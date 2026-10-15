import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import type { TransactionListItem } from '@/data/repositories/transactions';
import { colors } from '@/theme/colors';

import { CategoryIcon } from './CategoryIcon';
import { PressableScale } from './PressableScale';
import { Amount } from './ui';

export function TransactionRow({ item, showDate = false }: { item: TransactionListItem; showDate?: boolean }) {
  const title =
    item.type === 'transfer'
      ? `${item.accountName} → ${item.toAccountName ?? 'Unknown'}`
      : item.counterparty || item.categoryName || 'Uncategorized';
  const parts =
    item.type === 'transfer'
      ? ['Transfer']
      : [item.counterparty ? item.categoryName : null, item.accountName];
  if (showDate) {
    parts.unshift(
      new Date(item.occurredAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
    );
  }
  const isDetected = item.source === 'upi_notification' || item.source === 'bank_sms';

  return (
    <PressableScale
      accessibilityRole="button"
      scaleTo={0.98}
      onPress={() => router.push(`/transaction/${item.id}`)}
      style={styles.row}
    >
      <CategoryIcon name={item.categoryName} type={item.type} />
      <View style={styles.text}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <View style={styles.metaRow}>
          {isDetected && <Ionicons name="flash" size={12} color={colors.primary} />}
          {item.source === 'recurring' && <Ionicons name="repeat" size={12} color={colors.primary} />}
          <Text style={styles.meta} numberOfLines={1}>
            {parts.filter(Boolean).join(' · ')}
          </Text>
        </View>
      </View>
      <Amount amountMinor={item.amountMinor} type={item.type} />
    </PressableScale>
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
  },
  text: { flex: 1, gap: 3 },
  title: { fontSize: 16, fontWeight: '600', color: colors.text },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  meta: { fontSize: 13, color: colors.textMuted, flexShrink: 1 },
});
