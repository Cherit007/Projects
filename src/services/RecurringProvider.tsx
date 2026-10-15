import { useSQLiteContext } from 'expo-sqlite';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { runDueRecurring } from '@/data/repositories/recurring';

interface RecurringState {
  /** Changes whenever repeats were added, so screens can reload. */
  lastAddedAt: number;
  run: () => Promise<void>;
}

const RecurringContext = createContext<RecurringState>({ lastAddedAt: 0, run: async () => {} });

/** Adds due repeating transactions when the app starts and whenever it comes back to the foreground. */
export function RecurringProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const [lastAddedAt, setLastAddedAt] = useState(0);

  const run = useCallback(
    () =>
      runDueRecurring(db).then(
        added => {
          if (added > 0) {
            setLastAddedAt(Date.now());
          }
        },
        (err: unknown) => console.warn('Could not add repeating transactions', err),
      ),
    [db],
  );

  useEffect(() => {
    runDueRecurring(db).then(
      added => added > 0 && setLastAddedAt(Date.now()),
      (err: unknown) => console.warn('Could not add repeating transactions', err),
    );
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') {
        run();
      }
    });
    return () => subscription.remove();
  }, [db, run]);

  return <RecurringContext.Provider value={{ lastAddedAt, run }}>{children}</RecurringContext.Provider>;
}

export function useRecurring(): RecurringState {
  return useContext(RecurringContext);
}
