import { router } from 'expo-router';
import type { SQLiteDatabase } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { AddTransactionButton } from '@/components/AddButton';
import { TransactionRow } from '@/components/TransactionRow';
import {
  Amount,
  Button,
  Card,
  ErrorState,
  LoadingState,
  MonthSelector,
} from '@/components/ui';
import { loadMonth } from '@/data/queries/monthSummary';
import { getAccountFlows, listAccounts } from '@/data/repositories/accounts';
import { listCategories } from '@/data/repositories/categories';
import {
  accountBalance,
  spendingByCategory,
} from '@/domain/accounting/accounting';
import { formatMinor, sumMinor } from '@/domain/money/money';
import { monthKeyOf, type MonthKey } from '@/domain/period';
import { useFocusQuery } from '@/hooks/useFocusQuery';
import { colors } from '@/theme/colors';

async function loadDashboard(db: SQLiteDatabase, month: MonthKey) {
  const [monthData, accounts, flows, categories] = await Promise.all([
    loadMonth(db, month),
    listAccounts(db),
    getAccountFlows(db),
    listCategories(db, { includeArchived: true }),
  ]);
  return {
    ...monthData,
    totalBalanceMinor: sumMinor(accounts.map(a => accountBalance(a, flows.get(a.id)))),
    spending: spendingByCategory(monthData.transactions, categories),
  };
}

export default function DashboardScreen() {
  const [month, setMonth] = useState<MonthKey>(() => monthKeyOf(new Date()));
  const { data, error, isLoading, reload } = useFocusQuery(
    useCallback((db: SQLiteDatabase) => loadDashboard(db, month), [month]),
  );

  if (error) {
    return <ErrorState error={error} onRetry={reload} />;
  }
  if (!data && isLoading) {
    return <LoadingState />;
  }
  if (!data) {
    return null;
  }

  const { summary, spending, transactions } = data;
  const maxSpend = spending[0]?.amountMinor ?? 0;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <MonthSelector value={month} onChange={setMonth} />

        <Card style={styles.netCard}>
          <Text style={styles.muted}>Net cash flow</Text>
          <Amount
            amountMinor={summary.netMinor}
            style={[styles.big, { color: summary.netMinor < 0 ? colors.expense : colors.income }]}
          />
          <View style={styles.split}>
            <View style={styles.splitItem}>
              <Text style={styles.muted}>Income</Text>
              <Amount amountMinor={summary.incomeMinor} style={{ color: colors.income }} />
            </View>
            <View style={styles.splitItem}>
              <Text style={styles.muted}>Expenses</Text>
              <Amount amountMinor={summary.expenseMinor} style={{ color: colors.expense }} />
            </View>
          </View>
        </Card>

        <Card style={styles.balanceCard}>
          <Text style={styles.muted}>Cash and bank balance</Text>
          <Amount amountMinor={data.totalBalanceMinor} style={styles.medium} />
        </Card>

        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Spending by category</Text>
          {spending.length === 0 ? (
            <Text style={styles.muted}>No expenses this month.</Text>
          ) : (
            spending.map(item => (
              <View key={item.categoryId ?? 'none'} style={styles.barRow}>
                <View style={styles.barLabels}>
                  <Text style={styles.barName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.barAmount}>{formatMinor(item.amountMinor)}</Text>
                </View>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.barFill,
                      { width: `${maxSpend ? (item.amountMinor / maxSpend) * 100 : 0}%` },
                    ]}
                  />
                </View>
              </View>
            ))
          )}
        </Card>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent transactions</Text>
          {transactions.length === 0 ? (
            <Card style={styles.emptyCard}>
              <Text style={styles.muted}>Nothing recorded this month yet.</Text>
              <Button title="Add transaction" onPress={() => router.push('/transaction/new')} />
            </Card>
          ) : (
            <View style={styles.recent}>
              {transactions.slice(0, 5).map(item => (
                <TransactionRow key={item.id} item={item} />
              ))}
            </View>
          )}
        </View>
      </ScrollView>
      <AddTransactionButton />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 12, paddingBottom: 96 },
  muted: { color: colors.textMuted },
  netCard: { gap: 4 },
  big: { fontSize: 32 },
  medium: { fontSize: 22 },
  split: { flexDirection: 'row', marginTop: 12, gap: 12 },
  splitItem: { flex: 1, gap: 2 },
  balanceCard: { gap: 4 },
  section: { gap: 10 },
  sectionTitle: { fontSize: 17, fontWeight: '600', color: colors.text },
  barRow: { gap: 4 },
  barLabels: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  barName: { flex: 1, color: colors.text },
  barAmount: { color: colors.text, fontVariant: ['tabular-nums'] },
  barTrack: { height: 8, backgroundColor: colors.background, borderRadius: 4, overflow: 'hidden' },
  barFill: { height: 8, backgroundColor: colors.expense, borderRadius: 4 },
  emptyCard: { gap: 12, alignItems: 'flex-start' },
  recent: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
});
