import { summarize, type PeriodSummary } from './accounting/accounting';
import type { MinorUnits } from './money/money';
import type { Category, CategoryType, Transaction } from './types';

type ReportTransaction = Pick<Transaction, 'type' | 'amountMinor' | 'occurredAt' | 'categoryId' | 'counterparty'>;

export interface MonthTotals extends PeriodSummary {
  /** 0-based, local time. */
  month: number;
}

/** Income, expenses and net for each month of `year` (12 entries, local time). */
export function monthlyTotals(transactions: readonly ReportTransaction[], year: number): MonthTotals[] {
  const byMonth = Array.from({ length: 12 }, () => [] as ReportTransaction[]);
  for (const txn of transactions) {
    const date = new Date(txn.occurredAt);
    if (date.getFullYear() === year) {
      byMonth[date.getMonth()].push(txn);
    }
  }
  return byMonth.map((items, month) => ({ month, ...summarize(items) }));
}

export interface CategoryTotal {
  categoryId: string | null;
  name: string;
  amountMinor: MinorUnits;
  share: number;
}

/** Totals of one type by top-level category, largest first, with each one's share of the total. */
export function totalsByCategory(
  transactions: readonly ReportTransaction[],
  categories: readonly Category[],
  type: CategoryType,
): CategoryTotal[] {
  const byId = new Map(categories.map(c => [c.id, c]));
  const totals = new Map<string | null, number>();
  let all = 0;
  for (const txn of transactions) {
    if (txn.type !== type) {
      continue;
    }
    const category = txn.categoryId ? byId.get(txn.categoryId) : undefined;
    const rootId = category ? (category.parentId ?? category.id) : null;
    totals.set(rootId, (totals.get(rootId) ?? 0) + txn.amountMinor);
    all += txn.amountMinor;
  }
  return [...totals.entries()]
    .map(([categoryId, amountMinor]) => ({
      categoryId,
      name: (categoryId && byId.get(categoryId)?.name) || 'Uncategorized',
      amountMinor,
      share: all ? amountMinor / all : 0,
    }))
    .sort((a, b) => b.amountMinor - a.amountMinor);
}

export interface PayeeTotal {
  name: string;
  amountMinor: MinorUnits;
  count: number;
}

/** Payees with the largest totals; names are matched ignoring case and spaces. */
export function topPayees(transactions: readonly ReportTransaction[], type: CategoryType, limit = 5): PayeeTotal[] {
  const totals = new Map<string, PayeeTotal>();
  for (const txn of transactions) {
    const name = txn.counterparty?.replace(/\s+/g, ' ').trim();
    if (txn.type !== type || !name) {
      continue;
    }
    const key = name.toLowerCase();
    const total = totals.get(key) ?? { name, amountMinor: 0, count: 0 };
    total.amountMinor += txn.amountMinor;
    total.count += 1;
    totals.set(key, total);
  }
  return [...totals.values()].sort((a, b) => b.amountMinor - a.amountMinor || b.count - a.count).slice(0, limit);
}

/**
 * Average monthly spending from the first month with any entries up to
 * `lastMonth` (the current month for this year, else December), so months
 * before tracking started do not lower it. Null without entries.
 */
export function averageMonthlySpend(months: readonly MonthTotals[], lastMonth = 11): MinorUnits | null {
  const first = months.findIndex(m => m.incomeMinor > 0 || m.expenseMinor > 0);
  if (first === -1 || first > lastMonth) {
    return null;
  }
  const span = months.slice(first, lastMonth + 1);
  return Math.round(span.reduce((sum, m) => sum + m.expenseMinor, 0) / span.length);
}

/** Share of income kept (net / income), or null without income. */
export function savingsRate(summary: PeriodSummary): number | null {
  return summary.incomeMinor > 0 ? summary.netMinor / summary.incomeMinor : null;
}

/** Relative change from `previous` to `current`, or null when there is nothing to compare with. */
export function change(current: MinorUnits, previous: MinorUnits): number | null {
  return previous > 0 ? (current - previous) / previous : null;
}
