import type { MinorUnits } from '../money/money';

export interface SafeToSpendInput {
  /** Cash, bank and wallet balances right now. */
  availableMinor: MinorUnits;
  /** What is owed on credit cards (positive). */
  cardDueMinor: MinorUnits;
  /** Recurring bills / subscriptions still due this month and not yet paid. */
  billsRemainingMinor: MinorUnits;
  /** Planned monthly savings toward goals. */
  goalsMinor: MinorUnits;
}

export interface SafeToSpend {
  /** What is left for discretionary spending today. */
  leftoverMinor: MinorUnits;
  availableMinor: MinorUnits;
  cardDueMinor: MinorUnits;
  billsRemainingMinor: MinorUnits;
  goalsMinor: MinorUnits;
}

/**
 * Money that is really there, less what is already promised:
 * cash, bank and wallet balances − card dues − remaining bills − goal contributions.
 * Income is not used: money moved between the user's own accounts or wallets
 * looks like income and would overstate it.
 */
export function safeToSpend(input: SafeToSpendInput): SafeToSpend {
  return {
    leftoverMinor: input.availableMinor - input.cardDueMinor - input.billsRemainingMinor - input.goalsMinor,
    availableMinor: input.availableMinor,
    cardDueMinor: input.cardDueMinor,
    billsRemainingMinor: input.billsRemainingMinor,
    goalsMinor: input.goalsMinor,
  };
}
