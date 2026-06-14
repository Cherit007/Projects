import { createStorageAdapter } from './createStorageAdapter.js';
import {
  LEGACY_LOCAL_STORAGE_KEYS,
  LEGACY_SESSION_STORAGE_KEYS,
} from './storageKeys.js';

const getBrowserStorage = (kind) => {
  if (typeof window === 'undefined') return null;
  return kind === 'session' ? window.sessionStorage : window.localStorage;
};

export const webStorage = createStorageAdapter({
  storage: getBrowserStorage('local'),
  legacyKeyMap: LEGACY_LOCAL_STORAGE_KEYS,
});

export const webSessionStorage = createStorageAdapter({
  storage: getBrowserStorage('session'),
  legacyKeyMap: LEGACY_SESSION_STORAGE_KEYS,
});

export const canUseWebStorage = () => (
  typeof window !== 'undefined'
  && typeof window.localStorage !== 'undefined'
);

export const canUseWebSessionStorage = () => (
  typeof window !== 'undefined'
  && typeof window.sessionStorage !== 'undefined'
);

/** Sync storage interface for TanStack Query persister and similar APIs. */
export const webStorageSyncAdapter = {
  getItem: (key) => webStorage.getItem(key),
  setItem: (key, value) => webStorage.setItem(key, value),
  removeItem: (key) => webStorage.removeItem(key),
};
