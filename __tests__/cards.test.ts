import type { SQLiteDatabase } from 'expo-sqlite';

import { createTestDb } from '../test-utils/testDb';
import { exportBackup, restoreBackup } from '../src/data/backup';
import { migrateDbIfNeeded, SCHEMA_VERSION } from '../src/data/local/migrations';
import { loadCardsOverview } from '../src/data/queries/cards';
import { createAccount, setAccountArchived } from '../src/data/repositories/accounts';
import { deleteCardDetails, getCardDetails, saveCardDetails } from '../src/data/repositories/cards';
import { listCategories } from '../src/data/repositories/categories';
import { createTransaction } from '../src/data/repositories/transactions';
import { parseBackup } from '../src/domain/backup';
import {
  availableCreditMinor,
  cardBill,
  cardReminders,
  dueDateAfter,
  lastStatementDate,
  statementCutoffIso,
  type CardFlows,
} from '../src/domain/cards/billing';
import type { TransactionInput } from '../src/domain/types';

jest.mock('expo-crypto', () => ({ randomUUID: () => jest.requireActual('node:crypto').randomUUID() }));

const local = (y: number, m: number, d: number, h = 12, min = 0) => new Date(y, m - 1, d, h, min);
const ymd = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const rupees = (minor: number) => `₹${minor / 100}`;

const flows = (overrides: Partial<CardFlows>): CardFlows => ({
  openingBalanceMinor: 0,
  beforeStatementMinor: 0,
  creditsSinceMinor: 0,
  debitsSinceMinor: 0,
  ...overrides,
});

describe('statement and due dates', () => {
  it('uses this month’s statement day once it has arrived, else last month’s', () => {
    expect(ymd(lastStatementDate(18, local(2026, 10, 19)))).toBe('2026-10-18');
    expect(ymd(lastStatementDate(18, local(2026, 10, 18, 0, 5)))).toBe('2026-10-18');
    expect(ymd(lastStatementDate(18, local(2026, 10, 17, 23, 59)))).toBe('2026-09-18');
    expect(ymd(lastStatementDate(25, local(2026, 1, 5)))).toBe('2025-12-25');
  });

  it('falls back to the last day of short months', () => {
    expect(ymd(lastStatementDate(31, local(2026, 2, 28)))).toBe('2026-02-28');
    expect(ymd(lastStatementDate(31, local(2026, 3, 1)))).toBe('2026-02-28');
    expect(ymd(lastStatementDate(30, local(2028, 2, 29)))).toBe('2028-02-29');
  });

  it('puts the due date after the statement, in the next month when the day is earlier', () => {
    expect(ymd(dueDateAfter(local(2026, 10, 18, 0), 7))).toBe('2026-11-07');
    expect(ymd(dueDateAfter(local(2026, 10, 3, 0), 23))).toBe('2026-10-23');
    expect(ymd(dueDateAfter(local(2026, 10, 18, 0), 18))).toBe('2026-11-18');
    expect(ymd(dueDateAfter(local(2026, 12, 20, 0), 10))).toBe('2027-01-10');
    expect(ymd(dueDateAfter(local(2026, 1, 31, 0), 30))).toBe('2026-02-28');
  });

  it('bills everything up to the end of the statement day', () => {
    expect(statementCutoffIso(18, local(2026, 10, 25))).toBe(local(2026, 10, 19, 0).toISOString());
  });
});

describe('cardBill', () => {
  const cycle = { statementDay: 18, dueDay: 7 };

  it('splits what is owed into the billed amount still due and spending since', () => {
    const bill = cardBill(
      cycle,
      flows({ beforeStatementMinor: -1_200_000, creditsSinceMinor: 500_000, debitsSinceMinor: 300_000 }),
      local(2026, 10, 25),
    );
    expect(bill).toEqual({
      statementDate: '2026-10-18',
      dueDate: '2026-11-07',
      nextStatementDate: '2026-11-18',
      nextDueDate: '2026-12-07',
      billedMinor: 1_200_000,
      paidMinor: 500_000,
      remainingMinor: 700_000,
      unbilledMinor: 300_000,
      owedMinor: 1_000_000,
      status: 'due',
      daysToDue: 13,
    });
  });

  it('counts the opening amount owed as billed', () => {
    const bill = cardBill(cycle, flows({ openingBalanceMinor: -50_000 }), local(2026, 10, 25));
    expect(bill.billedMinor).toBe(50_000);
    expect(bill.owedMinor).toBe(50_000);
  });

  it('is overdue after the due day while anything billed is unpaid', () => {
    const onDueDay = cardBill(cycle, flows({ beforeStatementMinor: -10_000 }), local(2026, 11, 7, 23));
    expect(onDueDay.status).toBe('due');
    expect(onDueDay.daysToDue).toBe(0);
    const after = cardBill(cycle, flows({ beforeStatementMinor: -10_000 }), local(2026, 11, 8, 1));
    expect(after.status).toBe('overdue');
    expect(after.daysToDue).toBe(-1);
  });

  it('is paid once payments cover the statement; overpaying does not make it negative', () => {
    const bill = cardBill(
      cycle,
      flows({ beforeStatementMinor: -10_000, creditsSinceMinor: 25_000, debitsSinceMinor: 5_000 }),
      local(2026, 10, 25),
    );
    expect(bill.status).toBe('paid');
    expect(bill.paidMinor).toBe(10_000);
    expect(bill.remainingMinor).toBe(0);
    expect(bill.owedMinor).toBe(0);
  });

  it('has nothing to pay when the statement had no balance or a credit balance', () => {
    expect(cardBill(cycle, flows({}), local(2026, 10, 25)).status).toBe('nothing');
    const credit = cardBill(cycle, flows({ openingBalanceMinor: 20_000, debitsSinceMinor: 5_000 }), local(2026, 10, 25));
    expect(credit.status).toBe('nothing');
    expect(credit.billedMinor).toBe(0);
    expect(credit.owedMinor).toBe(0);
  });

  it('never shows negative available credit', () => {
    expect(availableCreditMinor(100_000, 30_000)).toBe(70_000);
    expect(availableCreditMinor(100_000, 130_000)).toBe(0);
  });
});

describe('cardReminders', () => {
  const cycle = { statementDay: 18, dueDay: 7 };

  it('reminds 3 days before and on the due day at 9am', () => {
    const now = local(2026, 10, 25);
    const bill = cardBill(cycle, flows({ beforeStatementMinor: -700_000 }), now);
    const reminders = cardReminders('a1', 'HDFC Regalia', bill, now, rupees);
    expect(reminders.map(r => [r.id, r.at.getTime()])).toEqual([
      ['card-due-a1-2026-11-07-early', local(2026, 11, 4, 9).getTime()],
      ['card-due-a1-2026-11-07-today', local(2026, 11, 7, 9).getTime()],
    ]);
    expect(reminders[0]!.body).toContain('₹7000');
    expect(reminders[0]!.title).toContain('HDFC Regalia');
  });

  it('skips reminders already in the past', () => {
    const now = local(2026, 11, 5);
    const bill = cardBill(cycle, flows({ beforeStatementMinor: -700_000 }), now);
    expect(cardReminders('a1', 'Card', bill, now, rupees).map(r => r.id)).toEqual(['card-due-a1-2026-11-07-today']);
  });

  it('after paying, reminds about the next due date when there is new spending', () => {
    const now = local(2026, 10, 25);
    const bill = cardBill(
      cycle,
      flows({ beforeStatementMinor: -10_000, creditsSinceMinor: 10_000, debitsSinceMinor: 4_000 }),
      now,
    );
    const reminders = cardReminders('a1', 'Card', bill, now, rupees);
    expect(reminders.map(r => r.id)).toEqual(['card-due-a1-2026-12-07-early', 'card-due-a1-2026-12-07-today']);
    expect(reminders[0]!.body).toContain('about ₹40');
  });

  it('has nothing to remind about when nothing is owed or the bill is overdue', () => {
    const now = local(2026, 10, 25);
    expect(cardReminders('a1', 'Card', cardBill(cycle, flows({}), now), now, rupees)).toEqual([]);
    const late = local(2026, 11, 10);
    expect(cardReminders('a1', 'Card', cardBill(cycle, flows({ beforeStatementMinor: -100 }), late), late, rupees)).toEqual(
      [],
    );
  });
});

describe('cards in the database', () => {
  async function setup(): Promise<{ db: SQLiteDatabase; bank: string; card: string; food: string }> {
    const db = createTestDb();
    await migrateDbIfNeeded(db);
    const bank = await createAccount(db, { name: 'HDFC Savings', type: 'bank', openingBalanceMinor: 1_000_000 });
    const card = await createAccount(db, { name: 'HDFC Regalia', type: 'card', openingBalanceMinor: 0 });
    const food = (await listCategories(db)).find(c => c.name === 'Food and dining' && c.type === 'expense')!.id;
    return { db, bank, card, food };
  }

  const spend = (accountId: string, categoryId: string, amountMinor: number, at: Date): TransactionInput => ({
    type: 'expense',
    amountMinor,
    occurredAt: at.toISOString(),
    accountId,
    toAccountId: null,
    categoryId,
    counterparty: 'Swiggy',
    note: null,
  });

  it('creates the table in the latest migration', async () => {
    const db = createTestDb();
    await migrateDbIfNeeded(db);
    expect((await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version).toBe(SCHEMA_VERSION);
    expect(await db.getFirstAsync("SELECT name FROM sqlite_master WHERE name = 'card_details'")).not.toBeNull();
  });

  it('computes the bill from card transactions around the statement day', async () => {
    const { db, bank, card, food } = await setup();
    await saveCardDetails(db, { accountId: card, statementDay: 18, dueDay: 7, creditLimitMinor: 10_000_000 });
    await createTransaction(db, spend(card, food, 400_000, local(2026, 10, 2)));
    await createTransaction(db, spend(card, food, 100_000, local(2026, 10, 18, 23, 30)));
    await createTransaction(db, spend(card, food, 50_000, local(2026, 10, 19, 0, 10)));
    await createTransaction(db, {
      type: 'transfer',
      amountMinor: 200_000,
      occurredAt: local(2026, 10, 22).toISOString(),
      accountId: bank,
      toAccountId: card,
      categoryId: null,
      counterparty: null,
      note: null,
    });
    // Bank spending does not touch the card.
    await createTransaction(db, spend(bank, food, 999_00, local(2026, 10, 10)));

    const overview = await loadCardsOverview(db, local(2026, 10, 25));
    expect(overview.cards).toHaveLength(1);
    const [summary] = overview.cards;
    expect(summary!.bill).toMatchObject({
      statementDate: '2026-10-18',
      dueDate: '2026-11-07',
      billedMinor: 500_000,
      paidMinor: 200_000,
      remainingMinor: 300_000,
      unbilledMinor: 50_000,
      owedMinor: 350_000,
      status: 'due',
    });
    expect(summary!.availableMinor).toBe(9_650_000);
    expect(overview.totalOwedMinor).toBe(350_000);
    expect(overview.totalBilledDueMinor).toBe(300_000);
    expect(overview.totalLimitMinor).toBe(10_000_000);
  });

  it('shows what is owed on cards without billing days, and lists the most urgent first', async () => {
    const { db, card, food } = await setup();
    const other = await createAccount(db, { name: 'SBI Card', type: 'card', openingBalanceMinor: -80_000 });
    await saveCardDetails(db, { accountId: other, statementDay: 1, dueDay: 20, creditLimitMinor: null });
    await createTransaction(db, spend(card, food, 30_000, local(2026, 10, 2)));

    const overview = await loadCardsOverview(db, local(2026, 10, 25));
    expect(overview.cards.map(c => c.account.name)).toEqual(['SBI Card', 'HDFC Regalia']);
    expect(overview.cards[0]!.bill?.status).toBe('overdue');
    expect(overview.cards[1]!.bill).toBeNull();
    expect(overview.cards[1]!.owedMinor).toBe(30_000);
    expect(overview.cards[1]!.availableMinor).toBeNull();
    expect(overview.totalOwedMinor).toBe(110_000);
  });

  it('leaves out archived cards', async () => {
    const { db, card } = await setup();
    await setAccountArchived(db, card, true);
    expect((await loadCardsOverview(db, local(2026, 10, 25))).cards).toEqual([]);
  });

  it('updates, validates and deletes billing details', async () => {
    const { db, card } = await setup();
    await saveCardDetails(db, { accountId: card, statementDay: 18, dueDay: 7, creditLimitMinor: null });
    await saveCardDetails(db, { accountId: card, statementDay: 5, dueDay: 25, creditLimitMinor: 50_000 });
    expect(await getCardDetails(db, card)).toEqual({ accountId: card, statementDay: 5, dueDay: 25, creditLimitMinor: 50_000 });
    await expect(saveCardDetails(db, { accountId: card, statementDay: 0, dueDay: 7, creditLimitMinor: null })).rejects.toThrow();
    await expect(saveCardDetails(db, { accountId: card, statementDay: 18, dueDay: 32, creditLimitMinor: null })).rejects.toThrow();
    await expect(saveCardDetails(db, { accountId: card, statementDay: 18, dueDay: 7, creditLimitMinor: 0 })).rejects.toThrow();
    await deleteCardDetails(db, card);
    expect(await getCardDetails(db, card)).toBeNull();
  });

  it('keeps billing details through backup and restore, and restores older backups without them', async () => {
    const { db, card } = await setup();
    await saveCardDetails(db, { accountId: card, statementDay: 18, dueDay: 7, creditLimitMinor: 25_000_000 });
    const backup = await exportBackup(db);
    expect(backup.tables.card_details).toHaveLength(1);

    const target = createTestDb();
    await migrateDbIfNeeded(target);
    await restoreBackup(target, parseBackup(JSON.stringify(backup), SCHEMA_VERSION));
    expect(await getCardDetails(target, card)).toMatchObject({ statementDay: 18, dueDay: 7, creditLimitMinor: 25_000_000 });

    const older = JSON.parse(JSON.stringify(backup));
    delete older.tables.card_details;
    const again = createTestDb();
    await migrateDbIfNeeded(again);
    await restoreBackup(again, parseBackup(JSON.stringify(older), SCHEMA_VERSION));
    expect(await getCardDetails(again, card)).toBeNull();
  });
});
