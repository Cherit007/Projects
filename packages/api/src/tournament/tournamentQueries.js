import { databases, DATABASE_ID, COLLECTIONS, Query } from '../appwrite/client.js';
import {
  CHILD_CACHE_TTL_MS,
  IN_QUERY_LIMIT,
  PAGE_SIZE,
  PLAYER_LOOKUP_CACHE_TTL_MS,
} from './tournamentConstants';
import {
  chunk,
  getMatchOptimisticVersionMs,
  getTournamentOptimisticVersionMs,
  isDeletedTournamentDoc,
  normalizeTournamentStatusValue,
  resolveTournamentImmutableId,
  toNonEmptyString,
  uniqueDocuments,
} from './tournamentUtils';

const playerLookupCache = new Map();
const tournamentChildrenCache = new Map();
const missingIndexCache = new Set();

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

const toDocumentTimestamp = (doc) => {
  const updated = Date.parse(toNonEmptyString(doc?.sourceUpdatedAt) || toNonEmptyString(doc?.$updatedAt));
  if (Number.isFinite(updated)) return updated;
  const created = Date.parse(toNonEmptyString(doc?.sourceCreatedAt) || toNonEmptyString(doc?.$createdAt));
  return Number.isFinite(created) ? created : 0;
};

const getTournamentDocPriority = (doc) => {
  const normalizedStatus = normalizeTournamentStatusValue({ status: doc?.status });
  if (normalizedStatus === 'completed') return 3;
  if (normalizedStatus === 'active') return 2;
  if (normalizedStatus === 'scheduled') return 1;
  return 0;
};

const pickCanonicalTournamentDoc = (docs = []) => (
  [...docs].sort((left, right) => {
    const priorityDiff = getTournamentDocPriority(right) - getTournamentDocPriority(left);
    if (priorityDiff !== 0) return priorityDiff;
    const timeDiff = toDocumentTimestamp(right) - toDocumentTimestamp(left);
    if (timeDiff !== 0) return timeDiff;
    return toNonEmptyString(right?.$id).localeCompare(toNonEmptyString(left?.$id));
  })[0] || null
);

const findExistingTournamentDocForCreate = async ({ groupId, payload }) => {
  const explicitAppwriteId = toNonEmptyString(payload?.appwriteId);
  if (explicitAppwriteId) {
    try {
      const doc = await databases.getDocument(
        DATABASE_ID,
        COLLECTIONS.TOURNAMENTS_V2,
        explicitAppwriteId
      );
      if (
        toNonEmptyString(doc?.groupId) === groupId
        && !isDeletedTournamentDoc(doc)
      ) {
        return doc;
      }
    } catch (error) {
      if (error?.code !== 404) throw error;
    }
  }

  const legacyTournamentId = resolveTournamentImmutableId({
    payload,
  });
  if (!legacyTournamentId) return null;

  const docs = await listByGroupAndValues({
    collectionId: COLLECTIONS.TOURNAMENTS_V2,
    groupId,
    key: 'legacyTournamentId',
    values: [legacyTournamentId],
  });
  const candidates = docs.filter((doc) => !isDeletedTournamentDoc(doc));
  return pickCanonicalTournamentDoc(candidates);
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
    const existingVersionMs = Math.max(
      getTournamentOptimisticVersionMs(existingDoc),
      getMatchOptimisticVersionMs(existingDoc)
    );
    const incomingVersionMs = Math.max(
      getTournamentOptimisticVersionMs(data),
      getMatchOptimisticVersionMs(data)
    );
    if (
      existingDoc
      && existingVersionMs > 0
      && incomingVersionMs > 0
      && incomingVersionMs <= existingVersionMs
    ) {
      continue;
    }
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

export {
  listDocumentsPaged,
  listByGroup,
  listByGroupAndValues,
  findExistingTournamentDocForCreate,
  upsertRows,
  deleteRows,
  getFreshPlayerLookupCache,
  setPlayerLookupCache,
  getFreshTournamentChildrenCache,
  setTournamentChildrenCache,
  clearTournamentChildrenCache,
  isIndexConstraintError,
};
