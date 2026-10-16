import type { MinorUnits } from '../money/money';

export interface SafeToSpendInput {
  /** Income already recorded this month. */
  incomeMinor: MinorUnits;
  /** Typical monthly income when this month's income is still thin (e.g. before salary). */
  expectedIncomeMinor: MinorUnits;
  /** Expenses already recorded this month. */
  spentMinor: MinorUnits;
  /** Recurring bills / subscriptions still due this month and not yet paid. */
  billsRemainingMinor: MinorUnits;
  /** Planned monthly savings toward goals. */
  goalsMinor: MinorUnits;
}

export interface SafeToSpend {
  /** What is left for discretionary spending today. */
  leftoverMinor: MinorUnits;
  incomeBasisMinor: MinorUnits;
  spentMinor: MinorUnits;
  billsRemainingMinor: MinorUnits;
  goalsMinor: MinorUnits;
}

/**
 * PocketGuard-style leftover:
 * income basis − spent so far − remaining fixed bills − monthly goal contributions.
 */
export function safeToSpend(input: SafeToSpendInput): SafeToSpend {
  const incomeBasisMinor = Math.max(input.incomeMinor, input.expectedIncomeMinor);
  const leftoverMinor =
    incomeBasisMinor - input.spentMinor - input.billsRemainingMinor - input.goalsMinor;
  return {
    leftoverMinor,
    incomeBasisMinor,
    spentMinor: input.spentMinor,
    billsRemainingMinor: input.billsRemainingMinor,
    goalsMinor: input.goalsMinor,
  };
}
