import { useFocusEffect } from 'expo-router';
import { useSQLiteContext, type SQLiteDatabase } from 'expo-sqlite';
import { useCallback, useEffect, useRef, useState } from 'react';

export interface QueryState<T> {
  data: T | undefined;
  error: Error | undefined;
  isLoading: boolean;
  reload: () => void;
}

/**
 * Runs `load` whenever the screen gains focus or `load` changes, so screens
 * show fresh data after edits made elsewhere. Wrap `load` in `useCallback`.
 * A change of `refreshKey` also reloads, for data changed in the background.
 */
export function useFocusQuery<T>(
  load: (db: SQLiteDatabase) => Promise<T>,
  refreshKey?: unknown,
): QueryState<T> {
  const db = useSQLiteContext();
  const [data, setData] = useState<T>();
  const [error, setError] = useState<Error>();
  const [isLoading, setIsLoading] = useState(true);
  const requestId = useRef(0);

  const run = useCallback(() => {
    const id = ++requestId.current;
    setIsLoading(true);
    load(db)
      .then(result => {
        if (id === requestId.current) {
          setData(result);
          setError(undefined);
        }
      })
      .catch((err: unknown) => {
        if (id === requestId.current) {
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      })
      .finally(() => {
        if (id === requestId.current) {
          setIsLoading(false);
        }
      });
  }, [db, load]);

  useFocusEffect(run);

  const lastRefreshKey = useRef(refreshKey);
  useEffect(() => {
    if (lastRefreshKey.current !== refreshKey) {
      lastRefreshKey.current = refreshKey;
      run();
    }
  }, [refreshKey, run]);

  return { data, error, isLoading, reload: run };
}
