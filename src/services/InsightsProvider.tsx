import { useSQLiteContext } from 'expo-sqlite';
import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { runInsightNotifications, scheduleCardReminders } from './insights/notifications';

const InsightsContext = createContext(true);

/** Schedules local insight notifications when the app becomes active. */
export function InsightsProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();

  useEffect(() => {
    const run = () => {
      runInsightNotifications(db).catch(() => undefined);
      scheduleCardReminders(db).catch(() => undefined);
    };
    run();
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') {
        run();
      }
    });
    return () => sub.remove();
  }, [db]);

  return <InsightsContext.Provider value={true}>{children}</InsightsContext.Provider>;
}

export function useInsightsMounted() {
  return useContext(InsightsContext);
}
