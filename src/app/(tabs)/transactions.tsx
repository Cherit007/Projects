import type { SQLiteDatabase } from 'expo-sqlite';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { AddTransactionButton } from '@/components/AddButton';
import { TransactionRow } from '@/components/TransactionRow';
import {
  Amount,
  Chip,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  MonthSelector,
} from '@/components/ui';
import { loadMonth } from '@/data/queries/monthSummary';
import { monthKeyOf, type MonthKey } from '@/domain/period';
import type { TransactionType } from '@/domain/types';
import { useFocusQuery } from '@/hooks/useFocusQuery';
import { colors } from '@/theme/colors';

const typeFilters: { value: TransactionType | null; label: string }[] = [
  { value: null, label: 'All' },
  { value: 'expense', label: 'Expenses' },
  { value: 'income', label: 'Income' },
  { value: 'transfer', label: 'Transfers' },
];

export default function TransactionsScreen() {
  const [month, setMonth] = useState<MonthKey>(() => monthKeyOf(new Date()));
  const [search, setSearch] = useState('');
  const [type, setType] = useState<TransactionType | null>(null);
  const { data, error, isLoading, reload } = useFocusQuery(
    useCallback((db: SQLiteDatabase) => loadMonth(db, month), [month]),
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (data?.transactions ?? []).filter(
      t =>
        (!type || t.type === type) &&
        (!query ||
          [t.counterparty, t.note, t.categoryName, t.accountName]
            .some(field => field?.toLowerCase().includes(query))),
    );
  }, [data, search, type]);

  const header = (
    <View style={styles.header}>
      <MonthSelector value={month} onChange={setMonth} />
      {data && (
        <View style={styles.totals}>
          <Total label="Income" amountMinor={data.summary.incomeMinor} color={colors.income} />
          <Total label="Expenses" amountMinor={data.summary.expenseMinor} color={colors.expense} />
          <Total label="Net" amountMinor={data.summary.netMinor} color={colors.text} />
        </View>
      )}
      <Input
        value={search}
        onChangeText={setSearch}
        placeholder="Search payee, note, category or account"
        clearButtonMode="while-editing"
      />
      <View style={styles.chips}>
        {typeFilters.map(f => (
          <Chip key={f.label} label={f.label} selected={type === f.value} onPress={() => setType(f.value)} />
        ))}
      </View>
    </View>
  );

  let body = null;
  if (error) {
    body = <ErrorState error={error} onRetry={reload} />;
  } else if (!data && isLoading) {
    body = <LoadingState />;
  }

  return (
    <View style={styles.container}>
      {body ?? (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          ListHeaderComponent={header}
          renderItem={({ item }) => <TransactionRow item={item} />}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <EmptyState
              title={data?.transactions.length ? 'No matching transactions' : 'No transactions this month'}
              body={data?.transactions.length ? 'Try a different search or filter.' : 'Tap + to add one.'}
            />
          }
        />
      )}
      <AddTransactionButton />
    </View>
  );
}

function Total({ label, amountMinor, color }: { label: string; amountMinor: number; color: string }) {
  return (
    <View style={styles.total}>
      <Text style={styles.totalLabel}>{label}</Text>
      <Amount amountMinor={amountMinor} style={{ color, fontSize: 14 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { paddingBottom: 96 },
  header: { padding: 16, gap: 12 },
  totals: { flexDirection: 'row', gap: 8 },
  total: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 10,
    gap: 2,
  },
  totalLabel: { fontSize: 12, color: colors.textMuted },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
});
