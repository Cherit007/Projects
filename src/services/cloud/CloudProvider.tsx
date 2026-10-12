import { useSQLiteContext, type SQLiteDatabase } from 'expo-sqlite';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState } from 'react-native';

import { SessionExpiredError, type CloudUser } from './backend';
import { cloudBackend } from './index';
import { lastSyncedAt, pendingChangeCount, resetSyncState, syncNow } from './sync';

const AUTO_SYNC_INTERVAL_MS = 30_000;

interface CloudState {
  /** False when this build has no cloud backend configured. */
  configured: boolean;
  status: 'loading' | 'signedOut' | 'signedIn';
  user: CloudUser | null;
  syncing: boolean;
  syncError: string | null;
  lastSyncedAt: string | null;
  pendingChanges: number;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  sync: () => Promise<void>;
}

const CloudContext = createContext<CloudState | null>(null);

function describe(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

async function loadSyncStatus(db: SQLiteDatabase) {
  const [last, pending] = await Promise.all([lastSyncedAt(db), pendingChangeCount(db)]);
  return { lastSyncedAt: last, pendingChanges: pending };
}

export function CloudProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const [status, setStatus] = useState<CloudState['status']>(() =>
    cloudBackend() ? 'loading' : 'signedOut',
  );
  const [user, setUser] = useState<CloudUser | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState({ lastSyncedAt: null as string | null, pendingChanges: 0 });
  const running = useRef(false);

  const sync = useCallback(async () => {
    const backend = cloudBackend();
    if (!backend || !user || running.current) {
      return;
    }
    running.current = true;
    setSyncing(true);
    try {
      await syncNow(db, backend.sync, user.id);
      setSyncError(null);
    } catch (err) {
      if (err instanceof SessionExpiredError) {
        setUser(null);
        setStatus('signedOut');
      }
      setSyncError(describe(err));
    } finally {
      running.current = false;
      setSyncing(false);
      setSyncStatus(await loadSyncStatus(db));
    }
  }, [db, user]);

  useEffect(() => {
    const backend = cloudBackend();
    loadSyncStatus(db).then(setSyncStatus);
    if (!backend) {
      return;
    }
    backend.auth.currentUser().then(current => {
      setUser(current);
      setStatus(current ? 'signedIn' : 'signedOut');
    });
  }, [db]);

  useEffect(() => {
    if (!user) {
      return;
    }
    const initial = setTimeout(sync, 0);
    const appState = AppState.addEventListener('change', state => {
      if (state === 'active') {
        sync();
      }
    });
    const timer = setInterval(async () => {
      if ((await pendingChangeCount(db)) > 0) {
        sync();
      }
    }, AUTO_SYNC_INTERVAL_MS);
    return () => {
      clearTimeout(initial);
      appState.remove();
      clearInterval(timer);
    };
  }, [db, user, sync]);

  const signInWithGoogle = useCallback(async () => {
    const backend = cloudBackend();
    if (!backend) {
      throw new Error('Cloud sync is not configured for this build.');
    }
    const signedIn = await backend.auth.signInWithGoogle();
    if (signedIn) {
      setUser(signedIn);
      setStatus('signedIn');
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await cloudBackend()?.auth.signOut();
    } finally {
      await resetSyncState(db);
      setUser(null);
      setStatus('signedOut');
      setSyncStatus(await loadSyncStatus(db));
    }
  }, [db]);

  const value = useMemo(
    () => ({
      configured: cloudBackend() !== null,
      status,
      user,
      syncing,
      syncError,
      ...syncStatus,
      signInWithGoogle,
      signOut,
      sync,
    }),
    [status, user, syncing, syncError, syncStatus, signInWithGoogle, signOut, sync],
  );

  return <CloudContext.Provider value={value}>{children}</CloudContext.Provider>;
}

export function useCloud(): CloudState {
  const value = useContext(CloudContext);
  if (!value) {
    throw new Error('useCloud must be used inside CloudProvider');
  }
  return value;
}
