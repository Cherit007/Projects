import { databases, DATABASE_ID, COLLECTIONS, ID, Query } from '../appwrite.config';

const DEFAULT_GROUP_ID = 'default-group';
const PAGE_SIZE = 100;
const IN_QUERY_LIMIT = 100;
const missingIndexCache = new Set();

const ensureV2Configured = () => {
  if (!COLLECTIONS.PLAYERS_V2 || !COLLECTIONS.RATINGS_CURRENT_V2) {
    throw new Error('V2 player collections are not configured. Set VITE_APPWRITE_COLLECTION_V2_PLAYERS and VITE_APPWRITE_COLLECTION_V2_RATINGS_CURRENT.');
  }

  if (
    (COLLECTIONS.PLAYERS && COLLECTIONS.PLAYERS_V2 === COLLECTIONS.PLAYERS)
    || (COLLECTIONS.RATINGS && COLLECTIONS.RATINGS_CURRENT_V2 === COLLECTIONS.RATINGS)
  ) {
    throw new Error(
      'Invalid Appwrite config: one or more V2 player/rating collections point to legacy collection ids.'
    );
  }
};

const normalizeName = (value) => String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();

const toGroupId = (groupId) => {
  const value = String(groupId || '').trim();
  return value || DEFAULT_GROUP_ID;
};

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toSafeString = (value) => String(value || '').trim();

const pickFirstString = (doc, keys = []) => {
  for (const key of keys) {
    const value = toSafeString(doc?.[key]);
    if (value) return value;
  }
  return '';
};

const pickFirstNumber = (doc, keys = [], fallback = 0) => {
  for (const key of keys) {
    if (doc?.[key] === undefined || doc?.[key] === null || doc?.[key] === '') continue;
    return toNumber(doc[key], fallback);
  }
  return fallback;
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

const listByGroup = async (collectionId, groupId) => {
  const docs = [];
  const groupIndexScope = 'groupId';
  if (!hasMissingIndex(collectionId, groupIndexScope)) {
    let cursor = null;
    try {
      while (true) {
        const queries = [
          Query.equal('groupId', groupId),
          Query.limit(PAGE_SIZE),
          Query.orderAsc('$id'),
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
    } catch (error) {
      if (!isIndexConstraintError(error)) throw error;
      markMissingIndex(collectionId, groupIndexScope);
    }
  }

  // Fallback for missing Appwrite attribute index on groupId.
  let fallbackCursor = null;
  while (true) {
    const queries = [
      Query.limit(PAGE_SIZE),
      Query.orderAsc('$id'),
      ...(fallbackCursor ? [Query.cursorAfter(fallbackCursor)] : []),
    ];
    const response = await databases.listDocuments(DATABASE_ID, collectionId, queries);
    const page = response?.documents || [];
    if (page.length === 0) break;
    docs.push(...page);
    if (page.length < PAGE_SIZE) break;
    fallbackCursor = page[page.length - 1].$id;
  }

  return docs.filter((doc) => String(doc?.groupId || '').trim() === groupId);
};

const listAllDocuments = async (collectionId) => {
  const docs = [];
  let cursor = null;

  while (true) {
    const queries = [
      Query.limit(PAGE_SIZE),
      Query.orderAsc('$id'),
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

const listByGroupAndValues = async ({ collectionId, groupId, key, values }) => {
  const normalizedValues = Array.from(
    new Set((Array.isArray(values) ? values : []).map((value) => String(value || '').trim()).filter(Boolean))
  );
  if (normalizedValues.length === 0) return [];

  const all = [];
  const sets = chunk(normalizedValues, IN_QUERY_LIMIT);

  const listWithQueries = async (baseQueries = []) => {
    const docs = [];
    for (const set of sets) {
      let cursor = null;
      while (true) {
        const queries = [
          ...baseQueries,
          Query.equal(key, set),
          Query.limit(PAGE_SIZE),
          Query.orderAsc('$id'),
          ...(cursor ? [Query.cursorAfter(cursor)] : []),
        ];
        // eslint-disable-next-line no-await-in-loop
        const response = await databases.listDocuments(DATABASE_ID, collectionId, queries);
        const page = response?.documents || [];
        if (page.length === 0) break;
        docs.push(...page);
        if (page.length < PAGE_SIZE) break;
        cursor = page[page.length - 1].$id;
      }
    }
    return docs;
  };

  const groupAndValueScope = `groupId+${key}`;
  if (!hasMissingIndex(collectionId, groupAndValueScope)) {
    try {
      all.push(...await listWithQueries([Query.equal('groupId', groupId)]));
      return uniqueDocuments(all);
    } catch (error) {
      if (!isIndexConstraintError(error)) throw error;
      markMissingIndex(collectionId, groupAndValueScope);
    }
  }

  const valueOnlyScope = key;
  if (!hasMissingIndex(collectionId, valueOnlyScope)) {
    try {
      all.push(...await listWithQueries([]));
      return uniqueDocuments(all).filter((doc) => String(doc?.groupId || '').trim() === groupId);
    } catch (error) {
      if (!isIndexConstraintError(error)) throw error;
      markMissingIndex(collectionId, valueOnlyScope);
    }
  }

  const byGroup = await listByGroup(collectionId, groupId);
  const allowed = new Set(normalizedValues);
  return byGroup.filter((doc) => allowed.has(String(doc?.[key] || '').trim()));
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
  const lastResult = String(lastEntry?.result || '').trim();
  const lastChange = toNumber(lastEntry?.change, 0);
  const sourceUpdatedAt = String(lastEntry?.date || now).trim() || now;

  return {
    groupId,
    playerId: String(playerDoc?.$id || '').trim(),
    playerName: String(playerName || '').trim(),
    rating: String(toNumber(snapshot?.rating, 1000)),
    matchesPlayed: String(toNumber(snapshot?.matchesPlayed, history.length)),
    lastResult,
    lastChange: String(lastChange),
    sourceUpdatedAt,
  };
};

const isRatingDocEqual = (existingDoc, payload) => (
  String(existingDoc?.groupId || '').trim() === String(payload?.groupId || '').trim()
  && String(existingDoc?.playerId || '').trim() === String(payload?.playerId || '').trim()
  && String(existingDoc?.playerName || '').trim() === String(payload?.playerName || '').trim()
  && String(existingDoc?.rating || '').trim() === String(payload?.rating || '').trim()
  && String(existingDoc?.matchesPlayed || '').trim() === String(payload?.matchesPlayed || '').trim()
  && String(existingDoc?.lastResult || '').trim() === String(payload?.lastResult || '').trim()
  && String(existingDoc?.lastChange || '').trim() === String(payload?.lastChange || '').trim()
  && String(existingDoc?.sourceUpdatedAt || '').trim() === String(payload?.sourceUpdatedAt || '').trim()
);

const ensurePlayersExist = async ({ groupId, names = [], source = 'runtime.player' }) => {
  if (names.length === 0) return new Map();

  const existing = await listByGroup(COLLECTIONS.PLAYERS_V2, groupId);
  const byNormalized = new Map();
  existing.forEach((doc) => {
    const normalized = normalizeName(doc.normalizedName || doc.displayName);
    if (normalized) byNormalized.set(normalized, doc);
  });

  const now = new Date().toISOString();
  for (const rawName of names) {
    const displayName = String(rawName || '').trim();
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

  return byNormalized;
};

export const playerService = {
  /**
   * Save or update player database (list of player names)
   */
  async savePlayerDatabase(players, groupId = null, options = {}) {
    ensureV2Configured();
    const resolvedGroupId = toGroupId(groupId);
    const { pruneMissing = false } = options || {};
    const now = new Date().toISOString();
    const uniqueByNormalized = new Map();

    (Array.isArray(players) ? players : []).forEach((rawName) => {
      const displayName = String(rawName || '').trim();
      const normalized = normalizeName(displayName);
      if (!normalized) return;
      if (!uniqueByNormalized.has(normalized)) {
        uniqueByNormalized.set(normalized, displayName);
      }
    });

    const existing = await listByGroup(COLLECTIONS.PLAYERS_V2, resolvedGroupId);
    const existingByNormalized = new Map();
    existing.forEach((doc) => {
      const normalized = normalizeName(doc.normalizedName || doc.displayName);
      if (normalized) existingByNormalized.set(normalized, doc);
    });

    for (const [normalizedName, displayName] of uniqueByNormalized.entries()) {
      const existingDoc = existingByNormalized.get(normalizedName);

      if (existingDoc?.$id) {
        const updatePayload = {};
        if (String(existingDoc.displayName || '').trim() !== displayName) {
          updatePayload.displayName = displayName;
        }
        if (String(existingDoc.normalizedName || '').trim() !== normalizedName) {
          updatePayload.normalizedName = normalizedName;
        }
        if (String(existingDoc.source || '').trim() !== 'runtime.player-database') {
          updatePayload.source = 'runtime.player-database';
        }
        if (Object.keys(updatePayload).length > 0) {
          // eslint-disable-next-line no-await-in-loop
          await databases.updateDocument(
            DATABASE_ID,
            COLLECTIONS.PLAYERS_V2,
            existingDoc.$id,
            updatePayload
          );
        }
      } else {
        const payload = {
          groupId: resolvedGroupId,
          displayName,
          normalizedName,
          source: 'runtime.player-database',
          migratedAt: now,
        };
        // eslint-disable-next-line no-await-in-loop
        await databases.createDocument(
          DATABASE_ID,
          COLLECTIONS.PLAYERS_V2,
          ID.unique(),
          payload
        );
      }
    }

    if (pruneMissing) {
      const keep = new Set(uniqueByNormalized.keys());
      for (const doc of existing) {
        const normalized = normalizeName(doc.normalizedName || doc.displayName);
        if (keep.has(normalized)) continue;
        // eslint-disable-next-line no-await-in-loop
        await databases.deleteDocument(DATABASE_ID, COLLECTIONS.PLAYERS_V2, doc.$id);
      }
    }

    return Array.from(uniqueByNormalized.values()).sort((a, b) => a.localeCompare(b));
  },

  /**
   * Get player database
   */
  async getPlayerDatabase(groupId = null) {
    ensureV2Configured();
    const resolvedGroupId = toGroupId(groupId);
    let docs = await listByGroup(COLLECTIONS.PLAYERS_V2, resolvedGroupId);
    if (docs.length === 0 && resolvedGroupId) {
      const all = await listAllDocuments(COLLECTIONS.PLAYERS_V2);
      const discoveredGroups = Array.from(
        new Set(all.map((doc) => String(doc?.groupId || '').trim()).filter(Boolean))
      );
      if (discoveredGroups.length === 1 && discoveredGroups[0] !== resolvedGroupId) {
        console.warn(
          `V2 players are stored under group "${discoveredGroups[0]}", but active group is "${resolvedGroupId}". Falling back to discovered group.`
        );
        docs = all.filter((doc) => String(doc?.groupId || '').trim() === discoveredGroups[0]);
      }
    }
    const players = docs
      .map((doc) => String(doc.displayName || '').trim())
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));

    return {
      $id: `group-${resolvedGroupId}`,
      players,
    };
  },

  /**
   * Save player ratings (ELO) into V2 ratings_current table
   */
  async savePlayerRatings(ratings, groupId = null) {
    ensureV2Configured();
    const resolvedGroupId = toGroupId(groupId);
    const now = new Date().toISOString();
    const input = ratings && typeof ratings === 'object' ? ratings : {};
    const names = Object.keys(input);

    const playerByNormalized = await ensurePlayersExist({
      groupId: resolvedGroupId,
      names,
      source: 'runtime.ratings-auto-create',
    });

    const existingRatings = await listByGroup(COLLECTIONS.RATINGS_CURRENT_V2, resolvedGroupId);
    const existingByPlayerNormalized = new Map();
    existingRatings.forEach((doc) => {
      const normalized = normalizeName(doc.playerName);
      if (normalized) existingByPlayerNormalized.set(normalized, doc);
    });

    const keepNormalized = new Set();

    for (const playerName of names) {
      const snapshot = input[playerName] || {};
      const normalized = normalizeName(playerName);
      if (!normalized) continue;

      keepNormalized.add(normalized);

      const playerDoc = playerByNormalized.get(normalized);
      const payload = buildRatingPayload({
        groupId: resolvedGroupId,
        playerName,
        snapshot,
        playerDoc,
        now,
      });

      const existingDoc = existingByPlayerNormalized.get(normalized);
      if (existingDoc?.$id) {
        if (!isRatingDocEqual(existingDoc, payload)) {
          // eslint-disable-next-line no-await-in-loop
          await databases.updateDocument(
            DATABASE_ID,
            COLLECTIONS.RATINGS_CURRENT_V2,
            existingDoc.$id,
            payload
          );
        }
      } else {
        const createPayload = {
          ...payload,
          migratedAt: now,
        };
        // eslint-disable-next-line no-await-in-loop
        await databases.createDocument(
          DATABASE_ID,
          COLLECTIONS.RATINGS_CURRENT_V2,
          ID.unique(),
          createPayload
        );
      }
    }

    for (const doc of existingRatings) {
      const normalized = normalizeName(doc.playerName);
      if (keepNormalized.has(normalized)) continue;
      // eslint-disable-next-line no-await-in-loop
      await databases.deleteDocument(DATABASE_ID, COLLECTIONS.RATINGS_CURRENT_V2, doc.$id);
    }

    return input;
  },

  /**
   * Save only changed/deleted ratings into V2 ratings_current table.
   * Avoids full collection scans on every autosave tick.
   */
  async savePlayerRatingsDelta(deltaPayload = {}, groupId = null) {
    ensureV2Configured();
    const resolvedGroupId = toGroupId(groupId);
    const now = new Date().toISOString();
    const changedInput = deltaPayload?.changedRatings && typeof deltaPayload.changedRatings === 'object'
      ? deltaPayload.changedRatings
      : {};
    const deletedInput = Array.isArray(deltaPayload?.deletedPlayerNames)
      ? deltaPayload.deletedPlayerNames
      : [];

    const changedEntries = Object.entries(changedInput)
      .map(([rawName, snapshot]) => [String(rawName || '').trim(), snapshot])
      .filter(([name]) => Boolean(name));
    const changedNames = changedEntries.map(([name]) => name);
    const changedNormalized = new Set(changedNames.map((name) => normalizeName(name)).filter(Boolean));
    const deletedNormalized = new Set(
      deletedInput.map((name) => normalizeName(name)).filter(Boolean)
    );
    changedNormalized.forEach((normalized) => deletedNormalized.delete(normalized));

    if (changedNames.length === 0 && deletedNormalized.size === 0) {
      return {
        changedRatings: {},
        deletedPlayerNames: [],
      };
    }

    const playerByNormalized = changedNames.length > 0
      ? await ensurePlayersExist({
          groupId: resolvedGroupId,
          names: changedNames,
          source: 'runtime.ratings-auto-create',
        })
      : new Map();

    const lookupNames = Array.from(new Set([
      ...changedNames,
      ...deletedInput.map((name) => String(name || '').trim()).filter(Boolean),
    ]));
    const changedPlayerIds = Array.from(new Set(
      changedNames
        .map((name) => String(playerByNormalized.get(normalizeName(name))?.$id || '').trim())
        .filter(Boolean)
    ));

    const [existingByName, existingByPlayerId] = await Promise.all([
      lookupNames.length > 0
        ? listByGroupAndValues({
            collectionId: COLLECTIONS.RATINGS_CURRENT_V2,
            groupId: resolvedGroupId,
            key: 'playerName',
            values: lookupNames,
          })
        : Promise.resolve([]),
      changedPlayerIds.length > 0
        ? listByGroupAndValues({
            collectionId: COLLECTIONS.RATINGS_CURRENT_V2,
            groupId: resolvedGroupId,
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

    for (const [playerName, snapshot] of changedEntries) {
      const normalized = normalizeName(playerName);
      if (!normalized) continue;
      const playerDoc = playerByNormalized.get(normalized);
      const payload = buildRatingPayload({
        groupId: resolvedGroupId,
        playerName,
        snapshot,
        playerDoc,
        now,
      });

      const existingDoc = existingByNormalized.get(normalized);
      if (existingDoc?.$id) {
        if (!isRatingDocEqual(existingDoc, payload)) {
          // eslint-disable-next-line no-await-in-loop
          await databases.updateDocument(
            DATABASE_ID,
            COLLECTIONS.RATINGS_CURRENT_V2,
            existingDoc.$id,
            payload
          );
        }
      } else {
        // eslint-disable-next-line no-await-in-loop
        await databases.createDocument(
          DATABASE_ID,
          COLLECTIONS.RATINGS_CURRENT_V2,
          ID.unique(),
          {
            ...payload,
            migratedAt: now,
          }
        );
      }
    }

    for (const normalized of deletedNormalized) {
      const existingDoc = existingByNormalized.get(normalized);
      if (!existingDoc?.$id) continue;
      // eslint-disable-next-line no-await-in-loop
      await databases.deleteDocument(
        DATABASE_ID,
        COLLECTIONS.RATINGS_CURRENT_V2,
        existingDoc.$id
      );
    }

    return {
      changedRatings: changedInput,
      deletedPlayerNames: Array.from(deletedNormalized),
    };
  },

  /**
   * Get player ratings
   */
  async getPlayerRatings(groupId = null) {
    ensureV2Configured();
    const resolvedGroupId = toGroupId(groupId);
    let effectiveGroupId = resolvedGroupId;
    let docs = await listByGroup(COLLECTIONS.RATINGS_CURRENT_V2, resolvedGroupId);
    if (docs.length === 0 && resolvedGroupId) {
      const all = await listAllDocuments(COLLECTIONS.RATINGS_CURRENT_V2);
      const discoveredGroups = Array.from(
        new Set(all.map((doc) => String(doc?.groupId || '').trim()).filter(Boolean))
      );
      if (discoveredGroups.length === 1 && discoveredGroups[0] !== resolvedGroupId) {
        console.warn(
          `V2 ratings are stored under group "${discoveredGroups[0]}", but active group is "${resolvedGroupId}". Falling back to discovered group.`
        );
        effectiveGroupId = discoveredGroups[0];
        docs = all.filter((doc) => String(doc?.groupId || '').trim() === effectiveGroupId);
      }
    }

    let playerNameById = new Map();
    try {
      const playerDocs = await listByGroup(COLLECTIONS.PLAYERS_V2, effectiveGroupId);
      playerNameById = new Map(
        playerDocs
          .map((doc) => [
            toSafeString(doc?.$id),
            pickFirstString(doc, ['displayName', 'name', 'normalizedName']),
          ])
          .filter(([id, name]) => id && name)
      );
    } catch (_error) {
      // Keep running even if player-name lookup fails.
    }

    const ratingsByName = new Map();
    docs.forEach((doc) => {
      const playerId = pickFirstString(doc, ['playerId', 'player']);
      const name = pickFirstString(doc, ['playerName', 'displayName', 'name'])
        || playerNameById.get(playerId)
        || playerId;
      if (!name) return;

      const rating = pickFirstNumber(doc, ['rating', 'currentRating', 'elo', 'ratingValue'], 1000);
      const matchesPlayed = pickFirstNumber(doc, ['matchesPlayed', 'matches', 'gamesPlayed'], 0);
      const lastChange = pickFirstNumber(doc, ['lastChange', 'ratingDelta', 'delta'], 0);
      const lastResult = pickFirstString(doc, ['lastResult', 'result']);
      const sourceUpdatedAt = pickFirstString(doc, ['sourceUpdatedAt', 'updatedAt', '$updatedAt', 'migratedAt'])
        || new Date().toISOString();
      const history = (lastResult || lastChange !== 0)
        ? [{
            matchId: 'v2-snapshot',
            oldRating: rating - lastChange,
            newRating: rating,
            change: lastChange,
            opponent: 'N/A',
            result: lastResult || 'unknown',
            date: sourceUpdatedAt,
          }]
        : [];

      const normalized = normalizeName(name);
      const existing = ratingsByName.get(normalized);
      if (existing && existing._sourceUpdatedAt >= sourceUpdatedAt) return;
      ratingsByName.set(normalized, {
        _name: name,
        _sourceUpdatedAt: sourceUpdatedAt,
        rating,
        matchesPlayed,
        history,
      });
    });

    const ratings = {};
    ratingsByName.forEach((value) => {
      ratings[value._name] = {
        rating: value.rating,
        matchesPlayed: value.matchesPlayed,
        history: value.history,
      };
    });

    return {
      $id: `group-${effectiveGroupId}`,
      ratings,
    };
  },

  /**
   * Add player to database
   */
  async addPlayerToDatabase(playerName, groupId = null) {
    ensureV2Configured();
    const resolvedGroupId = toGroupId(groupId);
    const trimmed = String(playerName || '').trim();
    if (!trimmed) return [];

    const dbDoc = await this.getPlayerDatabase(resolvedGroupId);
    const players = Array.isArray(dbDoc?.players) ? [...dbDoc.players] : [];
    if (!players.some((name) => normalizeName(name) === normalizeName(trimmed))) {
      players.push(trimmed);
    }

    await this.savePlayerDatabase(players, resolvedGroupId);
    return players.sort((a, b) => a.localeCompare(b));
  },
};
