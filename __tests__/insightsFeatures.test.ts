import type { SQLiteDatabase } from 'expo-sqlite';

import { createTestDb } from '../test-utils/testDb';
import { exportBackup, restoreBackup } from '../src/data/backup';
import { migrateDbIfNeeded, SCHEMA_VERSION } from '../src/data/local/migrations';
import { checkUnusualExpense, loadMonthInsight, monthlyOverviewBody } from '../src/data/queries/insights';
import { createAccount, listAccounts } from '../src/data/repositories/accounts';
import { listCategories } from '../src/data/repositories/categories';
import { createGoal, deleteGoal, listGoals, monthlyGoalCommitmentMinor } from '../src/data/repositories/goals';
import {
  deleteMerchantRule,
  findMerchantRule,
  listMerchantRules,
  upsertMerchantRule,
} from '../src/data/repositories/merchantRules';
import { createRecurringRule } from '../src/data/repositories/recurring';
import {
  getInsightNotifyFlags,
  getInsightNotifyLevel,
  setInsightLastSent,
  getInsightLastSent,
  setInsightNotifyFlag,
  setInsightNotifyLevel,
} from '../src/data/repositories/settings';
import { listSplits, setSplits, spendingByCategoryWithSplits } from '../src/data/repositories/splits';
import {
  ensureTag,
  listTags,
  listTagsForTransaction,
  setTransactionTags,
} from '../src/data/repositories/tags';
import { createTransaction, listTransactions } from '../src/data/repositories/transactions';
import { insertCandidate } from '../src/data/repositories/upiCandidates';
import { parseBackup } from '../src/domain/backup';
import { monthRange } from '../src/domain/period';
import type { TransactionInput } from '../src/domain/types';
import { parseBankSms } from '../src/domain/upi/bankSms';
import { autoAddCandidates } from '../src/services/upi/autoAdd';

jest.mock('expo-crypto', () => ({ randomUUID: () => jest.requireActual('node:crypto').randomUUID() }));

async function freshDb(): Promise<SQLiteDatabase> {
  const db = createTestDb();
  await migrateDbIfNeeded(db);
  return db;
}

async function categoryId(db: SQLiteDatabase, name: string, type: 'income' | 'expense' = 'expense') {
  const found = (await listCategories(db)).find(c => c.name === name && c.type === type);
  if (!found) {
    throw new Error(`no category ${name}`);
  }
  return found.id;
}

async function bank(db: SQLiteDatabase) {
  const accounts = await listAccounts(db);
  const cash = accounts.find(a => a.type === 'cash');
  if (!cash) {
    throw new Error('no cash');
  }
  // Prefer a bank if one exists; otherwise create one.
  const existing = accounts.find(a => a.type === 'bank');
  if (existing) {
    return existing.id;
  }
  return createAccount(db, { name: 'HDFC', type: 'bank', openingBalanceMinor: 0 });
}

function expense(
  accountId: string,
  categoryId: string,
  amountMinor: number,
  occurredAt: string,
  counterparty = 'Shop',
): TransactionInput {
  return {
    type: 'expense',
    amountMinor,
    occurredAt,
    accountId,
    toAccountId: null,
    categoryId,
    counterparty,
    note: null,
  };
}

function income(
  accountId: string,
  categoryId: string,
  amountMinor: number,
  occurredAt: string,
  counterparty = 'Employer',
): TransactionInput {
  return {
    type: 'income',
    amountMinor,
    occurredAt,
    accountId,
    toAccountId: null,
    categoryId,
    counterparty,
    note: null,
  };
}

describe('migration for insights tables', () => {
  it('creates tags, merchant_rules, splits and goals at the current schema', async () => {
    const db = await freshDb();
    expect((await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version).toBe(
      SCHEMA_VERSION,
    );
    for (const table of ['tags', 'transaction_tags', 'merchant_rules', 'transaction_splits', 'savings_goals']) {
      expect(await db.getFirstAsync(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`, table)).toEqual({
        name: table,
      });
    }
  });
});

describe('tags', () => {
  it('creates, reuses case-insensitively, and attaches to a transaction', async () => {
    const db = await freshDb();
    const accountId = await bank(db);
    const food = await categoryId(db, 'Food and dining');
    const txnId = await createTransaction(db, expense(accountId, food, 250_00, '2026-10-01T10:00:00.000Z'));

    const a = await ensureTag(db, '  Trip Goa ');
    const b = await ensureTag(db, 'trip goa');
    expect(a?.id).toBe(b?.id);
    expect(await ensureTag(db, '   ')).toBeNull();
    expect(await ensureTag(db, '')).toBeNull();

    await setTransactionTags(db, txnId, ['trip goa', 'office', 'trip goa', '']);
    const tags = await listTagsForTransaction(db, txnId);
    expect(tags.map(t => t.name).sort()).toEqual(['office', 'Trip Goa'].sort());

    await setTransactionTags(db, txnId, []);
    expect(await listTagsForTransaction(db, txnId)).toEqual([]);
    expect((await listTags(db)).length).toBeGreaterThanOrEqual(2);
  });

  it('cascades when the transaction is deleted', async () => {
    const db = await freshDb();
    const accountId = await bank(db);
    const txnId = await createTransaction(
      db,
      expense(accountId, await categoryId(db, 'Food and dining'), 100_00, '2026-10-02T10:00:00.000Z'),
    );
    await setTransactionTags(db, txnId, ['gone']);
    await db.runAsync('DELETE FROM transactions WHERE id = ?', txnId);
    expect(await db.getFirstAsync('SELECT 1 AS x FROM transaction_tags WHERE transaction_id = ?', txnId)).toBeNull();
  });
});

describe('merchant rules', () => {
  it('upserts by match text and picks the longest contained match', async () => {
    const db = await freshDb();
    const food = await categoryId(db, 'Food and dining');
    const groceries = await categoryId(db, 'Groceries');

    await expect(upsertMerchantRule(db, '  ', food)).rejects.toThrow(/merchant/i);

    const first = await upsertMerchantRule(db, 'Swiggy', food);
    const again = await upsertMerchantRule(db, 'swiggy', groceries);
    expect(again.id).toBe(first.id);
    expect(again.categoryId).toBe(groceries);
    expect(await listMerchantRules(db)).toHaveLength(1);

    await upsertMerchantRule(db, 'Swiggy Instamart', food);
    expect((await findMerchantRule(db, 'Paid to SWIGGY INSTAMART Bangalore'))?.matchText).toBe('Swiggy Instamart');
    expect((await findMerchantRule(db, 'SWIGGY'))?.categoryId).toBe(groceries);
    expect(await findMerchantRule(db, null)).toBeNull();
    expect(await findMerchantRule(db, 'Zomato')).toBeNull();

    await deleteMerchantRule(db, again.id);
    expect(await findMerchantRule(db, 'SWIGGY')).toBeNull();
  });

  it('wins over learned/predicted category when auto-adding', async () => {
    const db = await freshDb();
    await createAccount(db, { name: 'HDFC', type: 'bank', openingBalanceMinor: 0 });
    // Without a rule, BALAJI MEDICAL HALL → Healthcare; force it to Food via rule.
    await upsertMerchantRule(db, 'BALAJI MEDICAL', await categoryId(db, 'Food and dining'));

    const parsed = parseBankSms(
      'Sent Rs.120.00 From HDFC Bank A/C *1234 To BALAJI MEDICAL HALL On 15/10/26 Ref 529199900001 Not You? Call 18002586161',
      Date.parse('2026-10-15T10:00:00.000Z'),
    );
    expect(parsed).not.toBeNull();
    const id = await insertCandidate(db, parsed!);
    await autoAddCandidates(db, [id!]);
    const [txn] = await listTransactions(db, { limit: 5 });
    expect(txn?.categoryName).toBe('Food and dining');
    expect(txn?.categoryName).not.toBe('Healthcare');
  });

  it('ignores an expense rule when the payment is income', async () => {
    const db = await freshDb();
    await createAccount(db, { name: 'HDFC', type: 'bank', openingBalanceMinor: 0 });
    await upsertMerchantRule(db, 'RAZORPAY', await categoryId(db, 'Shopping'));
    const parsed = parseBankSms(
      'Rs.501.00 credited to HDFC Bank A/c XX1234 from VPA razorpay@icici on 15-10-26 UPI 529199900002',
      Date.parse('2026-10-15T10:00:00.000Z'),
    );
    expect(parsed).not.toBeNull();
    const id = await insertCandidate(db, parsed!);
    await autoAddCandidates(db, [id!]);
    const [txn] = await listTransactions(db, { limit: 5 });
    expect(txn?.type).toBe('income');
    expect(txn?.categoryName).not.toBe('Shopping');
  });
});

describe('splits', () => {
  it('replaces splits, rejects non-positive amounts, and cascades on delete', async () => {
    const db = await freshDb();
    const accountId = await bank(db);
    const food = await categoryId(db, 'Food and dining');
    const groceries = await categoryId(db, 'Groceries');
    const txnId = await createTransaction(db, expense(accountId, food, 500_00, '2026-10-03T10:00:00.000Z'));

    await setSplits(db, txnId, [
      { categoryId: food, amountMinor: 300_00 },
      { categoryId: groceries, amountMinor: 200_00, note: 'milk' },
    ]);
    const listed = await listSplits(db, txnId);
    expect(listed).toHaveLength(2);
    expect(listed[1]).toMatchObject({ amountMinor: 200_00, note: 'milk', categoryName: 'Groceries' });

    await expect(setSplits(db, txnId, [{ categoryId: food, amountMinor: 0 }])).rejects.toThrow(/greater than zero/i);

    await setSplits(db, txnId, []);
    expect(await listSplits(db, txnId)).toEqual([]);

    await setSplits(db, txnId, [{ categoryId: food, amountMinor: 500_00 }]);
    await db.runAsync('DELETE FROM transactions WHERE id = ?', txnId);
    expect(await db.getFirstAsync('SELECT 1 AS x FROM transaction_splits WHERE transaction_id = ?', txnId)).toBeNull();
  });

  it('spendingByCategoryWithSplits uses split lines instead of the parent category', async () => {
    const db = await freshDb();
    const accountId = await bank(db);
    const food = await categoryId(db, 'Food and dining');
    const groceries = await categoryId(db, 'Groceries');
    const transport = await categoryId(db, 'Transport');
    const range = monthRange({ year: 2026, month: 9 });

    const splitTxn = await createTransaction(
      db,
      expense(accountId, food, 500_00, '2026-10-04T10:00:00.000Z', 'Swiggy'),
    );
    await setSplits(db, splitTxn, [
      { categoryId: food, amountMinor: 200_00 },
      { categoryId: groceries, amountMinor: 300_00 },
    ]);
    await createTransaction(db, expense(accountId, transport, 100_00, '2026-10-05T10:00:00.000Z', 'Uber'));

    const map = await spendingByCategoryWithSplits(db, range.startIso, range.endIso);
    expect(map.get(food)).toBe(200_00);
    expect(map.get(groceries)).toBe(300_00);
    expect(map.get(transport)).toBe(100_00);
    // Parent category alone must not double-count the 500.
    expect([...(map.values())].reduce((a, b) => a + b, 0)).toBe(600_00);
  });
});

describe('savings goals', () => {
  it('sums monthly commitments and deletes cleanly', async () => {
    const db = await freshDb();
    expect(await monthlyGoalCommitmentMinor(db)).toBe(0);
    const id = await createGoal(db, { name: 'Emergency', targetMinor: 100_000_00, monthlyMinor: 5_000_00 });
    await createGoal(db, { name: 'Laptop', targetMinor: 80_000_00, monthlyMinor: 2_000_00 });
    expect(await monthlyGoalCommitmentMinor(db)).toBe(7_000_00);
    expect((await listGoals(db)).map(g => g.name).sort()).toEqual(['Emergency', 'Laptop']);
    await deleteGoal(db, id);
    expect(await monthlyGoalCommitmentMinor(db)).toBe(2_000_00);
  });
});

describe('insight settings', () => {
  it('defaults and persists notify level and flags', async () => {
    const db = await freshDb();
    expect(await getInsightNotifyLevel(db)).toBe('monthly');
    expect(await getInsightNotifyFlags(db)).toEqual({
      pace: true,
      unusual: true,
      salary: true,
      bills: true,
      cards: true,
    });
    await setInsightNotifyLevel(db, 'off');
    await setInsightNotifyFlag(db, 'pace', false);
    await setInsightNotifyFlag(db, 'unusual', false);
    await setInsightNotifyFlag(db, 'cards', false);
    expect(await getInsightNotifyLevel(db)).toBe('off');
    expect(await getInsightNotifyFlags(db)).toMatchObject({ pace: false, unusual: false, salary: true, cards: false });
    await setInsightLastSent(db, 'monthly', '2026-10-01');
    expect(await getInsightLastSent(db, 'monthly')).toBe('2026-10-01');
  });
});

describe('loadMonthInsight', () => {
  it('computes safe-to-spend, pace, upcoming bills and vs last month', async () => {
    const db = await freshDb();
    const accountId = await bank(db);
    const food = await categoryId(db, 'Food and dining');
    const salary = await categoryId(db, 'Salary', 'income');

    // Last month: income 40k, spent 10k
    await createTransaction(db, income(accountId, salary, 40_000_00, '2026-09-01T10:00:00.000Z'));
    await createTransaction(db, expense(accountId, food, 10_000_00, '2026-09-05T10:00:00.000Z', 'Misc'));

    // Subscription history (Aug+Sep Netflix)
    await createTransaction(db, expense(accountId, food, 649_00, '2026-08-12T10:00:00.000Z', 'Netflix'));
    await createTransaction(db, expense(accountId, food, 649_00, '2026-09-12T10:00:00.000Z', 'Netflix'));

    // This month so far (day 10): no salary yet, spent 2k
    await createTransaction(db, expense(accountId, food, 2_000_00, '2026-10-03T10:00:00.000Z', 'Cafe'));

    // Unpaid recurring rent still counts toward bills
    await createRecurringRule(
      db,
      expense(accountId, await categoryId(db, 'Rent and housing'), 15_000_00, '2026-01-01T10:00:00.000Z', 'Landlord'),
      'monthly',
    );
    await createGoal(db, { name: 'Buffer', targetMinor: 50_000_00, monthlyMinor: 3_000_00 });

    // Income that never arrived (or arrives later) must not count: only balances held today.
    await createTransaction(db, income(accountId, salary, 99_000_00, '2026-10-25T10:00:00.000Z'));
    const card = await createAccount(db, { name: 'Amex', type: 'card', openingBalanceMinor: 0 });
    await createTransaction(db, expense(card, food, 1_500_00, '2026-10-04T10:00:00.000Z', 'Shop'));

    const insight = await loadMonthInsight(db, { year: 2026, month: 9 }, new Date(2026, 9, 10));
    expect(insight.expenseMinor).toBe(3_500_00);
    expect(insight.incomeMinor).toBe(99_000_00);
    // Balance today: 40k salary − 10k − 649 − 649 − 2k.
    expect(insight.safe.availableMinor).toBe(40_000_00 - 10_000_00 - 649_00 - 649_00 - 2_000_00);
    expect(insight.safe.cardDueMinor).toBe(1_500_00);
    expect(insight.safe.goalsMinor).toBe(3_000_00);
    expect(insight.safe.billsRemainingMinor).toBeGreaterThanOrEqual(15_000_00);
    expect(insight.safe.leftoverMinor).toBe(
      insight.safe.availableMinor -
        insight.safe.cardDueMinor -
        insight.safe.billsRemainingMinor -
        insight.safe.goalsMinor,
    );
    expect(insight.pace.projectedMinor).toBeGreaterThan(insight.expenseMinor);
    expect(insight.upcoming.some(b => b.counterparty === 'Netflix')).toBe(true);
    expect(insight.vsLastMonthExpensePct).not.toBeNull();
    expect(monthlyOverviewBody(insight)).toContain('You spent');
  });

  it('does not double-count a recurring bill that was already paid this month', async () => {
    const db = await freshDb();
    const accountId = await bank(db);
    const rent = await categoryId(db, 'Rent and housing');
    await createRecurringRule(
      db,
      expense(accountId, rent, 15_000_00, '2026-01-01T10:00:00.000Z', 'Landlord'),
      'monthly',
    );
    await createTransaction(db, expense(accountId, rent, 15_000_00, '2026-10-02T10:00:00.000Z', 'Landlord'));
    const insight = await loadMonthInsight(db, { year: 2026, month: 9 }, new Date(2026, 9, 10));
    // Netflix not in history → only paid rent; bills remaining should not include another 15k for Landlord
    expect(insight.safe.billsRemainingMinor).toBe(0);
  });

  it('handles an empty month', async () => {
    const db = await freshDb();
    const insight = await loadMonthInsight(db, { year: 2026, month: 9 }, new Date(2026, 9, 1));
    expect(insight.expenseMinor).toBe(0);
    expect(insight.incomeMinor).toBe(0);
    expect(insight.topCategories).toEqual([]);
    expect(insight.upcoming).toEqual([]);
    expect(insight.vsLastMonthExpensePct).toBeNull();
  });
});

describe('checkUnusualExpense', () => {
  it('uses real recent expenses from the database', async () => {
    const db = await freshDb();
    const accountId = await bank(db);
    const food = await categoryId(db, 'Food and dining');
    for (let i = 0; i < 6; i++) {
      await createTransaction(
        db,
        expense(accountId, food, 100_00 + i, `2026-09-${String(10 + i).padStart(2, '0')}T10:00:00.000Z`, `Shop${i}`),
      );
    }
    expect(await checkUnusualExpense(db, 50_000_00, '2026-10-10T10:00:00.000Z')).toBe(true);
    expect(await checkUnusualExpense(db, 150_00, '2026-10-10T10:00:00.000Z')).toBe(false);
    expect(await checkUnusualExpense(db, 9_000_00, '2026-10-10T10:00:00.000Z')).toBe(true); // thin? no, 6 history → 3× median ~300
  });
});

describe('backup round-trip for insights tables', () => {
  it('restores tags, rules, splits and goals', async () => {
    const db = await freshDb();
    const accountId = await bank(db);
    const food = await categoryId(db, 'Food and dining');
    const groceries = await categoryId(db, 'Groceries');
    const txnId = await createTransaction(db, expense(accountId, food, 400_00, '2026-10-06T10:00:00.000Z', 'Swiggy'));
    await setTransactionTags(db, txnId, ['trip Goa']);
    await setSplits(db, txnId, [
      { categoryId: food, amountMinor: 250_00 },
      { categoryId: groceries, amountMinor: 150_00 },
    ]);
    await upsertMerchantRule(db, 'Swiggy', food);
    await createGoal(db, { name: 'Trip', targetMinor: 20_000_00, monthlyMinor: 1_000_00 });

    const backup = await exportBackup(db);
    const json = JSON.stringify(backup);
    const parsed = parseBackup(json, SCHEMA_VERSION);

    const other = await freshDb();
    await restoreBackup(other, parsed);

    expect((await listTagsForTransaction(other, txnId)).map(t => t.name)).toEqual(['trip Goa']);
    expect(await listSplits(other, txnId)).toHaveLength(2);
    expect((await findMerchantRule(other, 'Swiggy Stores'))?.matchText).toBe('Swiggy');
    expect((await listGoals(other))[0]?.name).toBe('Trip');
    expect(await monthlyGoalCommitmentMinor(other)).toBe(1_000_00);
  });
});
