import { makeRedirectUri } from 'expo-auth-session';
import { useSQLiteContext, type SQLiteDatabase } from 'expo-sqlite';
import * as WebBrowser from 'expo-web-browser';
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
import { AppwriteException, OAuthProvider, type Models } from 'react-native-appwrite';

import { cloud } from './client';
import { isCloudConfigured, oauthScheme } from './config';
import { lastSyncedAt, pendingChangeCount, resetSyncState, syncNow } from './sync';

WebBrowser.maybeCompleteAuthSession();

const AUTO_SYNC_INTERVAL_MS = 30_000;

type User = Models.User<Models.Preferences>;

interface CloudState {
  /** False when this build has no Appwrite project configured. */
  configured: boolean;
  status: 'loading' | 'signedOut' | 'signedIn';
  user: User | null;
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
  if (err instanceof AppwriteException) {
    return err.message;
  }
  return err instanceof Error ? err.message : String(err);
}

async function loadSyncStatus(db: SQLiteDatabase) {
  const [last, pending] = await Promise.all([lastSyncedAt(db), pendingChangeCount(db)]);
  return { lastSyncedAt: last, pendingChanges: pending };
}

export function CloudProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const [status, setStatus] = useState<CloudState['status']>(isCloudConfigured ? 'loading' : 'signedOut');
  const [user, setUser] = useState<User | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState({ lastSyncedAt: null as string | null, pendingChanges: 0 });
  const running = useRef(false);

  const sync = useCallback(async () => {
    const services = cloud();
    if (!services || !user || running.current) {
      return;
    }
    running.current = true;
    setSyncing(true);
    try {
      await syncNow(db, user.$id);
      setSyncError(null);
    } catch (err) {
      if (err instanceof AppwriteException && err.code === 401) {
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
    const services = cloud();
    loadSyncStatus(db).then(setSyncStatus);
    if (!services) {
      return;
    }
    services.account
      .get()
      .then(current => {
        setUser(current);
        setStatus('signedIn');
      })
      .catch(() => setStatus('signedOut'));
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
    const services = cloud();
    if (!services) {
      throw new Error('Cloud sync is not configured for this build.');
    }
    // Expo Go returns to exp://; a build returns to the appwrite-callback scheme.
    const redirect = makeRedirectUri({ scheme: oauthScheme, preferLocalhost: true });
    const loginUrl = services.account.createOAuth2Token({
      provider: OAuthProvider.Google,
      success: redirect,
      failure: redirect,
    });
    if (!loginUrl) {
      throw new Error('Could not start Google sign-in.');
    }
    const result = await WebBrowser.openAuthSessionAsync(loginUrl.toString(), redirect);
    if (result.type !== 'success') {
      return;
    }
    const params = new URL(result.url).searchParams;
    const userId = params.get('userId');
    const secret = params.get('secret');
    if (!userId || !secret) {
      throw new Error('Google sign-in was cancelled or failed.');
    }
    await services.account.createSession({ userId, secret });
    setUser(await services.account.get());
    setStatus('signedIn');
  }, []);

  const signOut = useCallback(async () => {
    const services = cloud();
    try {
      await services?.account.deleteSession({ sessionId: 'current' });
    } finally {
      await resetSyncState(db);
      setUser(null);
      setStatus('signedOut');
      setSyncStatus(await loadSyncStatus(db));
    }
  }, [db]);

  const value = useMemo(
    () => ({
      configured: isCloudConfigured,
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
