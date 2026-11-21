import Ionicons from '@expo/vector-icons/Ionicons';
import type { SQLiteDatabase } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { CategoryIcon } from '@/components/CategoryIcon';
import { PressableScale } from '@/components/PressableScale';
import { Card, ErrorState, LoadingState, MonthSelector, SectionTitle, Segmented } from '@/components/ui';
import { listCategories } from '@/data/repositories/categories';
import { listTransactions } from '@/data/repositories/transactions';
import { holdings, summarize } from '@/domain/accounting/accounting';
import { getAccountFlows, listAccounts } from '@/data/repositories/accounts';
import { formatMinor } from '@/domain/money/money';
import { addMonths, monthKeyOf, monthRange, yearRange, type DateRange, type MonthKey } from '@/domain/period';
import {
  averageMonthlySpend,
  change,
  monthlyTotals,
  savingsRate,
  topPayees,
  totalsByCategory,
  type CategoryTotal,
  type MonthTotals,
  type PayeeTotal,
} from '@/domain/reports';
import { useFocusQuery } from '@/hooks/useFocusQuery';
import { categoryStyle } from '@/theme/categoryStyle';
import { colors, themedStyles } from '@/theme/colors';

type Mode = 'month' | 'year';

const modeOptions = [
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'Year' },
] as const;

async function loadReport(db: SQLiteDatabase, range: DateRange, previous: DateRange, year: number | null) {
  const [transactions, before, categories, accounts, startFlows, endFlows] = await Promise.all([
    listTransactions(db, { range, limit: -1 }),
    listTransactions(db, { range: previous, limit: -1 }),
    listCategories(db, { includeArchived: true }),
    listAccounts(db),
    getAccountFlows(db, range.startIso),
    getAccountFlows(db, range.endIso),
  ]);
  const summary = summarize(transactions);
  return {
    summary,
    previous: summarize(before),
    carried: holdings(accounts, startFlows),
    closing: holdings(accounts, endFlows),
    count: transactions.length,
    months: year === null ? null : monthlyTotals(transactions, year),
    spending: totalsByCategory(transactions, categories, 'expense'),
    income: totalsByCategory(transactions, categories, 'income'),
    payees: topPayees(transactions, 'expense'),
  };
}

const percent = (value: number) => `${Math.round(value * 100)}%`;

/** The last month of `year` that has started. */
function lastMonthOf(year: number): number {
  const now = new Date();
  return year === now.getFullYear() ? now.getMonth() : 11;
}

export default function ReportsScreen() {
  const [mode, setMode] = useState<Mode>('month');
  const [month, setMonth] = useState<MonthKey>(() => monthKeyOf(new Date()));
  const year = month.year;

  const { data, error, isLoading, reload } = useFocusQuery(
    useCallback(
      (db: SQLiteDatabase) =>
        mode === 'month'
          ? loadReport(db, monthRange(month), monthRange(addMonths(month, -1)), null)
          : loadReport(db, yearRange(year), yearRange(year - 1), year),
      [mode, month, year],
    ),
  );

  const openMonth = (index: number) => {
    setMonth({ year, month: index });
    setMode('month');
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Segmented options={modeOptions} value={mode} onChange={setMode} />
      {mode === 'month' ? (
        <MonthSelector value={month} onChange={setMonth} />
      ) : (
        <YearSelector year={year} onChange={next => setMonth({ year: next, month: month.month })} />
      )}

      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : !data && isLoading ? (
        <LoadingState />
      ) : data ? (
        <>
          <Animated.View entering={FadeInDown.duration(300)}>
            <Card style={styles.section}>
              <View style={styles.totals}>
                <Total label="Income" amount={data.summary.incomeMinor} color={colors.income} />
                <Total label="Expenses" amount={data.summary.expenseMinor} color={colors.expense} />
                <Total
                  label="Net"
                  amount={data.summary.netMinor}
                  color={data.summary.netMinor < 0 ? colors.expense : colors.text}
                />
              </View>
              <View style={styles.facts}>
                <Fact
                  icon="arrow-redo-outline"
                  text={`Carried over ${formatMinor(data.carried.cashMinor)} from ${mode === 'month' ? 'last month' : year - 1}, ended with ${formatMinor(data.closing.cashMinor)}`}
                />
                <Fact
                  icon="trending-up-outline"
                  text={
                    savingsRate(data.summary) === null
                      ? 'No income recorded'
                      : `Saved ${percent(savingsRate(data.summary)!)} of income`
                  }
                />
                <Fact icon="list-outline" text={`${data.count} transaction${data.count === 1 ? '' : 's'}`} />
                <SpendChange
                  current={data.summary.expenseMinor}
                  previous={data.previous.expenseMinor}
                  period={mode === 'month' ? 'last month' : `${year - 1}`}
                />
                {data.months && averageMonthlySpend(data.months, lastMonthOf(year)) !== null && (
                  <Fact
                    icon="calendar-outline"
                    text={`${formatMinor(averageMonthlySpend(data.months, lastMonthOf(year))!)} spent a month on average`}
                  />
                )}
              </View>
            </Card>
          </Animated.View>

          {data.months && (
            <Animated.View entering={FadeInDown.delay(60).duration(300)}>
              <Card style={styles.section}>
                <SectionTitle title="Month by month" />
                <MonthBars months={data.months} onOpen={openMonth} />
              </Card>
            </Animated.View>
          )}

          <Animated.View entering={FadeInDown.delay(120).duration(300)}>
            <CategoryCard title="Spending by category" totals={data.spending} type="expense" empty="No expenses." />
          </Animated.View>
          <Animated.View entering={FadeInDown.delay(160).duration(300)}>
            <CategoryCard title="Income by category" totals={data.income} type="income" empty="No income." />
          </Animated.View>
          {data.payees.length > 0 && (
            <Animated.View entering={FadeInDown.delay(200).duration(300)}>
              <PayeeCard payees={data.payees} />
            </Animated.View>
          )}
        </>
      ) : null}
    </ScrollView>
  );
}

function YearSelector({ year, onChange }: { year: number; onChange: (year: number) => void }) {
  return (
    <View style={styles.yearSelector}>
      <PressableScale accessibilityLabel="Previous year" hitSlop={12} hapticKind="selection" onPress={() => onChange(year - 1)} style={styles.yearButton}>
        <Ionicons name="chevron-back" size={20} color={colors.primary} />
      </PressableScale>
      <Text style={styles.yearText}>{year}</Text>
      <PressableScale accessibilityLabel="Next year" hitSlop={12} hapticKind="selection" onPress={() => onChange(year + 1)} style={styles.yearButton}>
        <Ionicons name="chevron-forward" size={20} color={colors.primary} />
      </PressableScale>
    </View>
  );
}

function Total({ label, amount, color }: { label: string; amount: number; color: string }) {
  return (
    <View style={styles.total}>
      <Text style={styles.muted}>{label}</Text>
      <Text style={[styles.totalAmount, { color }]} numberOfLines={1} adjustsFontSizeToFit>
        {formatMinor(amount)}
      </Text>
    </View>
  );
}

function Fact({ icon, text }: { icon: React.ComponentProps<typeof Ionicons>['name']; text: string }) {
  return (
    <View style={styles.fact}>
      <Ionicons name={icon} size={16} color={colors.textMuted} />
      <Text style={styles.factText}>{text}</Text>
    </View>
  );
}

function SpendChange({ current, previous, period }: { current: number; previous: number; period: string }) {
  const delta = change(current, previous);
  if (delta === null) {
    return <Fact icon="swap-vertical-outline" text={`Nothing spent in ${period} to compare with`} />;
  }
  if (Math.abs(delta) < 0.005) {
    return <Fact icon="swap-vertical-outline" text={`Spent the same as ${period}`} />;
  }
  return (
    <Fact
      icon={delta > 0 ? 'arrow-up-outline' : 'arrow-down-outline'}
      text={`Spent ${percent(Math.abs(delta))} ${delta > 0 ? 'more' : 'less'} than ${period}`}
    />
  );
}

function MonthBars({ months, onOpen }: { months: MonthTotals[]; onOpen: (month: number) => void }) {
  const max = Math.max(1, ...months.flatMap(m => [m.incomeMinor, m.expenseMinor]));
  return (
    <View style={styles.monthList}>
      <View style={styles.legend}>
        <View style={[styles.dot, { backgroundColor: colors.income }]} />
        <Text style={styles.muted}>Income</Text>
        <View style={[styles.dot, { backgroundColor: colors.expense }]} />
        <Text style={styles.muted}>Expenses</Text>
      </View>
      {months.map(m => (
        <PressableScale
          key={m.month}
          accessibilityRole="button"
          accessibilityLabel={`Open ${monthName(m.month)}`}
          scaleTo={0.98}
          onPress={() => onOpen(m.month)}
          style={styles.monthRow}
        >
          <Text style={styles.monthName}>{monthName(m.month)}</Text>
          <View style={styles.monthBars}>
            <Bar amount={m.incomeMinor} max={max} color={colors.income} />
            <Bar amount={m.expenseMinor} max={max} color={colors.expense} />
          </View>
          <Text style={[styles.monthNet, m.netMinor < 0 && { color: colors.expense }]} numberOfLines={1}>
            {m.incomeMinor || m.expenseMinor ? formatMinor(m.netMinor) : '—'}
          </Text>
        </PressableScale>
      ))}
    </View>
  );
}

function Bar({ amount, max, color }: { amount: number; max: number; color: string }) {
  return (
    <View style={styles.barTrack}>
      {amount > 0 && <View style={[styles.bar, { width: `${(amount / max) * 100}%`, backgroundColor: color }]} />}
    </View>
  );
}

function monthName(month: number): string {
  return new Date(2000, month, 1).toLocaleDateString('en-IN', { month: 'short' });
}

function CategoryCard({
  title,
  totals,
  type,
  empty,
}: {
  title: string;
  totals: CategoryTotal[];
  type: 'income' | 'expense';
  empty: string;
}) {
  return (
    <Card style={styles.section}>
      <SectionTitle title={title} />
      {totals.length === 0 ? (
        <Text style={styles.muted}>{empty}</Text>
      ) : (
        totals.map(item => (
          <View key={item.categoryId ?? 'none'} style={styles.categoryRow}>
            <CategoryIcon name={item.name} type={type} size={32} />
            <View style={styles.categoryBody}>
              <View style={styles.categoryLabels}>
                <Text style={styles.categoryName} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.categoryAmount}>{formatMinor(item.amountMinor)}</Text>
              </View>
              <View style={styles.track}>
                <View
                  style={[
                    styles.fill,
                    { width: `${item.share * 100}%`, backgroundColor: categoryStyle(item.name, type).color },
                  ]}
                />
              </View>
            </View>
            <Text style={styles.share}>{percent(item.share)}</Text>
          </View>
        ))
      )}
    </Card>
  );
}

function PayeeCard({ payees }: { payees: PayeeTotal[] }) {
  return (
    <Card style={styles.section}>
      <SectionTitle title="Where the money went" />
      {payees.map((payee, index) => (
        <View key={payee.name.toLowerCase()} style={styles.payeeRow}>
          <Text style={styles.rank}>{index + 1}</Text>
          <View style={styles.flex}>
            <Text style={styles.categoryName} numberOfLines={1}>
              {payee.name}
            </Text>
            <Text style={styles.muted}>
              {payee.count} payment{payee.count === 1 ? '' : 's'}
            </Text>
          </View>
          <Text style={styles.categoryAmount}>{formatMinor(payee.amountMinor)}</Text>
        </View>
      ))}
    </Card>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  content: { padding: 16, gap: 16, paddingBottom: 48 },
  section: { gap: 14 },
  flex: { flex: 1 },
  muted: { color: colors.textMuted, fontSize: 13 },
  totals: { flexDirection: 'row', gap: 8 },
  total: { flex: 1, gap: 4 },
  totalAmount: { fontSize: 18, fontWeight: '800', fontVariant: ['tabular-nums'] },
  facts: { gap: 8, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12 },
  fact: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  factText: { color: colors.text, flex: 1 },
  yearSelector: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  yearButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  yearText: { fontSize: 18, fontWeight: '700', color: colors.text },
  monthList: { gap: 8 },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, marginLeft: 4 },
  monthRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 2 },
  monthName: { width: 34, color: colors.text, fontWeight: '600' },
  monthBars: { flex: 1, gap: 3 },
  barTrack: { height: 7 },
  bar: { height: 7, borderRadius: 4, minWidth: 3 },
  monthNet: { width: 96, textAlign: 'right', color: colors.text, fontVariant: ['tabular-nums'], fontSize: 13 },
  categoryRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  categoryBody: { flex: 1, gap: 6 },
  categoryLabels: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  categoryName: { flex: 1, color: colors.text, fontWeight: '600' },
  categoryAmount: { color: colors.text, fontWeight: '600', fontVariant: ['tabular-nums'] },
  track: { height: 8, backgroundColor: colors.surfaceMuted, borderRadius: 4, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
  share: { width: 40, textAlign: 'right', fontSize: 12, color: colors.textMuted },
  payeeRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rank: {
    width: 26,
    height: 26,
    borderRadius: 13,
    textAlign: 'center',
    lineHeight: 26,
    backgroundColor: colors.primarySoft,
    color: colors.primary,
    fontWeight: '700',
    overflow: 'hidden',
  },
}));
