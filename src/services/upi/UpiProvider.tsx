import { useSQLiteContext, type SQLiteDatabase } from 'expo-sqlite';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { AppState } from 'react-native';

import { countPendingCandidates } from '@/data/repositories/upiCandidates';

import { syncBankSms } from './bankSmsSync';
import { setDetectionEnabled, syncUpiEvents, upiNative } from './upiSync';

interface UpiState {
  /** False on iOS and in Expo Go, where detection is impossible. */
  available: boolean;
  enabled: boolean;
  accessGranted: boolean;
  pendingCount: number;
  /** Changes after every sync, so screens can reload detected payments. */
  lastSyncAt: number;
  refresh: () => Promise<void>;
  setEnabled: (enabled: boolean) => void;
}

const UpiContext = createContext<UpiState | null>(null);

type UpiStatusSnapshot = Pick<UpiState, 'accessGranted' | 'pendingCount' | 'lastSyncAt'>;

async function loadStatus(db: SQLiteDatabase): Promise<UpiStatusSnapshot> {
  await syncUpiEvents(db);
  await syncBankSms(db);
  return {
    accessGranted: upiNative?.isAccessGranted() ?? false,
    pendingCount: await countPendingCandidates(db),
    lastSyncAt: Date.now(),
  };
}

export function UpiProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const [enabled, setEnabledState] = useState(() => upiNative?.getConfig().enabled ?? false);
  const [status, setStatus] = useState<UpiStatusSnapshot>(() => ({
    accessGranted: upiNative?.isAccessGranted() ?? false,
    pendingCount: 0,
    lastSyncAt: 0,
  }));

  const refresh = useCallback(() => loadStatus(db).then(setStatus), [db]);

  useEffect(() => {
    if (upiNative?.getConfig().enabled) {
      setDetectionEnabled(true);
    }
    loadStatus(db).then(setStatus);
    const appState = AppState.addEventListener('change', state => {
      if (state === 'active') {
        refresh();
      }
    });
    const subscription = upiNative?.addListener('onNotification', () => {
      refresh();
    });
    return () => {
      appState.remove();
      subscription?.remove();
    };
  }, [db, refresh]);

  const setEnabled = useCallback(
    (next: boolean) => {
      setDetectionEnabled(next);
      setEnabledState(next);
      refresh();
    },
    [refresh],
  );

  const value = useMemo(
    () => ({ available: upiNative != null, enabled, ...status, refresh, setEnabled }),
    [enabled, status, refresh, setEnabled],
  );

  return <UpiContext.Provider value={value}>{children}</UpiContext.Provider>;
}

export function useUpi(): UpiState {
  const value = useContext(UpiContext);
  if (!value) {
    throw new Error('useUpi must be used inside UpiProvider');
  }
  return value;
}
