import { Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext, type SQLiteDatabase } from 'expo-sqlite';
import { useCallback } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { displayName } from '@/components/PersonRow';
import { haptic } from '@/components/PressableScale';
import { TransactionRow } from '@/components/TransactionRow';
import { Button, Card, ErrorState, LoadingState } from '@/components/ui';
import { listPeople, movePerson } from '@/data/repositories/people';
import { listTransactions } from '@/data/repositories/transactions';
import { formatMinor, sumMinor } from '@/domain/money/money';
import { useFocusQuery } from '@/hooks/useFocusQuery';
import { useUpi } from '@/services/upi/UpiProvider';
import { colors, radius, shadow } from '@/theme/colors';

export default function PersonScreen() {
  const db = useSQLiteContext();
  const { name } = useLocalSearchParams<{ name: string }>();
  const { lastSyncAt } = useUpi();
  const { data, error, isLoading, reload } = useFocusQuery(
    useCallback(
      async (database: SQLiteDatabase) => {
        const [transactions, people] = await Promise.all([
          listTransactions(database, { counterparty: name, limit: 500 }),
          listPeople(database),
        ]);
        const key = name.trim().toLowerCase();
        return { transactions, person: people.find(p => p.name.trim().toLowerCase() === key) };
      },
      [name],
    ),
    lastSyncAt,
  );

  const title = <Stack.Screen options={{ title: displayName(name) }} />;
  if (error) {
    return <ErrorState error={error} onRetry={reload} />;
  }
  if (!data && isLoading) {
    return <LoadingState />;
  }
  const transactions = (data?.transactions ?? []).filter(t => t.type !== 'transfer');
  const person = data?.person;
  const sent = sumMinor(transactions.filter(t => t.type === 'expense').map(t => t.amountMinor));
  const received = sumMinor(transactions.filter(t => t.type === 'income').map(t => t.amountMinor));
  const net = received - sent;

  const move = async () => {
    if (!person) {
      return;
    }
    haptic('selection');
    await movePerson(db, name, person.family ? 'friends' : 'family');
    await reload();
  };

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

      {person && (
        <Button title={person.family ? 'Move to Friends' : 'Move to Family'} variant="secondary" onPress={move} />
      )}

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
