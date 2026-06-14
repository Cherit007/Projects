import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppSessionProvider } from './src/context/AppSessionContext';
import AppNavigator from './src/navigation/AppNavigator';
import { queryClient } from './src/query/queryClient';
import { restoreQueryCache, startQueryCachePersistence } from './src/query/queryPersistence';

export default function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let stopPersistence = () => {};

    const bootstrap = async () => {
      await restoreQueryCache(queryClient);
      stopPersistence = startQueryCachePersistence(queryClient);
      setReady(true);
    };

    void bootstrap();

    return () => {
      stopPersistence();
    };
  }, []);

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#0f766e" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AppSessionProvider>
          <AppNavigator />
          <StatusBar style="auto" />
        </AppSessionProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
