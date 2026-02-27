import { databases, DATABASE_ID, COLLECTIONS, ID } from '../appwrite.config';

const APP_META_DOC_ID = 'global-app-meta';

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
export const appDataService = {
  isMetaEnabled,

  async getAppMeta() {
    if (!isMetaEnabled()) return null;

    try {
      const doc = await databases.getDocument(
        DATABASE_ID,
        COLLECTIONS.APP_META,
        APP_META_DOC_ID
      );

      const invitesEnvelope = parseJson(doc.groupInvites, []);
      const parsedInvites = Array.isArray(invitesEnvelope)
        ? invitesEnvelope
        : (Array.isArray(invitesEnvelope?.invites) ? invitesEnvelope.invites : []);
      const parsedJoinRequestsFromEnvelope = Array.isArray(invitesEnvelope?.joinRequests)
        ? invitesEnvelope.joinRequests
        : [];
      const parsedJoinRequestsDirect = parseJson(doc.groupJoinRequests, null);

      return {
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
        updatedAt: doc.updatedAt || null,
      };
    } catch (error) {
      if (error?.code === 404) return null;
      throw error;
    }
  },

  async saveAppMeta(updates = {}) {
    if (!isMetaEnabled()) return null;

    const existing = await this.getAppMeta();
    const merged = {
      members: updates.members ?? existing?.members ?? [],
      memberAccountLinks: updates.memberAccountLinks ?? existing?.memberAccountLinks ?? {},
      templates: updates.templates ?? existing?.templates ?? [],
      playerPhotos: updates.playerPhotos ?? existing?.playerPhotos ?? {},
      groups: updates.groups ?? existing?.groups ?? [],
      groupMembers: updates.groupMembers ?? existing?.groupMembers ?? [],
      groupInvites: updates.groupInvites ?? existing?.groupInvites ?? [],
      groupJoinRequests: updates.groupJoinRequests ?? existing?.groupJoinRequests ?? [],
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
      }),
      updatedAt: merged.updatedAt,
    };

    const saveWithPayload = async (body) => {
      if (existing) {
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

    return merged;
  },

};
