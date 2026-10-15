/**
 * Downloads real Indian payee names for the payee classifier:
 *
 * - businesses with their type from OpenStreetMap (Overpass API), per city
 *   (© OpenStreetMap contributors, ODbL)
 * - people's names from Wikidata (people with Indian citizenship, CC0)
 *
 *   node scripts/fetch-payee-data.mts
 *
 * Writes scripts/data/ (not committed); train-payee-classifier.mts uses it
 * when present. Cities already downloaded are skipped, so it can be re-run.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';

const DATA = new URL('./data/', import.meta.url);
const USER_AGENT = 'FinanceTrackerPayeeTraining/1.0 (personal finance app; one-off download)';
const OVERPASS = 'https://overpass-api.de/api/interpreter';
const WIKIDATA = 'https://query.wikidata.org/sparql';

/** south, west, north, east */
const CITIES: Record<string, [number, number, number, number]> = {
  bengaluru: [12.85, 77.45, 13.1, 77.75],
  chennai: [12.9, 80.12, 13.2, 80.32],
  hyderabad: [17.3, 78.35, 17.55, 78.6],
  mumbai: [18.9, 72.8, 19.25, 72.98],
  pune: [18.45, 73.75, 18.62, 73.95],
  delhi: [28.5, 77.05, 28.75, 77.32],
  kolkata: [22.48, 88.28, 22.65, 88.42],
  ahmedabad: [22.95, 72.5, 23.1, 72.65],
  jaipur: [26.8, 75.7, 26.98, 75.88],
  lucknow: [26.78, 80.88, 26.92, 81.02],
  kochi: [9.9, 76.22, 10.05, 76.35],
  coimbatore: [10.95, 76.9, 11.07, 77.03],
  visakhapatnam: [17.68, 83.18, 17.8, 83.35],
  chandigarh: [30.68, 76.7, 30.78, 76.83],
  indore: [22.65, 75.8, 22.78, 75.93],
  bhubaneswar: [20.22, 85.75, 20.35, 85.88],
  guwahati: [26.1, 91.65, 26.2, 91.82],
  patna: [25.57, 85.05, 25.65, 85.25],
};

/** Tags kept for labelling; the training script maps them to categories. */
const TAG_KEYS = ['amenity', 'shop', 'tourism', 'office', 'healthcare', 'leisure', 'building', 'craft'] as const;

/** Small queries per city; one big query tends to time out on the public server. */
const QUERY_PARTS = [
  'nwr["name"]["amenity"~"^(restaurant|fast_food|cafe|food_court|ice_cream|bar|pub)$"]',
  'nwr["name"]["amenity"~"^(fuel|parking|car_wash|charging_station|car_rental|pharmacy|hospital|clinic|doctors|dentist|veterinary|cinema|theatre|nightclub|arts_centre|school|college|university|kindergarten|language_school|driving_school|training|bank|atm|bureau_de_change)$"]',
  'nwr["name"]["shop"]',
  'nwr["name"]["tourism"~"^(hotel|guest_house|hostel|motel|resort|apartment)$"]',
  'nwr["name"]["office"~"^(company|financial|insurance|estate_agent|travel_agent|telecommunication|energy_supplier|it|consulting)$"]',
  'nwr["name"]["healthcare"]',
  'nwr["name"]["leisure"~"^(amusement_arcade|water_park|bowling_alley)$"]',
  'way["name"]["building"="apartments"]',
  'nwr["name"]["craft"~"^(tailor|caterer)$"]',
];

function overpassQuery(part: string, [s, w, n, e]: [number, number, number, number]): string {
  return `[out:json][timeout:120];${part}(${s},${w},${n},${e});out tags;`;
}

async function request(url: string, init: RequestInit, label: string): Promise<Response> {
  for (let attempt = 1; ; attempt++) {
    const response = await fetch(url, { ...init, headers: { 'User-Agent': USER_AGENT, ...init.headers } });
    if (response.ok) {
      return response;
    }
    if (attempt === 4 || ![429, 502, 503, 504].includes(response.status)) {
      throw new Error(`${label}: HTTP ${response.status}`);
    }
    const wait = 20 * attempt;
    console.log(`  ${label}: HTTP ${response.status}, retrying in ${wait}s`);
    await new Promise(resolve => setTimeout(resolve, wait * 1000));
  }
}

async function fetchCity(city: string, box: [number, number, number, number]): Promise<void> {
  const file = new URL(`osm-${city}.json`, DATA);
  if (existsSync(file)) {
    console.log(`${city}: already downloaded`);
    return;
  }
  const started = Date.now();
  const places: Record<string, string>[] = [];
  for (const [index, part] of QUERY_PARTS.entries()) {
    const label = `${city} ${index + 1}/${QUERY_PARTS.length}`;
    const response = await request(OVERPASS, { method: 'POST', body: new URLSearchParams({ data: overpassQuery(part, box) }) }, label);
    const { elements } = (await response.json()) as { elements: { tags: Record<string, string> }[] };
    for (const { tags } of elements) {
      const place: Record<string, string> = { name: tags['name:en'] ?? tags.name };
      for (const key of TAG_KEYS) {
        if (tags[key]) {
          place[key] = tags[key];
        }
      }
      places.push(place);
    }
    // Overpass asks clients to leave room for others between queries.
    await new Promise(resolve => setTimeout(resolve, 3_000));
  }
  writeFileSync(file, JSON.stringify(places));
  console.log(`${city}: ${places.length} places in ${Math.round((Date.now() - started) / 1000)}s`);
}

async function fetchPeople(): Promise<void> {
  const file = new URL('people.json', DATA);
  if (existsSync(file)) {
    console.log('people: already downloaded');
    return;
  }
  const names = new Set<string>();
  for (let offset = 0; offset < 240_000; offset += 80_000) {
    const query = `SELECT ?label WHERE { ?p wdt:P27 wd:Q668; wdt:P31 wd:Q5. ?p rdfs:label ?label FILTER(LANG(?label)="en") } LIMIT 80000 OFFSET ${offset}`;
    const response = await request(
      `${WIKIDATA}?${new URLSearchParams({ query })}`,
      { headers: { Accept: 'application/sparql-results+json' } },
      `people from ${offset}`,
    );
    const { results } = (await response.json()) as { results: { bindings: { label: { value: string } }[] } };
    for (const { label } of results.bindings) {
      names.add(label.value);
    }
    console.log(`people: ${names.size}`);
    if (results.bindings.length < 80_000) {
      break;
    }
  }
  writeFileSync(file, JSON.stringify([...names]));
}

mkdirSync(DATA, { recursive: true });
await fetchPeople();
for (const [city, box] of Object.entries(CITIES)) {
  try {
    await fetchCity(city, box);
  } catch (error) {
    console.log(`${city}: skipped (${(error as Error).message})`);
  }
}
