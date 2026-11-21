import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams } from 'expo-router';
import type { SQLiteDatabase } from 'expo-sqlite';
import { useCallback, useMemo, useState } from 'react';
import { SectionList, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { AddTransactionButton } from '@/components/AddButton';
import { CategoryIcon } from '@/components/CategoryIcon';
import { PressableScale } from '@/components/PressableScale';
import { TransactionRow } from '@/components/TransactionRow';
import {
  Amount,
  Card,
  Chip,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  MonthSelector,
} from '@/components/ui';
import { loadMonth, loadRange } from '@/data/queries/monthSummary';
import type { TransactionListItem } from '@/data/repositories/transactions';
import { summarize } from '@/domain/accounting/accounting';
import { categoryBreakdown } from '@/domain/accounting/breakdown';
import { monthKeyOf, type DateRange, type MonthKey } from '@/domain/period';
import type { TransactionType } from '@/domain/types';
import { useFocusQuery } from '@/hooks/useFocusQuery';
import { useRecurring } from '@/services/RecurringProvider';
import { useUpi } from '@/services/upi/UpiProvider';
import { colors, radius, shadow, themedStyles } from '@/theme/colors';
import { toLocalDateInput } from '@/utils/dates';

const typeFilters: { value: TransactionType | null; label: string; color: string }[] = [
  { value: null, label: 'All', color: colors.primary },
  { value: 'expense', label: 'Expenses', color: colors.expense },
  { value: 'income', label: 'Income', color: colors.income },
  { value: 'transfer', label: 'Transfers', color: colors.transfer },
];

type Scope = { kind: 'all' } | { kind: 'month' } | { kind: 'range'; range: DateRange; label: string };

/** Filters the dashboard opens this screen with, e.g. "income in March". */
type Params = {
  type?: string;
  from?: string;
  to?: string;
  label?: string;
  category?: string;
  /** Changes on every tap so the same link applies again after the user changed filters. */
  at?: string;
};

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
  const date = new Date(iso);
  return date.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: date.getFullYear() === today.getFullYear() ? undefined : 'numeric',
  });
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

function isType(value: string | undefined): value is TransactionType {
  return value === 'income' || value === 'expense' || value === 'transfer';
}

/** Category filter value for transactions without a category. */
const UNCATEGORISED = 'none';

export default function TransactionsScreen() {
  const params = useLocalSearchParams<Params>();
  const [month, setMonth] = useState<MonthKey>(() => monthKeyOf(new Date()));
  const [scope, setScope] = useState<Scope>({ kind: 'all' });
  const [search, setSearch] = useState('');
  const [type, setType] = useState<TransactionType | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const { lastSyncAt } = useUpi();
  const { lastAddedAt } = useRecurring();

  // Filters from a dashboard link apply once per tap; afterwards the user's own choices win.
  const [appliedAt, setAppliedAt] = useState<string | undefined>(undefined);
  if (params.at && params.at !== appliedAt) {
    setAppliedAt(params.at);
    setType(isType(params.type) ? params.type : null);
    setCategory(params.category ?? null);
    setSearch('');
    if (params.from && params.to) {
      setScope({ kind: 'range', range: { startIso: params.from, endIso: params.to }, label: params.label ?? 'Selected period' });
    }
  }

  // Detection syncs and repeating transactions add entries in the background, so they reload the list too.
  const { data, error, isLoading, reload } = useFocusQuery(
    useCallback(
      (db: SQLiteDatabase) =>
        scope.kind === 'all' ? loadRange(db) : scope.kind === 'range' ? loadRange(db, scope.range) : loadMonth(db, month),
      [scope, month],
    ),
    `${lastSyncAt}|${lastAddedAt}`,
  );

  const chooseType = (next: TransactionType | null) => {
    setType(next);
    setCategory(null);
  };

  const breakdown = useMemo(
    () => (data && (type === 'income' || type === 'expense') ? categoryBreakdown(data.transactions, type) : []),
    [data, type],
  );

  const sections = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = (data?.transactions ?? []).filter(
      t =>
        (!type || t.type === type) &&
        (!category || (category === UNCATEGORISED ? t.categoryId === null : t.categoryId === category)) &&
        (!query ||
          [t.counterparty, t.note, t.categoryName, t.accountName].some(field =>
            field?.toLowerCase().includes(query),
          )),
    );
    return groupByDay(filtered);
  }, [data, search, type, category]);

  const header = (
    <View style={styles.header}>
      <View style={styles.chips}>
        <Chip label="All time" icon="infinite" selected={scope.kind === 'all'} onPress={() => setScope({ kind: 'all' })} />
        <Chip
          label="By month"
          icon="calendar-outline"
          selected={scope.kind === 'month'}
          onPress={() => setScope({ kind: 'month' })}
        />
        {scope.kind === 'range' && <Chip label={scope.label} icon="funnel-outline" selected onPress={() => undefined} />}
      </View>
      {scope.kind === 'month' && <MonthSelector value={month} onChange={setMonth} />}
      {data && (
        <View style={styles.totals}>
          <Total
            label="Income"
            icon="arrow-down"
            amountMinor={data.summary.incomeMinor}
            color={colors.income}
            selected={type === 'income'}
            onPress={() => chooseType(type === 'income' ? null : 'income')}
          />
          <Total
            label="Expenses"
            icon="arrow-up"
            amountMinor={data.summary.expenseMinor}
            color={colors.expense}
            selected={type === 'expense'}
            onPress={() => chooseType(type === 'expense' ? null : 'expense')}
          />
          <Total label="Net" icon="analytics" amountMinor={data.summary.netMinor} color={colors.primary} />
        </View>
      )}
      {breakdown.length > 0 && (
        <Card style={styles.breakdown}>
          <Text style={styles.breakdownTitle}>
            {type === 'income' ? 'Money in by category' : 'Spending by category'} · tap to filter
          </Text>
          {breakdown.map(item => {
            const id = item.categoryId ?? UNCATEGORISED;
            const selected = category === id;
            return (
              <PressableScale
                key={id}
                hapticKind="light"
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => setCategory(selected ? null : id)}
                style={[styles.breakdownRow, selected && styles.breakdownRowSelected]}
              >
                <CategoryIcon name={item.name} type={type === 'income' ? 'income' : 'expense'} size={30} />
                <View style={styles.breakdownText}>
                  <Text style={styles.breakdownName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.breakdownCount}>
                    {item.count} {item.count === 1 ? 'entry' : 'entries'}
                  </Text>
                </View>
                <Amount amountMinor={item.amountMinor} style={styles.breakdownAmount} />
                {selected && <Ionicons name="checkmark-circle" size={18} color={colors.primary} />}
              </PressableScale>
            );
          })}
        </Card>
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
            onPress={() => chooseType(f.value)}
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
              <TransactionRow item={item} showDate onDeleted={reload} />
            </Animated.View>
          )}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <EmptyState
              icon={data?.transactions.length ? 'search' : 'receipt-outline'}
              title={
                data?.transactions.length
                  ? 'No matching transactions'
                  : scope.kind === 'all'
                    ? 'No transactions yet'
                    : 'No transactions in this period'
              }
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
  selected = false,
  onPress,
}: {
  label: string;
  icon: 'arrow-down' | 'arrow-up' | 'analytics';
  amountMinor: number;
  color: string;
  selected?: boolean;
  onPress?: () => void;
}) {
  const content = (
    <>
      <View style={styles.totalLabelRow}>
        <Ionicons name={icon} size={12} color={color} />
        <Text style={styles.totalLabel}>{label}</Text>
      </View>
      <Amount amountMinor={amountMinor} style={{ color, fontSize: 14 }} />
    </>
  );
  if (!onPress) {
    return <View style={styles.total}>{content}</View>;
  }
  return (
    <PressableScale
      hapticKind="light"
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityHint={`Shows only ${label.toLowerCase()}`}
      onPress={onPress}
      style={[styles.total, selected && { borderColor: color, borderWidth: 1.5 }]}
    >
      {content}
    </PressableScale>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  container: { flex: 1 },
  list: { paddingBottom: 110 },
  header: { padding: 16, gap: 14 },
  totals: { flexDirection: 'row', gap: 8 },
  total: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 12,
    gap: 4,
    borderWidth: 1.5,
    borderColor: 'transparent',
    ...shadow,
  },
  totalLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  totalLabel: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
  breakdown: { gap: 4 },
  breakdownTitle: { fontSize: 12, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', marginBottom: 4 },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderRadius: radius.md,
  },
  breakdownRowSelected: { backgroundColor: colors.primarySoft },
  breakdownText: { flex: 1, gap: 1 },
  breakdownName: { fontSize: 15, fontWeight: '600', color: colors.text },
  breakdownCount: { fontSize: 12, color: colors.textMuted },
  breakdownAmount: { fontSize: 15, color: colors.text },
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
}));
