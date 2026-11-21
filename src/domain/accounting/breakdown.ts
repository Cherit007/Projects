import type { MinorUnits } from '../money/money';
import type { TransactionType } from '../types';

export interface CategoryTotal {
  /** null for transactions without a category. */
  categoryId: string | null;
  name: string;
  amountMinor: MinorUnits;
  count: number;
}

/** Totals per category for one kind of transaction, largest first. */
export function categoryBreakdown(
  items: readonly { type: TransactionType; amountMinor: MinorUnits; categoryId: string | null; categoryName: string | null }[],
  type: 'income' | 'expense',
): CategoryTotal[] {
  const totals = new Map<string | null, CategoryTotal>();
  for (const item of items) {
    if (item.type !== type) {
      continue;
    }
    const entry = totals.get(item.categoryId) ?? {
      categoryId: item.categoryId,
      name: item.categoryName ?? 'Uncategorised',
      amountMinor: 0,
      count: 0,
    };
    entry.amountMinor += item.amountMinor;
    entry.count += 1;
    totals.set(item.categoryId, entry);
  }
  return [...totals.values()].sort((a, b) => b.amountMinor - a.amountMinor || a.name.localeCompare(b.name));
}
