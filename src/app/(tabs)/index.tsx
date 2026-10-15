import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, Stack } from 'expo-router';
import type { SQLiteDatabase } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { AddTransactionButton } from '@/components/AddButton';
import { CategoryIcon } from '@/components/CategoryIcon';
import { PersonRow } from '@/components/PersonRow';
import { PressableScale } from '@/components/PressableScale';
import { TransactionRow } from '@/components/TransactionRow';
import {
  Button,
  Card,
  ErrorState,
  LoadingState,
  MonthSelector,
  SectionTitle,
  TextLink,
} from '@/components/ui';
import { ProgressBar, levelColor } from '@/components/ProgressBar';
import { loadBudgetSummary } from '@/data/queries/budgetSummary';
import { loadMonth } from '@/data/queries/monthSummary';
import { getAccountFlows, listAccounts } from '@/data/repositories/accounts';
import { listCategories } from '@/data/repositories/categories';
import { listPeople } from '@/data/repositories/people';
import { accountBalance, spendingByCategory } from '@/domain/accounting/accounting';
import { formatMinor, sumMinor } from '@/domain/money/money';
import { monthKeyOf, type MonthKey } from '@/domain/period';
import { useFocusQuery } from '@/hooks/useFocusQuery';
import { useUpi } from '@/services/upi/UpiProvider';
import { categoryStyle } from '@/theme/categoryStyle';
import { colors, radius, shadow } from '@/theme/colors';

async function loadDashboard(db: SQLiteDatabase, month: MonthKey) {
  const [monthData, accounts, flows, categories, budgets, people] = await Promise.all([
    loadMonth(db, month),
    listAccounts(db),
    getAccountFlows(db),
    listCategories(db, { includeArchived: true }),
    loadBudgetSummary(db, month),
    listPeople(db),
  ]);
  return {
    ...monthData,
    people: people.slice(0, 3),
    budgets: budgets.progress.slice(0, 3),
    totalBalanceMinor: sumMinor(accounts.map(a => accountBalance(a, flows.get(a.id)))),
    spending: spendingByCategory(monthData.transactions, categories),
  };
}

export default function DashboardScreen() {
  const [month, setMonth] = useState<MonthKey>(() => monthKeyOf(new Date()));
  const upi = useUpi();
  // Detection syncs may add payments automatically, so they reload the dashboard too.
  const { data, error, isLoading, reload } = useFocusQuery(
    useCallback((db: SQLiteDatabase) => loadDashboard(db, month), [month]),
    upi.lastSyncAt,
  );

  const header = (
    <Stack.Screen
      options={{
        headerRight: () => (
          <PressableScale
            accessibilityLabel="Settings"
            hitSlop={10}
            onPress={() => router.push('/settings')}
            style={styles.headerButton}
          >
            <Ionicons name="person-circle-outline" size={26} color={colors.primary} />
          </PressableScale>
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

  const { summary, spending, transactions } = data;
  const maxSpend = spending[0]?.amountMinor ?? 0;

  return (
    <View style={styles.container}>
      {header}
      <ScrollView contentContainerStyle={styles.content}>
        <MonthSelector value={month} onChange={setMonth} />

        <Animated.View entering={FadeInDown.duration(350)}>
          <LinearGradient
            colors={[colors.heroStart, colors.heroEnd]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.hero}
          >
            <Text style={styles.heroLabel}>Net cash flow</Text>
            <Text style={styles.heroAmount}>{formatMinor(summary.netMinor)}</Text>
            <View style={styles.heroPills}>
              <HeroPill icon="arrow-down" label="Income" amount={summary.incomeMinor} />
              <HeroPill icon="arrow-up" label="Expenses" amount={summary.expenseMinor} />
            </View>
            <View style={styles.heroDivider} />
            <View style={styles.heroFooter}>
              <Ionicons name="wallet-outline" size={16} color="#E0E7FF" />
              <Text style={styles.heroFooterText}>Cash and bank balance</Text>
              <Text style={styles.heroFooterAmount}>{formatMinor(data.totalBalanceMinor)}</Text>
            </View>
          </LinearGradient>
        </Animated.View>

        {upi.pendingCount > 0 && (
          <Animated.View entering={FadeInDown.delay(80).duration(350)}>
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
          </Animated.View>
        )}

        {data.budgets.length > 0 && (
          <Animated.View entering={FadeInDown.delay(110).duration(350)}>
            <Card style={styles.section}>
              <SectionTitle
                title="Budgets"
                action={<TextLink label="Manage" onPress={() => router.push('/budgets')} />}
              />
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
          </Animated.View>
        )}

        <Animated.View entering={FadeInDown.delay(140).duration(350)}>
          <Card style={styles.section}>
            <SectionTitle title="Spending by category" />
            {spending.length === 0 ? (
              <Text style={styles.muted}>No expenses this month.</Text>
            ) : (
              spending.map((item, index) => (
                <SpendingBar
                  key={item.categoryId ?? 'none'}
                  name={item.name}
                  amountMinor={item.amountMinor}
                  share={maxSpend ? item.amountMinor / maxSpend : 0}
                  percent={summary.expenseMinor ? Math.round((item.amountMinor / summary.expenseMinor) * 100) : 0}
                  index={index}
                />
              ))
            )}
          </Card>
        </Animated.View>

        {data.people.length > 0 && (
          <Animated.View entering={FadeInDown.delay(170).duration(350)} style={styles.section}>
            <SectionTitle title="Friends and family" action={<TextLink label="See all" onPress={() => router.push('/people')} />} />
            <View style={styles.recent}>
              {data.people.map(person => (
                <PersonRow key={person.name.toLowerCase()} person={person} />
              ))}
            </View>
          </Animated.View>
        )}

        <Animated.View entering={FadeInDown.delay(200).duration(350)} style={styles.section}>
          <SectionTitle
            title="Recent transactions"
            action={transactions.length > 0 ? <TextLink label="See all" onPress={() => router.push('/transactions')} /> : undefined}
          />
          {transactions.length === 0 ? (
            <Card style={styles.emptyCard}>
              <Text style={styles.muted}>Nothing recorded this month yet.</Text>
              <Button title="Add transaction" icon="add" onPress={() => router.push('/transaction/new')} />
            </Card>
          ) : (
            <View style={styles.recent}>
              {transactions.slice(0, 5).map(item => (
                <TransactionRow key={item.id} item={item} showDate />
              ))}
            </View>
          )}
        </Animated.View>
      </ScrollView>
      <AddTransactionButton />
    </View>
  );
}

function HeroPill({ icon, label, amount }: { icon: 'arrow-down' | 'arrow-up'; label: string; amount: number }) {
  return (
    <View style={styles.heroPill}>
      <View style={styles.heroPillIcon}>
        <Ionicons name={icon} size={14} color="#fff" />
      </View>
      <View>
        <Text style={styles.heroPillLabel}>{label}</Text>
        <Text style={styles.heroPillAmount}>{formatMinor(amount)}</Text>
      </View>
    </View>
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

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 16, paddingBottom: 110 },
  muted: { color: colors.textMuted },
  headerButton: { marginRight: 16, padding: 4 },
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
  heroFooter: { flexDirection: 'row', alignItems: 'center', gap: 6 },
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
    borderColor: '#D9DCFF',
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
});
