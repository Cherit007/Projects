import { databases, DATABASE_ID, COLLECTIONS, ID } from '../appwrite.config';

const APP_META_DOC_ID = 'global-app-meta';
const SESSION_DOC_ID = 'current-session';

const parseJson = (value, fallback) => {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch (_error) {
    return fallback;
  }
};

const isMetaEnabled = () => Boolean(COLLECTIONS.APP_META);
const isSessionEnabled = () => Boolean(COLLECTIONS.SESSION_STATE);

export const appDataService = {
  isMetaEnabled,
  isSessionEnabled,

  async getAppMeta() {
    if (!isMetaEnabled()) return null;

    try {
      const doc = await databases.getDocument(
        DATABASE_ID,
        COLLECTIONS.APP_META,
        APP_META_DOC_ID
      );
      return {
        members: parseJson(doc.members, []),
        templates: parseJson(doc.templates, []),
        playerPhotos: parseJson(doc.playerPhotos, {}),
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
      templates: updates.templates ?? existing?.templates ?? [],
      playerPhotos: updates.playerPhotos ?? existing?.playerPhotos ?? {},
      updatedAt: new Date().toISOString(),
    };

    const payload = {
      members: JSON.stringify(merged.members),
      templates: JSON.stringify(merged.templates),
      playerPhotos: JSON.stringify(merged.playerPhotos),
      updatedAt: merged.updatedAt,
    };

    if (existing) {
      await databases.updateDocument(
        DATABASE_ID,
        COLLECTIONS.APP_META,
        APP_META_DOC_ID,
        payload
      );
    } else {
      await databases.createDocument(
        DATABASE_ID,
        COLLECTIONS.APP_META,
        ID.custom(APP_META_DOC_ID),
        payload
      );
    }

    return merged;
  },

  async getSessionState() {
    if (!isSessionEnabled()) return null;
    try {
      const doc = await databases.getDocument(
        DATABASE_ID,
        COLLECTIONS.SESSION_STATE,
        SESSION_DOC_ID
      );
      return parseJson(doc.state, null);
    } catch (error) {
      if (error?.code === 404) return null;
      throw error;
    }
  },

  async saveSessionState(state) {
    if (!isSessionEnabled()) return state;
    const payload = {
      state: JSON.stringify(state),
      updatedAt: new Date().toISOString(),
    };

    try {
      await databases.updateDocument(
        DATABASE_ID,
        COLLECTIONS.SESSION_STATE,
        SESSION_DOC_ID,
        payload
      );
    } catch (error) {
      if (error?.code !== 404) throw error;
      await databases.createDocument(
        DATABASE_ID,
        COLLECTIONS.SESSION_STATE,
        ID.custom(SESSION_DOC_ID),
        payload
      );
    }
    return state;
  },

  async clearSessionState() {
    if (!isSessionEnabled()) return true;
    try {
      await databases.deleteDocument(
        DATABASE_ID,
        COLLECTIONS.SESSION_STATE,
        SESSION_DOC_ID
      );
      return true;
    } catch (error) {
      if (error?.code === 404) return true;
      throw error;
    }
  },
};
