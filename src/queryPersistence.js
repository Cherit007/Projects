import {
  persistQueryClientRestore,
  persistQueryClientSubscribe,
} from '@tanstack/query-persist-client-core';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';

const QUERY_CACHE_STORAGE_KEY = 'bfm:rq-cache:v2';
const LEGACY_QUERY_CACHE_STORAGE_KEY = 'bfm:rq-cache:v1';
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

const canUseStorage = () => (
  typeof window !== 'undefined'
  && typeof window.localStorage !== 'undefined'
);

const getPersister = () => createSyncStoragePersister({
  storage: window.localStorage,
  key: QUERY_CACHE_STORAGE_KEY,
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
  if (!canUseStorage()) return;
  try {
    const persister = getPersister();
    await persistQueryClientRestore({
      queryClient,
      persister,
      buster: QUERY_CACHE_BUSTER,
      maxAge: QUERY_CACHE_MAX_AGE_MS,
    });
    // Drop previous custom-format cache payload if present.
    window.localStorage.removeItem(LEGACY_QUERY_CACHE_STORAGE_KEY);
  } catch (error) {
    clearPersistedQueryCache();
    console.warn('Failed to restore React Query cache snapshot:', error);
  }
};

export const startQueryCachePersistence = (queryClient) => {
  if (!canUseStorage()) return () => {};
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
  if (!canUseStorage()) return;
  try {
    window.localStorage.removeItem(QUERY_CACHE_STORAGE_KEY);
    window.localStorage.removeItem(LEGACY_QUERY_CACHE_STORAGE_KEY);
  } catch {
    // Ignore storage errors.
  }
};
