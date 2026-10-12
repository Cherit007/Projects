import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { formatMinor, type MinorUnits } from '@/domain/money/money';
import { addMonths, formatMonth, type MonthKey } from '@/domain/period';
import type { TransactionType } from '@/domain/types';
import { colors } from '@/theme/colors';

export function LoadingState() {
  return (
    <View style={styles.centered}>
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}

export function ErrorState({
  error,
  onRetry,
}: {
  error: Error;
  onRetry?: () => void;
}) {
  return (
    <View style={styles.centered}>
      <Text style={styles.stateTitle}>Something went wrong</Text>
      <Text style={styles.stateBody}>{error.message}</Text>
      {onRetry && <Button title="Try again" onPress={onRetry} />}
    </View>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <View style={styles.centered}>
      <Text style={styles.stateTitle}>{title}</Text>
      {body && <Text style={styles.stateBody}>{body}</Text>}
      {action}
    </View>
  );
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  style?: ViewStyle;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        variant === 'secondary' && styles.buttonSecondary,
        variant === 'danger' && styles.buttonDanger,
        (pressed || disabled) && styles.buttonPressed,
        style,
      ]}
    >
      <Text
        style={[
          styles.buttonText,
          variant !== 'primary' && { color: variant === 'danger' ? colors.danger : colors.primary },
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
}

export function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
      {error && <Text style={styles.fieldError}>{error}</Text>}
    </View>
  );
}

export function Input(props: TextInputProps) {
  return (
    <TextInput
      placeholderTextColor={colors.textMuted}
      {...props}
      style={[styles.input, props.style]}
    />
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.segmented}>
      {options.map(option => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={[styles.segment, selected && styles.segmentSelected]}
          >
            <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

export function MonthSelector({
  value,
  onChange,
}: {
  value: MonthKey;
  onChange: (value: MonthKey) => void;
}) {
  return (
    <View style={styles.monthSelector}>
      <Pressable
        accessibilityLabel="Previous month"
        hitSlop={12}
        onPress={() => onChange(addMonths(value, -1))}
      >
        <Ionicons name="chevron-back" size={22} color={colors.primary} />
      </Pressable>
      <Text style={styles.monthText}>{formatMonth(value)}</Text>
      <Pressable
        accessibilityLabel="Next month"
        hitSlop={12}
        onPress={() => onChange(addMonths(value, 1))}
      >
        <Ionicons name="chevron-forward" size={22} color={colors.primary} />
      </Pressable>
    </View>
  );
}

const typeColor: Record<TransactionType, string> = {
  income: colors.income,
  expense: colors.expense,
  transfer: colors.transfer,
};

export function Amount({
  amountMinor,
  type,
  style,
}: {
  amountMinor: MinorUnits;
  type?: TransactionType;
  style?: object;
}) {
  const sign = type === 'income' ? '+' : type === 'expense' ? '−' : '';
  return (
    <Text style={[styles.amount, type && { color: typeColor[type] }, style]}>
      {sign}
      {formatMinor(amountMinor)}
    </Text>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 8,
  },
  stateTitle: { fontSize: 17, fontWeight: '600', color: colors.text, textAlign: 'center' },
  stateBody: { color: colors.textMuted, textAlign: 'center', marginBottom: 8 },
  button: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: 'center',
  },
  buttonSecondary: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  buttonDanger: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  buttonPressed: { opacity: 0.6 },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  field: { gap: 6 },
  label: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  fieldError: { color: colors.danger, fontSize: 13 },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: colors.text,
  },
  segmented: {
    flexDirection: 'row',
    backgroundColor: colors.border,
    borderRadius: 10,
    padding: 2,
  },
  segment: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  segmentSelected: { backgroundColor: colors.surface },
  segmentText: { color: colors.textMuted, fontWeight: '500' },
  segmentTextSelected: { color: colors.text, fontWeight: '600' },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.text },
  chipTextSelected: { color: '#fff', fontWeight: '600' },
  monthSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  monthText: { fontSize: 17, fontWeight: '600', color: colors.text },
  amount: { fontSize: 16, fontWeight: '600', color: colors.text, fontVariant: ['tabular-nums'] },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
