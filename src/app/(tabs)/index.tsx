import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, Stack } from 'expo-router';
import type { SQLiteDatabase } from 'expo-sqlite';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { AddTransactionButton } from '@/components/AddButton';
import { billSummary } from '@/components/cardBill';
import { CategoryIcon } from '@/components/CategoryIcon';
import { PressableScale } from '@/components/PressableScale';
import { TransactionRow } from '@/components/TransactionRow';
import {
  Button,
  Card,
  Chip,
  ErrorState,
  Input,
  LoadingState,
  MonthSelector,
  SectionTitle,
  TextLink,
} from '@/components/ui';
import { ProgressBar, levelColor } from '@/components/ProgressBar';
import { loadBudgetSummary } from '@/data/queries/budgetSummary';
import { loadCardsOverview } from '@/data/queries/cards';
import { loadMonthInsight } from '@/data/queries/insights';
import { loadRange } from '@/data/queries/monthSummary';
import { getAccountFlows, listAccounts } from '@/data/repositories/accounts';
import { listCategories } from '@/data/repositories/categories';
import { accountBalance, holdings, spendingByCategory } from '@/domain/accounting/accounting';
import type { DashboardSectionId } from '@/domain/dashboard';
import { formatMinor } from '@/domain/money/money';
import {
  addMonths,
  getMonthStartDay,
  isInRange,
  monthKeyOf,
  formatMonth,
  monthName,
  monthRange,
  periodRange,
  type MonthKey,
  type Period,
} from '@/domain/period';
import { useFocusQuery } from '@/hooks/useFocusQuery';
import { usePreferences } from '@/services/PreferencesProvider';
import { useRecurring } from '@/services/RecurringProvider';
import { useUpi } from '@/services/upi/UpiProvider';
import { categoryStyle } from '@/theme/categoryStyle';
import { colors, radius, shadow, themedStyles } from '@/theme/colors';
import { formatShortLocalDate, toLocalDateInput } from '@/utils/dates';

async function loadDashboard(db: SQLiteDatabase, period: Period) {
  const now = new Date();
  const range = periodRange(period, now) ?? monthRange(monthKeyOf(now));
  const month = period.kind === 'month' ? period.month : monthKeyOf(now);
  const [rangeData, accounts, startFlows, endFlows, categories, budgets, insight, cards] = await Promise.all([
    loadRange(db, range),
    listAccounts(db),
    getAccountFlows(db, range.startIso),
    getAccountFlows(db, range.endIso),
    listCategories(db, { includeArchived: true }),
    loadBudgetSummary(db, month),
    loadMonthInsight(db, month),
    loadCardsOverview(db),
  ]);
  return {
    ...rangeData,
    range,
    cards,
    balances: accounts
      .filter(a => a.type !== 'card')
      .map(a => ({ id: a.id, name: a.name, type: a.type, balanceMinor: accountBalance(a, endFlows.get(a.id)) })),
    budgets: budgets.progress.slice(0, 3),
    carried: holdings(accounts, startFlows),
    closing: holdings(accounts, endFlows),
    spending: spendingByCategory(rangeData.transactions, categories),
    insight,
  };
}

type PeriodKind = Period['kind'];

const PERIOD_KINDS: { value: PeriodKind; label: string }[] = [
  { value: 'month', label: 'Month' },
  { value: 'ytd', label: 'Year to date' },
  { value: 'custom', label: 'Custom' },
];

function dayLabel(iso: string): string {
  return formatShortLocalDate(toLocalDateInput(iso));
}

export default function DashboardScreen() {
  const { dashboard } = usePreferences();
  const [period, setPeriod] = useState<Period>(() => ({ kind: 'month', month: monthKeyOf(new Date()) }));
  const [month, setMonth] = useState<MonthKey>(() => monthKeyOf(new Date()));
  const [customFrom, setCustomFrom] = useState(() => {
    const now = new Date();
    return toLocalDateInput(new Date(now.getFullYear(), now.getMonth(), 1).toISOString());
  });
  const [customTo, setCustomTo] = useState(() => toLocalDateInput(new Date().toISOString()));
  const upi = useUpi();
  const recurring = useRecurring();

  // Detection syncs and repeating transactions add entries in the background, so they reload the dashboard too.
  const { data, error, isLoading, reload } = useFocusQuery(
    useCallback((db: SQLiteDatabase) => loadDashboard(db, period), [period]),
    `${upi.lastSyncAt}|${recurring.lastAddedAt}`,
  );

  const chooseKind = (kind: PeriodKind) => {
    if (kind === 'month') {
      setPeriod({ kind: 'month', month });
    } else if (kind === 'ytd') {
      setPeriod({ kind: 'ytd' });
    } else {
      applyCustom();
    }
  };

  const changeMonth = (next: MonthKey) => {
    setMonth(next);
    setPeriod({ kind: 'month', month: next });
  };

  const applyCustom = () => {
    const next: Period = { kind: 'custom', from: customFrom, to: customTo };
    if (!periodRange(next, new Date())) {
      Alert.alert('Check the dates', 'Enter dates as YYYY-MM-DD, with the start on or before the end.');
      return;
    }
    setPeriod(next);
  };

  const header = (
    <Stack.Screen
      options={{
        headerRight: () => (
          <View style={styles.headerRight}>
            <PressableScale
              accessibilityLabel="Search"
              hitSlop={10}
              onPress={() => router.push('/search')}
              style={styles.headerButton}
            >
              <Ionicons name="search" size={22} color={colors.primary} />
            </PressableScale>
            <PressableScale
              accessibilityLabel="Settings"
              hitSlop={10}
              onPress={() => router.push('/settings')}
              style={styles.headerButton}
            >
              <Ionicons name="person-circle-outline" size={26} color={colors.primary} />
            </PressableScale>
          </View>
        ),
      }}
    />
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

  const { summary, spending, transactions, range } = data;
  const isMonth = period.kind === 'month';
  // With a salary-day month start, month names alone are ambiguous, so the summary uses dates.
  const calendarMonths = isMonth && getMonthStartDay() === 1;
  const lastDay = dayLabel(new Date(Date.parse(range.endIso) - 1).toISOString());
  const includesToday = isInRange(new Date().toISOString(), range);
  const maxSpend = spending[0]?.amountMinor ?? 0;
  const periodLabel = calendarMonths ? formatMonth(month) : `${dayLabel(range.startIso)} – ${lastDay}`;
  const openTransactions = (filter: { type: 'income' | 'expense'; category?: string }) =>
    router.push({
      pathname: '/transactions',
      params: {
        ...filter,
        from: range.startIso,
        to: range.endIso,
        label: periodLabel,
        at: new Date().toISOString(),
      },
    });

  const sections: Record<DashboardSectionId, ReactNode> = {
    review:
      upi.pendingCount > 0 ? (
        <PressableScale hapticKind="light" onPress={() => router.push('/upi-review')} style={styles.reviewBanner}>
          <View style={styles.reviewIcon}>
            <Ionicons name="flash" size={20} color={colors.primary} />
          </View>
          <View style={styles.reviewText}>
            <Text style={styles.reviewTitle}>
              {upi.pendingCount} detected payment{upi.pendingCount === 1 ? '' : 's'} to review
            </Text>
            <Text style={styles.reviewBody}>Tap to categorise them in a few seconds</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.primary} />
        </PressableScale>
      ) : null,

    safe: isMonth && includesToday ? (
      <Card style={styles.safeCard}>
        <Text style={styles.safeLabel}>Safe to spend</Text>
        <Text
          style={[styles.safeAmount, { color: data.insight.safe.leftoverMinor < 0 ? colors.expense : colors.income }]}
        >
          {formatMinor(data.insight.safe.leftoverMinor)}
        </Text>
        <Text style={styles.safeDetail}>
          Balance {formatMinor(data.insight.safe.availableMinor)}
          {data.insight.safe.cardDueMinor > 0 ? ` − card dues ${formatMinor(data.insight.safe.cardDueMinor)}` : ''}
          {data.insight.safe.billsRemainingMinor > 0 ? ` − bills ${formatMinor(data.insight.safe.billsRemainingMinor)}` : ''}
          {data.insight.safe.goalsMinor > 0 ? ` − goals ${formatMinor(data.insight.safe.goalsMinor)}` : ''}
        </Text>
        {includesToday && data.insight.pace.aheadOfLastMonth && (
          <Text style={styles.paceWarn}>{`At this rate: ${formatMinor(data.insight.pace.projectedMinor)} by month end`}</Text>
        )}
        <TextLink label="Savings goals" onPress={() => router.push('/goals')} />
      </Card>
    ) : null,

    cards:
      includesToday && data.cards.cards.length > 0 ? (
        <Card style={styles.section}>
          <SectionTitle title="Credit card bills" action={<TextLink label="All cards" onPress={() => router.push('/cards')} />} />
          {data.cards.cards.slice(0, 3).map(card => {
            const bill = card.bill ? billSummary(card.bill) : null;
            return (
              <PressableScale
                key={card.account.id}
                hapticKind="light"
                onPress={() => router.push('/cards')}
                style={styles.billRow}
              >
                <View style={styles.flex}>
                  <Text style={styles.barName} numberOfLines={1}>
                    {card.account.name}
                  </Text>
                  <Text style={[styles.cardStatus, { color: bill?.color ?? colors.textMuted }]} numberOfLines={1}>
                    {bill?.text ?? 'Set statement and due days'}
                  </Text>
                </View>
                <Text style={styles.billAmount}>{formatMinor(card.owedMinor)}</Text>
              </PressableScale>
            );
          })}
        </Card>
      ) : null,

    bills:
      includesToday && data.insight.upcoming.length > 0 ? (
        <Card style={styles.section}>
          <SectionTitle title="Upcoming bills" />
          {data.insight.upcoming.slice(0, 4).map(bill => (
            <View key={`${bill.counterparty}-${bill.nextDue}`} style={styles.billRow}>
              <View style={styles.flex}>
                <Text style={styles.barName} numberOfLines={1}>
                  {bill.counterparty}
                </Text>
                <Text style={styles.muted}>Due {formatShortLocalDate(bill.nextDue)}</Text>
              </View>
              <Text style={styles.billAmount}>{formatMinor(bill.amountMinor)}</Text>
            </View>
          ))}
        </Card>
      ) : null,

    shortcuts: (
      <>
        <PressableScale hapticKind="light" onPress={() => router.push('/reports')}>
          <Card style={styles.linkCard}>
            <View style={[styles.reviewIcon, { backgroundColor: colors.primarySoft }]}>
              <Ionicons name="bar-chart" size={20} color={colors.primary} />
            </View>
            <View style={styles.reviewText}>
              <Text style={styles.reviewTitle}>Reports</Text>
              <Text style={styles.reviewBody}>Month and year totals, categories and top payees</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </Card>
        </PressableScale>
        <PressableScale hapticKind="light" onPress={() => router.push('/statement-import')} style={styles.secondLink}>
          <Card style={styles.linkCard}>
            <View style={[styles.reviewIcon, { backgroundColor: colors.primarySoft }]}>
              <Ionicons name="document-text-outline" size={20} color={colors.primary} />
            </View>
            <View style={styles.reviewText}>
              <Text style={styles.reviewTitle}>Import statement</Text>
              <Text style={styles.reviewBody}>HDFC Bank, SBI or MobiKwik statement PDF</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </Card>
        </PressableScale>
      </>
    ),

    budgets:
      isMonth && data.budgets.length > 0 ? (
        <Card style={styles.section}>
          <SectionTitle title="Budgets" action={<TextLink label="Manage" onPress={() => router.push('/budgets')} />} />
          {data.budgets.map(budget => (
            <View key={budget.budgetId} style={styles.budgetRow}>
              <View style={styles.barLabels}>
                <Text style={styles.barName} numberOfLines={1}>
                  {budget.name}
                </Text>
                <Text style={[styles.budgetLeft, { color: levelColor[budget.level] }]}>
                  {budget.remainingMinor >= 0
                    ? `${formatMinor(budget.remainingMinor)} left`
                    : `${formatMinor(-budget.remainingMinor)} over`}
                </Text>
              </View>
              <ProgressBar ratio={budget.ratio} color={levelColor[budget.level]} />
            </View>
          ))}
        </Card>
      ) : null,

    spending: (
      <Card style={styles.section}>
        <SectionTitle title="Spending by category" />
        {spending.length === 0 ? (
          <Text style={styles.muted}>No expenses in this period.</Text>
        ) : (
          spending.map((item, index) => (
            <PressableScale
              key={item.categoryId ?? 'none'}
              hapticKind="light"
              accessibilityRole="button"
              accessibilityHint={`Shows ${item.name} spending in this period`}
              onPress={() => openTransactions({ type: 'expense', category: item.categoryId ?? 'none' })}
            >
              <SpendingBar
                name={item.name}
                amountMinor={item.amountMinor}
                share={maxSpend ? item.amountMinor / maxSpend : 0}
                percent={summary.expenseMinor ? Math.round((item.amountMinor / summary.expenseMinor) * 100) : 0}
                index={index}
              />
            </PressableScale>
          ))
        )}
      </Card>
    ),

    balances:
      data.balances.length > 0 ? (
        <Card style={styles.section}>
          <SectionTitle
            title={includesToday ? 'Account balances' : `Balances on ${lastDay}`}
            action={<TextLink label="Accounts" onPress={() => router.push('/accounts')} />}
          />
          {data.balances.map(account => (
            <View key={account.id} style={styles.billRow}>
              <Ionicons
                name={account.type === 'cash' ? 'cash-outline' : account.type === 'wallet' ? 'wallet-outline' : 'business-outline'}
                size={20}
                color={colors.primary}
              />
              <Text style={styles.barName} numberOfLines={1}>
                {account.name}
              </Text>
              <Text style={[styles.billAmount, account.balanceMinor < 0 && { color: colors.expense }]}>
                {formatMinor(account.balanceMinor)}
              </Text>
            </View>
          ))}
        </Card>
      ) : null,

    recent: (
      <View style={styles.section}>
        <SectionTitle
          title="Recent transactions"
          action={transactions.length > 0 ? <TextLink label="See all" onPress={() => router.push('/transactions')} /> : undefined}
        />
        {transactions.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Text style={styles.muted}>Nothing recorded in this period yet.</Text>
            <Button title="Add transaction" icon="add" onPress={() => router.push('/transaction/new')} />
          </Card>
        ) : (
          <View style={styles.recent}>
            {transactions.slice(0, 5).map(item => (
              <TransactionRow key={item.id} item={item} showDate onDeleted={reload} />
            ))}
          </View>
        )}
      </View>
    ),
  };

  const shown = dashboard.filter(s => s.visible && sections[s.id] !== null);

  return (
    <View style={styles.container}>
      {header}
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.periodRow}>
          {PERIOD_KINDS.map(option => (
            <Chip
              key={option.value}
              label={option.label}
              selected={period.kind === option.value}
              onPress={() => chooseKind(option.value)}
            />
          ))}
        </View>
        {period.kind === 'month' && <MonthSelector value={month} onChange={changeMonth} />}
        {period.kind === 'custom' && (
          <View style={styles.customRow}>
            <Input
              style={styles.dateInput}
              value={customFrom}
              onChangeText={setCustomFrom}
              placeholder="From YYYY-MM-DD"
              maxLength={10}
            />
            <Input style={styles.dateInput} value={customTo} onChangeText={setCustomTo} placeholder="To YYYY-MM-DD" maxLength={10} />
            <Button title="Show" variant="secondary" onPress={applyCustom} />
          </View>
        )}

        <Animated.View entering={FadeInDown.duration(350)}>
          <LinearGradient
            colors={[colors.heroStart, colors.heroEnd]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.hero}
          >
            <Text style={styles.heroLabel}>
              Net cash flow
              {isMonth ? '' : ` · ${dayLabel(range.startIso)} – ${lastDay}`}
            </Text>
            <Text style={styles.heroAmount}>{formatMinor(summary.netMinor)}</Text>
            <View style={styles.heroPills}>
              <HeroPill
                icon="arrow-down"
                label="Income"
                amount={summary.incomeMinor}
                onPress={() => openTransactions({ type: 'income' })}
              />
              <HeroPill
                icon="arrow-up"
                label="Expenses"
                amount={summary.expenseMinor}
                onPress={() => openTransactions({ type: 'expense' })}
              />
            </View>
            <View style={styles.heroDivider} />
            <View style={styles.heroFooter}>
              <Ionicons name="arrow-redo-outline" size={16} color="#E0E7FF" />
              <Text style={styles.heroFooterText}>
                {calendarMonths
                  ? `Carried over from ${monthName(addMonths(month, -1))}`
                  : `Balance on ${dayLabel(range.startIso)}`}
              </Text>
              <Text style={styles.heroFooterAmount}>{formatMinor(data.carried.cashMinor)}</Text>
            </View>
            <View style={styles.heroFooter}>
              <Ionicons name="wallet-outline" size={16} color="#E0E7FF" />
              <Text style={styles.heroFooterText}>
                {includesToday
                  ? 'Cash and bank balance'
                  : calendarMonths
                    ? `Balance at end of ${monthName(month)}`
                    : `Balance at end of ${lastDay}`}
              </Text>
              <Text style={styles.heroFooterAmount}>{formatMinor(data.closing.cashMinor)}</Text>
            </View>
            {data.closing.cardDueMinor > 0 && (
              <View style={styles.heroFooter}>
                <Ionicons name="card-outline" size={16} color="#E0E7FF" />
                <Text style={styles.heroFooterText}>Credit card dues</Text>
                <Text style={styles.heroFooterAmount}>{formatMinor(data.closing.cardDueMinor)}</Text>
              </View>
            )}
          </LinearGradient>
        </Animated.View>

        {shown.map((section, index) => (
          <Animated.View key={section.id} entering={FadeInDown.delay(40 + index * 30).duration(350)}>
            {sections[section.id]}
          </Animated.View>
        ))}
        {shown.length === 0 && (
          <TextLink label="Choose dashboard sections" onPress={() => router.push('/preferences')} />
        )}
      </ScrollView>
      <AddTransactionButton />
    </View>
  );
}

function HeroPill({
  icon,
  label,
  amount,
  onPress,
}: {
  icon: 'arrow-down' | 'arrow-up';
  label: string;
  amount: number;
  onPress: () => void;
}) {
  return (
    <PressableScale
      hapticKind="light"
      accessibilityRole="button"
      accessibilityHint={`Shows every ${label === 'Income' ? 'credit' : 'debit'} in this period`}
      onPress={onPress}
      style={styles.heroPill}
    >
      <View style={styles.heroPillIcon}>
        <Ionicons name={icon} size={14} color="#fff" />
      </View>
      <View style={styles.flex}>
        <Text style={styles.heroPillLabel}>{label}</Text>
        <Text style={styles.heroPillAmount}>{formatMinor(amount)}</Text>
      </View>
      <Ionicons name="chevron-forward" size={14} color="#E0E7FF" />
    </PressableScale>
  );
}

function SpendingBar({
  name,
  amountMinor,
  share,
  percent,
  index,
}: {
  name: string;
  amountMinor: number;
  share: number;
  percent: number;
  index: number;
}) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.set(withDelay(150 + index * 60, withTiming(share, { duration: 600 })));
  }, [progress, share, index]);
  const fillStyle = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));
  const { color } = categoryStyle(name, 'expense');

  return (
    <View style={styles.barRow}>
      <CategoryIcon name={name} type="expense" size={34} />
      <View style={styles.barBody}>
        <View style={styles.barLabels}>
          <Text style={styles.barName} numberOfLines={1}>
            {name}
          </Text>
          <Text style={styles.barAmount}>{formatMinor(amountMinor)}</Text>
        </View>
        <View style={styles.barTrackRow}>
          <View style={styles.barTrack}>
            <Animated.View style={[styles.barFill, { backgroundColor: color }, fillStyle]} />
          </View>
          <Text style={styles.barPercent}>{percent}%</Text>
        </View>
      </View>
    </View>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 16, paddingBottom: 110 },
  muted: { color: colors.textMuted },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  headerButton: { marginRight: 12, padding: 4 },
  periodRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  customRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dateInput: { flex: 1, fontSize: 15, paddingHorizontal: 10 },
  safeCard: { gap: 6 },
  safeLabel: { fontSize: 13, fontWeight: '600', color: colors.textMuted, textTransform: 'uppercase' },
  safeAmount: { fontSize: 28, fontWeight: '800', fontVariant: ['tabular-nums'] },
  safeDetail: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },
  paceWarn: { fontSize: 13, color: colors.warning, fontWeight: '600' },
  billRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  billAmount: { fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'] },
  cardStatus: { fontSize: 13, fontWeight: '600' },
  flex: { flex: 1 },
  hero: { borderRadius: radius.lg, padding: 20, gap: 6, ...shadow },
  heroLabel: { color: '#E0E7FF', fontWeight: '600' },
  heroAmount: { color: '#fff', fontSize: 36, fontWeight: '800', fontVariant: ['tabular-nums'] },
  heroPills: { flexDirection: 'row', gap: 10, marginTop: 10 },
  heroPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: radius.md,
    padding: 10,
  },
  heroPillIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroPillLabel: { color: '#E0E7FF', fontSize: 12 },
  heroPillAmount: { color: '#fff', fontWeight: '700', fontVariant: ['tabular-nums'] },
  heroDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.18)', marginVertical: 10 },
  heroFooter: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  heroFooterText: { color: '#E0E7FF', flex: 1 },
  heroFooterAmount: { color: '#fff', fontWeight: '700', fontVariant: ['tabular-nums'] },
  reviewBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
  },
  reviewIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewText: { flex: 1, gap: 2 },
  linkCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  secondLink: { marginTop: 10 },
  reviewTitle: { fontWeight: '700', color: colors.text },
  reviewBody: { color: colors.textMuted, fontSize: 13 },
  section: { gap: 14 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  barBody: { flex: 1, gap: 6 },
  barLabels: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  barName: { flex: 1, color: colors.text, fontWeight: '600' },
  barAmount: { color: colors.text, fontWeight: '600', fontVariant: ['tabular-nums'] },
  barTrackRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  barTrack: { flex: 1, height: 8, backgroundColor: colors.surfaceMuted, borderRadius: 4, overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 4 },
  barPercent: { width: 36, textAlign: 'right', fontSize: 12, color: colors.textMuted },
  emptyCard: { gap: 12, alignItems: 'flex-start' },
  budgetRow: { gap: 6 },
  budgetLeft: { fontWeight: '700', fontVariant: ['tabular-nums'] },
  recent: { borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.surface, ...shadow },
}));
