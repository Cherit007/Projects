import { databases, DATABASE_ID, COLLECTIONS, ID, Query } from '../appwrite.config';
import { z } from 'zod';

const DEFAULT_GROUP_ID = 'default-group';
const PAGE_SIZE = 100;
const IN_QUERY_LIMIT = 100;
const PLAYER_LOOKUP_CACHE_TTL_MS = 60 * 1000;
const CHILD_CACHE_TTL_MS = 2 * 60 * 1000;
const TOURNAMENT_DELETED_STATUS = 'deleted';
const TOURNAMENT_DELETE_MODE = String(
  import.meta.env.VITE_APPWRITE_TOURNAMENT_DELETE_MODE || 'soft'
).trim().toLowerCase();

const teamPayloadSchema = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  name: z.string().optional(),
  player: z.string().optional(),
  player1: z.string().optional(),
  player2: z.string().optional(),
}).passthrough();

const matchPatchSchema = z.object({
  matchKind: z.string().optional(),
  id: z.union([z.string(), z.number()]).optional(),
  legacyMatchId: z.union([z.string(), z.number()]).optional(),
  bracketRoundIndex: z.union([z.string(), z.number()]).optional(),
  bracketMatchIndex: z.union([z.string(), z.number()]).optional(),
  team1: teamPayloadSchema.nullish(),
  team2: teamPayloadSchema.nullish(),
  score1: z.union([z.string(), z.number(), z.null()]).optional(),
  score2: z.union([z.string(), z.number(), z.null()]).optional(),
  completed: z.union([z.boolean(), z.string(), z.number()]).optional(),
  completedAt: z.union([z.string(), z.number(), z.null()]).optional(),
  roundLabel: z.union([z.string(), z.number()]).optional(),
  round: z.union([z.string(), z.number()]).optional(),
  roundNo: z.union([z.string(), z.number()]).optional(),
  nextLegacyMatchId: z.union([z.string(), z.number()]).optional(),
  nextMatchId: z.union([z.string(), z.number()]).optional(),
}).passthrough();

const tournamentDocSchema = z.object({
  $id: z.string(),
  groupId: z.string().optional(),
  legacyTournamentId: z.union([z.string(), z.number()]).optional(),
  name: z.string().optional(),
  dateLabel: z.string().optional(),
  status: z.string().optional(),
  gameMode: z.string().optional(),
  tournamentFormat: z.string().optional(),
  format: z.string().optional(),
  oddPlayerEnabled: z.union([z.boolean(), z.string(), z.number()]).optional(),
  oddPlayerName: z.string().optional(),
  sourceCreatedAt: z.string().optional(),
  sourceUpdatedAt: z.string().optional(),
  $createdAt: z.string().optional(),
  $updatedAt: z.string().optional(),
}).passthrough();

const tournamentTeamDocSchema = z.object({
  $id: z.string(),
  legacyTeamId: z.union([z.string(), z.number()]).optional(),
  teamNo: z.union([z.string(), z.number()]).optional(),
  teamName: z.string().optional(),
  emoji: z.string().optional(),
  player1Name: z.string().optional(),
  player2Name: z.string().optional(),
}).passthrough();

const tournamentMatchDocSchema = z.object({
  $id: z.string(),
  legacyMatchId: z.union([z.string(), z.number()]).optional(),
  matchKind: z.string().optional(),
  roundLabel: z.union([z.string(), z.number()]).optional(),
  roundNo: z.union([z.string(), z.number()]).optional(),
  sequenceNo: z.union([z.string(), z.number()]).optional(),
  bracketRoundIndex: z.union([z.string(), z.number()]).optional(),
  bracketMatchIndex: z.union([z.string(), z.number()]).optional(),
  nextLegacyMatchId: z.union([z.string(), z.number()]).optional(),
  team1Id: z.string().optional(),
  team2Id: z.string().optional(),
  team1Name: z.string().optional(),
  team2Name: z.string().optional(),
  score1: z.union([z.string(), z.number(), z.null()]).optional(),
  score2: z.union([z.string(), z.number(), z.null()]).optional(),
  completed: z.union([z.boolean(), z.string(), z.number()]).optional(),
  completedAt: z.string().optional(),
  winnerSide: z.string().optional(),
}).passthrough();

const matchParticipantDocSchema = z.object({
  $id: z.string(),
  matchId: z.string().optional(),
  sideNo: z.union([z.string(), z.number()]).optional(),
  slotNo: z.union([z.string(), z.number()]).optional(),
  playerName: z.string().optional(),
}).passthrough();

const playerLookupCache = new Map();
const tournamentChildrenCache = new Map();
const missingIndexCache = new Set();

const parseWithSchema = (schema, value, context, fallback) => {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  console.warn(`Invalid ${context} payload detected. Falling back to safe value.`, result.error.flatten());
  return fallback;
};

const normalizeDocList = (docs, schema, context) => (
  (Array.isArray(docs) ? docs : [])
    .map((doc) => parseWithSchema(
      schema,
      doc,
      context,
      doc && typeof doc === 'object' ? doc : null
    ))
    .filter(Boolean)
);

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

const childCacheKey = (groupId, tournamentId) => `${groupId}::${tournamentId}`;

const cloneDocs = (docs = []) => docs.map((doc) => ({ ...doc }));

const getFreshPlayerLookupCache = (groupId) => {
  const cached = playerLookupCache.get(groupId);
  if (!cached) return null;
  if (Date.now() - cached.cachedAt > PLAYER_LOOKUP_CACHE_TTL_MS) return null;
  return new Map(cached.byNormalized);
};

const setPlayerLookupCache = (groupId, byNormalized) => {
  playerLookupCache.set(groupId, {
    byNormalized: new Map(byNormalized),
    cachedAt: Date.now(),
  });
};

const getFreshTournamentChildrenCache = (groupId, tournamentId) => {
  const key = childCacheKey(groupId, tournamentId);
  const cached = tournamentChildrenCache.get(key);
  if (!cached) return null;
  if (Date.now() - cached.cachedAt > CHILD_CACHE_TTL_MS) return null;
  return {
    teamRows: cloneDocs(cached.teamRows),
    matchRows: cloneDocs(cached.matchRows),
    participantRows: cloneDocs(cached.participantRows),
  };
};

const setTournamentChildrenCache = (groupId, tournamentId, {
  teamRows = [],
  matchRows = [],
  participantRows = [],
}) => {
  tournamentChildrenCache.set(childCacheKey(groupId, tournamentId), {
    teamRows: cloneDocs(teamRows),
    matchRows: cloneDocs(matchRows),
    participantRows: cloneDocs(participantRows),
    cachedAt: Date.now(),
  });
};

const clearTournamentChildrenCache = (groupId, tournamentId) => {
  tournamentChildrenCache.delete(childCacheKey(groupId, tournamentId));
};

const isIndexConstraintError = (error) => {
  const message = String(error?.message || '').toLowerCase();
  return error?.code === 400
    && (
      message.includes('index')
      || message.includes('attribute not found in schema')
    );
};

const indexCacheKey = (collectionId, scope) => `${collectionId}::${scope}`;
const hasMissingIndex = (collectionId, scope) => missingIndexCache.has(indexCacheKey(collectionId, scope));
const markMissingIndex = (collectionId, scope) => {
  missingIndexCache.add(indexCacheKey(collectionId, scope));
};

const listDocumentsPaged = async (collectionId, baseQueries = []) => {
  const docs = [];
  let cursor = null;

  while (true) {
    const queries = [
      ...baseQueries,
      Query.orderAsc('$id'),
      Query.limit(PAGE_SIZE),
      ...(cursor ? [Query.cursorAfter(cursor)] : []),
    ];
    const response = await databases.listDocuments(DATABASE_ID, collectionId, queries);
    const page = response?.documents || [];

    if (page.length === 0) break;
    docs.push(...page);
    if (page.length < PAGE_SIZE) break;
    cursor = page[page.length - 1].$id;
  }

  return docs;
};

const listByGroup = async (collectionId, groupId) => {
  const groupIndexScope = 'groupId';
  if (!hasMissingIndex(collectionId, groupIndexScope)) {
    try {
      return await listDocumentsPaged(collectionId, [Query.equal('groupId', groupId)]);
    } catch (error) {
      if (!isIndexConstraintError(error)) throw error;
      markMissingIndex(collectionId, groupIndexScope);
    }
  }
  const unfiltered = await listDocumentsPaged(collectionId);
  return unfiltered.filter((doc) => toNonEmptyString(doc?.groupId) === groupId);
};

const listByGroupAndValues = async ({ collectionId, groupId, key, values }) => {
  const normalizedValues = Array.from(
    new Set((Array.isArray(values) ? values : []).map((value) => toNonEmptyString(value)).filter(Boolean))
  );

  if (normalizedValues.length === 0) return [];

  const groups = chunk(normalizedValues, IN_QUERY_LIMIT);
  const all = [];

  const groupAndValueScope = `groupId+${key}`;
  if (!hasMissingIndex(collectionId, groupAndValueScope)) {
    try {
      for (const set of groups) {
        const page = await listDocumentsPaged(collectionId, [
          Query.equal('groupId', groupId),
          Query.equal(key, set),
        ]);
        all.push(...page);
      }
      return uniqueDocuments(all);
    } catch (error) {
      if (!isIndexConstraintError(error)) throw error;
      markMissingIndex(collectionId, groupAndValueScope);
    }
  }

  const valueOnlyScope = key;
  if (!hasMissingIndex(collectionId, valueOnlyScope)) {
    try {
      for (const set of groups) {
        const page = await listDocumentsPaged(collectionId, [
          Query.equal(key, set),
        ]);
        all.push(...page);
      }
      return uniqueDocuments(all).filter((doc) => toNonEmptyString(doc?.groupId) === groupId);
    } catch (error) {
      if (!isIndexConstraintError(error)) throw error;
      markMissingIndex(collectionId, valueOnlyScope);
    }
  }

  const byGroup = await listByGroup(collectionId, groupId);
  const allowed = new Set(normalizedValues);
  return byGroup.filter((doc) => allowed.has(toNonEmptyString(doc?.[key])));
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

const ensurePlayersExist = async ({ groupId, names = [], source = 'runtime.tournament' }) => {
  if (!COLLECTIONS.PLAYERS_V2) return new Map();
  const requested = Array.from(
    new Set((Array.isArray(names) ? names : []).map((name) => normalizeName(name)).filter(Boolean))
  );
  if (requested.length === 0) {
    return getFreshPlayerLookupCache(groupId) || new Map();
  }

  let byNormalized = getFreshPlayerLookupCache(groupId);
  if (!byNormalized) {
    const existing = await listByGroup(COLLECTIONS.PLAYERS_V2, groupId);
    byNormalized = new Map();
    existing.forEach((doc) => {
      const normalized = normalizeName(doc?.normalizedName || doc?.displayName);
      if (normalized) byNormalized.set(normalized, doc);
    });
  }

  // One refresh when requested names are not present in cache; this avoids stale-cache misses.
  const missingFromCache = requested.filter((normalized) => !byNormalized.has(normalized));
  if (missingFromCache.length > 0) {
    const existing = await listByGroup(COLLECTIONS.PLAYERS_V2, groupId);
    byNormalized = new Map();
    existing.forEach((doc) => {
      const normalized = normalizeName(doc?.normalizedName || doc?.displayName);
      if (normalized) byNormalized.set(normalized, doc);
    });
  }

  const now = new Date().toISOString();
  for (const rawName of names) {
    const displayName = toNonEmptyString(rawName);
    const normalized = normalizeName(displayName);
    if (!normalized || byNormalized.has(normalized)) continue;

    // eslint-disable-next-line no-await-in-loop
    const created = await databases.createDocument(
      DATABASE_ID,
      COLLECTIONS.PLAYERS_V2,
      ID.unique(),
      {
        groupId,
        displayName,
        normalizedName: normalized,
        source,
        migratedAt: now,
      }
    );

    byNormalized.set(normalized, created);
  }

  setPlayerLookupCache(groupId, byNormalized);
  return byNormalized;
};

const resolvePlayerId = (playerName, playerByNormalized) => {
  const normalized = normalizeName(playerName);
  if (!normalized) return '';
  return toNonEmptyString(playerByNormalized.get(normalized)?.$id);
};

const parseTeamDocument = (doc) => {
  const id = toNonEmptyString(doc?.legacyTeamId) || toNonEmptyString(doc?.teamNo) || toNonEmptyString(doc?.$id);
  const player1 = toNonEmptyString(doc?.player1Name);
  const player2 = toNonEmptyString(doc?.player2Name);
  return {
    id,
    name: toNonEmptyString(doc?.teamName) || `Team ${toNonEmptyString(doc?.teamNo) || '?'}`,
    emoji: toNonEmptyString(doc?.emoji) || '🏸',
    player1,
    player: player1,
    player2,
  };
};

const buildTeamForMatch = ({
  rowTeamId,
  rowTeamName,
  sidePlayers,
  mappedTeam,
}) => {
  const player1 = toNonEmptyString(sidePlayers[0] || mappedTeam?.player || mappedTeam?.player1);
  const player2 = toNonEmptyString(sidePlayers[1] || mappedTeam?.player2);
  const fallbackName = toNonEmptyString(rowTeamName)
    || toNonEmptyString(mappedTeam?.name)
    || [player1, player2].filter(Boolean).join(' & ')
    || 'Team';

  const id = toNonEmptyString(mappedTeam?.id)
    || toNonEmptyString(rowTeamId)
    || fallbackName;

  return {
    id,
    name: fallbackName,
    emoji: toNonEmptyString(mappedTeam?.emoji) || '🏸',
    player1,
    player: player1,
    player2,
  };
};

const parseMatchDocument = ({ doc, teamByRowId, participantsByMatchId }) => {
  const participantRows = participantsByMatchId.get(doc.$id) || [];
  const side1 = participantRows
    .filter((row) => toNonEmptyString(row.sideNo) === '1')
    .sort((a, b) => Number(a.slotNo || 0) - Number(b.slotNo || 0));
  const side2 = participantRows
    .filter((row) => toNonEmptyString(row.sideNo) === '2')
    .sort((a, b) => Number(a.slotNo || 0) - Number(b.slotNo || 0));

  const team1 = buildTeamForMatch({
    rowTeamId: doc.team1Id,
    rowTeamName: doc.team1Name,
    sidePlayers: side1.map((row) => row.playerName),
    mappedTeam: teamByRowId.get(toNonEmptyString(doc.team1Id)),
  });

  const team2 = buildTeamForMatch({
    rowTeamId: doc.team2Id,
    rowTeamName: doc.team2Name,
    sidePlayers: side2.map((row) => row.playerName),
    mappedTeam: teamByRowId.get(toNonEmptyString(doc.team2Id)),
  });

  const score1 = parseScore(doc.score1);
  const score2 = parseScore(doc.score2);

  return {
    id: parseMaybeNumeric(doc.legacyMatchId) || toNonEmptyString(doc.$id),
    team1,
    team2,
    score1,
    score2,
    completed: parseBoolean(doc.completed),
    completedAt: toNonEmptyString(doc.completedAt),
    round: parseMaybeNumeric(doc.roundNo || doc.roundLabel),
    nextMatchId: parseMaybeNumeric(doc.nextLegacyMatchId),
    upsetAlert: null,
    preMatchPrediction: null,
  };
};

const sortMatchesBySequence = (a, b) => {
  const aSeq = Number(a?.sequenceNo || 0);
  const bSeq = Number(b?.sequenceNo || 0);
  if (Number.isFinite(aSeq) && Number.isFinite(bSeq) && aSeq !== bSeq) return aSeq - bSeq;
  return toNonEmptyString(a?.$id).localeCompare(toNonEmptyString(b?.$id));
};

const hydrateTournament = ({ tournamentDoc, teamDocs = [], matchDocs = [], matchPlayerDocs = [] }) => {
  const safeTournamentDoc = parseWithSchema(
    tournamentDocSchema,
    tournamentDoc,
    'tournament document',
    tournamentDoc && typeof tournamentDoc === 'object' ? tournamentDoc : {}
  );
  const normalizedTeamDocs = normalizeDocList(teamDocs, tournamentTeamDocSchema, 'tournament team document');
  const normalizedMatchDocs = normalizeDocList(matchDocs, tournamentMatchDocSchema, 'tournament match document');
  const normalizedMatchPlayerDocs = normalizeDocList(
    matchPlayerDocs,
    matchParticipantDocSchema,
    'match participant document'
  );

  const sortedTeamDocs = [...normalizedTeamDocs].sort((a, b) => {
    const aNo = Number(a.teamNo || 0);
    const bNo = Number(b.teamNo || 0);
    if (Number.isFinite(aNo) && Number.isFinite(bNo) && aNo !== bNo) return aNo - bNo;
    return toNonEmptyString(a.$id).localeCompare(toNonEmptyString(b.$id));
  });

  const teams = sortedTeamDocs.map(parseTeamDocument);
  const teamByRowId = new Map();
  sortedTeamDocs.forEach((doc, index) => {
    teamByRowId.set(toNonEmptyString(doc.$id), teams[index]);
  });

  const participantsByMatchId = new Map();
  normalizedMatchPlayerDocs.forEach((row) => {
    const matchId = toNonEmptyString(row.matchId);
    if (!matchId) return;
    const bucket = participantsByMatchId.get(matchId) || [];
    bucket.push(row);
    participantsByMatchId.set(matchId, bucket);
  });

  const fixtures = [];
  const bracketByRound = new Map();
  let finalMatch = null;

  const sortedMatches = [...normalizedMatchDocs].sort(sortMatchesBySequence);

  sortedMatches.forEach((row) => {
    const parsed = parseMatchDocument({
      doc: row,
      teamByRowId,
      participantsByMatchId,
    });

    const kind = toNonEmptyString(row.matchKind).toLowerCase();
    const bracketRound = toNonEmptyString(row.bracketRoundIndex);

    if (kind === 'league') {
      fixtures.push(parsed);
      return;
    }

    if (kind === 'knockout' || (kind === 'final' && bracketRound)) {
      const roundIndex = Number(bracketRound || 0);
      const roundKey = Number.isFinite(roundIndex) && roundIndex > 0 ? roundIndex : 1;
      const bucket = bracketByRound.get(roundKey) || [];
      bucket.push({
        row,
        parsed,
      });
      bracketByRound.set(roundKey, bucket);
      return;
    }

    if (kind === 'final') {
      finalMatch = parsed;
    }
  });

  const bracket = Array.from(bracketByRound.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([, roundMatches]) => (
      [...roundMatches]
        .sort((a, b) => {
          const aIndex = Number(a.row?.bracketMatchIndex || a.row?.sequenceNo || 0);
          const bIndex = Number(b.row?.bracketMatchIndex || b.row?.sequenceNo || 0);
          if (Number.isFinite(aIndex) && Number.isFinite(bIndex) && aIndex !== bIndex) return aIndex - bIndex;
          return toNonEmptyString(a.row?.$id).localeCompare(toNonEmptyString(b.row?.$id));
        })
        .map((entry) => entry.parsed)
    ));

  const findChampion = () => {
    if (finalMatch?.completed) {
      if (finalMatch.score1 > finalMatch.score2) return finalMatch.team1;
      if (finalMatch.score2 > finalMatch.score1) return finalMatch.team2;
    }

    const finalRound = bracket.length > 0 ? bracket[bracket.length - 1] : [];
    const bracketFinal = finalRound.length > 0 ? finalRound[0] : null;
    if (bracketFinal?.completed) {
      if (bracketFinal.score1 > bracketFinal.score2) return bracketFinal.team1;
      if (bracketFinal.score2 > bracketFinal.score1) return bracketFinal.team2;
    }

    return null;
  };

  const champion = toNonEmptyString(safeTournamentDoc?.status).toLowerCase() === 'completed'
    ? findChampion()
    : null;

  return {
    id: safeTournamentDoc.$id,
    appwriteId: safeTournamentDoc.$id,
    groupId: safeTournamentDoc.groupId,
    legacyTournamentId: safeTournamentDoc.legacyTournamentId,
    name: safeTournamentDoc.name,
    date: safeTournamentDoc.dateLabel,
    teams,
    fixtures,
    bracket,
    finalMatch,
    champion,
    aiSummaries: [],
    swapHistory: [],
    format: safeTournamentDoc.format || '1',
    gameMode: safeTournamentDoc.gameMode || 'doubles',
    tournamentFormat: safeTournamentDoc.tournamentFormat || 'league',
    status: safeTournamentDoc.status || (champion ? 'completed' : 'active'),
    oddPlayerEnabled: parseBoolean(safeTournamentDoc.oddPlayerEnabled),
    oddPlayerName: toNonEmptyString(safeTournamentDoc.oddPlayerName),
    createdAt: safeTournamentDoc.sourceCreatedAt || safeTournamentDoc.$createdAt,
    updatedAt: safeTournamentDoc.sourceUpdatedAt || safeTournamentDoc.$updatedAt,
  };
};

const buildTournamentDocument = ({
  tournamentId,
  groupId,
  payload,
  existing,
  playerByNormalized,
}) => {
  const now = new Date().toISOString();
  const oddPlayerName = toNonEmptyString(payload.oddPlayerName ?? existing?.oddPlayerName);
  const resolvedOddPlayerId = resolvePlayerId(oddPlayerName, playerByNormalized);

  return {
    groupId,
    legacyTournamentId: toNonEmptyString(existing?.legacyTournamentId)
      || toNonEmptyString(payload.legacyTournamentId)
      || toNonEmptyString(payload.id)
      || tournamentId,
    name: toNonEmptyString(payload.name) || toNonEmptyString(existing?.name) || 'Untitled Tournament',
    dateLabel: toNonEmptyString(payload.date) || toNonEmptyString(existing?.dateLabel),
    status: toNonEmptyString(payload.status) || toNonEmptyString(existing?.status) || 'active',
    gameMode: toNonEmptyString(payload.gameMode) || toNonEmptyString(existing?.gameMode) || 'doubles',
    tournamentFormat: toNonEmptyString(payload.tournamentFormat) || toNonEmptyString(existing?.tournamentFormat) || 'league',
    format: toNonEmptyString(payload.format) || toNonEmptyString(existing?.format) || '1',
    oddPlayerEnabled: toBooleanString(payload.oddPlayerEnabled ?? parseBoolean(existing?.oddPlayerEnabled)),
    oddPlayerName,
    oddPlayerId: resolvedOddPlayerId || toNonEmptyString(existing?.oddPlayerId),
    sourceCreatedAt: toNonEmptyString(existing?.sourceCreatedAt) || now,
    sourceUpdatedAt: now,
    migratedAt: now,
  };
};

const buildTeamRows = ({
  groupId,
  tournamentId,
  legacyTournamentId,
  teams,
  playerByNormalized,
  existingTeamRows,
}) => {
  const existingByLegacyTeamId = new Map();
  existingTeamRows.forEach((row) => {
    const legacyTeamId = toNonEmptyString(row.legacyTeamId);
    if (!legacyTeamId || existingByLegacyTeamId.has(legacyTeamId)) return;
    existingByLegacyTeamId.set(legacyTeamId, row);
  });

  const rows = [];
  const teamRowIdByLegacyId = new Map();
  const teamRowIdByName = new Map();
  const now = new Date().toISOString();

  (Array.isArray(teams) ? teams : []).forEach((team, index) => {
    const legacyTeamId = toNonEmptyString(team?.id) || String(index + 1);
    const existing = existingByLegacyTeamId.get(legacyTeamId);
    const id = toNonEmptyString(existing?.$id) || ID.unique();
    const teamName = toNonEmptyString(team?.name) || `Team ${index + 1}`;
    const player1Name = toNonEmptyString(team?.player || team?.player1);
    const player2Name = toNonEmptyString(team?.player2);

    rows.push({
      id,
      data: {
        groupId,
        tournamentId,
        legacyTournamentId,
        legacyTeamId,
        teamNo: String(index + 1),
        teamName,
        emoji: toNonEmptyString(team?.emoji) || '🏸',
        player1Name,
        player1Id: resolvePlayerId(player1Name, playerByNormalized),
        player2Name,
        player2Id: resolvePlayerId(player2Name, playerByNormalized),
        migratedAt: now,
      },
    });

    teamRowIdByLegacyId.set(legacyTeamId, id);
    const normalizedName = normalizeName(teamName);
    if (normalizedName) teamRowIdByName.set(normalizedName, id);
  });

  return {
    rows,
    teamRowIdByLegacyId,
    teamRowIdByName,
  };
};

const buildMatchAndParticipantRows = ({
  groupId,
  tournamentId,
  legacyTournamentId,
  fixtures,
  bracket,
  finalMatch,
  playerByNormalized,
  teamRowIdByLegacyId,
  teamRowIdByName,
  existingMatchRows,
  existingParticipantsByMatchId,
}) => {
  const existingMatchByNaturalKey = new Map();
  existingMatchRows.forEach((row) => {
    const key = makeMatchNaturalKey({
      matchKind: row.matchKind,
      legacyMatchId: row.legacyMatchId,
      bracketRoundIndex: row.bracketRoundIndex,
      bracketMatchIndex: row.bracketMatchIndex,
    });
    if (!existingMatchByNaturalKey.has(key)) existingMatchByNaturalKey.set(key, row);
  });

  const matchRows = [];
  const participantRows = [];
  const seenMatchKeys = new Set();
  const now = new Date().toISOString();

  const resolveTeamRowId = (team) => {
    const teamLegacyId = toNonEmptyString(team?.id);
    if (teamLegacyId && teamRowIdByLegacyId.has(teamLegacyId)) {
      return teamRowIdByLegacyId.get(teamLegacyId) || '';
    }

    const normalizedTeamName = normalizeName(team?.name);
    if (normalizedTeamName && teamRowIdByName.has(normalizedTeamName)) {
      return teamRowIdByName.get(normalizedTeamName) || '';
    }

    return '';
  };

  const appendMatch = ({
    match,
    matchKind,
    sequenceNo,
    bracketRoundIndex,
    bracketMatchIndex,
    fallbackLegacyMatchId,
  }) => {
    if (!match?.team1 && !match?.team2) return;

    const legacyMatchId = toNonEmptyString(match?.id) || fallbackLegacyMatchId;
    const roundLabel = toNonEmptyString(match?.round);
    const roundNo = toNonEmptyString(match?.round);
    const sequenceValue = toNonEmptyString(sequenceNo);
    const bracketRoundValue = toNonEmptyString(bracketRoundIndex);
    const bracketMatchValue = toNonEmptyString(bracketMatchIndex);
    const naturalKey = makeMatchNaturalKey({
      matchKind,
      legacyMatchId,
      bracketRoundIndex: bracketRoundValue,
      bracketMatchIndex: bracketMatchValue,
    });

    if (seenMatchKeys.has(naturalKey)) return;
    seenMatchKeys.add(naturalKey);

    const existing = existingMatchByNaturalKey.get(naturalKey);
    const id = toNonEmptyString(existing?.$id) || ID.unique();
    const score1 = toNumericString(match?.score1);
    const score2 = toNumericString(match?.score2);

    const completedValue = getMatchCompleted(match, score1, score2);
    const completedAt = completedValue
      ? (toNonEmptyString(match?.completedAt) || toNonEmptyString(existing?.completedAt))
      : '';

    matchRows.push({
      id,
      data: {
        groupId,
        tournamentId,
        legacyTournamentId,
        legacyMatchId,
        matchKind,
        roundLabel,
        roundNo,
        sequenceNo: sequenceValue,
        bracketRoundIndex: bracketRoundValue,
        bracketMatchIndex: bracketMatchValue,
        nextLegacyMatchId: toNonEmptyString(match?.nextMatchId),
        team1Id: resolveTeamRowId(match?.team1),
        team2Id: resolveTeamRowId(match?.team2),
        team1Name: toNonEmptyString(match?.team1?.name),
        team2Name: toNonEmptyString(match?.team2?.name),
        score1,
        score2,
        completed: toBooleanString(completedValue),
        completedAt,
        winnerSide: getWinnerSide(score1, score2),
        sourceCreatedAt: toNonEmptyString(existing?.sourceCreatedAt) || now,
        migratedAt: now,
      },
    });

    const existingParticipants = existingParticipantsByMatchId.get(id) || [];
    const existingParticipantBySlot = new Map();
    existingParticipants.forEach((row) => {
      const slotKey = `${toNonEmptyString(row.sideNo)}|${toNonEmptyString(row.slotNo)}`;
      if (!slotKey || existingParticipantBySlot.has(slotKey)) return;
      existingParticipantBySlot.set(slotKey, row);
    });

    const addParticipant = (sideNo, slotNo, rawPlayerName) => {
      const playerName = toNonEmptyString(rawPlayerName);
      if (!playerName) return;

      const slotKey = `${sideNo}|${slotNo}`;
      const existingParticipant = existingParticipantBySlot.get(slotKey);
      participantRows.push({
        id: toNonEmptyString(existingParticipant?.$id) || ID.unique(),
        data: {
          groupId,
          matchId: id,
          sideNo: String(sideNo),
          slotNo: String(slotNo),
          playerName,
          playerId: resolvePlayerId(playerName, playerByNormalized),
          sourceCreatedAt: toNonEmptyString(existingParticipant?.sourceCreatedAt) || now,
          migratedAt: now,
        },
      });
    };

    addParticipant(1, 1, match?.team1?.player || match?.team1?.player1);
    addParticipant(1, 2, match?.team1?.player2);
    addParticipant(2, 1, match?.team2?.player || match?.team2?.player1);
    addParticipant(2, 2, match?.team2?.player2);
  };

  (Array.isArray(fixtures) ? fixtures : []).forEach((match, index) => {
    appendMatch({
      match,
      matchKind: 'league',
      sequenceNo: index + 1,
      bracketRoundIndex: '',
      bracketMatchIndex: '',
      fallbackLegacyMatchId: `fixture-${index + 1}`,
    });
  });

  (Array.isArray(bracket) ? bracket : []).forEach((round, roundIndex) => {
    (Array.isArray(round) ? round : []).forEach((match, matchIndex) => {
      const roundLabel = toNonEmptyString(match?.round).toLowerCase();
      appendMatch({
        match,
        matchKind: roundLabel === 'final' ? 'final' : 'knockout',
        sequenceNo: matchIndex + 1,
        bracketRoundIndex: roundIndex + 1,
        bracketMatchIndex: matchIndex + 1,
        fallbackLegacyMatchId: `bracket-${roundIndex + 1}-${matchIndex + 1}`,
      });
    });
  });

  if (finalMatch) {
    appendMatch({
      match: finalMatch,
      matchKind: 'final',
      sequenceNo: 1,
      bracketRoundIndex: '',
      bracketMatchIndex: '',
      fallbackLegacyMatchId: 'final',
    });
  }

  return {
    matchRows,
    participantRows,
  };
};

const upsertRows = async (collectionId, rows = []) => {
  const TIMESTAMP_KEYS = new Set(['sourceUpdatedAt', 'migratedAt']);
  const normalizeComparable = (value) => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };
  const isRowDataEqual = (existingDoc, nextData) => {
    if (!existingDoc) return false;
    const keys = Object.keys(nextData || {}).filter((key) => !TIMESTAMP_KEYS.has(key));
    return keys.every((key) => (
      normalizeComparable(existingDoc[key]) === normalizeComparable(nextData[key])
    ));
  };

  const byId = new Map();
  rows.forEach((row) => {
    const id = toNonEmptyString(row?.id);
    if (!id) return;
    byId.set(id, row?.data || {});
  });

  for (const [id, data] of byId.entries()) {
    const existingDoc = rows._existingById?.get(id);
    if (isRowDataEqual(existingDoc, data)) continue;
    // eslint-disable-next-line no-await-in-loop
    await databases.upsertDocument(DATABASE_ID, collectionId, id, data);
  }
};

const deleteRows = async (collectionId, rows = []) => {
  for (const row of rows) {
    const id = toNonEmptyString(row?.$id || row?.id);
    if (!id) continue;

    try {
      // eslint-disable-next-line no-await-in-loop
      await databases.deleteDocument(DATABASE_ID, collectionId, id);
    } catch (error) {
      if (error?.code !== 404) throw error;
    }
  }
};

const syncTournamentChildren = async ({
  groupId,
  tournamentDoc,
  payload,
  playerByNormalized,
}) => {
  const tournamentId = toNonEmptyString(tournamentDoc.$id);
  const legacyTournamentId = toNonEmptyString(tournamentDoc.legacyTournamentId) || tournamentId;
  let existingTeamRows = [];
  let existingMatchRows = [];
  let existingParticipants = [];
  const cachedChildren = getFreshTournamentChildrenCache(groupId, tournamentId);
  if (cachedChildren) {
    existingTeamRows = cachedChildren.teamRows;
    existingMatchRows = cachedChildren.matchRows;
    existingParticipants = cachedChildren.participantRows;
  } else {
    [existingTeamRows, existingMatchRows] = await Promise.all([
      listByGroupAndValues({
        collectionId: COLLECTIONS.TOURNAMENT_TEAMS_V2,
        groupId,
        key: 'tournamentId',
        values: [tournamentId],
      }),
      listByGroupAndValues({
        collectionId: COLLECTIONS.MATCHES_V2,
        groupId,
        key: 'tournamentId',
        values: [tournamentId],
      }),
    ]);

    existingParticipants = await listByGroupAndValues({
      collectionId: COLLECTIONS.MATCH_PLAYERS_V2,
      groupId,
      key: 'matchId',
      values: existingMatchRows.map((row) => row.$id),
    });
  }

  const existingParticipantsByMatchId = new Map();
  existingParticipants.forEach((row) => {
    const key = toNonEmptyString(row.matchId);
    if (!key) return;
    const bucket = existingParticipantsByMatchId.get(key) || [];
    bucket.push(row);
    existingParticipantsByMatchId.set(key, bucket);
  });

  const existingTeamById = new Map();
  existingTeamRows.forEach((row) => {
    const id = toNonEmptyString(row?.$id);
    if (id) existingTeamById.set(id, row);
  });
  const existingMatchById = new Map();
  existingMatchRows.forEach((row) => {
    const id = toNonEmptyString(row?.$id);
    if (id) existingMatchById.set(id, row);
  });
  const existingParticipantById = new Map();
  existingParticipants.forEach((row) => {
    const id = toNonEmptyString(row?.$id);
    if (id) existingParticipantById.set(id, row);
  });

  const { rows: teamRows, teamRowIdByLegacyId, teamRowIdByName } = buildTeamRows({
    groupId,
    tournamentId,
    legacyTournamentId,
    teams: payload.teams,
    playerByNormalized,
    existingTeamRows,
  });

  const { matchRows, participantRows } = buildMatchAndParticipantRows({
    groupId,
    tournamentId,
    legacyTournamentId,
    fixtures: payload.fixtures,
    bracket: payload.bracket,
    finalMatch: payload.finalMatch,
    playerByNormalized,
    teamRowIdByLegacyId,
    teamRowIdByName,
    existingMatchRows,
    existingParticipantsByMatchId,
  });

  teamRows._existingById = existingTeamById;
  matchRows._existingById = existingMatchById;
  participantRows._existingById = existingParticipantById;
  await upsertRows(COLLECTIONS.TOURNAMENT_TEAMS_V2, teamRows);
  await upsertRows(COLLECTIONS.MATCHES_V2, matchRows);
  await upsertRows(COLLECTIONS.MATCH_PLAYERS_V2, participantRows);

  const nextTeamIds = new Set(teamRows.map((row) => row.id));
  const nextMatchIds = new Set(matchRows.map((row) => row.id));
  const nextParticipantIds = new Set(participantRows.map((row) => row.id));

  const staleParticipants = existingParticipants.filter((row) => !nextParticipantIds.has(row.$id));
  const staleMatches = existingMatchRows.filter((row) => !nextMatchIds.has(row.$id));
  const staleTeams = existingTeamRows.filter((row) => !nextTeamIds.has(row.$id));

  await deleteRows(COLLECTIONS.MATCH_PLAYERS_V2, staleParticipants);
  await deleteRows(COLLECTIONS.MATCHES_V2, staleMatches);
  await deleteRows(COLLECTIONS.TOURNAMENT_TEAMS_V2, staleTeams);

  const toCachedDocs = (rows = []) => rows.map((row) => ({
    $id: row.id,
    ...(row.data || {}),
  }));
  setTournamentChildrenCache(groupId, tournamentId, {
    teamRows: toCachedDocs(teamRows),
    matchRows: toCachedDocs(matchRows),
    participantRows: toCachedDocs(participantRows),
  });
};

const mergeTournamentState = (existing, updates = {}) => ({
  name: updates.name ?? existing?.name ?? 'Untitled Tournament',
  date: updates.date ?? existing?.date ?? '',
  teams: updates.teams ?? existing?.teams ?? [],
  fixtures: updates.fixtures ?? existing?.fixtures ?? [],
  bracket: updates.bracket ?? existing?.bracket ?? [],
  finalMatch: updates.finalMatch !== undefined ? updates.finalMatch : (existing?.finalMatch ?? null),
  champion: updates.champion !== undefined ? updates.champion : (existing?.champion ?? null),
  format: updates.format ?? existing?.format ?? '1',
  gameMode: updates.gameMode ?? existing?.gameMode ?? 'doubles',
  tournamentFormat: updates.tournamentFormat ?? existing?.tournamentFormat ?? 'league',
  status: updates.status ?? existing?.status ?? 'active',
  oddPlayerEnabled: updates.oddPlayerEnabled ?? existing?.oddPlayerEnabled ?? false,
  oddPlayerName: updates.oddPlayerName ?? existing?.oddPlayerName ?? '',
  aiSummaries: updates.aiSummaries ?? existing?.aiSummaries ?? [],
  swapHistory: updates.swapHistory ?? existing?.swapHistory ?? [],
});

const collectTournamentPlayers = (payload = {}) => {
  const names = new Set();
  const add = (name) => {
    const value = toNonEmptyString(name);
    if (value) names.add(value);
  };

  (Array.isArray(payload.teams) ? payload.teams : []).forEach((team) => {
    collectPlayersFromTeam(team).forEach(add);
  });

  (Array.isArray(payload.fixtures) ? payload.fixtures : []).forEach((match) => {
    collectPlayersFromMatch(match).forEach(add);
  });

  (Array.isArray(payload.bracket) ? payload.bracket : []).forEach((round) => {
    (Array.isArray(round) ? round : []).forEach((match) => {
      collectPlayersFromMatch(match).forEach(add);
    });
  });

  if (payload.finalMatch) {
    collectPlayersFromMatch(payload.finalMatch).forEach(add);
  }

  if (payload.champion) {
    collectPlayersFromTeam(payload.champion).forEach(add);
  }

  add(payload.oddPlayerName);
  return Array.from(names);
};

/**
 * Tournament Service
 * Normalized Appwrite V2 implementation.
 */
export const tournamentService = {
  async createTournament(tournamentData, groupId = null) {
    ensureV2Configured();
    const resolvedGroupId = toGroupId(groupId);
    const merged = mergeTournamentState(null, tournamentData || {});
    const players = collectTournamentPlayers(merged);
    const playerByNormalized = await ensurePlayersExist({
      groupId: resolvedGroupId,
      names: players,
      source: 'runtime.tournament-create',
    });

    const tournamentId = ID.unique();
    const document = buildTournamentDocument({
      tournamentId,
      groupId: resolvedGroupId,
      payload: merged,
      existing: null,
      playerByNormalized,
    });

    const created = await databases.upsertDocument(
      DATABASE_ID,
      COLLECTIONS.TOURNAMENTS_V2,
      tournamentId,
      document
    );

    await syncTournamentChildren({
      groupId: resolvedGroupId,
      tournamentDoc: created,
      payload: merged,
      playerByNormalized,
    });

    return {
      id: created.$id,
      appwriteId: created.$id,
      name: merged.name,
      date: merged.date,
      teams: merged.teams,
      fixtures: merged.fixtures,
      bracket: merged.bracket,
      finalMatch: merged.finalMatch,
      champion: merged.champion,
      aiSummaries: merged.aiSummaries,
      swapHistory: merged.swapHistory,
      format: merged.format,
      gameMode: merged.gameMode,
      tournamentFormat: merged.tournamentFormat,
      status: merged.status,
      oddPlayerEnabled: Boolean(merged.oddPlayerEnabled),
      oddPlayerName: toNonEmptyString(merged.oddPlayerName),
      createdAt: created.sourceCreatedAt || created.$createdAt,
    };
  },

  async getAllTournaments(limit = 100, groupId = null) {
    ensureV2Configured();
    const resolvedGroupId = toGroupId(groupId);
    let effectiveGroupId = resolvedGroupId;
    const queryLimit = Math.max(limit, 200);

    let tournamentDocs = [];
    try {
      const response = await databases.listDocuments(
        DATABASE_ID,
        COLLECTIONS.TOURNAMENTS_V2,
        [
          Query.equal('groupId', resolvedGroupId),
          Query.orderDesc('$updatedAt'),
          Query.limit(queryLimit),
        ]
      );
      tournamentDocs = (response?.documents || [])
        .filter((doc) => !isDeletedTournamentDoc(doc))
        .slice(0, limit);
    } catch (error) {
      if (!isIndexConstraintError(error)) throw error;
      const unfiltered = await databases.listDocuments(
        DATABASE_ID,
        COLLECTIONS.TOURNAMENTS_V2,
        [
          Query.orderDesc('$updatedAt'),
          Query.limit(queryLimit),
        ]
      );
      tournamentDocs = (unfiltered?.documents || [])
        .filter((doc) => toNonEmptyString(doc?.groupId) === resolvedGroupId)
        .filter((doc) => !isDeletedTournamentDoc(doc))
        .slice(0, limit);
    }

    if (tournamentDocs.length === 0 && resolvedGroupId) {
      const unscoped = await databases.listDocuments(
        DATABASE_ID,
        COLLECTIONS.TOURNAMENTS_V2,
        [
          Query.orderDesc('$updatedAt'),
          Query.limit(Math.max(limit, 200)),
        ]
      );
      const docs = unscoped?.documents || [];
      const discoveredGroups = Array.from(
        new Set(docs.map((doc) => toNonEmptyString(doc?.groupId)).filter(Boolean))
      );
      if (discoveredGroups.length === 1 && discoveredGroups[0] !== resolvedGroupId) {
        console.warn(
          `V2 tournaments are stored under group "${discoveredGroups[0]}", but active group is "${resolvedGroupId}". Falling back to discovered group.`
        );
        effectiveGroupId = discoveredGroups[0];
        tournamentDocs = docs
          .filter((doc) => toNonEmptyString(doc?.groupId) === effectiveGroupId)
          .filter((doc) => !isDeletedTournamentDoc(doc))
          .slice(0, limit);
      }
    }

    if (tournamentDocs.length === 0) return [];

    const tournamentIds = tournamentDocs.map((doc) => doc.$id);

    const [teamDocs, matchDocs] = await Promise.all([
      listByGroupAndValues({
        collectionId: COLLECTIONS.TOURNAMENT_TEAMS_V2,
        groupId: effectiveGroupId,
        key: 'tournamentId',
        values: tournamentIds,
      }),
      listByGroupAndValues({
        collectionId: COLLECTIONS.MATCHES_V2,
        groupId: effectiveGroupId,
        key: 'tournamentId',
        values: tournamentIds,
      }),
    ]);

    const matchIds = matchDocs.map((doc) => doc.$id);
    const matchPlayerDocs = await listByGroupAndValues({
      collectionId: COLLECTIONS.MATCH_PLAYERS_V2,
      groupId: effectiveGroupId,
      key: 'matchId',
      values: matchIds,
    });

    const teamsByTournament = new Map();
    teamDocs.forEach((doc) => {
      const key = toNonEmptyString(doc.tournamentId);
      if (!key) return;
      const bucket = teamsByTournament.get(key) || [];
      bucket.push(doc);
      teamsByTournament.set(key, bucket);
    });

    const matchesByTournament = new Map();
    matchDocs.forEach((doc) => {
      const key = toNonEmptyString(doc.tournamentId);
      if (!key) return;
      const bucket = matchesByTournament.get(key) || [];
      bucket.push(doc);
      matchesByTournament.set(key, bucket);
    });

    const participantsByTournament = new Map();
    const tournamentIdByMatchId = new Map();
    matchDocs.forEach((doc) => {
      tournamentIdByMatchId.set(toNonEmptyString(doc.$id), toNonEmptyString(doc.tournamentId));
    });
    matchPlayerDocs.forEach((doc) => {
      const matchId = toNonEmptyString(doc.matchId);
      const tournamentId = tournamentIdByMatchId.get(matchId);
      if (!tournamentId) return;
      const bucket = participantsByTournament.get(tournamentId) || [];
      bucket.push(doc);
      participantsByTournament.set(tournamentId, bucket);
    });

    tournamentDocs.forEach((doc) => {
      setTournamentChildrenCache(effectiveGroupId, doc.$id, {
        teamRows: teamsByTournament.get(doc.$id) || [],
        matchRows: matchesByTournament.get(doc.$id) || [],
        participantRows: participantsByTournament.get(doc.$id) || [],
      });
    });

    return tournamentDocs.map((doc) => hydrateTournament({
      tournamentDoc: doc,
      teamDocs: teamsByTournament.get(doc.$id) || [],
      matchDocs: matchesByTournament.get(doc.$id) || [],
      matchPlayerDocs: participantsByTournament.get(doc.$id) || [],
    }));
  },

  async getTournamentSummaries(limit = 100, groupId = null, statuses = []) {
    ensureV2Configured();
    const resolvedGroupId = toGroupId(groupId);
    let effectiveGroupId = resolvedGroupId;
    const normalizedStatuses = Array.from(
      new Set(
        (Array.isArray(statuses) ? statuses : [])
          .map((status) => toNonEmptyString(status).toLowerCase())
          .filter(Boolean)
      )
    );

    const matchesStatusFilter = (doc) => {
      if (isDeletedTournamentDoc(doc)) return false;
      if (normalizedStatuses.length === 0) return true;
      const status = toNonEmptyString(doc?.status).toLowerCase();
      return normalizedStatuses.includes(status);
    };

    let tournamentDocs = [];
    try {
      const response = await databases.listDocuments(
        DATABASE_ID,
        COLLECTIONS.TOURNAMENTS_V2,
        [
          Query.equal('groupId', resolvedGroupId),
          ...(normalizedStatuses.length > 0 ? [Query.equal('status', normalizedStatuses)] : []),
          Query.orderDesc('$updatedAt'),
          Query.limit(Math.max(limit, 200)),
        ]
      );
      tournamentDocs = (response?.documents || [])
        .filter(matchesStatusFilter)
        .slice(0, limit);
    } catch (error) {
      if (!isIndexConstraintError(error)) throw error;
      const unfiltered = await databases.listDocuments(
        DATABASE_ID,
        COLLECTIONS.TOURNAMENTS_V2,
        [
          Query.orderDesc('$updatedAt'),
          Query.limit(Math.max(limit, 200)),
        ]
      );
      tournamentDocs = (unfiltered?.documents || [])
        .filter((doc) => toNonEmptyString(doc?.groupId) === resolvedGroupId)
        .filter(matchesStatusFilter)
        .slice(0, limit);
    }

    if (tournamentDocs.length === 0 && resolvedGroupId) {
      const unscoped = await databases.listDocuments(
        DATABASE_ID,
        COLLECTIONS.TOURNAMENTS_V2,
        [
          Query.orderDesc('$updatedAt'),
          Query.limit(Math.max(limit, 200)),
        ]
      );
      const docs = unscoped?.documents || [];
      const discoveredGroups = Array.from(
        new Set(docs.map((doc) => toNonEmptyString(doc?.groupId)).filter(Boolean))
      );
      if (discoveredGroups.length === 1 && discoveredGroups[0] !== resolvedGroupId) {
        console.warn(
          `V2 tournaments are stored under group "${discoveredGroups[0]}", but active group is "${resolvedGroupId}". Falling back to discovered group.`
        );
        effectiveGroupId = discoveredGroups[0];
        tournamentDocs = docs
          .filter((doc) => toNonEmptyString(doc?.groupId) === effectiveGroupId)
          .filter(matchesStatusFilter)
          .slice(0, limit);
      }
    }

    const tournamentIds = tournamentDocs.map((doc) => toNonEmptyString(doc?.$id)).filter(Boolean);
    const teamDocs = tournamentIds.length > 0
      ? await listByGroupAndValues({
          collectionId: COLLECTIONS.TOURNAMENT_TEAMS_V2,
          groupId: effectiveGroupId,
          key: 'tournamentId',
          values: tournamentIds,
        })
      : [];
    const teamsByTournament = new Map();
    teamDocs.forEach((doc) => {
      const tournamentId = toNonEmptyString(doc?.tournamentId);
      if (!tournamentId) return;
      const parsedTeam = parseTeamDocument(doc);
      const bucket = teamsByTournament.get(tournamentId) || [];
      bucket.push(parsedTeam);
      teamsByTournament.set(tournamentId, bucket);
    });

    return tournamentDocs.map((doc) => {
      const summaryTeams = teamsByTournament.get(doc.$id) || [];
      return {
      id: doc.$id,
      appwriteId: doc.$id,
      groupId: doc.groupId,
      legacyTournamentId: doc.legacyTournamentId,
      name: doc.name,
      date: doc.dateLabel,
      teams: summaryTeams,
      teamsCount: summaryTeams.length,
      fixtures: [],
      bracket: [],
      finalMatch: null,
      champion: null,
      aiSummaries: [],
      swapHistory: [],
      format: doc.format || '1',
      gameMode: doc.gameMode || 'doubles',
      tournamentFormat: doc.tournamentFormat || 'league',
      status: doc.status || 'active',
      oddPlayerEnabled: parseBoolean(doc.oddPlayerEnabled),
      oddPlayerName: toNonEmptyString(doc.oddPlayerName),
      createdAt: doc.sourceCreatedAt || doc.$createdAt,
      updatedAt: doc.sourceUpdatedAt || doc.$updatedAt,
      isSummary: true,
      };
    });
  },

  async getTournamentById(tournamentId, groupId = null) {
    ensureV2Configured();
    const resolvedGroupId = toGroupId(groupId);
    const doc = await databases.getDocument(DATABASE_ID, COLLECTIONS.TOURNAMENTS_V2, tournamentId);

    if (toNonEmptyString(doc.groupId) !== resolvedGroupId) {
      throw new Error('Tournament not found for this group');
    }
    if (isDeletedTournamentDoc(doc)) {
      return null;
    }

    const [teamDocs, matchDocs] = await Promise.all([
      listByGroupAndValues({
        collectionId: COLLECTIONS.TOURNAMENT_TEAMS_V2,
        groupId: resolvedGroupId,
        key: 'tournamentId',
        values: [doc.$id],
      }),
      listByGroupAndValues({
        collectionId: COLLECTIONS.MATCHES_V2,
        groupId: resolvedGroupId,
        key: 'tournamentId',
        values: [doc.$id],
      }),
    ]);

    const matchPlayerDocs = await listByGroupAndValues({
      collectionId: COLLECTIONS.MATCH_PLAYERS_V2,
      groupId: resolvedGroupId,
      key: 'matchId',
      values: matchDocs.map((row) => row.$id),
    });

    setTournamentChildrenCache(resolvedGroupId, doc.$id, {
      teamRows: teamDocs,
      matchRows: matchDocs,
      participantRows: matchPlayerDocs,
    });

    return hydrateTournament({
      tournamentDoc: doc,
      teamDocs,
      matchDocs,
      matchPlayerDocs,
    });
  },

  async patchTournamentMatches(tournamentId, patches = [], groupId = null) {
    ensureV2Configured();
    const resolvedGroupId = toGroupId(groupId);
    const targetTournamentId = toNonEmptyString(tournamentId);
    const baseSummary = {
      updatedMatches: 0,
      updatedParticipants: 0,
      deletedParticipants: 0,
      missingMatches: 0,
    };
    if (!targetTournamentId) return baseSummary;

    const validatedPatches = (Array.isArray(patches) ? patches : [])
      .map((patch, index) => {
        const parsed = matchPatchSchema.safeParse(patch);
        if (parsed.success) return parsed.data;
        console.warn(`Ignoring invalid tournament match patch at index ${index}.`, parsed.error.flatten());
        return null;
      })
      .filter(Boolean);

    const normalizedPatches = validatedPatches
      .map((patch) => {
        const roundValue = patch?.roundLabel ?? patch?.round ?? patch?.roundNo;
        const matchKind = normalizePatchMatchKind(patch?.matchKind, roundValue);
        const legacyMatchId = toNonEmptyString(patch?.legacyMatchId ?? patch?.id);
        const bracketRoundIndex = toNonEmptyString(patch?.bracketRoundIndex);
        const bracketMatchIndex = toNonEmptyString(patch?.bracketMatchIndex);
        const key = makeMatchNaturalKey({
          matchKind,
          legacyMatchId,
          bracketRoundIndex,
          bracketMatchIndex,
        });
        if (!legacyMatchId) return null;
        return {
          patch,
          matchKind,
          legacyMatchId,
          bracketRoundIndex,
          bracketMatchIndex,
          key,
        };
      })
      .filter(Boolean);
    if (normalizedPatches.length === 0) return baseSummary;

    const tournamentDoc = await databases.getDocument(DATABASE_ID, COLLECTIONS.TOURNAMENTS_V2, targetTournamentId);
    if (toNonEmptyString(tournamentDoc.groupId) !== resolvedGroupId) {
      throw new Error('Tournament not found for this group');
    }
    if (isDeletedTournamentDoc(tournamentDoc)) {
      return {
        ...baseSummary,
        missingMatches: normalizedPatches.length,
      };
    }

    const [teamRows, existingMatchRows] = await Promise.all([
      listByGroupAndValues({
        collectionId: COLLECTIONS.TOURNAMENT_TEAMS_V2,
        groupId: resolvedGroupId,
        key: 'tournamentId',
        values: [targetTournamentId],
      }),
      listByGroupAndValues({
        collectionId: COLLECTIONS.MATCHES_V2,
        groupId: resolvedGroupId,
        key: 'tournamentId',
        values: [targetTournamentId],
      }),
    ]);

    const matchByNaturalKey = new Map();
    existingMatchRows.forEach((row) => {
      const key = makeMatchNaturalKey({
        matchKind: row.matchKind,
        legacyMatchId: row.legacyMatchId,
        bracketRoundIndex: row.bracketRoundIndex,
        bracketMatchIndex: row.bracketMatchIndex,
      });
      if (key && !matchByNaturalKey.has(key)) matchByNaturalKey.set(key, row);
    });

    const patchTargets = normalizedPatches.map((entry) => ({
      ...entry,
      row: matchByNaturalKey.get(entry.key) || null,
    }));
    const matchedRows = patchTargets
      .map((entry) => entry.row)
      .filter(Boolean);

    if (matchedRows.length === 0) {
      return {
        ...baseSummary,
        missingMatches: normalizedPatches.length,
      };
    }

    const existingParticipants = await listByGroupAndValues({
      collectionId: COLLECTIONS.MATCH_PLAYERS_V2,
      groupId: resolvedGroupId,
      key: 'matchId',
      values: matchedRows.map((row) => row.$id),
    });

    const participantsByMatchId = new Map();
    existingParticipants.forEach((row) => {
      const matchId = toNonEmptyString(row.matchId);
      if (!matchId) return;
      const bucket = participantsByMatchId.get(matchId) || [];
      bucket.push(row);
      participantsByMatchId.set(matchId, bucket);
    });

    const teamRowIdByLegacyId = new Map();
    const teamRowIdByName = new Map();
    teamRows.forEach((row) => {
      const rowId = toNonEmptyString(row?.$id);
      if (!rowId) return;
      const legacyTeamId = toNonEmptyString(row?.legacyTeamId);
      if (legacyTeamId && !teamRowIdByLegacyId.has(legacyTeamId)) {
        teamRowIdByLegacyId.set(legacyTeamId, rowId);
      }
      const normalizedTeamName = normalizeName(row?.teamName);
      if (normalizedTeamName && !teamRowIdByName.has(normalizedTeamName)) {
        teamRowIdByName.set(normalizedTeamName, rowId);
      }
    });

    const resolveTeamRowId = (team, existingTeamId = '') => {
      const teamLegacyId = toNonEmptyString(team?.id);
      if (teamLegacyId && teamRowIdByLegacyId.has(teamLegacyId)) {
        return teamRowIdByLegacyId.get(teamLegacyId) || existingTeamId;
      }
      const normalizedTeamName = normalizeName(team?.name);
      if (normalizedTeamName && teamRowIdByName.has(normalizedTeamName)) {
        return teamRowIdByName.get(normalizedTeamName) || existingTeamId;
      }
      return existingTeamId;
    };

    const playerNames = patchTargets.flatMap(({ patch }) => (
      [
        patch?.team1?.player || patch?.team1?.player1,
        patch?.team1?.player2,
        patch?.team2?.player || patch?.team2?.player1,
        patch?.team2?.player2,
      ].map((name) => toNonEmptyString(name)).filter(Boolean)
    ));
    const playerByNormalized = await ensurePlayersExist({
      groupId: resolvedGroupId,
      names: playerNames,
      source: 'runtime.tournament-match-patch',
    });

    const now = new Date().toISOString();
    const counters = { ...baseSummary };

    for (const target of patchTargets) {
      const { patch, matchKind, legacyMatchId, bracketRoundIndex, bracketMatchIndex, row } = target;
      if (!row) {
        counters.missingMatches += 1;
        // eslint-disable-next-line no-continue
        continue;
      }

      const score1 = Object.prototype.hasOwnProperty.call(patch, 'score1')
        ? toNumericString(patch.score1)
        : toNonEmptyString(row.score1);
      const score2 = Object.prototype.hasOwnProperty.call(patch, 'score2')
        ? toNumericString(patch.score2)
        : toNonEmptyString(row.score2);
      const completed = Object.prototype.hasOwnProperty.call(patch, 'completed')
        ? toBooleanString(patch.completed)
        : toBooleanString(getMatchCompleted({ completed: parseBoolean(row.completed) }, score1, score2));
      const existingCompletedAt = toNonEmptyString(row?.completedAt);
      const patchCompletedAt = Object.prototype.hasOwnProperty.call(patch, 'completedAt')
        ? toNonEmptyString(patch.completedAt)
        : '';
      const resolvedCompletedAt = patchCompletedAt || existingCompletedAt;
      const completedAt = completed === 'true'
        ? (resolvedCompletedAt || now)
        : '';
      const winnerSide = toNonEmptyString(patch?.winnerSide)
        || getWinnerSide(score1, score2)
        || toNonEmptyString(row?.winnerSide);

      const nextLegacyMatchId = toNonEmptyString(
        patch?.nextLegacyMatchId ?? patch?.nextMatchId ?? row?.nextLegacyMatchId
      );
      const roundLabel = toNonEmptyString(patch?.roundLabel ?? patch?.round ?? row?.roundLabel);
      const roundNo = toNonEmptyString(patch?.roundNo ?? patch?.round ?? row?.roundNo);

      const nextTeam1Id = resolveTeamRowId(patch?.team1, toNonEmptyString(row?.team1Id));
      const nextTeam2Id = resolveTeamRowId(patch?.team2, toNonEmptyString(row?.team2Id));
      const nextTeam1Name = toNonEmptyString(patch?.team1?.name) || toNonEmptyString(row?.team1Name);
      const nextTeam2Name = toNonEmptyString(patch?.team2?.name) || toNonEmptyString(row?.team2Name);

      const matchPayload = {
        groupId: resolvedGroupId,
        tournamentId: targetTournamentId,
        legacyTournamentId: toNonEmptyString(row?.legacyTournamentId || tournamentDoc?.legacyTournamentId || targetTournamentId),
        legacyMatchId,
        matchKind,
        roundLabel,
        roundNo,
        sequenceNo: toNonEmptyString(row?.sequenceNo),
        bracketRoundIndex,
        bracketMatchIndex,
        nextLegacyMatchId,
        team1Id: nextTeam1Id,
        team2Id: nextTeam2Id,
        team1Name: nextTeam1Name,
        team2Name: nextTeam2Name,
        score1,
        score2,
        completed,
        completedAt,
        winnerSide,
        sourceCreatedAt: toNonEmptyString(row?.sourceCreatedAt) || now,
        migratedAt: now,
      };

      const isUnchanged = Object.keys(matchPayload).every((key) => (
        normalizeComparable(row?.[key]) === normalizeComparable(matchPayload[key])
      ));
      if (!isUnchanged) {
        // eslint-disable-next-line no-await-in-loop
        await databases.updateDocument(
          DATABASE_ID,
          COLLECTIONS.MATCHES_V2,
          row.$id,
          matchPayload
        );
        counters.updatedMatches += 1;
      }

      const hasTeamPayload = Boolean(patch?.team1 || patch?.team2);
      if (!hasTeamPayload) {
        // eslint-disable-next-line no-continue
        continue;
      }

      const desiredParticipants = [
        { sideNo: '1', slotNo: '1', playerName: toNonEmptyString(patch?.team1?.player || patch?.team1?.player1) },
        { sideNo: '1', slotNo: '2', playerName: toNonEmptyString(patch?.team1?.player2) },
        { sideNo: '2', slotNo: '1', playerName: toNonEmptyString(patch?.team2?.player || patch?.team2?.player1) },
        { sideNo: '2', slotNo: '2', playerName: toNonEmptyString(patch?.team2?.player2) },
      ].filter((participant) => participant.playerName);

      const existingRows = participantsByMatchId.get(row.$id) || [];
      const existingBySlot = new Map();
      existingRows.forEach((participant) => {
        const slotKey = `${toNonEmptyString(participant.sideNo)}|${toNonEmptyString(participant.slotNo)}`;
        if (slotKey && !existingBySlot.has(slotKey)) existingBySlot.set(slotKey, participant);
      });

      const keepSlots = new Set();
      for (const participant of desiredParticipants) {
        const slotKey = `${participant.sideNo}|${participant.slotNo}`;
        keepSlots.add(slotKey);
        const existingParticipant = existingBySlot.get(slotKey);
        const payload = {
          groupId: resolvedGroupId,
          matchId: row.$id,
          sideNo: participant.sideNo,
          slotNo: participant.slotNo,
          playerName: participant.playerName,
          playerId: resolvePlayerId(participant.playerName, playerByNormalized),
          sourceCreatedAt: toNonEmptyString(existingParticipant?.sourceCreatedAt) || now,
          migratedAt: now,
        };

        if (existingParticipant?.$id) {
          const participantUnchanged = Object.keys(payload).every((key) => (
            normalizeComparable(existingParticipant?.[key]) === normalizeComparable(payload[key])
          ));
          if (!participantUnchanged) {
            // eslint-disable-next-line no-await-in-loop
            await databases.updateDocument(
              DATABASE_ID,
              COLLECTIONS.MATCH_PLAYERS_V2,
              existingParticipant.$id,
              payload
            );
            counters.updatedParticipants += 1;
          }
        } else {
          // eslint-disable-next-line no-await-in-loop
          await databases.createDocument(
            DATABASE_ID,
            COLLECTIONS.MATCH_PLAYERS_V2,
            ID.unique(),
            payload
          );
          counters.updatedParticipants += 1;
        }
      }

      const staleParticipants = existingRows.filter((participant) => {
        const slotKey = `${toNonEmptyString(participant.sideNo)}|${toNonEmptyString(participant.slotNo)}`;
        return !keepSlots.has(slotKey);
      });
      for (const stale of staleParticipants) {
        // eslint-disable-next-line no-await-in-loop
        await databases.deleteDocument(DATABASE_ID, COLLECTIONS.MATCH_PLAYERS_V2, stale.$id);
        counters.deletedParticipants += 1;
      }
    }

    clearTournamentChildrenCache(resolvedGroupId, targetTournamentId);
    return counters;
  },

  async updateTournament(tournamentId, updates, groupId = null, options = {}) {
    ensureV2Configured();
    const resolvedGroupId = toGroupId(groupId);
    const { skipExistingHydration = false } = options || {};

    const baseDoc = await databases.getDocument(DATABASE_ID, COLLECTIONS.TOURNAMENTS_V2, tournamentId);
    if (toNonEmptyString(baseDoc.groupId) !== resolvedGroupId) {
      throw new Error('Tournament not found for this group');
    }
    if (isDeletedTournamentDoc(baseDoc)) {
      throw new Error('Tournament is deleted');
    }

    const hasCompleteStateInUpdates = Boolean(
      updates
      && Object.prototype.hasOwnProperty.call(updates, 'teams')
      && Object.prototype.hasOwnProperty.call(updates, 'fixtures')
      && Object.prototype.hasOwnProperty.call(updates, 'bracket')
      && Object.prototype.hasOwnProperty.call(updates, 'aiSummaries')
      && Object.prototype.hasOwnProperty.call(updates, 'swapHistory')
    );
    const canSkipHydration = skipExistingHydration && hasCompleteStateInUpdates;

    const existing = canSkipHydration
      ? {
          id: baseDoc.$id,
          appwriteId: baseDoc.$id,
          groupId: baseDoc.groupId,
          name: baseDoc.name,
          date: baseDoc.dateLabel,
          teams: updates.teams,
          fixtures: updates.fixtures,
          bracket: updates.bracket,
          finalMatch: updates.finalMatch ?? null,
          champion: updates.champion ?? null,
          aiSummaries: updates.aiSummaries ?? [],
          swapHistory: updates.swapHistory ?? [],
          format: baseDoc.format || '1',
          gameMode: baseDoc.gameMode || 'doubles',
          tournamentFormat: baseDoc.tournamentFormat || 'league',
          status: baseDoc.status || 'active',
          oddPlayerEnabled: parseBoolean(baseDoc.oddPlayerEnabled),
          oddPlayerName: toNonEmptyString(baseDoc.oddPlayerName),
        }
      : await this.getTournamentById(tournamentId, resolvedGroupId);
    const merged = mergeTournamentState(existing, updates || {});

    const players = collectTournamentPlayers(merged);
    const playerByNormalized = await ensurePlayersExist({
      groupId: resolvedGroupId,
      names: players,
      source: 'runtime.tournament-update',
    });

    const document = buildTournamentDocument({
      tournamentId,
      groupId: resolvedGroupId,
      payload: merged,
      existing: baseDoc,
      playerByNormalized,
    });

    const updatedDoc = await databases.upsertDocument(
      DATABASE_ID,
      COLLECTIONS.TOURNAMENTS_V2,
      tournamentId,
      document
    );

    await syncTournamentChildren({
      groupId: resolvedGroupId,
      tournamentDoc: updatedDoc,
      payload: merged,
      playerByNormalized,
    });

    return {
      ...merged,
      id: updatedDoc.$id,
      appwriteId: updatedDoc.$id,
      createdAt: updatedDoc.sourceCreatedAt || updatedDoc.$createdAt,
      updatedAt: updatedDoc.sourceUpdatedAt || updatedDoc.$updatedAt,
    };
  },

  async deleteTournament(tournamentId, groupId = null) {
    ensureV2Configured();
    const resolvedGroupId = toGroupId(groupId);

    let tournamentDoc = null;
    try {
      tournamentDoc = await databases.getDocument(DATABASE_ID, COLLECTIONS.TOURNAMENTS_V2, tournamentId);
    } catch (error) {
      if (error?.code === 404) return false;
      throw error;
    }

    if (toNonEmptyString(tournamentDoc.groupId) !== resolvedGroupId) {
      return false;
    }
    if (isDeletedTournamentDoc(tournamentDoc)) {
      clearTournamentChildrenCache(resolvedGroupId, tournamentId);
      return true;
    }

    if (shouldUseSoftTournamentDelete()) {
      try {
        await databases.updateDocument(
          DATABASE_ID,
          COLLECTIONS.TOURNAMENTS_V2,
          tournamentId,
          {
            status: TOURNAMENT_DELETED_STATUS,
            sourceUpdatedAt: new Date().toISOString(),
          }
        );
        clearTournamentChildrenCache(resolvedGroupId, tournamentId);
        return true;
      } catch (error) {
        const message = String(error?.message || '').toLowerCase();
        const isStatusValidationError = error?.code === 400 && (
          message.includes('status')
          || message.includes('enum')
          || message.includes('invalid document structure')
          || message.includes('unknown attribute')
        );
        if (!isStatusValidationError) throw error;
        console.warn('Soft delete failed; falling back to hard delete for tournament.', error);
      }
    }

    const [teamDocs, matchDocs] = await Promise.all([
      listByGroupAndValues({
        collectionId: COLLECTIONS.TOURNAMENT_TEAMS_V2,
        groupId: resolvedGroupId,
        key: 'tournamentId',
        values: [tournamentId],
      }),
      listByGroupAndValues({
        collectionId: COLLECTIONS.MATCHES_V2,
        groupId: resolvedGroupId,
        key: 'tournamentId',
        values: [tournamentId],
      }),
    ]);

    const participants = await listByGroupAndValues({
      collectionId: COLLECTIONS.MATCH_PLAYERS_V2,
      groupId: resolvedGroupId,
      key: 'matchId',
      values: matchDocs.map((row) => row.$id),
    });

    await deleteRows(COLLECTIONS.MATCH_PLAYERS_V2, participants);
    await deleteRows(COLLECTIONS.MATCHES_V2, matchDocs);
    await deleteRows(COLLECTIONS.TOURNAMENT_TEAMS_V2, teamDocs);

    await databases.deleteDocument(DATABASE_ID, COLLECTIONS.TOURNAMENTS_V2, tournamentId);
    clearTournamentChildrenCache(resolvedGroupId, tournamentId);
    return true;
  },
};
