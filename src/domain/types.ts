import type { MinorUnits } from './money/money';

/** `card` is a credit card: its balance is negative while money is owed on it. */
export type AccountType = 'cash' | 'bank' | 'wallet' | 'card';

/** Bank and wallet accounts are where UPI payments come from and go to. */
export function isUpiAccount(account: Pick<Account, 'type'>): boolean {
  return account.type === 'bank' || account.type === 'wallet';
}

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  openingBalanceMinor: MinorUnits;
  currency: string;
  isArchived: boolean;
  createdAt: string;
}

export type CategoryType = 'income' | 'expense';

export interface Category {
  id: string;
  name: string;
  type: CategoryType;
  parentId: string | null;
  sortOrder: number;
  isArchived: boolean;
}

export type TransactionType = 'income' | 'expense' | 'transfer';

/**
 * `amountMinor` is always positive; direction comes from `type`.
 * Transfers use `accountId` as the source and `toAccountId` as the
 * destination, and have no category.
 */
export interface Transaction {
  id: string;
  type: TransactionType;
  amountMinor: MinorUnits;
  currency: string;
  occurredAt: string;
  accountId: string;
  toAccountId: string | null;
  categoryId: string | null;
  counterparty: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

export type TransactionInput = Pick<
  Transaction,
  | 'type'
  | 'amountMinor'
  | 'occurredAt'
  | 'accountId'
  | 'toAccountId'
  | 'categoryId'
  | 'counterparty'
  | 'note'
>;
