import { DEFAULT_SPORT_ID, resolveSportId } from '@fixture-maker/domain/sports';

const STORAGE_KEY = 'fixture-maker:last-sport-by-group';

const readMap = () => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const writeMap = (map) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Ignore quota / private mode errors.
  }
};

export const getLastSportForGroup = (groupId) => {
  const key = String(groupId || '').trim();
  if (!key) return DEFAULT_SPORT_ID;
  const map = readMap();
  return resolveSportId(map[key] || DEFAULT_SPORT_ID);
};

export const setLastSportForGroup = (groupId, sportId) => {
  const key = String(groupId || '').trim();
  if (!key) return;
  const map = readMap();
  map[key] = resolveSportId(sportId);
  writeMap(map);
};
