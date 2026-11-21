import { DarkTheme, DefaultTheme, Stack, ThemeProvider, type Theme } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { Suspense, useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AppLock } from '@/components/AppLock';
import { ThemedScreen } from '@/components/ThemedScreen';
import { LoadingState } from '@/components/ui';
import { migrateDbIfNeeded } from '@/data/local/migrations';
import { CloudProvider } from '@/services/cloud/CloudProvider';
import { InsightsProvider } from '@/services/InsightsProvider';
import { PreferencesProvider, usePreferences } from '@/services/PreferencesProvider';
import { RecurringProvider } from '@/services/RecurringProvider';
import { UpiProvider } from '@/services/upi/UpiProvider';
import { colors } from '@/theme/colors';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={StyleSheet.absoluteFill}>
    <Suspense fallback={<LoadingState />}>
      <SQLiteProvider databaseName="finance.db" onInit={migrateDbIfNeeded} useSuspense>
        <PreferencesProvider>
        <CloudProvider>
        <UpiProvider>
        <RecurringProvider>
        <InsightsProvider>
          <AppLock>
            <Screens />
          </AppLock>
        </InsightsProvider>
        </RecurringProvider>
        </UpiProvider>
        </CloudProvider>
        </PreferencesProvider>
      </SQLiteProvider>
    </Suspense>
    </GestureHandlerRootView>
  );
}

function navigationTheme(dark: boolean): Theme {
  const base = dark ? DarkTheme : DefaultTheme;
  return {
    ...base,
    colors: {
      ...base.colors,
      primary: colors.primary,
      background: colors.background,
      card: colors.surface,
      text: colors.text,
      border: colors.border,
    },
  };
}

function Screens() {
  const { scheme } = usePreferences();
  useEffect(() => {
    // Behind screens during transitions and the keyboard; older builds without the module keep the default.
    import('expo-system-ui')
      .then(SystemUI => SystemUI.setBackgroundColorAsync(colors.background))
      .catch(() => undefined);
  }, [scheme]);
  return (
    <ThemeProvider value={navigationTheme(scheme === 'dark')}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        // The tabs redraw their own screens, so switching theme keeps the selected tab.
        screenLayout={({ children, route }) =>
          route.name === '(tabs)' ? <>{children}</> : <ThemedScreen>{children}</ThemedScreen>
        }
        screenOptions={{
          headerTintColor: colors.primary,
          headerTitleStyle: { color: colors.text },
          headerShadowVisible: false,
          headerStyle: { backgroundColor: colors.background },
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="transaction/[id]" options={{ presentation: 'modal' }} />
        <Stack.Screen name="account/[id]" options={{ presentation: 'modal' }} />
        <Stack.Screen name="upi-review" options={{ title: 'Review payments' }} />
        <Stack.Screen name="upi-settings" options={{ title: 'Payment detection' }} />
        <Stack.Screen name="settings" options={{ title: 'Settings' }} />
        <Stack.Screen name="preferences" options={{ title: 'Personalise' }} />
        <Stack.Screen name="capture" options={{ title: 'Capture payment' }} />
        <Stack.Screen name="people/index" options={{ title: 'Friends and family' }} />
        <Stack.Screen name="people/[name]" options={{ title: '' }} />
        <Stack.Screen name="reports" options={{ title: 'Reports' }} />
        <Stack.Screen name="recurring" options={{ title: 'Repeating transactions' }} />
        <Stack.Screen name="backup" options={{ title: 'Backup and restore' }} />
        <Stack.Screen name="statement-import" options={{ title: 'Import statement' }} />
        <Stack.Screen name="insight-settings" options={{ title: 'Insights and alerts' }} />
        <Stack.Screen name="merchant-rules" options={{ title: 'Merchant rules' }} />
        <Stack.Screen name="search" options={{ title: 'Search' }} />
        <Stack.Screen name="goals" options={{ title: 'Savings goals' }} />
        <Stack.Screen name="cards" options={{ title: 'Credit cards' }} />
      </Stack>
    </ThemeProvider>
  );
}
