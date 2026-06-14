import React from 'react';
import { Text, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import HomeScreen from '../screens/dashboard/HomeScreen';
import LiveScreen from '../screens/dashboard/LiveScreen';
import StartScreen from '../screens/dashboard/StartScreen';
import StatsScreen from '../screens/dashboard/StatsScreen';
import ProfileScreen from '../screens/dashboard/ProfileScreen';
import { colors } from '../styles/dashboardStyles';
import type { MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();

type MainTabNavigatorProps = {
  onSignedOut: () => void;
};

const TAB_ICONS: Record<keyof MainTabParamList, string> = {
  Home: '🏠',
  Live: '▶️',
  Start: '➕',
  Stats: '📊',
  Profile: '👤',
};

function TabIcon({ label, focused }: { label: keyof MainTabParamList; focused: boolean }) {
  return (
    <Text style={{ fontSize: label === 'Start' ? 22 : 18, opacity: focused ? 1 : 0.65 }}>
      {TAB_ICONS[label]}
    </Text>
  );
}

export default function MainTabNavigator({ onSignedOut }: MainTabNavigatorProps) {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          borderTopColor: colors.border,
          backgroundColor: colors.card,
          paddingBottom: Math.max(insets.bottom, 8),
          paddingTop: 8,
          height: 56 + Math.max(insets.bottom, 8),
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarIcon: ({ focused }) => <TabIcon label={route.name} focused={focused} />,
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Live" component={LiveScreen} />
      <Tab.Screen
        name="Start"
        component={StartScreen}
        options={{ tabBarLabel: 'Start' }}
      />
      <Tab.Screen name="Stats" component={StatsScreen} />
      <Tab.Screen name="Profile">
        {() => <ProfileScreen onSignedOut={onSignedOut} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}
