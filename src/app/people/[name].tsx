import { Stack, useLocalSearchParams } from 'expo-router';
import type { SQLiteDatabase } from 'expo-sqlite';
import { useCallback } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { displayName } from '@/components/PersonRow';
import { TransactionRow } from '@/components/TransactionRow';
import { Card, ErrorState, LoadingState } from '@/components/ui';
import { listTransactions } from '@/data/repositories/transactions';
import { formatMinor, sumMinor } from '@/domain/money/money';
import { useFocusQuery } from '@/hooks/useFocusQuery';
import { useUpi } from '@/services/upi/UpiProvider';
import { colors, radius, shadow } from '@/theme/colors';

export default function PersonScreen() {
  const { name } = useLocalSearchParams<{ name: string }>();
  const { lastSyncAt } = useUpi();
  const { data, error, isLoading, reload } = useFocusQuery(
    useCallback((db: SQLiteDatabase) => listTransactions(db, { counterparty: name, limit: 500 }), [name]),
    lastSyncAt,
  );

  const title = <Stack.Screen options={{ title: displayName(name) }} />;
  if (error) {
    return <ErrorState error={error} onRetry={reload} />;
  }
  if (!data && isLoading) {
    return <LoadingState />;
  }
  const transactions = (data ?? []).filter(t => t.type !== 'transfer');
  const sent = sumMinor(transactions.filter(t => t.type === 'expense').map(t => t.amountMinor));
  const received = sumMinor(transactions.filter(t => t.type === 'income').map(t => t.amountMinor));
  const net = received - sent;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      {title}
      <Card style={styles.summary}>
        <View style={styles.totals}>
          <Total label="You sent" amountMinor={sent} color={colors.expense} />
          <Total label="You received" amountMinor={received} color={colors.income} />
        </View>
        <Text style={styles.net}>
          {net === 0
            ? 'You are even.'
            : net > 0
              ? `They have paid you ${formatMinor(net)} more than you paid them.`
              : `You have paid them ${formatMinor(-net)} more than they paid you.`}
        </Text>
      </Card>

      <Text style={styles.heading}>
        {transactions.length} transaction{transactions.length === 1 ? '' : 's'}
      </Text>
      <View style={styles.list}>
        {transactions.map(item => (
          <TransactionRow key={item.id} item={item} showDate />
        ))}
      </View>
    </ScrollView>
  );
}

function Total({ label, amountMinor, color }: { label: string; amountMinor: number; color: string }) {
  return (
    <View style={styles.total}>
      <Text style={styles.totalLabel}>{label}</Text>
      <Text style={[styles.totalAmount, { color }]}>{formatMinor(amountMinor)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 12 },
  summary: { gap: 12 },
  totals: { flexDirection: 'row', gap: 12 },
  total: { flex: 1, gap: 4 },
  totalLabel: { color: colors.textMuted, fontWeight: '600' },
  totalAmount: { fontSize: 22, fontWeight: '800' },
  net: { color: colors.text, lineHeight: 20 },
  heading: { color: colors.textMuted, fontWeight: '700', marginTop: 4 },
  list: { borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.surface, ...shadow },
});
