import type { CategorySpending } from '../accounting/accounting';
import type { MinorUnits } from '../money/money';

export type BudgetLevel = 'ok' | 'warning' | 'over';

export const DEFAULT_WARN_PERCENT = 80;

export interface Budget {
  id: string;
  categoryId: string;
  amountMinor: MinorUnits;
}

export interface BudgetProgress {
  budgetId: string;
  categoryId: string;
  name: string;
  limitMinor: MinorUnits;
  spentMinor: MinorUnits;
  /** Negative when the budget is exceeded. */
  remainingMinor: MinorUnits;
  /** Spent divided by limit; above 1 when exceeded. */
  ratio: number;
  level: BudgetLevel;
}

export function budgetLevel(spentMinor: MinorUnits, limitMinor: MinorUnits, warnPercent: number): BudgetLevel {
  if (spentMinor > limitMinor) {
    return 'over';
  }
  if (spentMinor * 100 >= limitMinor * warnPercent) {
    return 'warning';
  }
  return 'ok';
}

/**
 * Compares budgets with a month's spending. Spending must already be rolled
 * up to top-level categories (as `spendingByCategory` does). Sorted with the
 * most used budget first.
 */
export function budgetProgress(
  budgets: readonly Budget[],
  spending: readonly CategorySpending[],
  categoryNames: ReadonlyMap<string, string>,
  warnPercent: number,
): BudgetProgress[] {
  const spentById = new Map(spending.map(s => [s.categoryId, s.amountMinor]));
  return budgets
    .map(budget => {
      const spentMinor = spentById.get(budget.categoryId) ?? 0;
      return {
        budgetId: budget.id,
        categoryId: budget.categoryId,
        name: categoryNames.get(budget.categoryId) ?? 'Unknown category',
        limitMinor: budget.amountMinor,
        spentMinor,
        remainingMinor: budget.amountMinor - spentMinor,
        ratio: spentMinor / budget.amountMinor,
        level: budgetLevel(spentMinor, budget.amountMinor, warnPercent),
      };
    })
    .sort((a, b) => b.ratio - a.ratio);
}

/**
 * The warning to show after saving an expense, if it moved its budget into a
 * worse level. Returns null when nothing changed.
 */
export function budgetCrossing(
  before: MinorUnits,
  after: MinorUnits,
  limitMinor: MinorUnits,
  warnPercent: number,
): BudgetLevel | null {
  const previous = budgetLevel(before, limitMinor, warnPercent);
  const next = budgetLevel(after, limitMinor, warnPercent);
  const rank = { ok: 0, warning: 1, over: 2 };
  return rank[next] > rank[previous] ? next : null;
}
