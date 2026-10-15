import { Stack } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { Suspense } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { LoadingState } from '@/components/ui';
import { migrateDbIfNeeded } from '@/data/local/migrations';
import { CloudProvider } from '@/services/cloud/CloudProvider';
import { RecurringProvider } from '@/services/RecurringProvider';
import { UpiProvider } from '@/services/upi/UpiProvider';
import { colors } from '@/theme/colors';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={StyleSheet.absoluteFill}>
    <Suspense fallback={<LoadingState />}>
      <SQLiteProvider databaseName="finance.db" onInit={migrateDbIfNeeded} useSuspense>
        <CloudProvider>
        <UpiProvider>
        <RecurringProvider>
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
            <Stack.Screen name="people/index" options={{ title: 'Friends and family' }} />
            <Stack.Screen name="people/[name]" options={{ title: '' }} />
            <Stack.Screen name="reports" options={{ title: 'Reports' }} />
            <Stack.Screen name="recurring" options={{ title: 'Repeating transactions' }} />
            <Stack.Screen name="backup" options={{ title: 'Backup and restore' }} />
            <Stack.Screen name="statement-import" options={{ title: 'Import bank statement' }} />
          </Stack>
        </RecurringProvider>
        </UpiProvider>
        </CloudProvider>
      </SQLiteProvider>
    </Suspense>
    </GestureHandlerRootView>
  );
}
