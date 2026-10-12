import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';

import { haptic } from '@/components/PressableScale';
import type { IconName } from '@/theme/categoryStyle';
import { colors } from '@/theme/colors';

function icon(active: IconName, inactive: IconName) {
  function TabIcon({ color, size, focused }: { color: ColorValue; size: number; focused: boolean }) {
    return <Ionicons name={focused ? active : inactive} color={color} size={size} />;
  }
  return TabIcon;
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontWeight: '600', fontSize: 11 },
        tabBarStyle: { borderTopColor: colors.border, backgroundColor: colors.surface },
        headerStyle: { backgroundColor: colors.background },
        headerShadowVisible: false,
        headerTitleStyle: { color: colors.text, fontWeight: '800', fontSize: 22 },
        sceneStyle: { backgroundColor: colors.background },
      }}
      screenListeners={{ tabPress: () => haptic('selection') }}
    >
      <Tabs.Screen name="index" options={{ title: 'Dashboard', tabBarIcon: icon('pie-chart', 'pie-chart-outline') }} />
      <Tabs.Screen name="transactions" options={{ title: 'Transactions', tabBarIcon: icon('list', 'list-outline') }} />
      <Tabs.Screen name="budgets" options={{ title: 'Budgets', tabBarIcon: icon('speedometer', 'speedometer-outline') }} />
      <Tabs.Screen name="accounts" options={{ title: 'Accounts', tabBarIcon: icon('wallet', 'wallet-outline') }} />
      <Tabs.Screen
        name="categories"
        options={{ title: 'Categories', tabBarIcon: icon('pricetags', 'pricetags-outline') }}
      />
    </Tabs>
  );
}
