import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { TransactionListItem } from '@/data/repositories/transactions';
import { colors } from '@/theme/colors';
import { formatDisplayDate } from '@/utils/dates';

import { Amount } from './ui';

export function TransactionRow({ item }: { item: TransactionListItem }) {
  const title =
    item.type === 'transfer'
      ? `${item.accountName} → ${item.toAccountName ?? 'Unknown'}`
      : item.counterparty || item.categoryName || 'Uncategorized';
  const subtitle =
    item.type === 'transfer'
      ? 'Transfer'
      : [item.counterparty ? item.categoryName : null, item.accountName].filter(Boolean).join(' · ');

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push(`/transaction/${item.id}`)}
      style={styles.row}
    >
      <View style={styles.text}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {formatDisplayDate(item.occurredAt)} · {subtitle}
        </Text>
      </View>
      <Amount amountMinor={item.amountMinor} type={item.type} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  text: { flex: 1, gap: 2 },
  title: { fontSize: 16, fontWeight: '500', color: colors.text },
  meta: { fontSize: 13, color: colors.textMuted },
});
