import { Stack } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { Suspense } from 'react';

import { LoadingState } from '@/components/ui';
import { migrateDbIfNeeded } from '@/data/local/migrations';
import { CloudProvider } from '@/services/cloud/CloudProvider';
import { UpiProvider } from '@/services/upi/UpiProvider';
import { colors } from '@/theme/colors';

export default function RootLayout() {
  return (
    <Suspense fallback={<LoadingState />}>
      <SQLiteProvider databaseName="finance.db" onInit={migrateDbIfNeeded} useSuspense>
        <CloudProvider>
        <UpiProvider>
          <StatusBar style="dark" />
          <Stack
            screenOptions={{
              headerTintColor: colors.primary,
              headerTitleStyle: { color: colors.text },
              headerShadowVisible: false,
              headerStyle: { backgroundColor: colors.background },
              contentStyle: { backgroundColor: colors.background },
            }}
          >
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="transaction/[id]" options={{ presentation: 'modal' }} />
            <Stack.Screen name="account/[id]" options={{ presentation: 'modal' }} />
            <Stack.Screen name="upi-review" options={{ title: 'Review payments' }} />
            <Stack.Screen name="upi-settings" options={{ title: 'Payment detection' }} />
            <Stack.Screen name="settings" options={{ title: 'Settings' }} />
            <Stack.Screen name="capture" options={{ title: 'Capture payment' }} />
            <Stack.Screen name="people/index" options={{ title: 'Friends' }} />
            <Stack.Screen name="people/[name]" options={{ title: '' }} />
          </Stack>
        </UpiProvider>
        </CloudProvider>
      </SQLiteProvider>
    </Suspense>
  );
}
