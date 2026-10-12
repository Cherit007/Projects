import {
  accountBalance,
  accountFlows,
  spendingByCategory,
  summarize,
  validateTransaction,
} from '../src/domain/accounting/accounting';
import type {
  Category,
  Transaction,
  TransactionInput,
} from '../src/domain/types';

function txn(overrides: Partial<Transaction>): Transaction {
  return {
    id: Math.random().toString(36),
    type: 'expense',
    amountMinor: 100,
    currency: 'INR',
    occurredAt: '2026-10-05T10:00:00.000Z',
    accountId: 'cash',
    toAccountId: null,
    categoryId: 'food',
    counterparty: null,
    note: null,
    createdAt: '2026-10-05T10:00:00.000Z',
    updatedAt: '2026-10-05T10:00:00.000Z',
    ...overrides,
  };
}

const categories: Category[] = [
  { id: 'food', name: 'Food', type: 'expense', parentId: null, sortOrder: 0, isArchived: false },
  { id: 'cafe', name: 'Cafe', type: 'expense', parentId: 'food', sortOrder: 1, isArchived: false },
  { id: 'rent', name: 'Rent', type: 'expense', parentId: null, sortOrder: 2, isArchived: false },
  { id: 'salary', name: 'Salary', type: 'income', parentId: null, sortOrder: 3, isArchived: false },
];

describe('summarize', () => {
  it('totals income and expenses and excludes transfers', () => {
    const summary = summarize([
      txn({ type: 'income', amountMinor: 50_000_00, categoryId: 'salary' }),
      txn({ type: 'expense', amountMinor: 1_250_50 }),
      txn({ type: 'expense', amountMinor: 99 }),
      txn({ type: 'transfer', amountMinor: 10_000_00, toAccountId: 'bank', categoryId: null }),
    ]);
    expect(summary).toEqual({
      incomeMinor: 50_000_00,
      expenseMinor: 1_251_49,
      netMinor: 48_748_51,
    });
  });

  it('returns zeros for no transactions', () => {
    expect(summarize([])).toEqual({ incomeMinor: 0, expenseMinor: 0, netMinor: 0 });
  });

  it('rejects fractional amounts', () => {
    expect(() => summarize([txn({ amountMinor: 0.5 })])).toThrow(RangeError);
  });
});

describe('account balances', () => {
  it('applies income, expenses and transfers to the right accounts', () => {
    const flows = accountFlows([
      txn({ type: 'income', amountMinor: 1000, accountId: 'bank', categoryId: 'salary' }),
      txn({ type: 'expense', amountMinor: 300, accountId: 'cash' }),
      txn({ type: 'transfer', amountMinor: 500, accountId: 'bank', toAccountId: 'cash', categoryId: null }),
    ]);
    expect(accountBalance({ openingBalanceMinor: 0 }, flows.get('bank'))).toBe(500);
    expect(accountBalance({ openingBalanceMinor: 200 }, flows.get('cash'))).toBe(400);
  });

  it('keeps total money unchanged across a transfer', () => {
    const flows = accountFlows([
      txn({ type: 'transfer', amountMinor: 700, accountId: 'bank', toAccountId: 'cash', categoryId: null }),
    ]);
    const bank = accountBalance({ openingBalanceMinor: 1000 }, flows.get('bank'));
    const cash = accountBalance({ openingBalanceMinor: 0 }, flows.get('cash'));
    expect(bank + cash).toBe(1000);
  });

  it('returns the opening balance for an account with no activity', () => {
    expect(accountBalance({ openingBalanceMinor: 1234 }, undefined)).toBe(1234);
  });
});

describe('spendingByCategory', () => {
  it('rolls subcategories into parents and sorts largest first', () => {
    const result = spendingByCategory(
      [
        txn({ amountMinor: 200, categoryId: 'food' }),
        txn({ amountMinor: 300, categoryId: 'cafe' }),
        txn({ amountMinor: 400, categoryId: 'rent' }),
        txn({ type: 'income', amountMinor: 9999, categoryId: 'salary' }),
      ],
      categories,
    );
    expect(result).toEqual([
      { categoryId: 'food', name: 'Food', amountMinor: 500 },
      { categoryId: 'rent', name: 'Rent', amountMinor: 400 },
    ]);
  });

  it('groups expenses with a missing category as Uncategorized', () => {
    const result = spendingByCategory([txn({ categoryId: 'deleted' })], categories);
    expect(result).toEqual([{ categoryId: null, name: 'Uncategorized', amountMinor: 100 }]);
  });
});

describe('validateTransaction', () => {
  const base: TransactionInput = {
    type: 'expense',
    amountMinor: 100,
    occurredAt: '2026-10-05T10:00:00.000Z',
    accountId: 'cash',
    toAccountId: null,
    categoryId: 'food',
    counterparty: null,
    note: null,
  };

  it('accepts a valid expense', () => {
    expect(validateTransaction(base, categories)).toEqual({});
  });

  it('requires a positive amount', () => {
    expect(validateTransaction({ ...base, amountMinor: 0 }, categories).amountMinor).toBeDefined();
  });

  it('requires a category matching the transaction type', () => {
    expect(validateTransaction({ ...base, categoryId: 'salary' }, categories).categoryId).toBeDefined();
    expect(validateTransaction({ ...base, categoryId: null }, categories).categoryId).toBeDefined();
  });

  it('requires different source and destination accounts for transfers', () => {
    const transfer: TransactionInput = { ...base, type: 'transfer', categoryId: null, toAccountId: 'cash' };
    expect(validateTransaction(transfer, categories).toAccountId).toBeDefined();
    expect(validateTransaction({ ...transfer, toAccountId: 'bank' }, categories)).toEqual({});
  });
});
