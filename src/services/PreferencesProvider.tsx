import { useSQLiteContext } from 'expo-sqlite';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Appearance, useColorScheme } from 'react-native';

import { LoadingState } from '@/components/ui';
import {
  getAppLock,
  getDashboardLayoutSetting,
  getMonthStartDaySetting,
  getOnboarded,
  getThemePreference,
  setAppLock as saveAppLock,
  setDashboardLayoutSetting,
  setMonthStartDaySetting,
  setOnboarded,
  setThemePreference,
  type ThemePreference,
} from '@/data/repositories/settings';
import { parseDashboardLayout, type DashboardSection } from '@/domain/dashboard';
import { setMonthStartDay } from '@/domain/period';
import { setActiveScheme, type ColorScheme } from '@/theme/colors';

interface Preferences {
  theme: ThemePreference;
  monthStartDay: number;
  appLock: boolean;
  onboarded: boolean;
  dashboard: DashboardSection[];
}

interface PreferencesValue extends Preferences {
  /** The colour scheme in use: the chosen theme, or the phone's for `system`. */
  scheme: ColorScheme;
  setTheme: (theme: ThemePreference) => Promise<void>;
  setMonthStart: (day: number) => Promise<void>;
  setAppLock: (enabled: boolean) => Promise<void>;
  setDashboard: (layout: DashboardSection[]) => Promise<void>;
  finishOnboarding: () => Promise<void>;
}

const PreferencesContext = createContext<PreferencesValue | null>(null);

async function loadPreferences(db: ReturnType<typeof useSQLiteContext>): Promise<Preferences> {
  const [theme, monthStartDay, appLock, onboarded, layout] = await Promise.all([
    getThemePreference(db),
    getMonthStartDaySetting(db),
    getAppLock(db),
    getOnboarded(db),
    getDashboardLayoutSetting(db),
  ]);
  let done = onboarded;
  if (!done) {
    // People who used the app before first-run setup existed skip it.
    const used = await db.getFirstAsync('SELECT 1 FROM transactions LIMIT 1');
    if (used) {
      await setOnboarded(db);
      done = true;
    }
  }
  return { theme, monthStartDay, appLock, onboarded: done, dashboard: parseDashboardLayout(layout) };
}

/**
 * Loads device preferences before the app renders and applies the month
 * start day and colour scheme, which the rest of the app reads globally.
 */
export function PreferencesProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const system = useColorScheme();
  const [prefs, setPrefs] = useState<Preferences>();

  useEffect(() => {
    loadPreferences(db)
      .then(loaded => {
        setMonthStartDay(loaded.monthStartDay);
        setPrefs(loaded);
      })
      .catch(() =>
        setPrefs({ theme: 'system', monthStartDay: 1, appLock: false, onboarded: true, dashboard: parseDashboardLayout(null) }),
      );
  }, [db]);

  useEffect(() => {
    if (prefs) {
      Appearance.setColorScheme(prefs.theme === 'system' ? 'unspecified' : prefs.theme);
    }
  }, [prefs]);

  const update = useCallback((patch: Partial<Preferences>) => setPrefs(p => (p ? { ...p, ...patch } : p)), []);

  const setTheme = useCallback(
    async (theme: ThemePreference) => {
      await setThemePreference(db, theme);
      update({ theme });
    },
    [db, update],
  );
  const setMonthStart = useCallback(
    async (day: number) => {
      await setMonthStartDaySetting(db, day);
      const saved = await getMonthStartDaySetting(db);
      setMonthStartDay(saved);
      update({ monthStartDay: saved });
    },
    [db, update],
  );
  const setAppLock = useCallback(
    async (enabled: boolean) => {
      await saveAppLock(db, enabled);
      update({ appLock: enabled });
    },
    [db, update],
  );
  const setDashboard = useCallback(
    async (layout: DashboardSection[]) => {
      await setDashboardLayoutSetting(db, JSON.stringify(layout));
      update({ dashboard: layout });
    },
    [db, update],
  );
  const finishOnboarding = useCallback(async () => {
    await setOnboarded(db);
    update({ onboarded: true });
  }, [db, update]);

  const scheme: ColorScheme = prefs?.theme === 'dark' || prefs?.theme === 'light' ? prefs.theme : system === 'dark' ? 'dark' : 'light';
  setActiveScheme(scheme);

  const value = useMemo(
    () =>
      prefs ? { ...prefs, scheme, setTheme, setMonthStart, setAppLock, setDashboard, finishOnboarding } : null,
    [prefs, scheme, setTheme, setMonthStart, setAppLock, setDashboard, finishOnboarding],
  );

  if (!value) {
    return <LoadingState />;
  }
  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences(): PreferencesValue {
  const value = useContext(PreferencesContext);
  if (!value) {
    throw new Error('usePreferences must be used inside PreferencesProvider');
  }
  return value;
}
