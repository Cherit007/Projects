import Ionicons from '@expo/vector-icons/Ionicons';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, Platform, StyleSheet, Text, View } from 'react-native';

import { loadNative } from '@/services/loadNative';
import { usePreferences } from '@/services/PreferencesProvider';
import { colors, themedStyles } from '@/theme/colors';

import { Button } from './ui';

/** Coming back within this long (e.g. from copying an OTP) does not ask again. */
const RELOCK_AFTER_MS = 30_000;

const localAuth = () => loadNative(() => import('expo-local-authentication'), 'App lock');

/** Errors that mean the phone has no way to unlock: keeping the app locked would lock the user out. */
const CANNOT_LOCK = new Set(['not_enrolled', 'not_available', 'passcode_not_set']);

const PRIVACY_KEY = 'app-lock';

async function setSystemPrivacy(enabled: boolean): Promise<void> {
  try {
    const ScreenCapture = await import('expo-screen-capture');
    if (Platform.OS === 'android') {
      await (enabled ? ScreenCapture.preventScreenCaptureAsync(PRIVACY_KEY) : ScreenCapture.allowScreenCaptureAsync(PRIVACY_KEY));
    } else if (Platform.OS === 'ios') {
      await (enabled ? ScreenCapture.enableAppSwitcherProtectionAsync() : ScreenCapture.disableAppSwitcherProtectionAsync());
    }
  } catch {
    // Builds without the module keep only the in-app cover.
  }
}

/**
 * Asks for the phone's fingerprint, face or passcode. Resolves true when the
 * user is verified, or when the phone cannot verify anyone at all.
 */
export async function verifyOwner(promptMessage = 'Unlock Many Tracker'): Promise<boolean> {
  let LocalAuthentication: Awaited<ReturnType<typeof localAuth>>;
  try {
    LocalAuthentication = await localAuth();
  } catch {
    return true;
  }
  const result = await LocalAuthentication.authenticateAsync({ promptMessage });
  return result.success || CANNOT_LOCK.has(result.error);
}

/** Whether this phone and build can lock the app (a fingerprint, face or passcode is set up). */
export async function canLockApp(): Promise<boolean> {
  try {
    const LocalAuthentication = await localAuth();
    const level = await LocalAuthentication.getEnrolledLevelAsync();
    return level !== LocalAuthentication.SecurityLevel.NONE;
  } catch {
    return false;
  }
}

/**
 * Covers the app until the owner unlocks it, when app lock is on: at launch
 * and after it has been in the background for a while. The screens stay
 * mounted underneath, so unlocking returns to where the user was. The cover
 * also hides balances in the app switcher.
 */
export function AppLock({ children }: { children: ReactNode }) {
  const { appLock } = usePreferences();
  const [locked, setLocked] = useState(appLock);
  const [hidden, setHidden] = useState(false);
  const [busy, setBusy] = useState(false);
  const backgroundedAt = useRef<number | null>(null);

  const unlock = useCallback(async () => {
    setBusy(true);
    try {
      if (await verifyOwner()) {
        setLocked(false);
      }
    } finally {
      setBusy(false);
    }
  }, []);

  // The JS cover is drawn too late for the system's app-switcher snapshot, so the OS hides it:
  // Android blanks the window (this also blocks screenshots), iOS blurs the snapshot.
  useEffect(() => {
    setSystemPrivacy(appLock);
  }, [appLock]);

  useEffect(() => {
    if (!appLock) {
      return;
    }
    const sub = AppState.addEventListener('change', state => {
      if (state === 'background') {
        backgroundedAt.current = Date.now();
        setHidden(true);
      } else if (state === 'inactive') {
        setHidden(true);
      } else if (state === 'active') {
        setHidden(false);
        const since = backgroundedAt.current;
        backgroundedAt.current = null;
        if (since !== null && Date.now() - since >= RELOCK_AFTER_MS) {
          setLocked(true);
        }
      }
    });
    return () => sub.remove();
  }, [appLock]);

  // The system prompt itself makes the app inactive, so prompt once per lock; after a cancel the button retries.
  const prompted = useRef(false);
  useEffect(() => {
    if (!locked) {
      prompted.current = false;
    } else if (!hidden && !prompted.current) {
      prompted.current = true;
      unlock();
    }
  }, [locked, hidden, unlock]);

  const covered = appLock && (locked || hidden);
  return (
    <View style={styles.root}>
      {children}
      {covered && (
        <View style={[StyleSheet.absoluteFill, styles.cover]}>
          <View style={styles.icon}>
            <Ionicons name="lock-closed" size={30} color={colors.primary} />
          </View>
          <Text style={styles.title}>Many Tracker is locked</Text>
          {locked && <Button title={busy ? 'Waiting…' : 'Unlock'} icon="finger-print" onPress={unlock} disabled={busy} />}
        </View>
      )}
    </View>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
    root: { flex: 1 },
    cover: { backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32 },
    icon: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: { fontSize: 18, fontWeight: '700', color: colors.text },
  }),
);
