import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { formatMinor, type MinorUnits } from '@/domain/money/money';
import { addMonths, formatMonth, type MonthKey } from '@/domain/period';
import type { TransactionType } from '@/domain/types';
import type { IconName } from '@/theme/categoryStyle';
import { colors, radius, shadow, themedStyles } from '@/theme/colors';

import { PressableScale, type HapticKind } from './PressableScale';

export function LoadingState() {
  return (
    <View style={styles.centered}>
      <ActivityIndicator color={colors.primary} size="large" />
    </View>
  );
}

export function ErrorState({ error, onRetry }: { error: Error; onRetry?: () => void }) {
  return (
    <View style={styles.centered}>
      <StateIcon name="alert-circle" color={colors.danger} />
      <Text style={styles.stateTitle}>Something went wrong</Text>
      <Text style={styles.stateBody}>{error.message}</Text>
      {onRetry && <Button title="Try again" onPress={onRetry} />}
    </View>
  );
}

export function EmptyState({
  title,
  body,
  icon = 'sparkles',
  action,
}: {
  title: string;
  body?: string;
  icon?: IconName;
  action?: ReactNode;
}) {
  return (
    <Animated.View entering={FadeIn.duration(300)} style={styles.centered}>
      <StateIcon name={icon} color={colors.primary} />
      <Text style={styles.stateTitle}>{title}</Text>
      {body && <Text style={styles.stateBody}>{body}</Text>}
      {action}
    </Animated.View>
  );
}

function StateIcon({ name, color }: { name: IconName; color: string }) {
  return (
    <View style={[styles.stateIcon, { backgroundColor: `${color}14` }]}>
      <Ionicons name={name} size={30} color={color} />
    </View>
  );
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  icon,
  disabled,
  style,
  hapticKind = 'light',
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  icon?: IconName;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  hapticKind?: HapticKind;
}) {
  const textColor = variant === 'primary' ? colors.onPrimary : variant === 'danger' ? colors.danger : colors.primary;
  return (
    <PressableScale
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      hapticKind={hapticKind}
      style={[
        styles.button,
        variant === 'secondary' && styles.buttonSecondary,
        variant === 'danger' && styles.buttonDanger,
        style,
      ]}
    >
      {icon && <Ionicons name={icon} size={18} color={textColor} />}
      <Text style={[styles.buttonText, { color: textColor }]}>{title}</Text>
    </PressableScale>
  );
}

export function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
      {error && (
        <Animated.Text entering={FadeIn} style={styles.fieldError}>
          {error}
        </Animated.Text>
      )}
    </View>
  );
}

export function Input(props: TextInputProps) {
  return <TextInput placeholderTextColor={colors.textMuted} {...props} style={[styles.input, props.style]} />;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  tint,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  tint?: (value: T) => string;
}) {
  return (
    <View style={styles.segmented}>
      {options.map(option => {
        const selected = option.value === value;
        const color = tint?.(option.value) ?? colors.text;
        return (
          <PressableScale
            key={option.value}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            hapticKind="selection"
            onPress={() => onChange(option.value)}
            style={[styles.segment, selected && styles.segmentSelected]}
          >
            <Text style={[styles.segmentText, selected && { color, fontWeight: '700' }]}>{option.label}</Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  icon,
  color = colors.primary,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  icon?: IconName;
  color?: string;
}) {
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityState={{ selected }}
      hapticKind="selection"
      onPress={onPress}
      scaleTo={0.94}
      style={[styles.chip, selected && { backgroundColor: color, borderColor: color }]}
    >
      {icon && <Ionicons name={icon} size={15} color={selected ? colors.onPrimary : color} />}
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </PressableScale>
  );
}

export function MonthSelector({ value, onChange }: { value: MonthKey; onChange: (value: MonthKey) => void }) {
  return (
    <View style={styles.monthSelector}>
      <PressableScale
        accessibilityLabel="Previous month"
        hitSlop={12}
        hapticKind="selection"
        onPress={() => onChange(addMonths(value, -1))}
        style={styles.monthButton}
      >
        <Ionicons name="chevron-back" size={20} color={colors.primary} />
      </PressableScale>
      <Text style={styles.monthText}>{formatMonth(value)}</Text>
      <PressableScale
        accessibilityLabel="Next month"
        hitSlop={12}
        hapticKind="selection"
        onPress={() => onChange(addMonths(value, 1))}
        style={styles.monthButton}
      >
        <Ionicons name="chevron-forward" size={20} color={colors.primary} />
      </PressableScale>
    </View>
  );
}

export const typeColor = themedStyles((): Record<TransactionType, string> => ({
  income: colors.income,
  expense: colors.expense,
  transfer: colors.transfer,
}));

export function Amount({
  amountMinor,
  type,
  style,
}: {
  amountMinor: MinorUnits;
  type?: TransactionType;
  style?: StyleProp<TextStyle>;
}) {
  const sign = type === 'income' ? '+' : type === 'expense' ? '−' : '';
  return (
    <Text style={[styles.amount, type && { color: typeColor[type] }, style]}>
      {sign}
      {formatMinor(amountMinor)}
    </Text>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Badge({ label, color, background }: { label: string; color: string; background: string }) {
  return (
    <View style={[styles.badge, { backgroundColor: background }]}>
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

export function SectionTitle({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <View style={styles.sectionTitleRow}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action}
    </View>
  );
}

export function TextLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable hitSlop={8} onPress={onPress}>
      <Text style={styles.link}>{label}</Text>
    </Pressable>
  );
}

export const styles = themedStyles(() => StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 8 },
  stateIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  stateTitle: { fontSize: 18, fontWeight: '700', color: colors.text, textAlign: 'center' },
  stateBody: { color: colors.textMuted, textAlign: 'center', marginBottom: 12, lineHeight: 20 },
  button: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonSecondary: { backgroundColor: colors.primarySoft },
  buttonDanger: { backgroundColor: colors.expenseSoft },
  buttonText: { fontWeight: '700', fontSize: 16 },
  field: { gap: 8 },
  label: { fontSize: 13, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  fieldError: { color: colors.danger, fontSize: 13 },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
  },
  segmented: { flexDirection: 'row', backgroundColor: colors.track, borderRadius: radius.md, padding: 3 },
  segment: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: radius.sm },
  segmentSelected: { backgroundColor: colors.surface, ...shadow },
  segmentText: { color: colors.textMuted, fontWeight: '600' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipText: { color: colors.text, fontWeight: '500' },
  chipTextSelected: { color: colors.onPrimary, fontWeight: '700' },
  monthSelector: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  monthButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow,
  },
  monthText: { fontSize: 17, fontWeight: '700', color: colors.text },
  amount: { fontSize: 16, fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'] },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 16, ...shadow },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, alignSelf: 'flex-start' },
  badgeText: { fontSize: 11, fontWeight: '700' },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  link: { color: colors.primary, fontWeight: '700' },
}));
