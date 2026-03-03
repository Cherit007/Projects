import { Client, Databases, ID, Query } from 'node-appwrite';

const APP_META_DOC_ID = 'global-app-meta';
const DEFAULT_GROUP_ID = 'default-group';
const PAGE_SIZE = 100;
const IN_QUERY_LIMIT = 100;
const DELETE_BATCH_SIZE = 20;

const pickEnv = (...keys) => {
  for (const key of keys) {
    const value = process.env[key];
    if (value && String(value).trim()) return String(value).trim();
  }
  return '';
};

const toNonEmptyString = (value) => String(value ?? '').trim();
const normalizeName = (value) => toNonEmptyString(value).replace(/\s+/g, ' ').toLowerCase();
const toGroupId = (value) => toNonEmptyString(value) || DEFAULT_GROUP_ID;
const toNumericString = (value) => {
  if (value === null || value === undefined || value === '') return '';
  const parsed = Number(value);
  return Number.isFinite(parsed) ? String(parsed) : '';
};
const toBooleanString = (value) => String(Boolean(value));
const parseBoolean = (value) => {
  if (typeof value === 'boolean') return value;
  const normalized = toNonEmptyString(value).toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes';
};
const parseNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const chunk = (items = [], size = IN_QUERY_LIMIT) => {
  const list = Array.isArray(items) ? items : [];
  const output = [];
  for (let i = 0; i < list.length; i += size) {
    output.push(list.slice(i, i + size));
  }
  return output;
};
const uniqueDocuments = (docs = []) => {
  const map = new Map();
  (Array.isArray(docs) ? docs : []).forEach((doc) => {
    const id = toNonEmptyString(doc?.$id);
    if (!id) return;
    map.set(id, doc);
  });
  return Array.from(map.values());
};

const normalizeComparable = (value) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

const isUnknownAttributeError = (error) => (
  error?.code === 400 && /unknown attribute/i.test(String(error?.message || ''))
);

const extractUnknownAttribute = (error) => {
  const message = String(error?.message || '');
  const directMatch = message.match(/Unknown attribute:\s*"([^"]+)"/i);
  if (directMatch?.[1]) return directMatch[1];
  const valueMatch = message.match(/attribute\s+"([^"]+)"/i);
  return valueMatch?.[1] || '';
};

const writeWithUnknownAttributeRetry = async (writer, payload) => {
  let body = { ...(payload || {}) };

  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      return await writer(body);
    } catch (error) {
      if (!isUnknownAttributeError(error)) throw error;
      const unknown = extractUnknownAttribute(error);
      if (!unknown || !Object.prototype.hasOwnProperty.call(body, unknown)) throw error;
      delete body[unknown];
      if (Object.keys(body).length === 0) throw error;
    }
  }

  throw new Error('Write failed after unknown-attribute retries');
};

const buildContext = () => {
  const endpoint = pickEnv(
    'APPWRITE_ENDPOINT',
    'APPWRITE_FUNCTION_API_ENDPOINT',
    'APPWRITE_FUNCTION_ENDPOINT'
  );
  const projectId = pickEnv('APPWRITE_PROJECT_ID', 'APPWRITE_FUNCTION_PROJECT_ID');
  const apiKey = pickEnv('APPWRITE_API_KEY', 'APPWRITE_FUNCTION_API_KEY');
  const databaseId = pickEnv('APPWRITE_DATABASE_ID');

  if (!endpoint || !projectId || !apiKey || !databaseId) {
    throw new Error(
      'Missing function env config. Required: APPWRITE_ENDPOINT (or APPWRITE_FUNCTION_API_ENDPOINT), APPWRITE_PROJECT_ID (or APPWRITE_FUNCTION_PROJECT_ID), APPWRITE_API_KEY (or APPWRITE_FUNCTION_API_KEY), APPWRITE_DATABASE_ID.'
    );
  }

  const collections = {
    tournaments: pickEnv('APPWRITE_COLLECTION_V2_TOURNAMENTS'),
    tournamentTeams: pickEnv('APPWRITE_COLLECTION_V2_TOURNAMENT_TEAMS'),
    matches: pickEnv('APPWRITE_COLLECTION_V2_MATCHES'),
    matchPlayers: pickEnv('APPWRITE_COLLECTION_V2_MATCH_PLAYERS'),
    players: pickEnv('APPWRITE_COLLECTION_V2_PLAYERS'),
    ratings: pickEnv('APPWRITE_COLLECTION_V2_RATINGS_CURRENT'),
    appMeta: pickEnv('APPWRITE_COLLECTION_APP_META'),
  };

  if (
    !collections.tournaments
    || !collections.tournamentTeams
    || !collections.matches
    || !collections.matchPlayers
    || !collections.players
    || !collections.ratings
  ) {
    throw new Error(
      'Missing V2 collection env config in function. Required: APPWRITE_COLLECTION_V2_TOURNAMENTS, APPWRITE_COLLECTION_V2_TOURNAMENT_TEAMS, APPWRITE_COLLECTION_V2_MATCHES, APPWRITE_COLLECTION_V2_MATCH_PLAYERS, APPWRITE_COLLECTION_V2_PLAYERS, APPWRITE_COLLECTION_V2_RATINGS_CURRENT.'
    );
  }

  const client = new Client()
    .setEndpoint(endpoint)
    .setProject(projectId)
    .setKey(apiKey);

  return {
    databases: new Databases(client),
    databaseId,
    collections,
  };
};

const parseRequestBody = (req) => {
  if (req?.bodyJson && typeof req.bodyJson === 'object') return req.bodyJson;
  if (req?.body && typeof req.body === 'object') return req.body;

  const candidates = [
    req?.bodyRaw,
    req?.bodyText,
    req?.body,
    req?.payload,
  ];

  for (const candidate of candidates) {
    if (typeof candidate !== 'string') continue;
    const trimmed = candidate.trim();
    if (!trimmed) continue;
    try {
      return JSON.parse(trimmed);
    } catch (_error) {
      continue;
    }
  }

  return {};
};

const getRequesterId = (req) => {
  const headers = req?.headers || {};
  return toNonEmptyString(
    headers['x-appwrite-user-id']
    || headers['X-Appwrite-User-Id']
    || process.env.APPWRITE_FUNCTION_USER_ID
  );
};

const listDocumentsPaged = async (ctx, collectionId, baseQueries = []) => {
  const all = [];
  let cursor = '';
  while (true) {
    const queries = [
      ...baseQueries,
      Query.limit(PAGE_SIZE),
      Query.orderAsc('$id'),
      ...(cursor ? [Query.cursorAfter(cursor)] : []),
    ];
    const page = await ctx.databases.listDocuments(
      ctx.databaseId,
      collectionId,
      queries
    );
    const docs = page?.documents || [];
    if (docs.length === 0) break;
    all.push(...docs);
    if (docs.length < PAGE_SIZE) break;
    cursor = docs[docs.length - 1].$id;
  }
  return all;
};

const listByGroup = async (ctx, collectionId, groupId) => (
  listDocumentsPaged(ctx, collectionId, [Query.equal('groupId', groupId)])
);

const listByGroupAndValues = async ({
  ctx,
  collectionId,
  groupId,
  key,
  values = [],
}) => {
  const normalized = Array.from(
    new Set((Array.isArray(values) ? values : []).map((value) => toNonEmptyString(value)).filter(Boolean))
  );
  if (normalized.length === 0) return [];

  const batches = chunk(normalized, IN_QUERY_LIMIT);
  const docs = [];
  for (const set of batches) {
    // eslint-disable-next-line no-await-in-loop
    const page = await listDocumentsPaged(ctx, collectionId, [
      Query.equal('groupId', groupId),
      Query.equal(key, set),
    ]);
    docs.push(...page);
  }
  return uniqueDocuments(docs);
};

const deleteDocumentSafe = async (ctx, collectionId, documentId) => {
  if (!documentId) return false;
  try {
    await ctx.databases.deleteDocument(ctx.databaseId, collectionId, documentId);
    return true;
  } catch (error) {
    if (error?.code === 404) return false;
    throw error;
  }
};

const deleteDocumentsByIdBatched = async ({
  ctx,
  collectionId,
  documentIds = [],
  batchSize = DELETE_BATCH_SIZE,
}) => {
  const uniqueIds = Array.from(
    new Set((Array.isArray(documentIds) ? documentIds : []).map((id) => toNonEmptyString(id)).filter(Boolean))
  );
  if (uniqueIds.length === 0) return 0;

  let removed = 0;
  const batches = chunk(uniqueIds, Math.max(1, Number(batchSize) || DELETE_BATCH_SIZE));
  for (const batch of batches) {
    const results = await Promise.all(batch.map((id) => (
      deleteDocumentSafe(ctx, collectionId, id)
    )));
    removed += results.filter(Boolean).length;
  }
  return removed;
};

const ensurePlayersExist = async ({
  ctx,
  groupId,
  names = [],
  source = 'runtime.heavy-ops',
}) => {
  const uniqueByNormalized = new Map();
  (Array.isArray(names) ? names : []).forEach((rawName) => {
    const displayName = toNonEmptyString(rawName);
    const normalized = normalizeName(displayName);
    if (!displayName || !normalized) return;
    if (!uniqueByNormalized.has(normalized)) uniqueByNormalized.set(normalized, displayName);
  });

  if (uniqueByNormalized.size === 0) return new Map();

  const normalizedNames = Array.from(uniqueByNormalized.keys());
  const existing = await listByGroupAndValues({
    ctx,
    collectionId: ctx.collections.players,
    groupId,
    key: 'normalizedName',
    values: normalizedNames,
  });
  const byNormalized = new Map();
  existing.forEach((doc) => {
    const normalized = normalizeName(doc?.normalizedName || doc?.displayName);
    if (!normalized || byNormalized.has(normalized)) return;
    byNormalized.set(normalized, doc);
  });

  const now = new Date().toISOString();
  for (const [normalizedName, displayName] of uniqueByNormalized.entries()) {
    if (byNormalized.has(normalizedName)) continue;
    // eslint-disable-next-line no-await-in-loop
    const created = await writeWithUnknownAttributeRetry(
      (payload) => ctx.databases.createDocument(
        ctx.databaseId,
        ctx.collections.players,
        ID.unique(),
        payload
      ),
      {
        groupId,
        displayName,
        normalizedName,
        source,
        migratedAt: now,
      }
    );
    byNormalized.set(normalizedName, created);
  }

  return byNormalized;
};

const resolvePlayerId = (playerName, playerByNormalized) => {
  const normalized = normalizeName(playerName);
  if (!normalized) return '';
  return toNonEmptyString(playerByNormalized.get(normalized)?.$id);
};

const buildRatingPayload = ({
  groupId,
  playerName,
  snapshot,
  playerDoc,
  now = new Date().toISOString(),
}) => {
  const history = Array.isArray(snapshot?.history) ? snapshot.history : [];
  const lastEntry = history.length > 0 ? history[history.length - 1] : null;
  const lastResult = toNonEmptyString(lastEntry?.result);
  const lastChange = parseNumber(lastEntry?.change, 0);
  const sourceUpdatedAt = toNonEmptyString(lastEntry?.date || now) || now;

  return {
    groupId,
    playerId: toNonEmptyString(playerDoc?.$id),
    playerName: toNonEmptyString(playerName),
    rating: String(parseNumber(snapshot?.rating, 1000)),
    matchesPlayed: String(parseNumber(snapshot?.matchesPlayed, history.length)),
    lastResult,
    lastChange: String(lastChange),
    sourceUpdatedAt,
  };
};

const isPayloadEqual = (existingDoc, nextPayload, ignoredKeys = []) => {
  const ignored = new Set(ignoredKeys);
  return Object.keys(nextPayload || {})
    .filter((key) => !ignored.has(key))
    .every((key) => normalizeComparable(existingDoc?.[key]) === normalizeComparable(nextPayload?.[key]));
};

const applyRatingsDelta = async (ctx, groupId, deltaPayload = {}) => {
  const changedInput = deltaPayload?.changedRatings && typeof deltaPayload.changedRatings === 'object'
    ? deltaPayload.changedRatings
    : {};
  const deletedInput = Array.isArray(deltaPayload?.deletedPlayerNames)
    ? deltaPayload.deletedPlayerNames
    : [];

  const changedEntries = Object.entries(changedInput)
    .map(([name, snapshot]) => [toNonEmptyString(name), snapshot])
    .filter(([name]) => Boolean(name));
  const changedNames = changedEntries.map(([name]) => name);
  const changedNormalized = new Set(changedNames.map((name) => normalizeName(name)).filter(Boolean));
  const deletedNormalized = new Set(deletedInput.map((name) => normalizeName(name)).filter(Boolean));
  changedNormalized.forEach((name) => deletedNormalized.delete(name));

  if (changedEntries.length === 0 && deletedNormalized.size === 0) {
    return {
      created: 0,
      updated: 0,
      deleted: 0,
    };
  }

  const playerByNormalized = changedNames.length > 0
    ? await ensurePlayersExist({
        ctx,
        groupId,
        names: changedNames,
        source: 'runtime.heavy-ops-ratings',
      })
    : new Map();

  const lookupNames = Array.from(new Set([
    ...changedNames,
    ...deletedInput.map((name) => toNonEmptyString(name)).filter(Boolean),
  ]));
  const changedPlayerIds = Array.from(new Set(
    changedNames
      .map((name) => toNonEmptyString(playerByNormalized.get(normalizeName(name))?.$id))
      .filter(Boolean)
  ));

  const [existingByName, existingByPlayerId] = await Promise.all([
    lookupNames.length > 0
      ? listByGroupAndValues({
          ctx,
          collectionId: ctx.collections.ratings,
          groupId,
          key: 'playerName',
          values: lookupNames,
        })
      : Promise.resolve([]),
    changedPlayerIds.length > 0
      ? listByGroupAndValues({
          ctx,
          collectionId: ctx.collections.ratings,
          groupId,
          key: 'playerId',
          values: changedPlayerIds,
        })
      : Promise.resolve([]),
  ]);

  const existingByNormalized = new Map();
  [...existingByName, ...existingByPlayerId].forEach((doc) => {
    const normalized = normalizeName(doc?.playerName);
    if (!normalized || existingByNormalized.has(normalized)) return;
    existingByNormalized.set(normalized, doc);
  });

  const now = new Date().toISOString();
  const counters = {
    created: 0,
    updated: 0,
    deleted: 0,
  };

  for (const [playerName, snapshot] of changedEntries) {
    const normalized = normalizeName(playerName);
    if (!normalized) continue;
    const payload = buildRatingPayload({
      groupId,
      playerName,
      snapshot,
      playerDoc: playerByNormalized.get(normalized),
      now,
    });
    const existingDoc = existingByNormalized.get(normalized);
    if (existingDoc?.$id) {
      if (!isPayloadEqual(existingDoc, payload, ['migratedAt'])) {
        // eslint-disable-next-line no-await-in-loop
        await writeWithUnknownAttributeRetry(
          (body) => ctx.databases.updateDocument(
            ctx.databaseId,
            ctx.collections.ratings,
            existingDoc.$id,
            body
          ),
          payload
        );
        counters.updated += 1;
      }
      continue;
    }

    // eslint-disable-next-line no-await-in-loop
    await writeWithUnknownAttributeRetry(
      (body) => ctx.databases.createDocument(
        ctx.databaseId,
        ctx.collections.ratings,
        ID.unique(),
        body
      ),
      {
        ...payload,
        migratedAt: now,
      }
    );
    counters.created += 1;
  }

  for (const normalized of deletedNormalized) {
    const existingDoc = existingByNormalized.get(normalized);
    if (!existingDoc?.$id) continue;
    // eslint-disable-next-line no-await-in-loop
    const removed = await deleteDocumentSafe(ctx, ctx.collections.ratings, existingDoc.$id);
    if (removed) counters.deleted += 1;
  }

  return counters;
};

const applyRatingsSnapshot = async (ctx, groupId, ratingsSnapshot = {}) => {
  const snapshot = ratingsSnapshot && typeof ratingsSnapshot === 'object' ? ratingsSnapshot : {};
  const names = Object.keys(snapshot).map((name) => toNonEmptyString(name)).filter(Boolean);
  const playerByNormalized = await ensurePlayersExist({
    ctx,
    groupId,
    names,
    source: 'runtime.heavy-ops-ratings',
  });

  const existing = await listByGroup(ctx, ctx.collections.ratings, groupId);
  const existingByNormalized = new Map();
  existing.forEach((doc) => {
    const normalized = normalizeName(doc?.playerName);
    if (!normalized || existingByNormalized.has(normalized)) return;
    existingByNormalized.set(normalized, doc);
  });

  const keepNormalized = new Set();
  const now = new Date().toISOString();
  const counters = {
    created: 0,
    updated: 0,
    deleted: 0,
  };

  for (const playerName of names) {
    const normalized = normalizeName(playerName);
    if (!normalized) continue;
    keepNormalized.add(normalized);

    const payload = buildRatingPayload({
      groupId,
      playerName,
      snapshot: snapshot[playerName],
      playerDoc: playerByNormalized.get(normalized),
      now,
    });
    const existingDoc = existingByNormalized.get(normalized);
    if (existingDoc?.$id) {
      if (!isPayloadEqual(existingDoc, payload, ['migratedAt'])) {
        // eslint-disable-next-line no-await-in-loop
        await writeWithUnknownAttributeRetry(
          (body) => ctx.databases.updateDocument(
            ctx.databaseId,
            ctx.collections.ratings,
            existingDoc.$id,
            body
          ),
          payload
        );
        counters.updated += 1;
      }
      continue;
    }

    // eslint-disable-next-line no-await-in-loop
    await writeWithUnknownAttributeRetry(
      (body) => ctx.databases.createDocument(
        ctx.databaseId,
        ctx.collections.ratings,
        ID.unique(),
        body
      ),
      {
        ...payload,
        migratedAt: now,
      }
    );
    counters.created += 1;
  }

  for (const doc of existing) {
    const normalized = normalizeName(doc?.playerName);
    if (keepNormalized.has(normalized)) continue;
    // eslint-disable-next-line no-await-in-loop
    const removed = await deleteDocumentSafe(ctx, ctx.collections.ratings, doc.$id);
    if (removed) counters.deleted += 1;
  }

  return counters;
};

const parseInvitesEnvelope = (value) => {
  try {
    const parsed = value ? JSON.parse(value) : [];
    if (Array.isArray(parsed)) {
      return {
        invites: parsed,
        joinRequests: [],
        activeTournament: null,
      };
    }
    if (parsed && typeof parsed === 'object') {
      return {
        invites: Array.isArray(parsed.invites) ? parsed.invites : [],
        joinRequests: Array.isArray(parsed.joinRequests) ? parsed.joinRequests : [],
        activeTournament: parsed.activeTournament || null,
      };
    }
  } catch (_error) {
    // Ignore malformed payload.
  }
  return {
    invites: [],
    joinRequests: [],
    activeTournament: null,
  };
};

const parseJson = (value, fallback) => {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch (_error) {
    return fallback;
  }
};

const getMetaForAuthorization = async (ctx) => {
  if (!ctx.collections.appMeta) return null;
  try {
    return await ctx.databases.getDocument(
      ctx.databaseId,
      ctx.collections.appMeta,
      APP_META_DOC_ID
    );
  } catch (error) {
    if (error?.code === 404) return null;
    throw error;
  }
};

const assertRole = async ({
  ctx,
  req,
  groupId,
  allowedRoles = ['member'],
}) => {
  const requesterId = getRequesterId(req);
  if (!requesterId) {
    throw new Error('Unauthorized execution: requester id is missing');
  }

  const metaDoc = await getMetaForAuthorization(ctx);
  if (!metaDoc) return { requesterId, role: 'unknown' };

  const memberships = parseJson(metaDoc.groupMembers, []);
  if (!Array.isArray(memberships) || memberships.length === 0) {
    return { requesterId, role: 'unknown' };
  }

  const membership = memberships.find((item) => (
    toNonEmptyString(item?.groupId) === groupId
    && toNonEmptyString(item?.userId) === requesterId
  ));

  if (!membership) {
    throw new Error('Unauthorized execution: no group membership');
  }

  const role = toNonEmptyString(membership?.role).toLowerCase();
  const allowed = new Set((Array.isArray(allowedRoles) ? allowedRoles : []).map((value) => toNonEmptyString(value).toLowerCase()));
  if (!allowed.has(role) && !(role === 'admin' && allowed.has('member'))) {
    throw new Error(`Forbidden execution: role "${role}" is not allowed`);
  }

  return { requesterId, role };
};

const updateActiveTournamentLock = async ({
  ctx,
  activeTournament = null,
}) => {
  if (!ctx.collections.appMeta) {
    return { skipped: true, reason: 'APPWRITE_COLLECTION_APP_META not configured' };
  }

  const now = new Date().toISOString();
  let existing = null;
  try {
    existing = await ctx.databases.getDocument(
      ctx.databaseId,
      ctx.collections.appMeta,
      APP_META_DOC_ID
    );
  } catch (error) {
    if (error?.code !== 404) throw error;
  }

  if (existing) {
    const envelope = parseInvitesEnvelope(existing.groupInvites);
    const nextEnvelope = {
      invites: envelope.invites,
      joinRequests: envelope.joinRequests,
      activeTournament: activeTournament || null,
    };
    await writeWithUnknownAttributeRetry(
      (payload) => ctx.databases.updateDocument(
        ctx.databaseId,
        ctx.collections.appMeta,
        APP_META_DOC_ID,
        payload
      ),
      {
        groupInvites: JSON.stringify(nextEnvelope),
        updatedAt: now,
      }
    );
    return { updated: true };
  }

  const createPayload = {
    members: JSON.stringify([]),
    memberAccountLinks: JSON.stringify({}),
    templates: JSON.stringify([]),
    playerPhotos: JSON.stringify({}),
    groups: JSON.stringify([]),
    groupMembers: JSON.stringify([]),
    groupInvites: JSON.stringify({
      invites: [],
      joinRequests: [],
      activeTournament: activeTournament || null,
    }),
    updatedAt: now,
  };

  try {
    await writeWithUnknownAttributeRetry(
      (payload) => ctx.databases.createDocument(
        ctx.databaseId,
        ctx.collections.appMeta,
        APP_META_DOC_ID,
        payload
      ),
      createPayload
    );
  } catch (error) {
    const message = String(error?.message || '');
    if (!(error?.code === 409 || /already exists/i.test(message))) {
      throw error;
    }
    await writeWithUnknownAttributeRetry(
      (payload) => ctx.databases.updateDocument(
        ctx.databaseId,
        ctx.collections.appMeta,
        APP_META_DOC_ID,
        payload
      ),
      {
        groupInvites: createPayload.groupInvites,
        updatedAt: now,
      }
    );
  }

  return { created: true };
};

const makeMatchNaturalKey = ({
  matchKind,
  legacyMatchId,
  bracketRoundIndex,
  bracketMatchIndex,
}) => `${toNonEmptyString(matchKind).toLowerCase()}|${toNonEmptyString(legacyMatchId)}|${toNonEmptyString(bracketRoundIndex)}|${toNonEmptyString(bracketMatchIndex)}`;

const normalizePatchMatchKind = (value, roundValue = '') => {
  const normalized = toNonEmptyString(value).toLowerCase();
  if (normalized === 'league' || normalized === 'knockout' || normalized === 'final') {
    return normalized;
  }
  const normalizedRound = toNonEmptyString(roundValue).toLowerCase();
  if (normalizedRound === 'final') return 'final';
  return 'league';
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

const mergeTournamentState = (input = {}) => {
  const champion = input?.champion ?? null;
  const normalizedStatus = toNonEmptyString(input?.status).toLowerCase();
  return {
    name: toNonEmptyString(input?.name) || 'Untitled Tournament',
    date: toNonEmptyString(input?.date),
    teams: Array.isArray(input?.teams) ? input.teams : [],
    fixtures: Array.isArray(input?.fixtures) ? input.fixtures : [],
    bracket: Array.isArray(input?.bracket) ? input.bracket : [],
    finalMatch: input?.finalMatch ?? null,
    champion,
    format: toNonEmptyString(input?.format) || '1',
    gameMode: toNonEmptyString(input?.gameMode) || 'doubles',
    tournamentFormat: toNonEmptyString(input?.tournamentFormat) || 'league',
    status: normalizedStatus || (champion ? 'completed' : 'active'),
    oddPlayerEnabled: Boolean(input?.oddPlayerEnabled),
    oddPlayerName: toNonEmptyString(input?.oddPlayerName),
    aiSummaries: Array.isArray(input?.aiSummaries) ? input.aiSummaries : [],
    swapHistory: Array.isArray(input?.swapHistory) ? input.swapHistory : [],
  };
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

const createTournamentChildren = async ({
  ctx,
  groupId,
  tournamentId,
  legacyTournamentId,
  payload,
  playerByNormalized,
  createdTracker,
}) => {
  const teamRowIdByLegacyId = new Map();
  const teamRowIdByName = new Map();
  const now = new Date().toISOString();

  const teams = Array.isArray(payload?.teams) ? payload.teams : [];
  for (let index = 0; index < teams.length; index += 1) {
    const team = teams[index];
    const legacyTeamId = toNonEmptyString(team?.id) || String(index + 1);
    const teamName = toNonEmptyString(team?.name) || `Team ${index + 1}`;
    const player1Name = toNonEmptyString(team?.player || team?.player1);
    const player2Name = toNonEmptyString(team?.player2);

    // eslint-disable-next-line no-await-in-loop
    const createdTeam = await writeWithUnknownAttributeRetry(
      (body) => ctx.databases.createDocument(
        ctx.databaseId,
        ctx.collections.tournamentTeams,
        ID.unique(),
        body
      ),
      {
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
      }
    );

    createdTracker.teams.push(createdTeam.$id);
    teamRowIdByLegacyId.set(legacyTeamId, createdTeam.$id);
    const normalizedName = normalizeName(teamName);
    if (normalizedName) teamRowIdByName.set(normalizedName, createdTeam.$id);
  }

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

  const seenMatchKeys = new Set();
  const appendMatch = async ({
    match,
    matchKind,
    sequenceNo,
    bracketRoundIndex,
    bracketMatchIndex,
    fallbackLegacyMatchId,
  }) => {
    if (!match?.team1 && !match?.team2) return;

    const legacyMatchId = toNonEmptyString(match?.id) || fallbackLegacyMatchId;
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

    const score1 = toNumericString(match?.score1);
    const score2 = toNumericString(match?.score2);
    const createdMatch = await writeWithUnknownAttributeRetry(
      (body) => ctx.databases.createDocument(
        ctx.databaseId,
        ctx.collections.matches,
        ID.unique(),
        body
      ),
      {
        groupId,
        tournamentId,
        legacyTournamentId,
        legacyMatchId,
        matchKind,
        roundLabel: toNonEmptyString(match?.round),
        roundNo: toNonEmptyString(match?.round),
        sequenceNo: toNonEmptyString(sequenceNo),
        bracketRoundIndex: bracketRoundValue,
        bracketMatchIndex: bracketMatchValue,
        nextLegacyMatchId: toNonEmptyString(match?.nextMatchId),
        team1Id: resolveTeamRowId(match?.team1),
        team2Id: resolveTeamRowId(match?.team2),
        team1Name: toNonEmptyString(match?.team1?.name),
        team2Name: toNonEmptyString(match?.team2?.name),
        score1,
        score2,
        completed: toBooleanString(getMatchCompleted(match, score1, score2)),
        winnerSide: getWinnerSide(score1, score2),
        sourceCreatedAt: now,
        migratedAt: now,
      }
    );

    createdTracker.matches.push(createdMatch.$id);
    const participantInputs = [
      { sideNo: '1', slotNo: '1', playerName: toNonEmptyString(match?.team1?.player || match?.team1?.player1) },
      { sideNo: '1', slotNo: '2', playerName: toNonEmptyString(match?.team1?.player2) },
      { sideNo: '2', slotNo: '1', playerName: toNonEmptyString(match?.team2?.player || match?.team2?.player1) },
      { sideNo: '2', slotNo: '2', playerName: toNonEmptyString(match?.team2?.player2) },
    ].filter((participant) => participant.playerName);

    for (const participant of participantInputs) {
      // eslint-disable-next-line no-await-in-loop
      const createdParticipant = await writeWithUnknownAttributeRetry(
        (body) => ctx.databases.createDocument(
          ctx.databaseId,
          ctx.collections.matchPlayers,
          ID.unique(),
          body
        ),
        {
          groupId,
          matchId: createdMatch.$id,
          sideNo: participant.sideNo,
          slotNo: participant.slotNo,
          playerName: participant.playerName,
          playerId: resolvePlayerId(participant.playerName, playerByNormalized),
          sourceCreatedAt: now,
          migratedAt: now,
        }
      );
      createdTracker.participants.push(createdParticipant.$id);
    }
  };

  const fixtures = Array.isArray(payload?.fixtures) ? payload.fixtures : [];
  for (let index = 0; index < fixtures.length; index += 1) {
    // eslint-disable-next-line no-await-in-loop
    await appendMatch({
      match: fixtures[index],
      matchKind: 'league',
      sequenceNo: index + 1,
      bracketRoundIndex: '',
      bracketMatchIndex: '',
      fallbackLegacyMatchId: `fixture-${index + 1}`,
    });
  }

  const bracket = Array.isArray(payload?.bracket) ? payload.bracket : [];
  for (let roundIndex = 0; roundIndex < bracket.length; roundIndex += 1) {
    const round = Array.isArray(bracket[roundIndex]) ? bracket[roundIndex] : [];
    for (let matchIndex = 0; matchIndex < round.length; matchIndex += 1) {
      const roundLabel = toNonEmptyString(round[matchIndex]?.round).toLowerCase();
      // eslint-disable-next-line no-await-in-loop
      await appendMatch({
        match: round[matchIndex],
        matchKind: roundLabel === 'final' ? 'final' : 'knockout',
        sequenceNo: matchIndex + 1,
        bracketRoundIndex: roundIndex + 1,
        bracketMatchIndex: matchIndex + 1,
        fallbackLegacyMatchId: `bracket-${roundIndex + 1}-${matchIndex + 1}`,
      });
    }
  }

  if (payload?.finalMatch) {
    await appendMatch({
      match: payload.finalMatch,
      matchKind: 'final',
      sequenceNo: 1,
      bracketRoundIndex: '',
      bracketMatchIndex: '',
      fallbackLegacyMatchId: 'final',
    });
  }
};

const rollbackCreatedTournament = async ({
  ctx,
  tournamentId = '',
  createdTracker = { teams: [], matches: [], participants: [] },
}) => {
  const participants = Array.isArray(createdTracker?.participants) ? createdTracker.participants : [];
  const matches = Array.isArray(createdTracker?.matches) ? createdTracker.matches : [];
  const teams = Array.isArray(createdTracker?.teams) ? createdTracker.teams : [];

  try {
    await deleteDocumentsByIdBatched({
      ctx,
      collectionId: ctx.collections.matchPlayers,
      documentIds: participants,
    });
  } catch (_error) {
    // Ignore rollback cleanup errors.
  }

  try {
    await deleteDocumentsByIdBatched({
      ctx,
      collectionId: ctx.collections.matches,
      documentIds: matches,
    });
  } catch (_error) {
    // Ignore rollback cleanup errors.
  }

  try {
    await deleteDocumentsByIdBatched({
      ctx,
      collectionId: ctx.collections.tournamentTeams,
      documentIds: teams,
    });
  } catch (_error) {
    // Ignore rollback cleanup errors.
  }

  try {
    await deleteDocumentSafe(ctx, ctx.collections.tournaments, tournamentId);
  } catch (_error) {
    // Ignore rollback cleanup errors.
  }
};

const handleCreateTournament = async ({ ctx, req, payload }) => {
  const groupId = toGroupId(payload?.groupId);
  await assertRole({
    ctx,
    req,
    groupId,
    allowedRoles: ['member', 'admin'],
  });

  const merged = mergeTournamentState(payload?.tournament || {});
  const players = collectTournamentPlayers(merged);
  const playerByNormalized = await ensurePlayersExist({
    ctx,
    groupId,
    names: players,
    source: 'runtime.heavy-ops-tournament-create',
  });

  const tournamentId = ID.unique();
  const now = new Date().toISOString();
  const oddPlayerName = toNonEmptyString(merged.oddPlayerName);
  const oddPlayerId = resolvePlayerId(oddPlayerName, playerByNormalized);
  const tournamentPayload = {
    groupId,
    legacyTournamentId: toNonEmptyString(payload?.tournament?.legacyTournamentId)
      || toNonEmptyString(payload?.tournament?.id)
      || tournamentId,
    name: merged.name,
    dateLabel: merged.date,
    status: merged.status,
    gameMode: merged.gameMode,
    tournamentFormat: merged.tournamentFormat,
    format: merged.format,
    oddPlayerEnabled: toBooleanString(merged.oddPlayerEnabled),
    oddPlayerName,
    oddPlayerId,
    sourceCreatedAt: now,
    sourceUpdatedAt: now,
    migratedAt: now,
  };

  let createdTournament = null;
  const createdTracker = {
    teams: [],
    matches: [],
    participants: [],
  };

  try {
    createdTournament = await writeWithUnknownAttributeRetry(
      (body) => ctx.databases.createDocument(
        ctx.databaseId,
        ctx.collections.tournaments,
        tournamentId,
        body
      ),
      tournamentPayload
    );

    await createTournamentChildren({
      ctx,
      groupId,
      tournamentId: createdTournament.$id,
      legacyTournamentId: tournamentPayload.legacyTournamentId,
      payload: merged,
      playerByNormalized,
      createdTracker,
    });

    let activeTournament = undefined;
    let lockSummary = null;
    if (Object.prototype.hasOwnProperty.call(payload || {}, 'activeTournament')) {
      const incomingActive = payload?.activeTournament;
      if (incomingActive && typeof incomingActive === 'object') {
        activeTournament = {
          ...incomingActive,
          id: toNonEmptyString(incomingActive.id) || createdTournament.$id,
          appwriteId: toNonEmptyString(incomingActive.appwriteId || incomingActive.id) || createdTournament.$id,
          name: toNonEmptyString(incomingActive.name) || merged.name,
          status: toNonEmptyString(incomingActive.status) || merged.status,
          teams: Array.isArray(incomingActive.teams) ? incomingActive.teams : merged.teams,
          fixtures: Array.isArray(incomingActive.fixtures) ? incomingActive.fixtures : merged.fixtures,
          bracket: Array.isArray(incomingActive.bracket) ? incomingActive.bracket : merged.bracket,
          champion: incomingActive.champion ?? merged.champion,
          aiSummaries: Array.isArray(incomingActive.aiSummaries) ? incomingActive.aiSummaries : merged.aiSummaries,
          swapHistory: Array.isArray(incomingActive.swapHistory) ? incomingActive.swapHistory : merged.swapHistory,
          format: toNonEmptyString(incomingActive.format) || merged.format,
          gameMode: toNonEmptyString(incomingActive.gameMode) || merged.gameMode,
          tournamentFormat: toNonEmptyString(incomingActive.tournamentFormat) || merged.tournamentFormat,
          updatedAt: toNonEmptyString(incomingActive.updatedAt) || now,
          date: toNonEmptyString(incomingActive.date) || merged.date,
        };
      } else {
        activeTournament = null;
      }

      lockSummary = await updateActiveTournamentLock({
        ctx,
        activeTournament,
      });
    }

    return {
      ok: true,
      data: {
        tournament: {
          ...merged,
          id: createdTournament.$id,
          appwriteId: createdTournament.$id,
          createdAt: createdTournament.sourceCreatedAt || createdTournament.$createdAt || now,
          updatedAt: createdTournament.sourceUpdatedAt || createdTournament.$updatedAt || now,
        },
        ...(Object.prototype.hasOwnProperty.call(payload || {}, 'activeTournament')
          ? { activeTournament }
          : {}),
        lockSummary,
      },
    };
  } catch (createError) {
    await rollbackCreatedTournament({
      ctx,
      tournamentId: createdTournament?.$id || tournamentId,
      createdTracker,
    });
    throw createError;
  }
};

const patchTournamentMatches = async ({
  ctx,
  groupId,
  tournamentId,
  patches = [],
}) => {
  const baseSummary = {
    updatedMatches: 0,
    updatedParticipants: 0,
    deletedParticipants: 0,
    missingMatches: 0,
  };

  const targetTournamentId = toNonEmptyString(tournamentId);
  if (!targetTournamentId) return baseSummary;

  const normalizedPatches = (Array.isArray(patches) ? patches : [])
    .map((patch) => {
      const roundValue = patch?.roundLabel ?? patch?.round ?? patch?.roundNo;
      const matchKind = normalizePatchMatchKind(patch?.matchKind, roundValue);
      const legacyMatchId = toNonEmptyString(patch?.legacyMatchId ?? patch?.id);
      const bracketRoundIndex = toNonEmptyString(patch?.bracketRoundIndex);
      const bracketMatchIndex = toNonEmptyString(patch?.bracketMatchIndex);
      if (!legacyMatchId) return null;
      return {
        patch,
        matchKind,
        legacyMatchId,
        bracketRoundIndex,
        bracketMatchIndex,
        key: makeMatchNaturalKey({
          matchKind,
          legacyMatchId,
          bracketRoundIndex,
          bracketMatchIndex,
        }),
      };
    })
    .filter(Boolean);
  if (normalizedPatches.length === 0) return baseSummary;

  const tournamentDoc = await ctx.databases.getDocument(
    ctx.databaseId,
    ctx.collections.tournaments,
    targetTournamentId
  );
  if (toNonEmptyString(tournamentDoc?.groupId) !== groupId) {
    throw new Error('Tournament not found for this group');
  }

  const [teamRows, existingMatchRows] = await Promise.all([
    listByGroupAndValues({
      ctx,
      collectionId: ctx.collections.tournamentTeams,
      groupId,
      key: 'tournamentId',
      values: [targetTournamentId],
    }),
    listByGroupAndValues({
      ctx,
      collectionId: ctx.collections.matches,
      groupId,
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

  const targets = normalizedPatches.map((entry) => ({
    ...entry,
    row: matchByNaturalKey.get(entry.key) || null,
  }));

  const matchedRows = targets.map((entry) => entry.row).filter(Boolean);
  if (matchedRows.length === 0) {
    return {
      ...baseSummary,
      missingMatches: normalizedPatches.length,
    };
  }

  const existingParticipants = await listByGroupAndValues({
    ctx,
    collectionId: ctx.collections.matchPlayers,
    groupId,
    key: 'matchId',
    values: matchedRows.map((row) => row.$id),
  });

  const participantsByMatchId = new Map();
  existingParticipants.forEach((row) => {
    const key = toNonEmptyString(row.matchId);
    if (!key) return;
    const bucket = participantsByMatchId.get(key) || [];
    bucket.push(row);
    participantsByMatchId.set(key, bucket);
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

  const playerNames = targets.flatMap(({ patch }) => ([
    patch?.team1?.player || patch?.team1?.player1,
    patch?.team1?.player2,
    patch?.team2?.player || patch?.team2?.player1,
    patch?.team2?.player2,
  ].map((name) => toNonEmptyString(name)).filter(Boolean)));

  const playerByNormalized = await ensurePlayersExist({
    ctx,
    groupId,
    names: playerNames,
    source: 'runtime.heavy-ops-match-patch',
  });

  const now = new Date().toISOString();
  const counters = { ...baseSummary };

  for (const target of targets) {
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
    const winnerSide = toNonEmptyString(patch?.winnerSide)
      || getWinnerSide(score1, score2)
      || toNonEmptyString(row?.winnerSide);

    const matchPayload = {
      groupId,
      tournamentId: targetTournamentId,
      legacyTournamentId: toNonEmptyString(
        row?.legacyTournamentId || tournamentDoc?.legacyTournamentId || targetTournamentId
      ),
      legacyMatchId,
      matchKind,
      roundLabel: toNonEmptyString(patch?.roundLabel ?? patch?.round ?? row?.roundLabel),
      roundNo: toNonEmptyString(patch?.roundNo ?? patch?.round ?? row?.roundNo),
      sequenceNo: toNonEmptyString(row?.sequenceNo),
      bracketRoundIndex,
      bracketMatchIndex,
      nextLegacyMatchId: toNonEmptyString(patch?.nextLegacyMatchId ?? patch?.nextMatchId ?? row?.nextLegacyMatchId),
      team1Id: resolveTeamRowId(patch?.team1, toNonEmptyString(row?.team1Id)),
      team2Id: resolveTeamRowId(patch?.team2, toNonEmptyString(row?.team2Id)),
      team1Name: toNonEmptyString(patch?.team1?.name) || toNonEmptyString(row?.team1Name),
      team2Name: toNonEmptyString(patch?.team2?.name) || toNonEmptyString(row?.team2Name),
      score1,
      score2,
      completed,
      winnerSide,
      sourceCreatedAt: toNonEmptyString(row?.sourceCreatedAt) || now,
      migratedAt: now,
    };

    if (!isPayloadEqual(row, matchPayload, ['migratedAt'])) {
      // eslint-disable-next-line no-await-in-loop
      await writeWithUnknownAttributeRetry(
        (body) => ctx.databases.updateDocument(
          ctx.databaseId,
          ctx.collections.matches,
          row.$id,
          body
        ),
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
    ].filter((rowPlayer) => rowPlayer.playerName);

    const existingRows = participantsByMatchId.get(row.$id) || [];
    const existingBySlot = new Map();
    existingRows.forEach((participant) => {
      const key = `${toNonEmptyString(participant?.sideNo)}|${toNonEmptyString(participant?.slotNo)}`;
      if (!key || existingBySlot.has(key)) return;
      existingBySlot.set(key, participant);
    });

    const keepSlots = new Set();
    for (const participant of desiredParticipants) {
      const slotKey = `${participant.sideNo}|${participant.slotNo}`;
      keepSlots.add(slotKey);

      const existingParticipant = existingBySlot.get(slotKey);
      const payload = {
        groupId,
        matchId: row.$id,
        sideNo: participant.sideNo,
        slotNo: participant.slotNo,
        playerName: participant.playerName,
        playerId: resolvePlayerId(participant.playerName, playerByNormalized),
        sourceCreatedAt: toNonEmptyString(existingParticipant?.sourceCreatedAt) || now,
        migratedAt: now,
      };

      if (existingParticipant?.$id) {
        if (!isPayloadEqual(existingParticipant, payload, ['migratedAt'])) {
          // eslint-disable-next-line no-await-in-loop
          await writeWithUnknownAttributeRetry(
            (body) => ctx.databases.updateDocument(
              ctx.databaseId,
              ctx.collections.matchPlayers,
              existingParticipant.$id,
              body
            ),
            payload
          );
          counters.updatedParticipants += 1;
        }
      } else {
        // eslint-disable-next-line no-await-in-loop
        await writeWithUnknownAttributeRetry(
          (body) => ctx.databases.createDocument(
            ctx.databaseId,
            ctx.collections.matchPlayers,
            ID.unique(),
            body
          ),
          payload
        );
        counters.updatedParticipants += 1;
      }
    }

    const staleParticipants = existingRows.filter((participant) => {
      const slotKey = `${toNonEmptyString(participant?.sideNo)}|${toNonEmptyString(participant?.slotNo)}`;
      return !keepSlots.has(slotKey);
    });
    for (const stale of staleParticipants) {
      // eslint-disable-next-line no-await-in-loop
      const removed = await deleteDocumentSafe(ctx, ctx.collections.matchPlayers, stale.$id);
      if (removed) counters.deletedParticipants += 1;
    }
  }

  return counters;
};

const deleteTournament = async ({
  ctx,
  groupId,
  tournamentId,
}) => {
  const id = toNonEmptyString(tournamentId);
  if (!id) {
    return {
      attempted: false,
      deleted: false,
      teams: 0,
      matches: 0,
      participants: 0,
    };
  }

  let tournamentDoc = null;
  try {
    tournamentDoc = await ctx.databases.getDocument(
      ctx.databaseId,
      ctx.collections.tournaments,
      id
    );
  } catch (error) {
    if (error?.code === 404) {
      return {
        attempted: true,
        deleted: false,
        teams: 0,
        matches: 0,
        participants: 0,
      };
    }
    throw error;
  }

  if (toNonEmptyString(tournamentDoc?.groupId) !== groupId) {
    return {
      attempted: true,
      deleted: false,
      teams: 0,
      matches: 0,
      participants: 0,
    };
  }

  const [teamRows, matchRows] = await Promise.all([
    listByGroupAndValues({
      ctx,
      collectionId: ctx.collections.tournamentTeams,
      groupId,
      key: 'tournamentId',
      values: [id],
    }),
    listByGroupAndValues({
      ctx,
      collectionId: ctx.collections.matches,
      groupId,
      key: 'tournamentId',
      values: [id],
    }),
  ]);

  const participants = matchRows.length > 0
    ? await listByGroupAndValues({
        ctx,
        collectionId: ctx.collections.matchPlayers,
        groupId,
        key: 'matchId',
        values: matchRows.map((row) => row.$id),
      })
    : [];

  const deletedParticipants = await deleteDocumentsByIdBatched({
    ctx,
    collectionId: ctx.collections.matchPlayers,
    documentIds: participants.map((row) => row.$id),
  });

  const deletedMatches = await deleteDocumentsByIdBatched({
    ctx,
    collectionId: ctx.collections.matches,
    documentIds: matchRows.map((row) => row.$id),
  });

  const deletedTeams = await deleteDocumentsByIdBatched({
    ctx,
    collectionId: ctx.collections.tournamentTeams,
    documentIds: teamRows.map((row) => row.$id),
  });

  await deleteDocumentSafe(ctx, ctx.collections.tournaments, id);

  return {
    attempted: true,
    deleted: true,
    teams: deletedTeams,
    matches: deletedMatches,
    participants: deletedParticipants,
  };
};

const normalizeTournamentIds = (input = []) => Array.from(
  new Set(
    (Array.isArray(input) ? input : [])
      .map((id) => toNonEmptyString(id))
      .filter(Boolean)
  )
);

const handleSubmitScore = async ({ ctx, req, payload }) => {
  const groupId = toGroupId(payload?.groupId);
  await assertRole({
    ctx,
    req,
    groupId,
    allowedRoles: ['member', 'admin'],
  });

  const tournamentId = toNonEmptyString(payload?.tournamentId);
  if (!tournamentId) {
    throw new Error('Missing tournamentId');
  }

  const matchPatches = Array.isArray(payload?.matchPatches) ? payload.matchPatches : [];
  const patchSummary = await patchTournamentMatches({
    ctx,
    groupId,
    tournamentId,
    patches: matchPatches,
  });

  if (Number(patchSummary?.missingMatches || 0) > 0) {
    return {
      ok: false,
      statusCode: 409,
      error: 'One or more patched matches were not found. Falling back to full sync is required.',
      data: {
        patchSummary,
      },
    };
  }

  const ratingsSummary = await applyRatingsDelta(ctx, groupId, payload?.ratingsDelta || {});

  let lockSummary = null;
  if (Object.prototype.hasOwnProperty.call(payload || {}, 'activeTournament')) {
    lockSummary = await updateActiveTournamentLock({
      ctx,
      activeTournament: payload?.activeTournament || null,
    });
  }

  return {
    ok: true,
    data: {
      patchSummary,
      ratingsSummary,
      lockSummary,
    },
  };
};

const handleDeleteTournament = async ({ ctx, req, payload }) => {
  const groupId = toGroupId(payload?.groupId);
  await assertRole({
    ctx,
    req,
    groupId,
    allowedRoles: ['admin'],
  });

  const tournamentIds = normalizeTournamentIds(payload?.tournamentIds);
  if (tournamentIds.length === 0) {
    throw new Error('Missing tournamentIds');
  }

  const deleteResults = [];
  for (const tournamentId of tournamentIds) {
    // eslint-disable-next-line no-await-in-loop
    const summary = await deleteTournament({
      ctx,
      groupId,
      tournamentId,
    });
    deleteResults.push({
      tournamentId,
      ...summary,
    });
  }

  const hasRatingsDeltaPayload = Boolean(
    payload?.ratingsDelta
    && typeof payload.ratingsDelta === 'object'
    && (
      Object.prototype.hasOwnProperty.call(payload.ratingsDelta, 'changedRatings')
      || Object.prototype.hasOwnProperty.call(payload.ratingsDelta, 'deletedPlayerNames')
    )
  );
  const ratingsSummary = hasRatingsDeltaPayload
    ? await applyRatingsDelta(ctx, groupId, payload?.ratingsDelta || {})
    : await applyRatingsSnapshot(ctx, groupId, payload?.ratingsSnapshot || {});

  let lockSummary = null;
  if (Object.prototype.hasOwnProperty.call(payload || {}, 'clearActiveTournament')) {
    lockSummary = await updateActiveTournamentLock({
      ctx,
      activeTournament: payload?.clearActiveTournament || null,
    });
  }

  return {
    ok: true,
    data: {
      deleteResults,
      ratingsSummary,
      lockSummary,
    },
  };
};

const handleRecalculateRatings = async ({ ctx, req, payload }) => {
  const groupId = toGroupId(payload?.groupId);
  await assertRole({
    ctx,
    req,
    groupId,
    allowedRoles: ['admin'],
  });

  const ratingsSummary = await applyRatingsSnapshot(ctx, groupId, payload?.ratingsSnapshot || {});
  let lockSummary = null;
  if (Object.prototype.hasOwnProperty.call(payload || {}, 'activeTournament')) {
    lockSummary = await updateActiveTournamentLock({
      ctx,
      activeTournament: payload?.activeTournament || null,
    });
  }

  return {
    ok: true,
    data: {
      ratingsSummary,
      lockSummary,
    },
  };
};

const withResponse = (res, statusCode, body) => {
  if (typeof res?.json === 'function') {
    return res.json(body, statusCode);
  }
  return body;
};

export default async ({ req, res, log, error }) => {
  try {
    const ctx = buildContext();
    const body = parseRequestBody(req);
    const action = toNonEmptyString(body?.action);
    const payload = body?.payload && typeof body.payload === 'object' ? body.payload : {};

    if (!action) {
      return withResponse(res, 400, {
        ok: false,
        error: 'Missing action',
      });
    }

    let result = null;
    if (action === 'submit_score') {
      result = await handleSubmitScore({ ctx, req, payload });
    } else if (action === 'create_tournament') {
      result = await handleCreateTournament({ ctx, req, payload });
    } else if (action === 'delete_tournament' || action === 'delete_tournament_and_recalculate') {
      result = await handleDeleteTournament({ ctx, req, payload });
    } else if (action === 'recalculate_ratings') {
      result = await handleRecalculateRatings({ ctx, req, payload });
    } else {
      return withResponse(res, 400, {
        ok: false,
        error: `Unsupported action "${action}"`,
      });
    }

    const statusCode = Number(result?.statusCode || 200);
    const responseBody = {
      ok: Boolean(result?.ok),
      ...(result?.error ? { error: result.error } : {}),
      ...(Object.prototype.hasOwnProperty.call(result || {}, 'data') ? { data: result.data } : {}),
    };
    if (!responseBody.ok && !responseBody.error) {
      responseBody.error = 'Action failed';
    }
    return withResponse(res, statusCode, responseBody);
  } catch (caughtError) {
    if (typeof error === 'function') {
      error(caughtError?.stack || caughtError?.message || String(caughtError));
    } else if (typeof log === 'function') {
      log(caughtError?.stack || caughtError?.message || String(caughtError));
    }
    return withResponse(res, 500, {
      ok: false,
      error: caughtError?.message || 'Internal function error',
    });
  }
};
