import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { StyleSheet } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';

import { colors } from '@/theme/colors';

import { PressableScale } from './PressableScale';

export function AddTransactionButton() {
  return (
    <Animated.View entering={ZoomIn.springify().delay(150)} style={styles.wrap}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel="Add transaction"
        hapticKind="light"
        scaleTo={0.9}
        onPress={() => router.push('/transaction/new')}
        style={styles.fab}
      >
        <Ionicons name="add" size={32} color="#fff" />
      </PressableScale>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', right: 20, bottom: 24 },
  fab: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: colors.primary,
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
  },
});
