import { badmintonSport } from './badminton.config.js';
import { pickleballSport } from './pickleball.config.js';
import { boxCricketSport } from './boxCricket.config.js';

export const DEFAULT_SPORT_ID = badmintonSport.id;

const KNOWN_SPORT_IDS = new Set([
  badmintonSport.id,
  pickleballSport.id,
  boxCricketSport.id,
]);

export const resolveSportId = (value) => {
  const normalized = String(value ?? '').trim();
  if (!normalized) return DEFAULT_SPORT_ID;
  return KNOWN_SPORT_IDS.has(normalized) ? normalized : DEFAULT_SPORT_ID;
};
