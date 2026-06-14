import { COLLECTIONS } from '../appwrite/client.js';
import {
  DEFAULT_GROUP_ID,
  IN_QUERY_LIMIT,
  TOURNAMENT_DELETED_STATUS,
  TOURNAMENT_DELETE_MODE,
} from './tournamentConstants';

const ensureV2Configured = () => {
  if (
    !COLLECTIONS.TOURNAMENTS_V2
    || !COLLECTIONS.TOURNAMENT_TEAMS_V2
    || !COLLECTIONS.MATCHES_V2
    || !COLLECTIONS.MATCH_PLAYERS_V2
  ) {
    throw new Error(
      'V2 tournament collections are not configured. Set VITE_APPWRITE_COLLECTION_V2_TOURNAMENTS, VITE_APPWRITE_COLLECTION_V2_TOURNAMENT_TEAMS, VITE_APPWRITE_COLLECTION_V2_MATCHES, and VITE_APPWRITE_COLLECTION_V2_MATCH_PLAYERS.'
    );
  }

  if (COLLECTIONS.TOURNAMENTS && COLLECTIONS.TOURNAMENTS_V2 === COLLECTIONS.TOURNAMENTS) {
    throw new Error(
      'Invalid Appwrite config: V2 tournaments collection points to legacy tournaments collection. Set VITE_APPWRITE_COLLECTION_V2_TOURNAMENTS to a separate normalized collection id (for example: v2_tournaments).'
    );
  }
};

const toGroupId = (groupId) => {
  const value = String(groupId || '').trim();
  return value || DEFAULT_GROUP_ID;
};

const toNonEmptyString = (value) => String(value ?? '').trim();
const normalizeName = (value) => toNonEmptyString(value).replace(/\s+/g, ' ').toLowerCase();
const isDeletedTournamentDoc = (doc) => (
  toNonEmptyString(doc?.status).toLowerCase() === TOURNAMENT_DELETED_STATUS
);
const shouldUseSoftTournamentDelete = () => TOURNAMENT_DELETE_MODE !== 'hard';

const toNumericString = (value) => {
  if (value === null || value === undefined || value === '') return '';
  const parsed = Number(value);
  if (Number.isFinite(parsed)) return String(parsed);
  return '';
};

const toBooleanString = (value) => String(Boolean(value));
const toTimestampMs = (value) => {
  const parsed = Date.parse(toNonEmptyString(value));
  return Number.isFinite(parsed) ? parsed : 0;
};

const pickFirstNonEmptyString = (...values) => (
  values.map((value) => toNonEmptyString(value)).find(Boolean) || ''
);

const resolveTournamentImmutableId = ({
  payload = null,
  existing = null,
  tournamentId = '',
} = {}) => pickFirstNonEmptyString(
  existing?.legacyTournamentId,
  existing?.$id,
  payload?.immutableTournamentId,
  payload?.legacyTournamentId,
  payload?.id,
  payload?.appwriteId,
  tournamentId
);

const resolveMatchImmutableId = ({
  match = null,
  existing = null,
  fallbackLegacyMatchId = '',
} = {}) => pickFirstNonEmptyString(
  existing?.legacyMatchId,
  existing?.$id,
  match?.immutableMatchId,
  match?.legacyMatchId,
  match?.id,
  match?.appwriteId,
  fallbackLegacyMatchId
);

const getTournamentOptimisticVersionValue = (entity = null) => pickFirstNonEmptyString(
  entity?.sourceUpdatedAt,
  entity?.updatedAt,
  entity?.$updatedAt,
  entity?.sourceCreatedAt,
  entity?.$createdAt
);

const getMatchOptimisticVersionValue = (entity = null) => pickFirstNonEmptyString(
  entity?.sourceUpdatedAt,
  entity?.migratedAt,
  entity?.updatedAt,
  entity?.completedAt,
  entity?.$updatedAt,
  entity?.sourceCreatedAt,
  entity?.$createdAt
);

const getTournamentOptimisticVersionMs = (entity = null) => toTimestampMs(
  getTournamentOptimisticVersionValue(entity)
);

const getMatchOptimisticVersionMs = (entity = null) => toTimestampMs(
  getMatchOptimisticVersionValue(entity)
);

const parseBoolean = (value) => {
  if (typeof value === 'boolean') return value;
  const normalized = toNonEmptyString(value).toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes';
};

const parseScore = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseMaybeNumeric = (value) => {
  const normalized = toNonEmptyString(value);
  if (!normalized) return '';
  const parsed = Number(normalized);
  if (Number.isFinite(parsed) && /^-?\d+(\.\d+)?$/.test(normalized)) {
    return parsed;
  }
  return normalized;
};

const normalizeComparable = (value) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

const chunk = (items, size = IN_QUERY_LIMIT) => {
  const source = Array.isArray(items) ? items : [];
  const result = [];
  for (let i = 0; i < source.length; i += size) {
    result.push(source.slice(i, i + size));
  }
  return result;
};

const uniqueDocuments = (docs = []) => {
  const byId = new Map();
  docs.forEach((doc) => {
    const id = String(doc?.$id || '').trim();
    if (!id) return;
    byId.set(id, doc);
  });
  return Array.from(byId.values());
};

const getWinnerSide = (score1, score2) => {
  if (score1 === '' || score2 === '') return '';
  const s1 = Number(score1);
  const s2 = Number(score2);
  if (!Number.isFinite(s1) || !Number.isFinite(s2) || s1 === s2) return '';
  return s1 > s2 ? '1' : '2';
};

const getMatchCompleted = (match, score1, score2) => {
  if (match?.completed === true) return true;
  if (score1 === '' || score2 === '') return false;
  const s1 = Number(score1);
  const s2 = Number(score2);
  return Number.isFinite(s1) && Number.isFinite(s2);
};

const getCompletedMatchWinner = (match) => {
  if (!match) return null;
  const score1 = parseScore(match?.score1);
  const score2 = parseScore(match?.score2);
  if (!getMatchCompleted(match, score1, score2)) return null;
  if (!Number.isFinite(score1) || !Number.isFinite(score2) || score1 === score2) return null;
  return score1 > score2 ? (match?.team1 || null) : (match?.team2 || null);
};

const inferTournamentChampionFromState = ({
  champion = null,
  finalMatch = null,
  bracket = [],
} = {}) => {
  if (champion) return champion;

  const finalWinner = getCompletedMatchWinner(finalMatch);
  if (finalWinner) return finalWinner;

  const finalRound = Array.isArray(bracket) && bracket.length > 0 ? bracket[bracket.length - 1] : [];
  const bracketFinal = Array.isArray(finalRound) && finalRound.length > 0 ? finalRound[0] : null;
  return getCompletedMatchWinner(bracketFinal);
};

const normalizeTournamentStatusValue = ({
  status,
  champion = null,
  finalMatch = null,
  bracket = [],
} = {}) => {
  const normalized = toNonEmptyString(status).toLowerCase();
  if (normalized === TOURNAMENT_DELETED_STATUS || normalized === 'scheduled') {
    return normalized;
  }
  if (inferTournamentChampionFromState({ champion, finalMatch, bracket })) {
    return 'completed';
  }
  if (normalized === 'completed') return 'completed';
  return normalized || 'active';
};

const collectPlayersFromTeam = (team) => (
  [team?.player || team?.player1, team?.player2]
    .map((name) => toNonEmptyString(name))
    .filter(Boolean)
);

const collectPlayersFromMatch = (match) => (
  [
    match?.team1?.player || match?.team1?.player1,
    match?.team1?.player2,
    match?.team2?.player || match?.team2?.player1,
    match?.team2?.player2,
  ]
    .map((name) => toNonEmptyString(name))
    .filter(Boolean)
);

const makeMatchNaturalKey = ({
  matchKind,
  legacyMatchId,
  bracketRoundIndex,
  bracketMatchIndex,
}) => {
  const kind = toNonEmptyString(matchKind).toLowerCase();
  const legacy = toNonEmptyString(legacyMatchId);
  const r = toNonEmptyString(bracketRoundIndex);
  const m = toNonEmptyString(bracketMatchIndex);
  return `${kind}|${legacy}|${r}|${m}`;
};

const normalizePatchMatchKind = (value, roundValue = '') => {
  const normalized = toNonEmptyString(value).toLowerCase();
  if (normalized === 'league' || normalized === 'knockout' || normalized === 'final') {
    return normalized;
  }
  const normalizedRound = toNonEmptyString(roundValue).toLowerCase();
  if (normalizedRound === 'final') return 'final';
  return 'league';
};

export {
  ensureV2Configured,
  toGroupId,
  toNonEmptyString,
  normalizeName,
  isDeletedTournamentDoc,
  shouldUseSoftTournamentDelete,
  toNumericString,
  toBooleanString,
  toTimestampMs,
  pickFirstNonEmptyString,
  resolveTournamentImmutableId,
  resolveMatchImmutableId,
  getTournamentOptimisticVersionValue,
  getMatchOptimisticVersionValue,
  getTournamentOptimisticVersionMs,
  getMatchOptimisticVersionMs,
  parseBoolean,
  parseScore,
  parseMaybeNumeric,
  normalizeComparable,
  chunk,
  uniqueDocuments,
  getWinnerSide,
  getMatchCompleted,
  getCompletedMatchWinner,
  inferTournamentChampionFromState,
  normalizeTournamentStatusValue,
  collectPlayersFromTeam,
  collectPlayersFromMatch,
  makeMatchNaturalKey,
  normalizePatchMatchKind,
};
