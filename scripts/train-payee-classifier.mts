/**
 * Trains the payee → expense category classifier shipped in the app.
 *
 *   node scripts/train-payee-classifier.mts
 *
 * Generates labelled Indian payee names (brands, descriptive shop names,
 * people), trains a naive Bayes model on payeeFeatures, prints held-out
 * accuracy and writes src/domain/categories/payeeModel.json.
 */
import { writeFileSync } from 'node:fs';

import { payeeFeatures, scorePayee } from '../src/domain/categories/payeeFeatures.ts';

const UNKNOWN = '__unknown__';
/** Keep in sync with MIN_CONFIDENCE in payeeClassifier.ts. */
const MIN_CONFIDENCE = 0.6;

const BRANDS: Record<string, string[]> = {
  'Food and dining': ['swiggy', 'zomato', 'eatsure', 'dominos', 'pizza hut', 'kfc', 'mcdonalds', 'burger king', 'subway', 'starbucks', 'cafe coffee day', 'chaayos', 'haldirams', 'barbeque nation', 'behrouz biryani', 'faasos', 'box8', 'wow momo', 'paradise biryani', 'meghana foods', 'adyar ananda bhavan', 'saravana bhavan', 'bikanervala', 'theobroma', 'baskin robbins', 'naturals ice cream', 'third wave coffee', 'blue tokai', 'chai point', 'rebel foods', 'empire restaurant', 'truffles', 'taco bell', 'la pinoz', 'biryani blues'],
  Groceries: ['bigbasket', 'blinkit', 'zepto', 'instamart', 'dmart', 'avenue supermarts', 'jiomart', 'reliance fresh', 'reliance smart', 'more retail', 'spencers', 'natures basket', 'ratnadeep', 'star bazaar', 'spar hypermarket', 'licious', 'freshtohome', 'country delight', 'milkbasket', 'nandini milk', 'amul', 'heritage foods', 'vijetha supermarket', 'bb daily', 'dunzo daily', 'grofers', 'kpn fresh', 'big bazaar'],
  Transport: ['uber', 'ola', 'rapido', 'namma yatri', 'blusmart', 'indian oil', 'iocl', 'hpcl', 'bpcl', 'hindustan petroleum', 'bharat petroleum', 'shell', 'nayara energy', 'fastag', 'delhi metro', 'bmrcl', 'mumbai metro', 'ksrtc', 'tsrtc', 'apsrtc', 'msrtc', 'yulu', 'bounce', 'park plus', 'jio bp', 'quick ride'],
  Shopping: ['amazon', 'flipkart', 'myntra', 'ajio', 'meesho', 'nykaa', 'tata cliq', 'croma', 'reliance digital', 'reliance trends', 'decathlon', 'ikea', 'lenskart', 'firstcry', 'pantaloons', 'westside', 'lifestyle stores', 'max fashion', 'zudio', 'uniqlo', 'bata', 'puma', 'nike', 'adidas', 'tanishq', 'malabar gold', 'kalyan jewellers', 'pothys', 'chennai silks', 'vijay sales', 'sangeetha mobiles', 'poorvika mobiles', 'samsung', 'boat lifestyle', 'snapdeal', 'shoppers stop', 'titan', 'raymond', 'fabindia', 'pepperfry', 'urban ladder', 'mamaearth', 'purplle'],
  'Utilities and bills': ['airtel', 'jio', 'reliance jio', 'vodafone idea', 'bsnl', 'act fibernet', 'hathway', 'tata play', 'dish tv', 'sun direct', 'bescom', 'tneb', 'tangedco', 'msedcl', 'mahadiscom', 'tata power', 'adani electricity', 'bses', 'cesc', 'tsspdcl', 'apspdcl', 'kseb', 'indane gas', 'hp gas', 'bharat gas', 'mahanagar gas', 'igl', 'bwssb', 'hmwssb', 'delhi jal board', 'electricity bill', 'mobile recharge', 'excitel', 'you broadband'],
  Healthcare: ['apollo pharmacy', 'apollo hospitals', 'pharmeasy', 'tata 1mg', 'netmeds', 'medplus', 'wellness forever', 'practo', 'cult fit', 'healthifyme', 'dr lal pathlabs', 'thyrocare', 'metropolis healthcare', 'manipal hospitals', 'fortis', 'max healthcare', 'narayana health', 'aster dm', 'rainbow children hospital', 'truemeds', 'frank ross pharmacy', 'vasan eye care'],
  Entertainment: ['netflix', 'spotify', 'disney hotstar', 'jiocinema', 'jiohotstar', 'prime video', 'youtube premium', 'bookmyshow', 'pvr', 'inox', 'cinepolis', 'sonyliv', 'zee5', 'steam', 'playstation', 'apple music', 'gaana', 'wynk', 'district by zomato', 'paytm insider', 'timezone', 'wonderla', 'smaaash', 'aha video', 'sun nxt', 'dream11'],
  Education: ['udemy', 'coursera', 'byjus', 'unacademy', 'vedantu', 'physics wallah', 'upgrad', 'simplilearn', 'great learning', 'toppr', 'duolingo', 'sapna book house', 'aakash institute', 'allen career institute', 'fiitjee', 'khan academy', 'scaler academy'],
  Travel: ['makemytrip', 'goibibo', 'cleartrip', 'yatra', 'ixigo', 'easemytrip', 'irctc', 'indigo', 'interglobe aviation', 'air india', 'akasa air', 'spicejet', 'vistara', 'oyo rooms', 'airbnb', 'booking com', 'agoda', 'treebo hotels', 'fabhotels', 'redbus', 'abhibus', 'zoomcar', 'thomas cook', 'taj hotels', 'lemon tree hotels'],
  'Rent and housing': ['nobroker', 'nestaway', 'magicbricks', 'housing com', 'mygate', 'nobrokerhood', 'stanza living', 'zolo stays', 'colive', 'square yards', 'urban company', 'adda apartment'],
  'Loan interest and fees': ['bajaj finance', 'bajaj finserv', 'tata capital', 'muthoot finance', 'manappuram finance', 'home credit', 'kreditbee', 'moneyview', 'navi finserv', 'lazypay', 'simpl', 'slice', 'cred', 'sbi card', 'hdfc credit card', 'icici credit card', 'axis credit card', 'loan emi', 'hdb financial', 'l t finance', 'aditya birla finance', 'iifl finance'],
};

const KEYWORDS: Record<string, string[]> = {
  'Food and dining': ['tiffins', 'tiffin centre', 'tiffin center', 'hotel', 'restaurant', 'family restaurant', 'mess', 'biryani', 'biryani house', 'cafe', 'bakery', 'bakers', 'sweets', 'sweet house', 'juice centre', 'juice point', 'tea stall', 'chai', 'dhaba', 'bhojanalaya', 'idli', 'dosa corner', 'fast food', 'canteen', 'caterers', 'pure veg', 'kitchen', 'food court', 'chaat', 'pani puri', 'ice cream', 'coffee house', 'bar and restaurant', 'darshini', 'udupi', 'foods', 'eatery', 'grill', 'tandoor', 'pizzeria', 'momos', 'shawarma', 'food plaza', 'tea point', 'bhavan', 'meals'],
  Groceries: ['kirana', 'kirana store', 'provision store', 'provisions', 'general stores', 'general store', 'supermarket', 'super market', 'departmental store', 'vegetables', 'vegetable shop', 'fruits', 'fruit stall', 'dairy', 'milk centre', 'milk dairy', 'grocery', 'groceries', 'mart', 'fresh mart', 'chicken centre', 'chicken shop', 'mutton shop', 'fish market', 'meat shop', 'rice traders', 'oil stores', 'hypermarket', 'daily needs', 'fresh', 'organics', 'egg centre', 'flour mill'],
  Transport: ['petroleum', 'petrol pump', 'petrol bunk', 'fuels', 'fuel station', 'filling station', 'service station', 'auto', 'cab', 'cabs', 'taxi', 'parking', 'toll plaza', 'toll', 'metro rail', 'bus', 'tyres', 'motors', 'auto works', 'car wash', 'garage', 'two wheeler service', 'bike service', 'automobiles', 'car care', 'battery', 'puncture shop', 'cng station'],
  Shopping: ['textiles', 'garments', 'fashion', 'fashions', 'footwear', 'shoes', 'jewellers', 'jewellery', 'electronics', 'mobiles', 'mobile shop', 'mobile world', 'gift centre', 'gifts', 'furniture', 'hardware', 'sarees', 'silks', 'collections', 'boutique', 'opticals', 'optics', 'watch co', 'cosmetics', 'home needs', 'emporium', 'readymades', 'tailors', 'computers', 'appliances', 'bags', 'toys', 'sports', 'sports shop', 'paints', 'lifestyle', 'mens wear', 'kids wear', 'novelty'],
  'Utilities and bills': ['electricity board', 'power distribution', 'electricity', 'water supply', 'water works', 'gas agency', 'gas agencies', 'broadband', 'fibernet', 'cable network', 'cable tv', 'recharge', 'telecom', 'dth', 'municipal corporation', 'property tax', 'postpaid', 'prepaid', 'internet services', 'power', 'utility', 'bill payment'],
  Healthcare: ['medicals', 'medical store', 'medical hall', 'pharmacy', 'pharma', 'chemists', 'chemist', 'chemist and druggist', 'druggists', 'hospital', 'hospitals', 'clinic', 'diagnostics', 'diagnostic centre', 'labs', 'pathlabs', 'dental care', 'dental clinic', 'eye care', 'eye hospital', 'nursing home', 'health care', 'healthcare', 'physiotherapy', 'ayurveda', 'ayurvedic', 'homeo', 'homoeopathy', 'medico', 'multispeciality', 'polyclinic', 'scan centre', 'surgicals', 'medicines'],
  Entertainment: ['cinemas', 'cinema', 'theatre', 'theatres', 'multiplex', 'gaming zone', 'gaming', 'amusement park', 'club', 'bowling', 'music', 'events', 'water park', 'fun world', 'snooker', 'play zone', 'concerts', 'entertainment'],
  Education: ['school', 'public school', 'high school', 'college', 'academy', 'institute', 'coaching centre', 'coaching', 'tuitions', 'tuition centre', 'classes', 'university', 'vidyalaya', 'vidya mandir', 'book depot', 'book house', 'books', 'educational trust', 'education', 'learning centre', 'play school', 'montessori', 'kids school', 'stationery', 'stationers'],
  Travel: ['tours and travels', 'tours travels', 'travels', 'tours', 'holidays', 'resorts', 'resort', 'lodge', 'guest house', 'residency', 'inn', 'homestay', 'airways', 'airlines', 'travel agency', 'hotels and resorts', 'stays', 'tourism', 'boarding and lodging'],
  'Rent and housing': ['rent', 'house rent', 'rentals', 'estates', 'properties', 'apartment owners association', 'apartments', 'society', 'housing society', 'welfare association', 'maintenance', 'pg', 'paying guest', 'hostel', 'realty', 'builders', 'developers', 'flat maintenance', 'residents association'],
  'Loan interest and fees': ['finance', 'finserv', 'fincorp', 'capital', 'credit', 'loans', 'emi', 'credit card', 'card payment', 'microfinance', 'gold loan', 'chit fund', 'chits', 'fin', 'financial services', 'housing finance', 'nbfc'],
};

const PREFIXES = ['sri', 'shree', 'sree', 'shri', 'new', 'royal', 'balaji', 'ganesh', 'lakshmi', 'sai', 'krishna', 'venkateswara', 'annapurna', 'murugan', 'durga', 'om', 'jai', 'maa', 'raj', 'star', 'city', 'green', 'golden', 'kumar', 'modern', 'national', 'famous', 'delhi', 'mumbai', 'hyderabad', 'chennai', 'amma', 'janata', 'apna', 'sagar', 'krishna', 'vinayaka', 'hanuman', 'mahalakshmi', 'srinivasa', 'bharat', 'india', 'metro', 'deccan', 'kaveri', 'ganga', 'ashirwad', 'shiv', 'jagdamba', 'ambika', 'patel', 'gupta', 'agarwal', 'reddy', 'nair', 'singh'];

const SUFFIXES = ['', '', '', ' pvt ltd', ' private limited', ' ltd', ' and co', ' & sons', ' enterprises', ' india', ' llp'];

const FIRST_NAMES = ['rahul', 'priya', 'suresh', 'ramesh', 'anita', 'sunita', 'vijay', 'ajay', 'deepak', 'pooja', 'neha', 'amit', 'rohit', 'sanjay', 'kavita', 'arun', 'karthik', 'lakshmi', 'venkatesh', 'srinivas', 'mohammed', 'imran', 'fatima', 'joseph', 'mary', 'thomas', 'gurpreet', 'harpreet', 'manoj', 'rajesh', 'mahesh', 'naveen', 'praveen', 'divya', 'swathi', 'anil', 'sunil', 'ravi', 'kiran', 'sandeep', 'vikram', 'arjun', 'aditya', 'sneha', 'meena', 'geeta', 'ashok', 'prakash', 'santosh', 'ganesh', 'murali', 'balaji', 'cherit', 'sai', 'chandra', 'shankar', 'abdul', 'ayesha', 'farhan', 'nikhil'];
const LAST_NAMES = ['sharma', 'verma', 'gupta', 'singh', 'kumar', 'reddy', 'rao', 'naidu', 'nair', 'menon', 'pillai', 'iyer', 'iyengar', 'patel', 'shah', 'mehta', 'joshi', 'kulkarni', 'deshpande', 'patil', 'chopra', 'kapoor', 'khan', 'shaikh', 'ansari', 'das', 'banerjee', 'chatterjee', 'mukherjee', 'ghosh', 'bose', 'yadav', 'mishra', 'pandey', 'tiwari', 'agarwal', 'jain', 'goyal', 'thomas', 'fernandes', 'dsouza', 'babu', 'prasad', 'murthy', 'hegde', 'shetty', 'gowda', 'sai', 'krishnan', 'subramanian'];
const VAGUE = ['enterprises', 'traders', 'trading co', 'associates', 'agencies', 'solutions', 'services', 'industries', 'corporation', 'exports', 'infotech', 'ventures', 'global', 'group', 'technologies', 'consultants', 'company', 'impex', 'marketing', 'distributors', 'wholesale', 'merchants', 'business', 'payments', 'innovations', 'retail', 'online'];
const HANDLES = ['ybl', 'okaxis', 'oksbi', 'okhdfcbank', 'okicici', 'paytm', 'ibl', 'axl', 'upi'];

let seed = 42;
function random(): number {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
}
const pick = <T,>(items: readonly T[]): T => items[Math.floor(random() * items.length)];

function vary(name: string): string {
  const roll = random();
  if (roll < 0.15) {
    return `${name.replace(/[^a-z0-9]/g, '')}@${pick(HANDLES)}`;
  }
  const text = `${name}${pick(SUFFIXES)}`;
  return roll < 0.6 ? text.toUpperCase() : text.replace(/\b\w/g, ch => ch.toUpperCase());
}

function person(): string {
  const first = pick(FIRST_NAMES);
  const last = pick(LAST_NAMES);
  switch (Math.floor(random() * 6)) {
    case 0:
      return `${first[0]} ${last}`;
    case 1:
      return `${first} ${last[0]}`;
    case 2:
      return `mr ${first} ${last}`;
    case 3:
      return `${first} ${last} ${pick(LAST_NAMES)}`;
    case 4:
      return first;
    default:
      return `${first} ${last}`;
  }
}

function dataset(): [string, string][] {
  const rows: [string, string][] = [];
  for (const [category, brands] of Object.entries(BRANDS)) {
    for (const brand of brands) {
      for (let i = 0; i < 4; i++) {
        rows.push([vary(brand), category]);
      }
    }
  }
  for (const [category, keywords] of Object.entries(KEYWORDS)) {
    for (let i = 0; i < 260; i++) {
      const name = random() < 0.85 ? `${pick(PREFIXES)} ${pick(keywords)}` : pick(keywords);
      rows.push([vary(name), category]);
    }
  }
  for (let i = 0; i < 1800; i++) {
    rows.push([vary(person()), UNKNOWN]);
  }
  for (let i = 0; i < 900; i++) {
    rows.push([vary(`${pick(PREFIXES)} ${pick(VAGUE)}`), UNKNOWN]);
  }
  return rows;
}

interface Model {
  classes: string[];
  logPriors: number[];
  features: Record<string, number[]>;
}

function train(rows: [string, string][]): Model {
  const classes = [...new Set(rows.map(([, label]) => label))].sort();
  const classCounts = classes.map(() => 0);
  const featureTotals = classes.map(() => 0);
  const counts = new Map<string, number[]>();
  const documentFrequency = new Map<string, number>();
  for (const [text, label] of rows) {
    const c = classes.indexOf(label);
    classCounts[c] += 1;
    for (const feature of payeeFeatures(text).flat()) {
      documentFrequency.set(feature, (documentFrequency.get(feature) ?? 0) + 1);
      const perClass = counts.get(feature) ?? classes.map(() => 0);
      perClass[c] += 1;
      featureTotals[c] += 1;
      counts.set(feature, perClass);
    }
  }
  const vocabulary = [...counts.keys()].filter(feature => (documentFrequency.get(feature) ?? 0) >= 3);
  const alpha = 0.5;
  const features: Record<string, number[]> = {};
  for (const feature of vocabulary) {
    const perClass = counts.get(feature)!;
    const weights = perClass.map((count, c) =>
      Math.log((count + alpha) / (featureTotals[c] + alpha * vocabulary.length)),
    );
    // Features that barely differ between classes only add noise and size.
    if (Math.max(...weights) - Math.min(...weights) >= 1) {
      features[feature] = weights.map(w => Math.round(w * 100) / 100);
    }
  }
  const logPriors = classCounts.map(count => Math.round(Math.log(count / rows.length) * 100) / 100);
  return { classes, logPriors, features };
}

function predict(model: Model, text: string): { label: string; confidence: number } {
  const scores = scorePayee(text, model.logPriors, model.features);
  const best = scores.indexOf(Math.max(...scores));
  const total = scores.reduce((sum, s) => sum + Math.exp(s - scores[best]), 0);
  return { label: model.classes[best], confidence: 1 / total };
}

const rows = dataset();
for (let i = rows.length - 1; i > 0; i--) {
  const j = Math.floor(random() * (i + 1));
  [rows[i], rows[j]] = [rows[j], rows[i]];
}
const split = Math.floor(rows.length * 0.85);
const heldOut = rows.slice(split);
const trial = train(rows.slice(0, split));
let correct = 0;
let confident = 0;
let confidentCorrect = 0;
let wronglyAdded = 0;
for (const [text, label] of heldOut) {
  const { label: predicted, confidence } = predict(trial, text);
  correct += predicted === label ? 1 : 0;
  if (confidence >= MIN_CONFIDENCE && predicted !== UNKNOWN) {
    confident += 1;
    confidentCorrect += predicted === label ? 1 : 0;
    wronglyAdded += label === UNKNOWN ? 1 : 0;
  }
}
if (process.argv.includes('--verbose')) {
  for (const threshold of [0.4, 0.5, 0.6, 0.7, 0.8, 0.9]) {
    let added = 0;
    let wrong = 0;
    for (const [text, label] of heldOut) {
      const p = predict(trial, text);
      if (p.confidence >= threshold && p.label !== UNKNOWN) {
        added += 1;
        if (p.label !== label) {
          wrong += 1;
          if (threshold === MIN_CONFIDENCE) console.log(`  wrong: ${text} -> ${p.label} (${label})`);
        }
      }
    }
    console.log(`threshold ${threshold}: added ${added}, wrong ${wrong}`);
  }
}
console.log(`examples: ${rows.length}, held out: ${heldOut.length}`);
console.log(`accuracy: ${((correct / heldOut.length) * 100).toFixed(1)}%`);
console.log(
  `auto-added at >=${MIN_CONFIDENCE}: ${confident}, correct ${((confidentCorrect / confident) * 100).toFixed(1)}%, people/vague added: ${wronglyAdded}`,
);

const model = train(rows);
const json = JSON.stringify(model);
writeFileSync(new URL('../src/domain/categories/payeeModel.json', import.meta.url), `${json}\n`);
console.log(`features: ${Object.keys(model.features).length}, model size: ${(json.length / 1024).toFixed(0)} KB`);
