import { databases, DATABASE_ID, COLLECTIONS, ID } from '../appwrite.config';

const APP_META_DOC_ID = 'global-app-meta';
const META_CACHE_TTL_MS = 15 * 1000;

let metaCache = {
  hasValue: false,
  value: null,
  cachedAt: 0,
};

const parseJson = (value, fallback) => {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch (_error) {
    return fallback;
  }
};

const isMetaEnabled = () => Boolean(COLLECTIONS.APP_META);

const shouldRetryWithoutMemberAccountLinks = (error) => {
  const message = String(error?.message || '');
  return error?.code === 400 && message.includes('Unknown attribute') && message.includes('memberAccountLinks');
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

const getCachedMeta = () => {
  if (!metaCache.hasValue) return undefined;
  if (Date.now() - metaCache.cachedAt > META_CACHE_TTL_MS) return undefined;
  return metaCache.value;
};

const setMetaCache = (value) => {
  metaCache = {
    hasValue: true,
    value: value ?? null,
    cachedAt: Date.now(),
  };
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
export const appDataService = {
  isMetaEnabled,

  async getAppMeta(options = {}) {
    if (!isMetaEnabled()) return null;
    const { force = false } = options || {};

    if (!force) {
      const cached = getCachedMeta();
      if (cached !== undefined) return cached;
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
      setMetaCache(parsed);
      return parsed;
    } catch (error) {
      if (error?.code === 404) {
        setMetaCache(null);
        return null;
      }
      throw error;
    }
  },

  async saveAppMeta(updates = {}) {
    if (!isMetaEnabled()) return null;

    const updateKeys = Object.keys(updates || {});
    const activeOnlyUpdate = updateKeys.length > 0 && updateKeys.every((key) => key === 'activeTournament');
    if (activeOnlyUpdate) {
      return this.saveActiveTournamentLock(updates.activeTournament ?? null);
    }

    const existing = toMetaEnvelope(await this.getAppMeta());
    const merged = {
      members: updates.members ?? existing.members,
      memberAccountLinks: updates.memberAccountLinks ?? existing.memberAccountLinks,
      templates: updates.templates ?? existing.templates,
      playerPhotos: updates.playerPhotos ?? existing.playerPhotos,
      groups: updates.groups ?? existing.groups,
      groupMembers: updates.groupMembers ?? existing.groupMembers,
      groupInvites: updates.groupInvites ?? existing.groupInvites,
      groupJoinRequests: updates.groupJoinRequests ?? existing.groupJoinRequests,
      activeTournament: updates.activeTournament ?? existing.activeTournament,
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
        activeTournament: merged.activeTournament,
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

    setMetaCache(merged);
    return merged;
  },

  async saveActiveTournamentLock(activeTournament = null) {
    if (!isMetaEnabled()) return null;
    const updatedAt = new Date().toISOString();
    const existing = toMetaEnvelope(
      getCachedMeta() !== undefined ? getCachedMeta() : await this.getAppMeta()
    );
    const nextEnvelope = {
      invites: existing.groupInvites,
      joinRequests: existing.groupJoinRequests,
      activeTournament: activeTournament || null,
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
    setMetaCache(merged);
    return {
      activeTournament: nextEnvelope.activeTournament,
      updatedAt,
    };
  },

};
