import React, { useCallback, useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer, LinkingOptions } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAppSession } from '../context/AppSessionContext';
import { TournamentProvider } from '../context/TournamentContext';
import { useMobileAuthBootstrap } from '../hooks/useMobileAuthBootstrap';
import { useMobileBootstrap } from '../hooks/useMobileBootstrap';
import { useMobileOutboxSync } from '../hooks/useMobileOutboxSync';
import AuthScreen from '../screens/AuthScreen';
import GroupAccessScreen from '../screens/GroupAccessScreen';
import SetupScreen from '../screens/SetupScreen';
import TeamEntryScreen from '../screens/TeamEntryScreen';
import TournamentScreen from '../screens/TournamentScreen';
import SportHubScreen from '../screens/SportHubScreen';
import HistoryScreen from '../screens/HistoryScreen';
import EloScreen from '../screens/EloScreen';
import CasualMatchScreen from '../screens/CasualMatchScreen';
import MainTabNavigator from './MainTabNavigator';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['fixturemaker://'],
  config: {
    screens: {
      MainTabs: 'home',
      SportHub: 'sports',
      TournamentSetup: 'setup',
      Teams: 'teams',
      Tournament: 'tournament',
      CasualMatch: 'casual',
      History: 'history',
      EloLeaderboard: 'elo',
    },
  },
};

function AppStack({ onSignedOut }: { onSignedOut: () => void }) {
  useMobileBootstrap();
  useMobileOutboxSync();

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MainTabs">
        {() => <MainTabNavigator onSignedOut={onSignedOut} />}
      </Stack.Screen>
      <Stack.Screen name="SportHub" component={SportHubScreen} />
      <Stack.Screen name="TournamentSetup" component={SetupScreen} />
      <Stack.Screen name="Teams" component={TeamEntryScreen} />
      <Stack.Screen name="Tournament" component={TournamentScreen} />
      <Stack.Screen name="CasualMatch" component={CasualMatchScreen} />
      <Stack.Screen name="History" component={HistoryScreen} />
      <Stack.Screen name="EloLeaderboard" component={EloScreen} />
    </Stack.Navigator>
  );
}

export default function AppNavigator() {
  const { activeGroup } = useAppSession();
  const {
    bootstrapping,
    isAuthenticated,
    groupsEnabled,
    bootstrap,
    handleSignedOut,
  } = useMobileAuthBootstrap();

  const handleAuthenticated = useCallback(() => {
    void bootstrap({ showLoader: false });
  }, [bootstrap]);

  const handleGroupSelected = useCallback(() => {
    // activeGroup in context drives the next render
  }, []);

  if (bootstrapping) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#0f766e" />
      </View>
    );
  }

  const needsGroupPicker = groupsEnabled && isAuthenticated && !activeGroup;
  const canShowWorkspace = isAuthenticated && (activeGroup || !groupsEnabled);

  return (
    <NavigationContainer linking={linking}>
      {!isAuthenticated ? (
        <AuthScreen onAuthenticated={handleAuthenticated} />
      ) : needsGroupPicker ? (
        <GroupAccessScreen
          onGroupSelected={handleGroupSelected}
          onSignedOut={handleSignedOut}
        />
      ) : canShowWorkspace ? (
        <TournamentProvider>
          <AppStack onSignedOut={handleSignedOut} />
        </TournamentProvider>
      ) : (
        <GroupAccessScreen
          onGroupSelected={handleGroupSelected}
          onSignedOut={handleSignedOut}
        />
      )}
    </NavigationContainer>
  );
}
