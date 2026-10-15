import { assertMinorUnits, type MinorUnits } from '../money/money';
import type {
  Account,
  Category,
  Transaction,
  TransactionInput,
} from '../types';

export interface PeriodSummary {
  incomeMinor: MinorUnits;
  expenseMinor: MinorUnits;
  netMinor: MinorUnits;
}

/** Transfers are excluded: they are neither income nor expense. */
export function summarize(
  transactions: readonly Pick<Transaction, 'type' | 'amountMinor'>[],
): PeriodSummary {
  let incomeMinor = 0;
  let expenseMinor = 0;
  for (const txn of transactions) {
    assertMinorUnits(txn.amountMinor);
    if (txn.type === 'income') {
      incomeMinor += txn.amountMinor;
    } else if (txn.type === 'expense') {
      expenseMinor += txn.amountMinor;
    }
  }
  return { incomeMinor, expenseMinor, netMinor: incomeMinor - expenseMinor };
}

/** Per-account totals, as produced by an aggregate query over the ledger. */
export interface AccountFlow {
  accountId: string;
  incomeMinor: MinorUnits;
  expenseMinor: MinorUnits;
  transfersInMinor: MinorUnits;
  transfersOutMinor: MinorUnits;
}

export function accountBalance(
  account: Pick<Account, 'openingBalanceMinor'>,
  flow: Omit<AccountFlow, 'accountId'> | undefined,
): MinorUnits {
  if (!flow) {
    return account.openingBalanceMinor;
  }
  return (
    account.openingBalanceMinor +
    flow.incomeMinor -
    flow.expenseMinor +
    flow.transfersInMinor -
    flow.transfersOutMinor
  );
}

export interface Holdings {
  /** Cash, bank and wallet balances together. */
  cashMinor: MinorUnits;
  /** What is owed on credit cards (positive). */
  cardDueMinor: MinorUnits;
}

/** Splits balances into money held and credit-card dues, which are not money held. */
export function holdings(
  accounts: readonly Pick<Account, 'id' | 'type' | 'openingBalanceMinor'>[],
  flows: ReadonlyMap<string, Omit<AccountFlow, 'accountId'>>,
): Holdings {
  let cashMinor = 0;
  let cardDueMinor = 0;
  for (const account of accounts) {
    const balance = accountBalance(account, flows.get(account.id));
    if (account.type === 'card') {
      cardDueMinor += Math.max(0, -balance);
    } else {
      cashMinor += balance;
    }
  }
  return { cashMinor, cardDueMinor };
}

/** Computes per-account flows from individual transactions. */
export function accountFlows(
  transactions: readonly Pick<
    Transaction,
    'type' | 'amountMinor' | 'accountId' | 'toAccountId'
  >[],
): Map<string, AccountFlow> {
  const flows = new Map<string, AccountFlow>();
  const flowFor = (accountId: string) => {
    let flow = flows.get(accountId);
    if (!flow) {
      flow = {
        accountId,
        incomeMinor: 0,
        expenseMinor: 0,
        transfersInMinor: 0,
        transfersOutMinor: 0,
      };
      flows.set(accountId, flow);
    }
    return flow;
  };
  for (const txn of transactions) {
    if (txn.type === 'income') {
      flowFor(txn.accountId).incomeMinor += txn.amountMinor;
    } else if (txn.type === 'expense') {
      flowFor(txn.accountId).expenseMinor += txn.amountMinor;
    } else if (txn.toAccountId) {
      flowFor(txn.accountId).transfersOutMinor += txn.amountMinor;
      flowFor(txn.toAccountId).transfersInMinor += txn.amountMinor;
    }
  }
  return flows;
}

export interface CategorySpending {
  categoryId: string | null;
  name: string;
  amountMinor: MinorUnits;
}

/**
 * Expense totals grouped by top-level category (subcategories roll up into
 * their parent), sorted largest first.
 */
export function spendingByCategory(
  transactions: readonly Pick<
    Transaction,
    'type' | 'amountMinor' | 'categoryId'
  >[],
  categories: readonly Category[],
): CategorySpending[] {
  const byId = new Map(categories.map(c => [c.id, c]));
  const totals = new Map<string | null, number>();
  for (const txn of transactions) {
    if (txn.type !== 'expense') {
      continue;
    }
    const category = txn.categoryId ? byId.get(txn.categoryId) : undefined;
    const rootId = category ? (category.parentId ?? category.id) : null;
    totals.set(rootId, (totals.get(rootId) ?? 0) + txn.amountMinor);
  }
  return [...totals.entries()]
    .map(([categoryId, amountMinor]) => ({
      categoryId,
      name: (categoryId && byId.get(categoryId)?.name) || 'Uncategorized',
      amountMinor,
    }))
    .sort((a, b) => b.amountMinor - a.amountMinor);
}

export type ValidationErrors = Partial<Record<keyof TransactionInput, string>>;

export function validateTransaction(
  input: TransactionInput,
  categories: readonly Category[],
): ValidationErrors {
  const errors: ValidationErrors = {};
  if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor <= 0) {
    errors.amountMinor = 'Enter an amount greater than zero.';
  }
  if (Number.isNaN(Date.parse(input.occurredAt))) {
    errors.occurredAt = 'Enter a valid date.';
  }
  if (!input.accountId) {
    errors.accountId = 'Choose an account.';
  }
  if (input.type === 'transfer') {
    if (!input.toAccountId) {
      errors.toAccountId = 'Choose the destination account.';
    } else if (input.toAccountId === input.accountId) {
      errors.toAccountId = 'Choose a different account.';
    }
    if (input.categoryId) {
      errors.categoryId = 'Transfers do not have a category.';
    }
  } else {
    const category = categories.find(c => c.id === input.categoryId);
    if (!category) {
      errors.categoryId = 'Choose a category.';
    } else if (category.type !== input.type) {
      errors.categoryId = `Choose an ${input.type} category.`;
    }
  }
  return errors;
}
