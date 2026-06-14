import { isBoxCricketCasualMatch } from '@fixture-maker/domain/sports';
import { webStorage } from '../platform/storage';
import { STORAGE_KEYS } from '../platform/storageKeys';
import { backfillCasualMatchesCompletedAt } from './appHelpers';

const listMatchKeys = (match = {}) => (
  [match.appwriteId, match.id, match.legacyMatchId]
    .map((value) => String(value || '').trim())
    .filter(Boolean)
);

const mergeTeam = (primary = {}, fallback = {}) => {
  if (!fallback || typeof fallback !== 'object') return primary;
  if (!primary || typeof primary !== 'object') return fallback;
  const primarySquad = Array.isArray(primary.squad) ? primary.squad : [];
  const fallbackSquad = Array.isArray(fallback.squad) ? fallback.squad : [];
  return {
    ...fallback,
    ...primary,
    squad: primarySquad.length > 0 ? primarySquad : fallbackSquad,
  };
};

export const mergeCasualMatchRecord = (primary = {}, fallback = null) => {
  if (!fallback) return primary;
  return {
    ...fallback,
    ...primary,
    sportId: primary.sportId || fallback.sportId,
    matchType: primary.matchType || fallback.matchType,
    statistics: primary.statistics || fallback.statistics,
    team1: mergeTeam(primary.team1, fallback.team1),
    team2: mergeTeam(primary.team2, fallback.team2),
    completed: primary.completed ?? fallback.completed,
    completedAt: primary.completedAt || fallback.completedAt,
  };
};

export const indexCasualMatchesById = (matches = []) => {
  const map = new Map();
  (Array.isArray(matches) ? matches : []).forEach((match) => {
    listMatchKeys(match).forEach((key) => {
      if (!map.has(key)) map.set(key, match);
    });
  });
  return map;
};

export const findCasualMatchAlias = (match = {}, index = new Map()) => {
  for (const key of listMatchKeys(match)) {
    if (index.has(key)) return index.get(key);
  }
  return null;
};

export const getLocalCasualMatchesBackup = () => (
  backfillCasualMatchesCompletedAt(
    webStorage.getJson(STORAGE_KEYS.CASUAL_MATCHES, []),
  ).matches
);

export const getCasualStatisticsBackupMap = () => {
  const raw = webStorage.getJson(STORAGE_KEYS.CASUAL_MATCH_STATISTICS, {});
  return raw && typeof raw === 'object' ? raw : {};
};

export const persistCasualMatchStatisticsBackup = (match = {}) => {
  const statistics = match?.statistics;
  if (!statistics || typeof statistics !== 'object') return;
  const map = getCasualStatisticsBackupMap();
  listMatchKeys(match).forEach((key) => {
    map[key] = statistics;
  });
  webStorage.setJson(STORAGE_KEYS.CASUAL_MATCH_STATISTICS, map);
};

export const removeCasualMatchStatisticsBackup = (matchOrId) => {
  const map = getCasualStatisticsBackupMap();
  const keys = typeof matchOrId === 'string'
    ? [String(matchOrId || '').trim()].filter(Boolean)
    : listMatchKeys(matchOrId);
  if (keys.length === 0) return;
  let changed = false;
  keys.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(map, key)) {
      delete map[key];
      changed = true;
    }
  });
  if (changed) {
    webStorage.setJson(STORAGE_KEYS.CASUAL_MATCH_STATISTICS, map);
  }
};

const attachStatisticsFromBackup = (match = {}, statsMap = {}) => {
  if (match?.statistics) return match;
  for (const key of listMatchKeys(match)) {
    const statistics = statsMap[key];
    if (statistics && typeof statistics === 'object') {
      return { ...match, statistics };
    }
  }
  return match;
};

export const enrichCasualMatches = (loadedMatches = []) => {
  const localMatches = getLocalCasualMatchesBackup();
  const statsMap = getCasualStatisticsBackupMap();
  const localIndex = indexCasualMatchesById(localMatches);

  const merged = (Array.isArray(loadedMatches) ? loadedMatches : []).map((match) => {
    const withLocal = mergeCasualMatchRecord(match, findCasualMatchAlias(match, localIndex));
    return attachStatisticsFromBackup(withLocal, statsMap);
  });

  const mergedKeys = new Set();
  merged.forEach((match) => {
    listMatchKeys(match).forEach((key) => mergedKeys.add(key));
  });

  localMatches.forEach((localMatch) => {
    const keys = listMatchKeys(localMatch);
    if (keys.some((key) => mergedKeys.has(key))) return;
    merged.push(attachStatisticsFromBackup(localMatch, statsMap));
    keys.forEach((key) => mergedKeys.add(key));
  });

  return merged;
};

export const hasViewableBoxCricketDetail = (match = {}) => (
  isBoxCricketCasualMatch(match) && Boolean(match?.statistics)
);

export const persistEnrichedCasualMatches = (matches = []) => {
  const enriched = enrichCasualMatches(matches);
  webStorage.setJson(STORAGE_KEYS.CASUAL_MATCHES, enriched);
  enriched.forEach((match) => persistCasualMatchStatisticsBackup(match));
  return enriched;
};
