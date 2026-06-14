import {
  persistQueryClientRestore,
  persistQueryClientSubscribe,
} from '@tanstack/query-persist-client-core';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import type { Query, QueryClient } from '@tanstack/react-query';
import {
  canUseNativeStorage,
  nativeStoragePersisterAdapter,
  STORAGE_KEYS,
} from '@fixture-maker/storage/native';

const QUERY_CACHE_BUSTER = '2026-06-13-mobile-v1';
const QUERY_CACHE_MAX_AGE_MS = 12 * 60 * 60 * 1000;

const ROOT_QUERY_KEYS = new Set([
  'appwrite',
  'tournaments',
  'casual-matches',
  'groups',
  'auth',
]);

let persistenceStarted = false;
let activeUnsubscribe: (() => void) | null = null;

const getPersister = () => createAsyncStoragePersister({
  storage: nativeStoragePersisterAdapter,
  key: STORAGE_KEYS.QUERY_CACHE,
  throttleTime: 800,
});

const queryKeyStartsWith = (full: unknown[], prefix: unknown[]) => {
  if (!Array.isArray(full) || !Array.isArray(prefix) || prefix.length === 0) return false;
  if (full.length < prefix.length) return false;
  return prefix.every((value, index) => String(full[index]) === String(value));
};

const shouldPersistQuery = (query: Query) => {
  const queryKey = Array.isArray(query?.queryKey) ? query.queryKey : [];
  const rootKey = String(queryKey[0] || '');
  if (!ROOT_QUERY_KEYS.has(rootKey)) return false;
  if (queryKeyStartsWith(queryKey, ['tournaments', 'detail'])) return false;
  if (queryKeyStartsWith(queryKey, ['groups', 'admin'])) return false;
  return query?.state?.status === 'success' && query?.state?.data !== undefined;
};

export const restoreQueryCache = async (client: QueryClient) => {
  if (!canUseNativeStorage()) return;
  try {
    await persistQueryClientRestore({
      queryClient: client,
      persister: getPersister(),
      buster: QUERY_CACHE_BUSTER,
      maxAge: QUERY_CACHE_MAX_AGE_MS,
    });
  } catch (error) {
    console.warn('Failed to restore React Query cache on mobile:', error);
  }
};

export const startQueryCachePersistence = (client: QueryClient) => {
  if (!canUseNativeStorage()) return () => {};
  if (persistenceStarted) return activeUnsubscribe || (() => {});

  persistenceStarted = true;
  const unsubscribe = persistQueryClientSubscribe({
    queryClient: client,
    persister: getPersister(),
    buster: QUERY_CACHE_BUSTER,
    dehydrateOptions: {
      shouldDehydrateQuery: shouldPersistQuery,
      shouldDehydrateMutation: () => false,
    },
  });

  activeUnsubscribe = () => {
    unsubscribe();
    persistenceStarted = false;
    activeUnsubscribe = null;
  };

  return activeUnsubscribe;
};
