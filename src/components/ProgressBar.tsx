import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import type { BudgetLevel } from '@/domain/budgets/budgets';
import { colors, themedStyles } from '@/theme/colors';

export const levelColor = themedStyles((): Record<BudgetLevel, string> => ({
  ok: colors.income,
  warning: colors.warning,
  over: colors.expense,
}));

/** Animated horizontal bar; ratios above 1 are drawn full. */
export function ProgressBar({ ratio, color, height = 8 }: { ratio: number; color: string; height?: number }) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.set(withTiming(Math.min(Math.max(ratio, 0), 1), { duration: 600 }));
  }, [progress, ratio]);
  const fillStyle = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));
  return (
    <View style={[styles.track, { height, borderRadius: height / 2 }]}>
      <Animated.View style={[{ height, borderRadius: height / 2, backgroundColor: color }, fillStyle]} />
    </View>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  track: { backgroundColor: colors.surfaceMuted, overflow: 'hidden' },
}));
