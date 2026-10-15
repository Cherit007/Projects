import type { SQLiteDatabase } from 'expo-sqlite';

import { createTestDb } from '../test-utils/testDb';
import { exportBackup, restoreBackup } from '../src/data/backup';
import { migrateDbIfNeeded, SCHEMA_VERSION } from '../src/data/local/migrations';
import { createAccount, getAccountFlows, listAccounts } from '../src/data/repositories/accounts';
import { listCategories } from '../src/data/repositories/categories';
import { getReceiptUri, setReceiptUri } from '../src/data/repositories/receipts';
import {
  createRecurringRule,
  deleteRecurringRule,
  listRecurringRules,
  runDueRecurring,
} from '../src/data/repositories/recurring';
import { setOwnerName } from '../src/data/repositories/settings';
import { createTransaction, deleteTransaction, listTransactions } from '../src/data/repositories/transactions';
import { getCandidate, insertCandidate } from '../src/data/repositories/upiCandidates';
import { accountBalance } from '../src/domain/accounting/accounting';
import { parseBackup } from '../src/domain/backup';
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

async function balances(db: SQLiteDatabase): Promise<Record<string, number>> {
  const [accounts, flows] = await Promise.all([listAccounts(db, { includeArchived: true }), getAccountFlows(db)]);
  return Object.fromEntries(accounts.map(a => [a.name, accountBalance(a, flows.get(a.id))]));
}

const expense = (accountId: string, category: string, amountMinor: number, occurredAt: string): TransactionInput => ({
  type: 'expense',
  amountMinor,
  occurredAt,
  accountId,
  toAccountId: null,
  categoryId: category,
  counterparty: 'Landlord',
  note: null,
});

describe('migration to credit cards', () => {
  it('keeps existing accounts, transactions, sync triggers and foreign keys', async () => {
    const db = createTestDb();
    await migrateDbIfNeeded(db, 5);
    const bank = await createAccount(db, { name: 'HDFC', type: 'bank', openingBalanceMinor: 1000 });
    await createTransaction(db, expense(bank, await categoryId(db, 'Groceries'), 250, '2026-10-01T10:00:00.000Z'));
    await expect(createAccount(db, { name: 'Card', type: 'card', openingBalanceMinor: 0 })).rejects.toThrow(/CHECK/);

    await migrateDbIfNeeded(db);

    expect((await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version).toBe(SCHEMA_VERSION);
    expect(await balances(db)).toEqual({ Cash: 0, HDFC: 750 });
    await db.runAsync('DELETE FROM sync_outbox');
    const card = await createAccount(db, { name: 'Amex', type: 'card', openingBalanceMinor: 0 });
    expect(await db.getFirstAsync('SELECT row_id FROM sync_outbox WHERE table_name = ?', 'accounts')).toEqual({ row_id: card });
    await expect(
      createTransaction(db, expense('missing-account', await categoryId(db, 'Groceries'), 1, '2026-10-01T10:00:00.000Z')),
    ).rejects.toThrow(/FOREIGN KEY/);
    await expect(createAccount(db, { name: 'X', type: 'loan' as 'bank', openingBalanceMinor: 0 })).rejects.toThrow(/CHECK/);
  });

  it('migrating again changes nothing', async () => {
    const db = await freshDb();
    await migrateDbIfNeeded(db);
    expect((await listAccounts(db)).map(a => a.name)).toEqual(['Cash']);
  });
});

describe('credit cards', () => {
  it('owes purchases on the card and clears them with a transfer from the bank', async () => {
    const db = await freshDb();
    const bank = await createAccount(db, { name: 'HDFC', type: 'bank', openingBalanceMinor: 100_000 });
    const card = await createAccount(db, { name: 'Amex', type: 'card', openingBalanceMinor: -5_000 });
    await createTransaction(db, { ...expense(card, await categoryId(db, 'Shopping'), 20_000, '2026-10-02T10:00:00.000Z') });
    expect(await balances(db)).toMatchObject({ HDFC: 100_000, Amex: -25_000 });

    await createTransaction(db, {
      type: 'transfer',
      amountMinor: 25_000,
      occurredAt: '2026-10-20T10:00:00.000Z',
      accountId: bank,
      toAccountId: card,
      categoryId: null,
      counterparty: null,
      note: null,
    });
    expect(await balances(db)).toMatchObject({ HDFC: 75_000, Amex: 0 });
    const october = await listTransactions(db, {});
    expect(october.filter(t => t.type === 'expense').reduce((s, t) => s + t.amountMinor, 0)).toBe(20_000);
  });

  it('never puts detected UPI payments or own transfers on a card', async () => {
    const db = await freshDb();
    await createAccount(db, { name: 'Amex', type: 'card', openingBalanceMinor: 0 });
    const sms = (to: string, ref: number) =>
      parseBankSms(`Sent Rs.120.00 From HDFC Bank A/C *1234 To ${to} On 15/10/26 Ref ${ref} Not You?`, Date.now())!;

    const onlyCard = await insertCandidate(db, sms('SWIGGY', 529200000001));
    await autoAddCandidates(db, [onlyCard!]);
    const first = (await listTransactions(db, {}))[0];
    expect(first.accountName).toBe('Cash');

    await createAccount(db, { name: 'HDFC', type: 'bank', openingBalanceMinor: 0 });
    const withBank = await insertCandidate(db, sms('ZOMATO', 529200000002));
    await autoAddCandidates(db, [withBank!]);
    expect((await listTransactions(db, {})).find(t => t.counterparty === 'ZOMATO')?.accountName).toBe('HDFC');

    await setOwnerName(db, 'Cherit Reddy');
    const own = await insertCandidate(db, sms('CHERIT REDDY', 529200000003));
    await autoAddCandidates(db, [own!]);
    expect((await getCandidate(db, own!))?.reviewState).toBe('needs_review');
  });
});

describe('repeating transactions', () => {
  it('adds missed repeats once, at month ends, and stops when deleted', async () => {
    const db = await freshDb();
    const bank = await createAccount(db, { name: 'HDFC', type: 'bank', openingBalanceMinor: 0 });
    const rent = await categoryId(db, 'Rent and housing');
    const start = new Date(2026, 0, 31, 9).toISOString();
    await createTransaction(db, expense(bank, rent, 15_000_00, start));
    const ruleId = await createRecurringRule(db, expense(bank, rent, 15_000_00, start), 'monthly');

    expect(await runDueRecurring(db, new Date(2026, 3, 1))).toBe(2);
    expect(await runDueRecurring(db, new Date(2026, 3, 1))).toBe(0);
    const dates = (await listTransactions(db, { limit: -1 }))
      .map(t => new Date(t.occurredAt).getDate())
      .sort((a, b) => a - b);
    expect(dates).toEqual([28, 31, 31]);
    expect((await listTransactions(db, { limit: -1 })).filter(t => t.source === 'recurring')).toHaveLength(2);

    const [rule] = await listRecurringRules(db);
    expect(rule).toMatchObject({ occurrences: 3, accountName: 'HDFC', categoryName: 'Rent and housing' });
    expect(new Date(rule.nextAt).getMonth()).toBe(3);
    expect(new Date(rule.nextAt).getDate()).toBe(30);

    await deleteRecurringRule(db, ruleId);
    expect(await runDueRecurring(db, new Date(2027, 0, 1))).toBe(0);
    expect(await listTransactions(db, { limit: -1 })).toHaveLength(3);
  });

  it('repeats transfers without a category, and nothing before the start', async () => {
    const db = await freshDb();
    const bank = await createAccount(db, { name: 'HDFC', type: 'bank', openingBalanceMinor: 0 });
    const card = await createAccount(db, { name: 'Amex', type: 'card', openingBalanceMinor: 0 });
    const start = new Date(2026, 5, 10).toISOString();
    await createRecurringRule(
      db,
      { type: 'transfer', amountMinor: 500, occurredAt: start, accountId: bank, toAccountId: card, categoryId: 'ignored', counterparty: ' ', note: null },
      'weekly',
    );
    expect(await runDueRecurring(db, new Date(2026, 5, 16))).toBe(0);
    expect(await runDueRecurring(db, new Date(2026, 5, 24))).toBe(2);
    const [txn] = await listTransactions(db, {});
    expect(txn).toMatchObject({ type: 'transfer', categoryId: null, counterparty: null, toAccountId: card });
  });
});

describe('receipts', () => {
  it('stores, replaces and removes a receipt, and drops it with the transaction', async () => {
    const db = await freshDb();
    const [cash] = await listAccounts(db);
    const id = await createTransaction(db, expense(cash.id, await categoryId(db, 'Shopping'), 100, new Date().toISOString()));
    expect(await getReceiptUri(db, id)).toBeNull();
    await setReceiptUri(db, id, 'file:///a.jpg');
    await setReceiptUri(db, id, 'file:///b.jpg');
    expect(await getReceiptUri(db, id)).toBe('file:///b.jpg');
    await setReceiptUri(db, id, null);
    expect(await getReceiptUri(db, id)).toBeNull();

    await setReceiptUri(db, id, 'file:///c.jpg');
    await deleteTransaction(db, id);
    expect(await db.getFirstAsync('SELECT * FROM receipts')).toBeNull();
    await expect(setReceiptUri(db, 'missing', 'file:///d.jpg')).rejects.toThrow(/FOREIGN KEY/);
  });
});

describe('backup and restore', () => {
  async function sampleDb() {
    const db = await freshDb();
    const bank = await createAccount(db, { name: 'HDFC', type: 'bank', openingBalanceMinor: 1_000_00 });
    const card = await createAccount(db, { name: 'Amex', type: 'card', openingBalanceMinor: -200_00 });
    const food = await categoryId(db, 'Food and dining');
    const id = await createTransaction(db, { ...expense(card, food, 300_00, '2026-10-01T10:00:00.000Z'), counterparty: 'राहुल' });
    await setReceiptUri(db, id, 'file:///r.jpg');
    await createRecurringRule(db, expense(bank, food, 50_00, '2026-10-01T10:00:00.000Z'), 'weekly');
    await setOwnerName(db, 'Cherit Reddy');
    await db.runAsync('INSERT INTO budgets (id, category_id, amount_minor, created_at, updated_at) VALUES (?, ?, ?, ?, ?)', 'b1', food, 5_000_00, 'x', 'x');
    return db;
  }

  it('restores exactly what was exported, through the file format', async () => {
    const source = await sampleDb();
    const backup = await exportBackup(source);
    const text = JSON.stringify(backup);

    const target = await freshDb();
    await createAccount(target, { name: 'Old', type: 'wallet', openingBalanceMinor: 7 });
    await restoreBackup(target, parseBackup(text, SCHEMA_VERSION));

    expect(await exportBackup(target, new Date(backup.exportedAt))).toEqual(backup);
    expect(await balances(target)).toEqual({ Cash: 0, HDFC: 1_000_00, Amex: -500_00 });
    expect((await listTransactions(target, {}))[0].counterparty).toBe('राहुल');
  });

  it('records the restore for cloud sync and clears the review list', async () => {
    const backup = await exportBackup(await sampleDb());
    const target = await freshDb();
    const parsed = parseBankSms('Sent Rs.10.00 From HDFC Bank A/C *1234 To SWIGGY On 15/10/26 Ref 529300000001 Not You?', Date.now())!;
    await insertCandidate(target, parsed);
    await target.runAsync('DELETE FROM sync_outbox');

    await restoreBackup(target, backup);

    expect(await target.getFirstAsync('SELECT COUNT(*) AS n FROM upi_candidates')).toEqual({ n: 0 });
    const outbox = await target.getAllAsync<{ table_name: string }>('SELECT DISTINCT table_name FROM sync_outbox ORDER BY 1');
    expect(outbox.map(r => r.table_name)).toEqual(['accounts', 'budgets', 'categories', 'transactions']);
  });

  it('restores older backups and ignores columns it does not know', async () => {
    const backup = await exportBackup(await sampleDb());
    const older = {
      ...backup,
      schemaVersion: 5,
      tables: {
        ...backup.tables,
        accounts: backup.tables.accounts.map(row => ({ ...row, legacy_column: 'x' })),
        recurring_rules: [],
        receipts: [],
      },
    };
    const target = await freshDb();
    await restoreBackup(target, parseBackup(JSON.stringify(older), SCHEMA_VERSION));
    expect((await listAccounts(target)).map(a => a.name).sort()).toEqual(['Amex', 'Cash', 'HDFC']);
    expect(await listRecurringRules(target)).toEqual([]);
  });

  it('changes nothing when the backup is inconsistent', async () => {
    const backup = await exportBackup(await sampleDb());
    const broken = {
      ...backup,
      tables: { ...backup.tables, accounts: backup.tables.accounts.filter(a => a.name !== 'Amex') },
    };
    const target = await freshDb();
    const before = await exportBackup(target);
    await expect(restoreBackup(target, broken)).rejects.toThrow(/FOREIGN KEY/);
    expect(await exportBackup(target, new Date(before.exportedAt))).toEqual(before);
  });
});
