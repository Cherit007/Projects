import AsyncStorage from '@react-native-async-storage/async-storage';
import { LEGACY_LOCAL_STORAGE_KEYS, STORAGE_KEYS } from './storageKeys.js';

const migrateLegacyValue = async (canonicalKey) => {
  const legacyKey = LEGACY_LOCAL_STORAGE_KEYS[canonicalKey];
  if (!legacyKey) return null;

  try {
    const legacyValue = await AsyncStorage.getItem(legacyKey);
    if (legacyValue === null) return null;
    await AsyncStorage.setItem(canonicalKey, legacyValue);
    await AsyncStorage.removeItem(legacyKey);
    return legacyValue;
  } catch {
    return null;
  }
};

export const nativeStorage = {
  async getItem(key) {
    const canonicalKey = String(key || '').trim();
    if (!canonicalKey) return null;

    try {
      const value = await AsyncStorage.getItem(canonicalKey);
      if (value !== null) return value;
      return migrateLegacyValue(canonicalKey);
    } catch {
      return null;
    }
  },

  async setItem(key, value) {
    const canonicalKey = String(key || '').trim();
    if (!canonicalKey) return;

    try {
      await AsyncStorage.setItem(canonicalKey, String(value));
      const legacyKey = LEGACY_LOCAL_STORAGE_KEYS[canonicalKey];
      if (legacyKey) {
        await AsyncStorage.removeItem(legacyKey);
      }
    } catch {
      // Ignore quota errors.
    }
  },

  async removeItem(key) {
    const canonicalKey = String(key || '').trim();
    if (!canonicalKey) return;

    try {
      await AsyncStorage.removeItem(canonicalKey);
      const legacyKey = LEGACY_LOCAL_STORAGE_KEYS[canonicalKey];
      if (legacyKey) {
        await AsyncStorage.removeItem(legacyKey);
      }
    } catch {
      // Ignore storage errors.
    }
  },

  async getJson(key, fallback = null) {
    const raw = await this.getItem(key);
    if (raw == null) return fallback;
    try {
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  },

  async setJson(key, value) {
    try {
      await this.setItem(key, JSON.stringify(value));
    } catch {
      // Ignore serialization errors.
    }
  },
};

/** AsyncStorage interface for TanStack Query async persister. */
export const nativeStoragePersisterAdapter = AsyncStorage;

export { STORAGE_KEYS };

export const canUseNativeStorage = () => Boolean(AsyncStorage);
