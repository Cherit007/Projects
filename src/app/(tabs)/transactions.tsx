import Ionicons from '@expo/vector-icons/Ionicons';
import type { SQLiteDatabase } from 'expo-sqlite';
import { useCallback, useMemo, useState } from 'react';
import { SectionList, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

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
import type { TransactionListItem } from '@/data/repositories/transactions';
import { summarize } from '@/domain/accounting/accounting';
import { monthKeyOf, type MonthKey } from '@/domain/period';
import type { TransactionType } from '@/domain/types';
import { useFocusQuery } from '@/hooks/useFocusQuery';
import { useRecurring } from '@/services/RecurringProvider';
import { useUpi } from '@/services/upi/UpiProvider';
import { colors, radius, shadow } from '@/theme/colors';
import { toLocalDateInput } from '@/utils/dates';

const typeFilters: { value: TransactionType | null; label: string; color: string }[] = [
  { value: null, label: 'All', color: colors.primary },
  { value: 'expense', label: 'Expenses', color: colors.expense },
  { value: 'income', label: 'Income', color: colors.income },
  { value: 'transfer', label: 'Transfers', color: colors.transfer },
];

interface DaySection {
  title: string;
  netMinor: number;
  data: TransactionListItem[];
}

function dayLabel(iso: string): string {
  const key = toLocalDateInput(iso);
  const today = new Date();
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1, 12);
  if (key === toLocalDateInput(today.toISOString())) {
    return 'Today';
  }
  if (key === toLocalDateInput(yesterday.toISOString())) {
    return 'Yesterday';
  }
  return new Date(iso).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

function groupByDay(items: TransactionListItem[]): DaySection[] {
  const sections = new Map<string, TransactionListItem[]>();
  for (const item of items) {
    const key = toLocalDateInput(item.occurredAt);
    sections.set(key, [...(sections.get(key) ?? []), item]);
  }
  return [...sections.values()].map(data => ({
    title: dayLabel(data[0].occurredAt),
    netMinor: summarize(data).netMinor,
    data,
  }));
}

export default function TransactionsScreen() {
  const [month, setMonth] = useState<MonthKey>(() => monthKeyOf(new Date()));
  const [search, setSearch] = useState('');
  const [type, setType] = useState<TransactionType | null>(null);
  const { lastSyncAt } = useUpi();
  const { lastAddedAt } = useRecurring();
  // Detection syncs and repeating transactions add entries in the background, so they reload the list too.
  const { data, error, isLoading, reload } = useFocusQuery(
    useCallback((db: SQLiteDatabase) => loadMonth(db, month), [month]),
    `${lastSyncAt}|${lastAddedAt}`,
  );

  const sections = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = (data?.transactions ?? []).filter(
      t =>
        (!type || t.type === type) &&
        (!query ||
          [t.counterparty, t.note, t.categoryName, t.accountName].some(field =>
            field?.toLowerCase().includes(query),
          )),
    );
    return groupByDay(filtered);
  }, [data, search, type]);

  const header = (
    <View style={styles.header}>
      <MonthSelector value={month} onChange={setMonth} />
      {data && (
        <View style={styles.totals}>
          <Total label="Income" icon="arrow-down" amountMinor={data.summary.incomeMinor} color={colors.income} />
          <Total label="Expenses" icon="arrow-up" amountMinor={data.summary.expenseMinor} color={colors.expense} />
          <Total label="Net" icon="analytics" amountMinor={data.summary.netMinor} color={colors.primary} />
        </View>
      )}
      <View style={styles.search}>
        <Ionicons name="search" size={18} color={colors.textMuted} />
        <Input
          value={search}
          onChangeText={setSearch}
          placeholder="Search payee, note, category or account"
          clearButtonMode="while-editing"
          style={styles.searchInput}
        />
      </View>
      <View style={styles.chips}>
        {typeFilters.map(f => (
          <Chip
            key={f.label}
            label={f.label}
            color={f.color}
            selected={type === f.value}
            onPress={() => setType(f.value)}
          />
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
        <SectionList
          sections={sections}
          keyExtractor={item => item.id}
          ListHeaderComponent={header}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => (
            <View style={styles.dayHeader}>
              <Text style={styles.dayTitle}>{section.title}</Text>
              <Amount
                amountMinor={section.netMinor}
                style={[styles.dayNet, { color: section.netMinor < 0 ? colors.expense : colors.income }]}
              />
            </View>
          )}
          renderItem={({ item, index, section }) => (
            <Animated.View
              entering={FadeInDown.delay(Math.min(index, 8) * 30).duration(250)}
              style={[
                styles.itemWrap,
                index === 0 && styles.itemFirst,
                index === section.data.length - 1 && styles.itemLast,
              ]}
            >
              <TransactionRow item={item} />
            </Animated.View>
          )}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <EmptyState
              icon={data?.transactions.length ? 'search' : 'receipt-outline'}
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

function Total({
  label,
  icon,
  amountMinor,
  color,
}: {
  label: string;
  icon: 'arrow-down' | 'arrow-up' | 'analytics';
  amountMinor: number;
  color: string;
}) {
  return (
    <View style={styles.total}>
      <View style={styles.totalLabelRow}>
        <Ionicons name={icon} size={12} color={color} />
        <Text style={styles.totalLabel}>{label}</Text>
      </View>
      <Amount amountMinor={amountMinor} style={{ color, fontSize: 14 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { paddingBottom: 110 },
  header: { padding: 16, gap: 14 },
  totals: { flexDirection: 'row', gap: 8 },
  total: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.md, padding: 12, gap: 4, ...shadow },
  totalLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  totalLabel: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingLeft: 12,
  },
  searchInput: { flex: 1, borderWidth: 0, backgroundColor: 'transparent' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 8,
  },
  dayTitle: { fontSize: 13, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase' },
  dayNet: { fontSize: 13 },
  itemWrap: { marginHorizontal: 16, backgroundColor: colors.surface, overflow: 'hidden' },
  itemFirst: { borderTopLeftRadius: radius.md, borderTopRightRadius: radius.md },
  itemLast: { borderBottomLeftRadius: radius.md, borderBottomRightRadius: radius.md },
});
