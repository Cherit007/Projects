import { databases, DATABASE_ID, COLLECTIONS, ID } from '../appwrite/client.js';
import { z } from 'zod';

const APP_META_DOC_ID = 'global-app-meta';
const META_CACHE_TTL_MS = 15 * 1000;
const DEFAULT_GROUP_ID = 'default-group';

const jsonRecordSchema = z.record(z.string(), z.unknown());
const appMetaSchema = z.object({
  members: z.array(z.unknown()),
  memberAccountLinks: jsonRecordSchema,
  templates: z.array(z.unknown()),
  playerPhotos: jsonRecordSchema,
  groups: z.array(z.unknown()),
  groupMembers: z.array(z.unknown()),
  groupInvites: z.array(z.unknown()),
  groupJoinRequests: z.array(z.unknown()),
  activeTournament: z.unknown().nullable(),
  updatedAt: z.string().nullable(),
}).passthrough();
const appMetaUpdateSchema = appMetaSchema.partial();
const activeTournamentLockSchema = z.object({
  id: z.string().optional(),
  appwriteId: z.string().optional(),
  name: z.string().optional(),
  status: z.string().optional(),
  updatedAt: z.string().optional(),
  teams: z.array(z.unknown()).optional(),
  fixtures: z.array(z.unknown()).optional(),
  bracket: z.array(z.unknown()).optional(),
  champion: z.unknown().nullable().optional(),
  aiSummaries: z.array(z.unknown()).optional(),
  swapHistory: z.array(z.unknown()).optional(),
  format: z.string().optional(),
  gameMode: z.string().optional(),
  tournamentFormat: z.string().optional(),
  date: z.string().optional(),
}).passthrough();

let metaCache = {
  hasValue: false,
  value: null,
  cachedAt: 0,
  groupId: DEFAULT_GROUP_ID,
};

const parseJson = (value, fallback) => {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
};

const isMetaEnabled = () => Boolean(COLLECTIONS.APP_META);
const isActiveLockCollectionEnabled = () => Boolean(COLLECTIONS.GROUP_ACTIVE_LOCKS);

const toGroupId = (groupId) => {
  const value = String(groupId || '').trim();
  return value || DEFAULT_GROUP_ID;
};

const hashGroupId = (value) => {
  let hash = 0;
  const input = String(value || '');
  for (let index = 0; index < input.length; index += 1) {
    hash = ((hash << 5) - hash) + input.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
};

const buildActiveLockDocId = (groupId) => `lock-${hashGroupId(groupId)}`;

const shouldRetryWithoutMemberAccountLinks = (error) => {
  const message = String(error?.message || '');
  return error?.code === 400 && message.includes('Unknown attribute') && message.includes('memberAccountLinks');
};

const isUnknownAttributeError = (error, attributeName) => {
  const message = String(error?.message || '');
  return error?.code === 400
    && message.includes('Unknown attribute')
    && message.includes(attributeName);
};

const parseInvitesEnvelope = (value) => {
  const parsed = parseJson(value, []);
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
  return {
    invites: [],
    joinRequests: [],
    activeTournament: null,
  };
};

const getCachedMeta = (groupId = DEFAULT_GROUP_ID) => {
  if (!metaCache.hasValue) return undefined;
  if (metaCache.groupId !== groupId) return undefined;
  if (Date.now() - metaCache.cachedAt > META_CACHE_TTL_MS) return undefined;
  return metaCache.value;
};

const setMetaCache = (value, groupId = DEFAULT_GROUP_ID) => {
  metaCache = {
    hasValue: true,
    value: value ?? null,
    cachedAt: Date.now(),
    groupId,
  };
};

const parseMaybeJson = (value, fallback) => {
  if (typeof value === 'string') return parseJson(value, fallback);
  if (value && typeof value === 'object') return value;
  return fallback;
};
const toTimestampMs = (value) => {
  const parsed = Date.parse(String(value || '').trim());
  return Number.isFinite(parsed) ? parsed : 0;
};

const parseWithSchema = (schema, value, context, fallback) => {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  console.warn(`Invalid ${context} structure. Falling back to safe defaults.`, result.error.flatten());
  return fallback;
};

const toMetaEnvelope = (meta) => ({
  members: Array.isArray(meta?.members) ? meta.members : [],
  memberAccountLinks: meta?.memberAccountLinks && typeof meta.memberAccountLinks === 'object'
    ? meta.memberAccountLinks
    : {},
  templates: Array.isArray(meta?.templates) ? meta.templates : [],
  playerPhotos: meta?.playerPhotos && typeof meta.playerPhotos === 'object'
    ? meta.playerPhotos
    : {},
  groups: Array.isArray(meta?.groups) ? meta.groups : [],
  groupMembers: Array.isArray(meta?.groupMembers) ? meta.groupMembers : [],
  groupInvites: Array.isArray(meta?.groupInvites) ? meta.groupInvites : [],
  groupJoinRequests: Array.isArray(meta?.groupJoinRequests) ? meta.groupJoinRequests : [],
  activeTournament: meta?.activeTournament || null,
  updatedAt: meta?.updatedAt || null,
});

const readActiveTournamentLockFromCollection = async (groupId) => {
  if (!isActiveLockCollectionEnabled()) {
    return {
      activeTournament: null,
      updatedAt: null,
      found: false,
    };
  }

  try {
    const doc = await databases.getDocument(
      DATABASE_ID,
      COLLECTIONS.GROUP_ACTIVE_LOCKS,
      buildActiveLockDocId(groupId)
    );
    const parsedRaw = parseMaybeJson(doc.activeTournamentJson ?? doc.activeTournament, null);
    const normalized = parsedRaw === null
      ? null
      : parseWithSchema(
          activeTournamentLockSchema,
          parsedRaw,
          'active tournament lock document',
          parsedRaw && typeof parsedRaw === 'object' ? parsedRaw : null
        );
    return {
      activeTournament: normalized || null,
      updatedAt: doc.updatedAt || doc.$updatedAt || null,
      found: true,
    };
  } catch (error) {
    if (error?.code === 404) {
      return {
        activeTournament: null,
        updatedAt: null,
        found: false,
      };
    }
    throw error;
  }
};

const upsertActiveTournamentLockInCollection = async ({
  groupId,
  activeTournament,
  updatedAt,
}) => {
  const payloadCandidates = [
    {
      groupId,
      activeTournamentJson: JSON.stringify(activeTournament || null),
      updatedAt,
    },
    {
      groupId,
      activeTournament: JSON.stringify(activeTournament || null),
      updatedAt,
    },
  ];

  const saveWithPayload = async (body) => {
    try {
      await databases.updateDocument(
        DATABASE_ID,
        COLLECTIONS.GROUP_ACTIVE_LOCKS,
        buildActiveLockDocId(groupId),
        body
      );
    } catch (error) {
      if (error?.code !== 404) throw error;
      await databases.createDocument(
        DATABASE_ID,
        COLLECTIONS.GROUP_ACTIVE_LOCKS,
        ID.custom(buildActiveLockDocId(groupId)),
        body
      );
    }
  };

  let lastError = null;
  for (const payload of payloadCandidates) {
    try {
      await saveWithPayload(payload);
      return;
    } catch (error) {
      lastError = error;
      if (
        !isUnknownAttributeError(error, 'activeTournamentJson')
        && !isUnknownAttributeError(error, 'activeTournament')
      ) {
        throw error;
      }
    }
  }
  if (lastError) throw lastError;
};
export const appDataService = {
  isMetaEnabled,

  async getAppMeta(options = {}) {
    if (!isMetaEnabled() && !isActiveLockCollectionEnabled()) return null;
    const { force = false, groupId = null } = options || {};
    const resolvedGroupId = toGroupId(groupId);

    if (!force) {
      const cached = getCachedMeta(resolvedGroupId);
      if (cached !== undefined) return cached;
    }

    let activeLockFromCollection = null;
    let activeLockUpdatedAt = null;
    let activeLockFoundInCollection = false;
    if (isActiveLockCollectionEnabled()) {
      const lockState = await readActiveTournamentLockFromCollection(resolvedGroupId);
      activeLockFromCollection = lockState.activeTournament;
      activeLockUpdatedAt = lockState.updatedAt;
      activeLockFoundInCollection = Boolean(lockState.found);
    }

    if (!isMetaEnabled()) {
      const metaOnly = toMetaEnvelope({
        activeTournament: activeLockFromCollection,
        updatedAt: activeLockUpdatedAt,
      });
      setMetaCache(metaOnly, resolvedGroupId);
      return metaOnly;
    }

    try {
      const doc = await databases.getDocument(
        DATABASE_ID,
        COLLECTIONS.APP_META,
        APP_META_DOC_ID
      );

      const invitesEnvelope = parseInvitesEnvelope(doc.groupInvites);
      const parsedInvites = invitesEnvelope.invites;
      const parsedJoinRequestsFromEnvelope = invitesEnvelope.joinRequests;
      const parsedActiveTournament = invitesEnvelope.activeTournament;
      const parsedJoinRequestsDirect = parseJson(doc.groupJoinRequests, null);

      const parsed = {
        members: parseJson(doc.members, []),
        memberAccountLinks: parseJson(doc.memberAccountLinks, {}),
        templates: parseJson(doc.templates, []),
        playerPhotos: parseJson(doc.playerPhotos, {}),
        groups: parseJson(doc.groups, []),
        groupMembers: parseJson(doc.groupMembers, []),
        groupInvites: parsedInvites,
        groupJoinRequests: Array.isArray(parsedJoinRequestsDirect)
          ? parsedJoinRequestsDirect
          : parsedJoinRequestsFromEnvelope,
        activeTournament: parsedActiveTournament,
        updatedAt: doc.updatedAt || null,
      };
      const normalized = parseWithSchema(
        appMetaSchema,
        parsed,
        'app meta document',
        toMetaEnvelope(parsed)
      );
      const withActiveLock = {
        ...normalized,
        activeTournament: isActiveLockCollectionEnabled()
          ? (activeLockFoundInCollection ? activeLockFromCollection : normalized.activeTournament)
          : normalized.activeTournament,
        updatedAt: activeLockUpdatedAt || normalized.updatedAt,
      };
      setMetaCache(withActiveLock, resolvedGroupId);
      return withActiveLock;
    } catch (error) {
      if (error?.code === 404) {
        const fallbackMeta = isActiveLockCollectionEnabled()
          ? toMetaEnvelope({
              activeTournament: activeLockFoundInCollection ? activeLockFromCollection : null,
              updatedAt: activeLockUpdatedAt,
            })
          : null;
        setMetaCache(fallbackMeta, resolvedGroupId);
        return fallbackMeta;
      }
      throw error;
    }
  },

  async saveAppMeta(updates = {}, options = {}) {
    if (!isMetaEnabled() && !isActiveLockCollectionEnabled()) return null;
    const { groupId = null } = options || {};
    const resolvedGroupId = toGroupId(groupId);
    const safeUpdates = parseWithSchema(
      appMetaUpdateSchema,
      updates || {},
      'app meta update payload',
      {}
    );

    const updateKeys = Object.keys(safeUpdates || {});
    const activeOnlyUpdate = updateKeys.length > 0 && updateKeys.every((key) => key === 'activeTournament');
    if (activeOnlyUpdate) {
      return this.saveActiveTournamentLock(
        safeUpdates.activeTournament ?? null,
        { groupId: resolvedGroupId }
      );
    }

    if (!isMetaEnabled()) {
      const activeTournamentUpdate = Object.prototype.hasOwnProperty.call(safeUpdates, 'activeTournament')
        ? safeUpdates.activeTournament ?? null
        : null;
      if (activeTournamentUpdate !== null || Object.prototype.hasOwnProperty.call(safeUpdates, 'activeTournament')) {
        await this.saveActiveTournamentLock(activeTournamentUpdate, { groupId: resolvedGroupId });
      }
      const fallbackMeta = toMetaEnvelope({
        activeTournament: activeTournamentUpdate,
        updatedAt: new Date().toISOString(),
      });
      setMetaCache(fallbackMeta, resolvedGroupId);
      return fallbackMeta;
    }

    const existing = toMetaEnvelope(await this.getAppMeta({ groupId: resolvedGroupId }));
    const merged = {
      members: safeUpdates.members ?? existing.members,
      memberAccountLinks: safeUpdates.memberAccountLinks ?? existing.memberAccountLinks,
      templates: safeUpdates.templates ?? existing.templates,
      playerPhotos: safeUpdates.playerPhotos ?? existing.playerPhotos,
      groups: safeUpdates.groups ?? existing.groups,
      groupMembers: safeUpdates.groupMembers ?? existing.groupMembers,
      groupInvites: safeUpdates.groupInvites ?? existing.groupInvites,
      groupJoinRequests: safeUpdates.groupJoinRequests ?? existing.groupJoinRequests,
      activeTournament: safeUpdates.activeTournament ?? existing.activeTournament,
      updatedAt: new Date().toISOString(),
    };

    const payload = {
      members: JSON.stringify(merged.members),
      memberAccountLinks: JSON.stringify(merged.memberAccountLinks),
      templates: JSON.stringify(merged.templates),
      playerPhotos: JSON.stringify(merged.playerPhotos),
      groups: JSON.stringify(merged.groups),
      groupMembers: JSON.stringify(merged.groupMembers),
      groupInvites: JSON.stringify({
        invites: merged.groupInvites,
        joinRequests: merged.groupJoinRequests,
        ...(isActiveLockCollectionEnabled() ? {} : { activeTournament: merged.activeTournament }),
      }),
      updatedAt: merged.updatedAt,
    };

    const saveWithPayload = async (body) => {
      if (metaCache.value) {
        await databases.updateDocument(
          DATABASE_ID,
          COLLECTIONS.APP_META,
          APP_META_DOC_ID,
          body
        );
        return;
      }
      await databases.createDocument(
        DATABASE_ID,
        COLLECTIONS.APP_META,
        ID.custom(APP_META_DOC_ID),
        body
      );
    };

    try {
      await saveWithPayload(payload);
    } catch (error) {
      if (!shouldRetryWithoutMemberAccountLinks(error)) {
        throw error;
      }

      const fallbackPayload = { ...payload };
      delete fallbackPayload.memberAccountLinks;
      await saveWithPayload(fallbackPayload);
    }

    if (Object.prototype.hasOwnProperty.call(safeUpdates, 'activeTournament')) {
      await this.saveActiveTournamentLock(
        merged.activeTournament ?? null,
        { groupId: resolvedGroupId }
      );
    }

    setMetaCache(merged, resolvedGroupId);
    return merged;
  },

  async saveActiveTournamentLock(activeTournament = null, options = {}) {
    if (!isMetaEnabled() && !isActiveLockCollectionEnabled()) return null;
    const { groupId = null } = options || {};
    const resolvedGroupId = toGroupId(groupId);
    const normalizedActiveTournament = activeTournament === null
      ? null
      : parseWithSchema(
          activeTournamentLockSchema,
          activeTournament,
          'active tournament lock payload',
          activeTournament && typeof activeTournament === 'object' ? activeTournament : null
        );
    const incomingUpdatedAt = normalizedActiveTournament?.updatedAt || new Date().toISOString();
    const updatedAt = incomingUpdatedAt;

    const currentMeta = toMetaEnvelope(
      getCachedMeta(resolvedGroupId) !== undefined
        ? getCachedMeta(resolvedGroupId)
        : await this.getAppMeta({ groupId: resolvedGroupId })
    );
    const currentUpdatedAtMs = toTimestampMs(currentMeta?.updatedAt);
    const incomingUpdatedAtMs = toTimestampMs(updatedAt);
    if (currentUpdatedAtMs > 0 && incomingUpdatedAtMs > 0 && incomingUpdatedAtMs < currentUpdatedAtMs) {
      return {
        activeTournament: currentMeta.activeTournament ?? null,
        updatedAt: currentMeta.updatedAt || null,
      };
    }

    if (isActiveLockCollectionEnabled()) {
      await upsertActiveTournamentLockInCollection({
        groupId: resolvedGroupId,
        activeTournament: normalizedActiveTournament || null,
        updatedAt,
      });

      const merged = {
        ...currentMeta,
        activeTournament: normalizedActiveTournament || null,
        updatedAt,
      };
      setMetaCache(merged, resolvedGroupId);
      return {
        activeTournament: merged.activeTournament,
        updatedAt,
      };
    }

    if (!isMetaEnabled()) {
      const fallbackMeta = toMetaEnvelope({
        activeTournament: normalizedActiveTournament || null,
        updatedAt,
      });
      setMetaCache(fallbackMeta, resolvedGroupId);
      return {
        activeTournament: fallbackMeta.activeTournament,
        updatedAt,
      };
    }

    const existing = currentMeta;
    const nextEnvelope = {
      invites: existing.groupInvites,
      joinRequests: existing.groupJoinRequests,
      activeTournament: normalizedActiveTournament || null,
    };

    try {
      await databases.updateDocument(
        DATABASE_ID,
        COLLECTIONS.APP_META,
        APP_META_DOC_ID,
        {
          groupInvites: JSON.stringify(nextEnvelope),
          updatedAt,
        }
      );
    } catch (error) {
      if (error?.code !== 404) throw error;

      await databases.createDocument(
        DATABASE_ID,
        COLLECTIONS.APP_META,
        ID.custom(APP_META_DOC_ID),
        {
          members: JSON.stringify(existing.members),
          memberAccountLinks: JSON.stringify(existing.memberAccountLinks),
          templates: JSON.stringify(existing.templates),
          playerPhotos: JSON.stringify(existing.playerPhotos),
          groups: JSON.stringify(existing.groups),
          groupMembers: JSON.stringify(existing.groupMembers),
          groupInvites: JSON.stringify(nextEnvelope),
          updatedAt,
        }
      );
    }

    const merged = {
      ...existing,
      activeTournament: nextEnvelope.activeTournament,
      updatedAt,
    };
    setMetaCache(merged, resolvedGroupId);
    return {
      activeTournament: nextEnvelope.activeTournament,
      updatedAt,
    };
  },

};
