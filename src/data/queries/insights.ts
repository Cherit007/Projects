import type { SQLiteDatabase } from 'expo-sqlite';

import { summarize } from '../../domain/accounting/accounting';
import { isUnusualSpend, spendingPace } from '../../domain/insights/pace';
import { safeToSpend, type SafeToSpend } from '../../domain/insights/safeToSpend';
import {
  detectSubscriptions,
  upcomingBills,
  type DetectedSubscription,
} from '../../domain/insights/subscriptions';
import { formatMinor } from '../../domain/money/money';
import { addMonths, monthKeyOf, monthRange, type MonthKey } from '../../domain/period';
import { monthlyGoalCommitmentMinor } from '../repositories/goals';
import { listRecurringRules } from '../repositories/recurring';
import { listTransactions } from '../repositories/transactions';
import { toLocalDateInput } from '../../utils/dates';

export interface MonthInsight {
  month: MonthKey;
  incomeMinor: number;
  expenseMinor: number;
  netMinor: number;
  topCategories: { name: string; amountMinor: number }[];
  vsLastMonthExpensePct: number | null;
  pace: ReturnType<typeof spendingPace>;
  safe: SafeToSpend;
  upcoming: DetectedSubscription[];
}

function labelMonth(key: MonthKey): string {
  return new Date(key.year, key.month, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

export async function loadMonthInsight(db: SQLiteDatabase, month: MonthKey, today = new Date()): Promise<MonthInsight> {
  const range = monthRange(month);
  const last = addMonths(month, -1);
  const lastRange = monthRange(last);
  const [txns, lastTxns, older, goalsMinor, rules] = await Promise.all([
    listTransactions(db, { range, limit: -1 }),
    listTransactions(db, { range: lastRange, limit: -1 }),
    listTransactions(db, {
      range: { startIso: monthRange(addMonths(month, -6)).startIso, endIso: range.startIso },
      type: 'expense',
      limit: -1,
    }),
    monthlyGoalCommitmentMinor(db),
    listRecurringRules(db),
  ]);

  const summary = summarize(txns);
  const lastSummary = summarize(lastTxns);
  const byCategory = new Map<string, number>();
  for (const t of txns) {
    if (t.type !== 'expense' || !t.categoryName) {
      continue;
    }
    byCategory.set(t.categoryName, (byCategory.get(t.categoryName) ?? 0) + t.amountMinor);
  }
  const topCategories = [...byCategory.entries()]
    .map(([name, amountMinor]) => ({ name, amountMinor }))
    .sort((a, b) => b.amountMinor - a.amountMinor)
    .slice(0, 3);

  const daysInMonth = new Date(month.year, month.month + 1, 0).getDate();
  const dayOfMonth =
    today.getFullYear() === month.year && today.getMonth() === month.month
      ? today.getDate()
      : daysInMonth;

  const pace = spendingPace({
    spentMinor: summary.expenseMinor,
    dayOfMonth,
    daysInMonth,
    lastMonthSpentMinor: lastSummary.expenseMinor,
  });

  const priorIncomes = [lastSummary.incomeMinor];
  // Average of last month income as expected when salary not yet in.
  const expectedIncomeMinor = Math.round(
    priorIncomes.reduce((a, b) => a + b, 0) / Math.max(1, priorIncomes.length),
  );

  const past = older.map(t => ({
    counterparty: t.counterparty ?? '',
    amountMinor: t.amountMinor,
    day: toLocalDateInput(t.occurredAt),
    categoryId: t.categoryId,
    categoryName: t.categoryName,
  }));
  const subscriptions = detectSubscriptions(past, toLocalDateInput(today.toISOString()));
  const upcoming = upcomingBills(subscriptions, toLocalDateInput(today.toISOString()), 14);

  // Recurring rules due this month that have not been mirrored by a matching expense yet.
  let billsFromRules = 0;
  for (const rule of rules) {
    if (rule.input.type !== 'expense' || rule.frequency === 'weekly') {
      continue;
    }
    const already = txns.some(
      t =>
        t.type === 'expense' &&
        t.amountMinor === rule.input.amountMinor &&
        (t.counterparty ?? '').trim().toLowerCase() === (rule.input.counterparty ?? '').trim().toLowerCase(),
    );
    if (!already) {
      billsFromRules += rule.input.amountMinor;
    }
  }
  const unpaidSubs = upcoming
    .filter(s => !txns.some(t => t.type === 'expense' && (t.counterparty ?? '').trim().toLowerCase() === s.counterparty.toLowerCase() && Math.abs(t.amountMinor - s.amountMinor) <= Math.max(100, s.amountMinor * 0.1)))
    .reduce((sum, s) => sum + s.amountMinor, 0);

  const safe = safeToSpend({
    incomeMinor: summary.incomeMinor,
    expectedIncomeMinor,
    spentMinor: summary.expenseMinor,
    billsRemainingMinor: billsFromRules + unpaidSubs,
    goalsMinor,
  });

  const vsLastMonthExpensePct =
    lastSummary.expenseMinor > 0
      ? Math.round(((summary.expenseMinor - lastSummary.expenseMinor) / lastSummary.expenseMinor) * 100)
      : null;

  return {
    month,
    incomeMinor: summary.incomeMinor,
    expenseMinor: summary.expenseMinor,
    netMinor: summary.netMinor,
    topCategories,
    vsLastMonthExpensePct,
    pace,
    safe,
    upcoming,
  };
}

export function monthlyOverviewBody(insight: MonthInsight): string {
  const month = labelMonth(insight.month);
  const top = insight.topCategories.map(c => c.name).slice(0, 2).join(', ') || 'no categories yet';
  const vs =
    insight.vsLastMonthExpensePct === null
      ? ''
      : insight.vsLastMonthExpensePct === 0
        ? ' · same as last month'
        : ` · ${insight.vsLastMonthExpensePct > 0 ? '+' : ''}${insight.vsLastMonthExpensePct}% vs last month`;
  return `You spent ${formatMinor(insight.expenseMinor)} in ${month} · top: ${top}${vs}`;
}

export function paceBody(insight: MonthInsight): string {
  return `At this rate you will hit ${formatMinor(insight.pace.projectedMinor)} by month end${
    insight.pace.aheadOfLastMonth ? ' — ahead of last month' : ''
  }.`;
}

export async function checkUnusualExpense(
  db: SQLiteDatabase,
  amountMinor: number,
  occurredAt: string,
): Promise<boolean> {
  const end = new Date(occurredAt);
  const start = new Date(end);
  start.setDate(start.getDate() - 60);
  const recent = await listTransactions(db, {
    type: 'expense',
    range: { startIso: start.toISOString(), endIso: end.toISOString() },
    limit: 200,
  });
  return isUnusualSpend(
    amountMinor,
    recent.filter(t => t.occurredAt !== occurredAt).map(t => t.amountMinor),
  );
}

export { monthKeyOf, labelMonth };
