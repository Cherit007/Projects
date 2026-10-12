import * as Haptics from 'expo-haptics';
import type { ReactNode } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type HapticKind = 'none' | 'selection' | 'light' | 'success' | 'warning';

export function haptic(kind: HapticKind) {
  switch (kind) {
    case 'selection':
      Haptics.selectionAsync();
      break;
    case 'light':
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      break;
    case 'success':
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      break;
    case 'warning':
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      break;
  }
}

interface Props extends Omit<PressableProps, 'style' | 'children'> {
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
  scaleTo?: number;
  hapticKind?: HapticKind;
}

/** Pressable that springs down slightly while pressed, with optional haptic feedback. */
export function PressableScale({ style, children, scaleTo = 0.97, hapticKind = 'none', onPress, ...rest }: Props) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedPressable
      {...rest}
      onPressIn={event => {
        scale.set(withSpring(scaleTo, { damping: 20, stiffness: 400 }));
        rest.onPressIn?.(event);
      }}
      onPressOut={event => {
        scale.set(withSpring(1, { damping: 15, stiffness: 300 }));
        rest.onPressOut?.(event);
      }}
      onPress={event => {
        haptic(hapticKind);
        onPress?.(event);
      }}
      style={[style, animatedStyle, rest.disabled && { opacity: 0.5 }]}
    >
      {children}
    </AnimatedPressable>
  );
}
