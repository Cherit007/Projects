import { BACKUP_FORMAT, backupFileName, BackupError, parseBackup } from '../src/domain/backup';
import { dueOccurrences, MAX_CATCH_UP, occurrenceAt } from '../src/domain/recurring';
import { averageMonthlySpend, change, monthlyTotals, savingsRate, topPayees, totalsByCategory } from '../src/domain/reports';
import type { Category } from '../src/domain/types';

const local = (y: number, m: number, d: number, h = 9) => new Date(y, m, d, h).toISOString();
const day = (iso: string) => {
  const date = new Date(iso);
  return [date.getFullYear(), date.getMonth() + 1, date.getDate(), date.getHours()];
};

describe('occurrenceAt', () => {
  it('adds weeks, keeping the time of day', () => {
    expect(day(occurrenceAt(local(2026, 9, 15), 'weekly', 0))).toEqual([2026, 10, 15, 9]);
    expect(day(occurrenceAt(local(2026, 9, 15), 'weekly', 3))).toEqual([2026, 11, 5, 9]);
    expect(day(occurrenceAt(local(2026, 11, 29), 'weekly', 1))).toEqual([2027, 1, 5, 9]);
  });

  it('keeps the day of the month, using the last day of shorter months', () => {
    const start = local(2027, 0, 31);
    expect(day(occurrenceAt(start, 'monthly', 1))).toEqual([2027, 2, 28, 9]);
    expect(day(occurrenceAt(start, 'monthly', 2))).toEqual([2027, 3, 31, 9]);
    expect(day(occurrenceAt(start, 'monthly', 3))).toEqual([2027, 4, 30, 9]);
    expect(day(occurrenceAt(local(2028, 0, 30), 'monthly', 1))).toEqual([2028, 2, 29, 9]);
    expect(day(occurrenceAt(local(2026, 10, 15), 'monthly', 2))).toEqual([2027, 1, 15, 9]);
  });

  it('handles 29 February in yearly repeats', () => {
    const start = local(2028, 1, 29);
    expect(day(occurrenceAt(start, 'yearly', 1))).toEqual([2029, 2, 28, 9]);
    expect(day(occurrenceAt(start, 'yearly', 4))).toEqual([2032, 2, 29, 9]);
  });
});

describe('dueOccurrences', () => {
  const start = local(2026, 0, 31);

  it('returns nothing before the start or once everything is created', () => {
    expect(dueOccurrences(start, 'monthly', 0, new Date(2026, 0, 30))).toEqual([]);
    expect(dueOccurrences(start, 'monthly', 1, new Date(2026, 1, 27))).toEqual([]);
  });

  it('includes a repeat due exactly now and catches up on missed ones', () => {
    const due = dueOccurrences(start, 'monthly', 1, new Date(2026, 3, 30, 9));
    expect(due.map(day)).toEqual([
      [2026, 2, 28, 9],
      [2026, 3, 31, 9],
      [2026, 4, 30, 9],
    ]);
  });

  it('never creates more than the catch-up limit at once', () => {
    expect(dueOccurrences(local(2000, 0, 1), 'weekly', 1, new Date(2026, 0, 1))).toHaveLength(MAX_CATCH_UP);
  });
});

const categories: Category[] = [
  { id: 'food', name: 'Food and dining', type: 'expense', parentId: null, sortOrder: 0, isArchived: false },
  { id: 'cafe', name: 'Cafes', type: 'expense', parentId: 'food', sortOrder: 1, isArchived: false },
  { id: 'rent', name: 'Rent and housing', type: 'expense', parentId: null, sortOrder: 2, isArchived: true },
  { id: 'salary', name: 'Salary', type: 'income', parentId: null, sortOrder: 3, isArchived: false },
];

const txn = (
  type: 'income' | 'expense' | 'transfer',
  amountMinor: number,
  occurredAt: string,
  categoryId: string | null = null,
  counterparty: string | null = null,
) => ({ type, amountMinor, occurredAt, categoryId, counterparty });

describe('reports', () => {
  const year = [
    txn('income', 50_000_00, local(2026, 0, 1), 'salary'),
    txn('expense', 20_000_00, local(2026, 0, 5), 'rent', 'Landlord'),
    txn('expense', 500_00, local(2026, 0, 6), 'cafe', 'Starbucks'),
    txn('expense', 300_00, local(2026, 2, 6), 'food', 'starbucks '),
    txn('transfer', 9_999_00, local(2026, 2, 7)),
    txn('expense', 100_00, local(2025, 11, 31, 23), 'food'),
    txn('expense', 50_00, local(2026, 4, 1), null, 'Kiosk'),
  ];

  it('totals each month of the year, ignoring other years and transfers', () => {
    const months = monthlyTotals(year, 2026);
    expect(months).toHaveLength(12);
    expect(months[0]).toEqual({ month: 0, incomeMinor: 50_000_00, expenseMinor: 20_500_00, netMinor: 29_500_00 });
    expect(months[2]).toEqual({ month: 2, incomeMinor: 0, expenseMinor: 300_00, netMinor: -300_00 });
    expect(months[11].expenseMinor).toBe(0);
  });

  it('groups by top-level category with shares, keeping archived and uncategorised spending', () => {
    const totals = totalsByCategory(year.filter(t => t.occurredAt >= local(2026, 0, 1, 0)), categories, 'expense');
    expect(totals.map(t => [t.name, t.amountMinor])).toEqual([
      ['Rent and housing', 20_000_00],
      ['Food and dining', 800_00],
      ['Uncategorized', 50_00],
    ]);
    expect(totals.reduce((sum, t) => sum + t.share, 0)).toBeCloseTo(1);
    expect(totalsByCategory([], categories, 'expense')).toEqual([]);
  });

  it('ranks payees, merging case and spacing differences', () => {
    expect(topPayees(year, 'expense')).toEqual([
      { name: 'Landlord', amountMinor: 20_000_00, count: 1 },
      { name: 'Starbucks', amountMinor: 800_00, count: 2 },
      { name: 'Kiosk', amountMinor: 50_00, count: 1 },
    ]);
    expect(topPayees(year, 'expense', 1)).toHaveLength(1);
    expect(topPayees(year, 'income')).toEqual([]);
  });

  it('averages monthly spending from the first month with entries', () => {
    const months = monthlyTotals(year, 2026);
    expect(averageMonthlySpend(months, 4)).toBe(Math.round((20_500_00 + 0 + 300_00 + 0 + 50_00) / 5));
    expect(averageMonthlySpend(months)).toBe(Math.round(20_850_00 / 12));
    expect(averageMonthlySpend(monthlyTotals([], 2026))).toBeNull();
    const late = monthlyTotals([txn('expense', 900, local(2026, 9, 1))], 2026);
    expect(averageMonthlySpend(late, 9)).toBe(900);
    expect(averageMonthlySpend(late, 8)).toBeNull();
  });

  it('computes savings rate and change safely', () => {
    expect(savingsRate({ incomeMinor: 0, expenseMinor: 100, netMinor: -100 })).toBeNull();
    expect(savingsRate({ incomeMinor: 1000, expenseMinor: 1500, netMinor: -500 })).toBe(-0.5);
    expect(change(150, 100)).toBe(0.5);
    expect(change(0, 100)).toBe(-1);
    expect(change(100, 0)).toBeNull();
  });
});

describe('parseBackup', () => {
  const valid = {
    format: BACKUP_FORMAT,
    version: 1,
    schemaVersion: 6,
    exportedAt: '2026-10-15T10:00:00.000Z',
    tables: { accounts: [{ id: 'a', name: 'Cash', type: 'cash', opening_balance_minor: 0 }] },
  };

  it('accepts a backup and fills in tables missing from older versions', () => {
    const backup = parseBackup(JSON.stringify(valid), 6);
    expect(backup.tables.accounts).toHaveLength(1);
    expect(backup.tables.recurring_rules).toEqual([]);
    expect(backup.tables.receipts).toEqual([]);
  });

  it.each([
    ['not json', '{oops', /not a backup/],
    ['another file', JSON.stringify({ hello: 1 }), /not a backup/],
    ['null', 'null', /not a backup/],
    ['a newer format', JSON.stringify({ ...valid, version: 2 }), /newer version/],
    ['a newer schema', JSON.stringify({ ...valid, schemaVersion: 7 }), /newer version/],
    ['nested values', JSON.stringify({ ...valid, tables: { ...valid.tables, transactions: [{ id: { x: 1 } }] } }), /damaged \(transactions\)/],
    ['a table that is not a list', JSON.stringify({ ...valid, tables: { ...valid.tables, budgets: {} } }), /damaged \(budgets\)/],
    ['no accounts', JSON.stringify({ ...valid, tables: {} }), /no accounts/],
  ])('rejects %s', (_, text, message) => {
    expect(() => parseBackup(text, 6)).toThrow(BackupError);
    expect(() => parseBackup(text, 6)).toThrow(message);
  });

  it('names files by date', () => {
    expect(backupFileName(new Date(2026, 0, 5))).toBe('finance-backup-2026-01-05.json');
  });
});
