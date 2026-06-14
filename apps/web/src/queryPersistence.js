import {
  persistQueryClientRestore,
  persistQueryClientSubscribe,
} from '@tanstack/query-persist-client-core';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { webStorage, webStorageSyncAdapter, canUseWebStorage } from './platform/storage';
import { STORAGE_KEYS } from './platform/storageKeys';

const QUERY_CACHE_BUSTER = '2026-03-04-cache-policy-v2';
const QUERY_CACHE_MAX_AGE_MS = 12 * 60 * 60 * 1000;
const PERSIST_THROTTLE_MS = 800;

const ROOT_QUERY_KEYS = new Set([
  'appwrite',
  'tournaments',
  'casual-matches',
  'groups',
]);
const EXCLUDED_QUERY_PREFIXES = [
  ['tournaments', 'detail'],
  ['groups', 'admin'],
  ['groups', 'pending'],
];

let persistenceStarted = false;
let activeUnsubscribe = null;

const getPersister = () => createSyncStoragePersister({
  storage: webStorageSyncAdapter,
  key: STORAGE_KEYS.QUERY_CACHE,
  throttleTime: PERSIST_THROTTLE_MS,
});

const queryKeyStartsWith = (full, prefix) => {
  if (!Array.isArray(full) || !Array.isArray(prefix) || prefix.length === 0) return false;
  if (full.length < prefix.length) return false;
  return prefix.every((value, index) => String(full[index]) === String(value));
};

const shouldPersistQuery = (query) => {
  const queryKey = Array.isArray(query?.queryKey) ? query.queryKey : [];
  const rootKey = String(queryKey[0] || '');
  if (!ROOT_QUERY_KEYS.has(rootKey)) return false;
  if (EXCLUDED_QUERY_PREFIXES.some((prefix) => queryKeyStartsWith(queryKey, prefix))) return false;
  return query?.state?.status === 'success' && query?.state?.data !== undefined;
};

export const restoreQueryCache = async (queryClient) => {
  if (!canUseWebStorage()) return;
  try {
    const persister = getPersister();
    await persistQueryClientRestore({
      queryClient,
      persister,
      buster: QUERY_CACHE_BUSTER,
      maxAge: QUERY_CACHE_MAX_AGE_MS,
    });
    webStorage.removeItem(STORAGE_KEYS.QUERY_CACHE_LEGACY);
  } catch (error) {
    clearPersistedQueryCache();
    console.warn('Failed to restore React Query cache snapshot:', error);
  }
};

export const startQueryCachePersistence = (queryClient) => {
  if (!canUseWebStorage()) return () => {};
  if (persistenceStarted) return activeUnsubscribe || (() => {});
  persistenceStarted = true;

  const persister = getPersister();
  const unsubscribeQueryCache = persistQueryClientSubscribe({
    queryClient,
    persister,
    buster: QUERY_CACHE_BUSTER,
    dehydrateOptions: {
      shouldDehydrateQuery: shouldPersistQuery,
      shouldDehydrateMutation: () => false,
    },
  });

  activeUnsubscribe = () => {
    unsubscribeQueryCache();
    persistenceStarted = false;
    activeUnsubscribe = null;
  };

  return activeUnsubscribe;
};

export const clearPersistedQueryCache = () => {
  if (!canUseWebStorage()) return;
  webStorage.removeItem(STORAGE_KEYS.QUERY_CACHE);
  webStorage.removeItem(STORAGE_KEYS.QUERY_CACHE_LEGACY);
};

export const resetQueryCachePersistenceForTests = () => {
  if (activeUnsubscribe) {
    activeUnsubscribe();
  } else {
    persistenceStarted = false;
    activeUnsubscribe = null;
  }
  clearPersistedQueryCache();
};
