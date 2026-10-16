import type { MinorUnits } from '../money/money';

export interface PaceInput {
  spentMinor: MinorUnits;
  /** 1-based day of month. */
  dayOfMonth: number;
  /** Days in this month. */
  daysInMonth: number;
  /** Last month's total spending, if known. */
  lastMonthSpentMinor: MinorUnits | null;
}

export interface Pace {
  projectedMinor: MinorUnits;
  /** True when projected spend is at least 10% above last month. */
  aheadOfLastMonth: boolean;
  dailyAverageMinor: MinorUnits;
}

/** Extrapolates this month's spending to the month end. */
export function spendingPace(input: PaceInput): Pace {
  const days = Math.max(1, Math.min(input.dayOfMonth, input.daysInMonth));
  const dailyAverageMinor = Math.round(input.spentMinor / days);
  const projectedMinor = dailyAverageMinor * input.daysInMonth;
  const aheadOfLastMonth =
    input.lastMonthSpentMinor !== null &&
    input.lastMonthSpentMinor > 0 &&
    projectedMinor >= input.lastMonthSpentMinor * 1.1;
  return { projectedMinor, aheadOfLastMonth, dailyAverageMinor };
}

/**
 * A single expense is "large" when it is at least ₹2,000 and at least 3× the
 * median expense in the lookback window (or ≥ ₹10,000 with a thin history).
 */
export function isUnusualSpend(
  amountMinor: MinorUnits,
  recentExpenseAmounts: readonly MinorUnits[],
): boolean {
  if (amountMinor < 200_000) {
    return false;
  }
  if (recentExpenseAmounts.length < 5) {
    return amountMinor >= 1_000_000;
  }
  const sorted = [...recentExpenseAmounts].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)]!;
  return amountMinor >= Math.max(200_000, median * 3);
}
