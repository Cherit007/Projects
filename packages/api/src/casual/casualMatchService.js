import { databases, DATABASE_ID, COLLECTIONS, ID, Query } from '../appwrite/client.js';

const DEFAULT_GROUP_ID = 'default-group';
const PAGE_SIZE = 100;
const IN_QUERY_LIMIT = 100;
const PLAYER_LOOKUP_CACHE_TTL_MS = 60 * 1000;

const playerLookupCache = new Map();
const missingIndexCache = new Set();

const ensureV2Configured = () => {
  if (!COLLECTIONS.MATCHES_V2 || !COLLECTIONS.MATCH_PLAYERS_V2) {
    throw new Error(
      'V2 match collections are not configured. Set VITE_APPWRITE_COLLECTION_V2_MATCHES and VITE_APPWRITE_COLLECTION_V2_MATCH_PLAYERS.'
    );
  }

  if (COLLECTIONS.CASUAL_MATCHES && COLLECTIONS.MATCHES_V2 === COLLECTIONS.CASUAL_MATCHES) {
    throw new Error(
      'Invalid Appwrite config: V2 matches collection points to legacy casual matches collection.'
    );
  }
};

const toGroupId = (groupId) => {
  const value = String(groupId || '').trim();
  return value || DEFAULT_GROUP_ID;
};

const toNonEmptyString = (value) => String(value ?? '').trim();
const toNumericString = (value) => {
  if (value === null || value === undefined || value === '') return '';
  const parsed = Number(value);
  return Number.isFinite(parsed) ? String(parsed) : '';
};
const normalizeName = (value) => toNonEmptyString(value).replace(/\s+/g, ' ').toLowerCase();

const chunk = (items, size = IN_QUERY_LIMIT) => {
  const source = Array.isArray(items) ? items : [];
  const result = [];
  for (let i = 0; i < source.length; i += size) {
    result.push(source.slice(i, i + size));
  }
  return result;
};

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

  const all = [];
  const sets = chunk(normalizedValues, IN_QUERY_LIMIT);
  const groupAndValueScope = `groupId+${key}`;
  if (!hasMissingIndex(collectionId, groupAndValueScope)) {
    try {
      for (const set of sets) {
        const rows = await listDocumentsPaged(collectionId, [
          Query.equal('groupId', groupId),
          Query.equal(key, set),
        ]);
        all.push(...rows);
      }
      const byId = new Map();
      all.forEach((row) => {
        const id = toNonEmptyString(row?.$id);
        if (id) byId.set(id, row);
      });
      return Array.from(byId.values());
    } catch (error) {
      if (!isIndexConstraintError(error)) throw error;
      markMissingIndex(collectionId, groupAndValueScope);
    }
  }

  const valueOnlyScope = key;
  if (!hasMissingIndex(collectionId, valueOnlyScope)) {
    try {
      for (const set of sets) {
        const rows = await listDocumentsPaged(collectionId, [
          Query.equal(key, set),
        ]);
        all.push(...rows);
      }
      const byId = new Map();
      all.forEach((row) => {
        const id = toNonEmptyString(row?.$id);
        if (id) byId.set(id, row);
      });
      return Array.from(byId.values()).filter((doc) => toNonEmptyString(doc?.groupId) === groupId);
    } catch (innerError) {
      if (!isIndexConstraintError(innerError)) throw innerError;
      markMissingIndex(collectionId, valueOnlyScope);
    }
  }

  const byGroup = await listByGroup(collectionId, groupId);
  const allowed = new Set(normalizedValues);
  return byGroup.filter((doc) => allowed.has(toNonEmptyString(doc?.[key])));
};

const collectPlayersFromTeam = (team) => (
  [team?.player || team?.player1, team?.player2]
    .map((name) => toNonEmptyString(name))
    .filter(Boolean)
);

const inferMatchType = (team1, team2, explicitType = '') => {
  const normalized = toNonEmptyString(explicitType).toLowerCase();
  if (normalized) return normalized;

  const team1Players = collectPlayersFromTeam(team1);
  const team2Players = collectPlayersFromTeam(team2);
  const doubles = team1Players.length > 1 || team2Players.length > 1;
  return doubles ? 'doubles' : 'singles';
};

const ensurePlayersExist = async ({ groupId, names = [] }) => {
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
        source: 'runtime.casual-match',
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

const parseScore = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const parseCasualMatch = ({ matchDoc, participantRows }) => {
  const side1 = participantRows
    .filter((row) => toNonEmptyString(row.sideNo) === '1')
    .sort((a, b) => Number(a.slotNo || 0) - Number(b.slotNo || 0));
  const side2 = participantRows
    .filter((row) => toNonEmptyString(row.sideNo) === '2')
    .sort((a, b) => Number(a.slotNo || 0) - Number(b.slotNo || 0));

  const team1Players = side1.map((row) => toNonEmptyString(row.playerName)).filter(Boolean);
  const team2Players = side2.map((row) => toNonEmptyString(row.playerName)).filter(Boolean);

  const team1 = {
    name: toNonEmptyString(matchDoc.team1Name) || team1Players.join(' & ') || 'Team 1',
    player1: team1Players[0] || '',
    player: team1Players[0] || '',
    player2: team1Players[1] || '',
  };
  const team2 = {
    name: toNonEmptyString(matchDoc.team2Name) || team2Players.join(' & ') || 'Team 2',
    player1: team2Players[0] || '',
    player: team2Players[0] || '',
    player2: team2Players[1] || '',
  };

  const score1 = parseScore(matchDoc.score1);
  const score2 = parseScore(matchDoc.score2);
  const winnerSide = toNonEmptyString(matchDoc.winnerSide);

  return {
    id: matchDoc.$id,
    appwriteId: matchDoc.$id,
    matchType: inferMatchType(team1, team2, matchDoc.roundLabel),
    date: matchDoc.sourceCreatedAt || matchDoc.$createdAt,
    completedAt: toNonEmptyString(matchDoc.completedAt),
    team1,
    team2,
    score1,
    score2,
    winner: winnerSide === '1' ? 'team1' : (winnerSide === '2' ? 'team2' : ''),
    createdAt: matchDoc.sourceCreatedAt || matchDoc.$createdAt,
  };
};

/**
 * Casual Match Service
 * Uses normalized V2 matches + match_players collections.
 */
export const casualMatchService = {
  async createCasualMatch(matchData, groupId = null) {
    ensureV2Configured();
    const resolvedGroupId = toGroupId(groupId);
    const now = new Date().toISOString();

    const team1 = matchData?.team1 || {};
    const team2 = matchData?.team2 || {};
    const matchType = inferMatchType(team1, team2, matchData?.matchType);
    const score1 = toNumericString(matchData?.score1);
    const score2 = toNumericString(matchData?.score2);

    const allPlayers = [
      ...collectPlayersFromTeam(team1),
      ...collectPlayersFromTeam(team2),
    ];
    const playerByNormalized = await ensurePlayersExist({
      groupId: resolvedGroupId,
      names: allPlayers,
    });

    const winner = toNonEmptyString(matchData?.winner);
    const winnerSide = winner === 'team1'
      ? '1'
      : (winner === 'team2' ? '2' : (Number(score1) > Number(score2) ? '1' : '2'));

    const completedAt = toNonEmptyString(matchData?.completedAt)
      || toNonEmptyString(matchData?.date)
      || now;

    const matchDoc = await databases.createDocument(
      DATABASE_ID,
      COLLECTIONS.MATCHES_V2,
      ID.unique(),
      {
        groupId: resolvedGroupId,
        tournamentId: '',
        legacyTournamentId: '',
        legacyMatchId: toNonEmptyString(matchData?.id) || `casual-${Date.now()}`,
        matchKind: 'casual',
        roundLabel: matchType,
        roundNo: '',
        sequenceNo: String(Date.now()),
        bracketRoundIndex: '',
        bracketMatchIndex: '',
        nextLegacyMatchId: '',
        team1Id: '',
        team2Id: '',
        team1Name: toNonEmptyString(team1?.name),
        team2Name: toNonEmptyString(team2?.name),
        score1,
        score2,
        completed: 'true',
        completedAt,
        winnerSide,
        sourceCreatedAt: toNonEmptyString(matchData?.date) || now,
        migratedAt: now,
      }
    );

    const participants = [
      { sideNo: '1', slotNo: '1', playerName: toNonEmptyString(team1?.player || team1?.player1) },
      { sideNo: '1', slotNo: '2', playerName: toNonEmptyString(team1?.player2) },
      { sideNo: '2', slotNo: '1', playerName: toNonEmptyString(team2?.player || team2?.player1) },
      { sideNo: '2', slotNo: '2', playerName: toNonEmptyString(team2?.player2) },
    ].filter((row) => row.playerName);

    for (const participant of participants) {
      // eslint-disable-next-line no-await-in-loop
      await databases.createDocument(
        DATABASE_ID,
        COLLECTIONS.MATCH_PLAYERS_V2,
        ID.unique(),
        {
          groupId: resolvedGroupId,
          matchId: matchDoc.$id,
          sideNo: participant.sideNo,
          slotNo: participant.slotNo,
          playerName: participant.playerName,
          playerId: resolvePlayerId(participant.playerName, playerByNormalized),
          sourceCreatedAt: toNonEmptyString(matchData?.date) || now,
          migratedAt: now,
        }
      );
    }

    return {
      id: matchDoc.$id,
      appwriteId: matchDoc.$id,
      matchType,
      date: matchDoc.sourceCreatedAt || matchDoc.$createdAt,
      completedAt: toNonEmptyString(matchDoc.completedAt),
      team1,
      team2,
      score1: parseScore(score1),
      score2: parseScore(score2),
      winner: winnerSide === '1' ? 'team1' : 'team2',
      createdAt: matchDoc.sourceCreatedAt || matchDoc.$createdAt,
    };
  },

  async getAllCasualMatches(limit = 100, groupId = null) {
    ensureV2Configured();
    const resolvedGroupId = toGroupId(groupId);
    let effectiveGroupId = resolvedGroupId;

    let matchDocs = [];
    try {
      const response = await databases.listDocuments(
        DATABASE_ID,
        COLLECTIONS.MATCHES_V2,
        [
          Query.equal('groupId', resolvedGroupId),
          Query.equal('matchKind', 'casual'),
          Query.orderDesc('$createdAt'),
          Query.limit(limit),
        ]
      );
      matchDocs = response?.documents || [];
    } catch (error) {
      if (!isIndexConstraintError(error)) throw error;
      const unfiltered = await databases.listDocuments(
        DATABASE_ID,
        COLLECTIONS.MATCHES_V2,
        [
          Query.orderDesc('$createdAt'),
          Query.limit(Math.max(limit, 200)),
        ]
      );
      matchDocs = (unfiltered?.documents || [])
        .filter((doc) => toNonEmptyString(doc?.groupId) === resolvedGroupId && toNonEmptyString(doc?.matchKind) === 'casual')
        .slice(0, limit);
    }

    if (matchDocs.length === 0 && resolvedGroupId) {
      const unscoped = await databases.listDocuments(
        DATABASE_ID,
        COLLECTIONS.MATCHES_V2,
        [
          Query.orderDesc('$createdAt'),
          Query.limit(Math.max(limit, 200)),
        ]
      );
      const docs = (unscoped?.documents || []).filter((doc) => toNonEmptyString(doc?.matchKind) === 'casual');
      const discoveredGroups = Array.from(
        new Set(docs.map((doc) => toNonEmptyString(doc?.groupId)).filter(Boolean))
      );
      if (discoveredGroups.length === 1 && discoveredGroups[0] !== resolvedGroupId) {
        console.warn(
          `V2 casual matches are stored under group "${discoveredGroups[0]}", but active group is "${resolvedGroupId}". Falling back to discovered group.`
        );
        effectiveGroupId = discoveredGroups[0];
        matchDocs = docs
          .filter((doc) => toNonEmptyString(doc?.groupId) === effectiveGroupId)
          .slice(0, limit);
      }
    }

    const matchIds = matchDocs.map((doc) => doc.$id);

    const participantDocs = await listByGroupAndValues({
      collectionId: COLLECTIONS.MATCH_PLAYERS_V2,
      groupId: effectiveGroupId,
      key: 'matchId',
      values: matchIds,
    });

    const participantsByMatchId = new Map();
    participantDocs.forEach((row) => {
      const key = toNonEmptyString(row.matchId);
      if (!key) return;
      const bucket = participantsByMatchId.get(key) || [];
      bucket.push(row);
      participantsByMatchId.set(key, bucket);
    });

    return matchDocs.map((doc) => parseCasualMatch({
      matchDoc: doc,
      participantRows: participantsByMatchId.get(doc.$id) || [],
    }));
  },

  async getMatchesByPlayer(playerName, limit = 50, groupId = null) {
    const needle = normalizeName(playerName);
    if (!needle) return [];

    const matches = await this.getAllCasualMatches(limit, groupId);
    return matches.filter((match) => {
      const players = [
        match?.team1?.player || match?.team1?.player1,
        match?.team1?.player2,
        match?.team2?.player || match?.team2?.player1,
        match?.team2?.player2,
      ]
        .map((name) => normalizeName(name))
        .filter(Boolean);

      return players.includes(needle);
    });
  },

  async deleteCasualMatch(matchId, groupId = null) {
    ensureV2Configured();
    const resolvedGroupId = toGroupId(groupId);

    let matchDoc = null;
    try {
      matchDoc = await databases.getDocument(DATABASE_ID, COLLECTIONS.MATCHES_V2, matchId);
    } catch (error) {
      if (error?.code === 404) return false;
      throw error;
    }

    if (toNonEmptyString(matchDoc.groupId) !== resolvedGroupId) {
      return false;
    }

    const participants = await listDocumentsPaged(COLLECTIONS.MATCH_PLAYERS_V2, [
      Query.equal('matchId', matchId),
    ]);
    const scopedParticipants = participants.filter((row) => toNonEmptyString(row?.groupId) === resolvedGroupId);

    for (const participant of scopedParticipants) {
      // eslint-disable-next-line no-await-in-loop
      await databases.deleteDocument(DATABASE_ID, COLLECTIONS.MATCH_PLAYERS_V2, participant.$id);
    }

    await databases.deleteDocument(DATABASE_ID, COLLECTIONS.MATCHES_V2, matchId);
    return true;
  },
};
