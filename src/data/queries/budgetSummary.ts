import type { SQLiteDatabase } from 'expo-sqlite';

import { spendingByCategory } from '../../domain/accounting/accounting';
import { budgetCrossing, budgetProgress, type BudgetProgress } from '../../domain/budgets/budgets';
import { formatMinor } from '../../domain/money/money';
import type { MonthKey } from '../../domain/period';
import { listBudgets } from '../repositories/budgets';
import { listCategories } from '../repositories/categories';
import { getBudgetWarnPercent } from '../repositories/settings';
import { loadMonth } from './monthSummary';

export interface BudgetSummary {
  progress: BudgetProgress[];
  warnPercent: number;
  totalLimitMinor: number;
  totalSpentMinor: number;
}

/**
 * Compares a category's budget before and after saving an expense and
 * describes the change if it crossed the warning threshold or the limit.
 */
export function budgetAlert(
  before: BudgetSummary,
  after: BudgetSummary,
  rootCategoryId: string,
): { title: string; message: string } | null {
  const previous = before.progress.find(p => p.categoryId === rootCategoryId);
  const next = after.progress.find(p => p.categoryId === rootCategoryId);
  if (!previous || !next) {
    return null;
  }
  const crossing = budgetCrossing(previous.spentMinor, next.spentMinor, next.limitMinor, after.warnPercent);
  if (crossing === 'over') {
    return {
      title: `${next.name} budget exceeded`,
      message: `You're ${formatMinor(-next.remainingMinor)} over your ${formatMinor(next.limitMinor)} monthly budget.`,
    };
  }
  if (crossing === 'warning') {
    return {
      title: `${next.name} budget ${Math.round(next.ratio * 100)}% used`,
      message: `${formatMinor(next.remainingMinor)} left of ${formatMinor(next.limitMinor)} this month.`,
    };
  }
  return null;
}

export async function loadBudgetSummary(db: SQLiteDatabase, month: MonthKey): Promise<BudgetSummary> {
  const [monthData, budgets, categories, warnPercent] = await Promise.all([
    loadMonth(db, month),
    listBudgets(db),
    listCategories(db, { includeArchived: true }),
    getBudgetWarnPercent(db),
  ]);
  const spending = spendingByCategory(monthData.transactions, categories);
  const names = new Map(categories.map(c => [c.id, c.name]));
  const progress = budgetProgress(budgets, spending, names, warnPercent);
  return {
    progress,
    warnPercent,
    totalLimitMinor: progress.reduce((sum, p) => sum + p.limitMinor, 0),
    totalSpentMinor: progress.reduce((sum, p) => sum + p.spentMinor, 0),
  };
}
