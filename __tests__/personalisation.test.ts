import type { SQLiteDatabase } from 'expo-sqlite';

import { createTestDb } from '../test-utils/testDb';
import { migrateDbIfNeeded } from '../src/data/local/migrations';
import { checkUnusualExpense, loadMonthInsight } from '../src/data/queries/insights';
import { createAccount } from '../src/data/repositories/accounts';
import { createCategory, listCategories, moveCategory } from '../src/data/repositories/categories';
import {
  DEFAULT_ALERT_TUNING,
  getAlertTuning,
  getAppLock,
  getMonthStartDaySetting,
  getOnboarded,
  getThemePreference,
  setAlertTuning,
  setAppLock,
  setMonthStartDaySetting,
  setOnboarded,
  setThemePreference,
} from '../src/data/repositories/settings';
import { createTransaction } from '../src/data/repositories/transactions';
import { cardBill, cardReminders } from '../src/domain/cards/billing';
import {
  DASHBOARD_SECTIONS,
  defaultDashboardLayout,
  moveSection,
  parseDashboardLayout,
  setSectionVisible,
} from '../src/domain/dashboard';
import {
  formatMonth,
  monthKeyOf,
  monthProgress,
  monthRange,
  periodRange,
  setMonthStartDay,
} from '../src/domain/period';
import { activeScheme, colors, setActiveScheme, themedStyles } from '../src/theme/colors';

jest.mock('expo-crypto', () => ({ randomUUID: () => jest.requireActual('node:crypto').randomUUID() }));

const local = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h);

async function freshDb(): Promise<SQLiteDatabase> {
  const db = createTestDb();
  await migrateDbIfNeeded(db);
  return db;
}

afterEach(() => {
  setMonthStartDay(1);
  setActiveScheme('light');
});

describe('months starting on the salary day', () => {
  beforeEach(() => setMonthStartDay(25));

  it('puts days before the start day in the previous month', () => {
    expect(monthKeyOf(local(2026, 10, 24))).toEqual({ year: 2026, month: 8 });
    expect(monthKeyOf(local(2026, 10, 25, 0))).toEqual({ year: 2026, month: 9 });
    expect(monthKeyOf(local(2026, 1, 3))).toEqual({ year: 2025, month: 11 });
  });

  it('runs a month from the start day to the day before it next month', () => {
    const range = monthRange({ year: 2026, month: 9 });
    expect(range.startIso).toBe(new Date(2026, 9, 25).toISOString());
    expect(range.endIso).toBe(new Date(2026, 10, 25).toISOString());
    const december = monthRange({ year: 2026, month: 11 });
    expect(december.endIso).toBe(new Date(2027, 0, 25).toISOString());
  });

  it('labels months by their dates', () => {
    expect(formatMonth({ year: new Date().getFullYear(), month: 9 })).toMatch(/25 Oct.*24 Nov/);
  });

  it('counts days through the month for spending pace', () => {
    expect(monthProgress({ year: 2026, month: 9 }, local(2026, 10, 25))).toEqual({ days: 31, elapsed: 1 });
    expect(monthProgress({ year: 2026, month: 9 }, local(2026, 11, 8))).toEqual({ days: 31, elapsed: 15 });
    expect(monthProgress({ year: 2026, month: 9 }, local(2026, 12, 1))).toEqual({ days: 31, elapsed: 31 });
    expect(monthProgress({ year: 2026, month: 9 }, local(2026, 10, 1))).toEqual({ days: 31, elapsed: 0 });
  });

  it('totals the month from the start day', async () => {
    const db = await freshDb();
    const bank = await createAccount(db, { name: 'HDFC', type: 'bank', openingBalanceMinor: 0 });
    const salary = (await listCategories(db)).find(c => c.name === 'Salary')!.id;
    const food = (await listCategories(db)).find(c => c.name === 'Food and dining')!.id;
    const add = (type: 'income' | 'expense', categoryId: string, amountMinor: number, at: Date) =>
      createTransaction(db, {
        type,
        amountMinor,
        occurredAt: at.toISOString(),
        accountId: bank,
        toAccountId: null,
        categoryId,
        counterparty: null,
        note: null,
      });
    await add('income', salary, 10_000_000, local(2026, 10, 25, 9));
    await add('expense', food, 50_000, local(2026, 11, 20));
    await add('expense', food, 70_000, local(2026, 10, 24));
    const insight = await loadMonthInsight(db, { year: 2026, month: 9 }, local(2026, 11, 20));
    expect(insight.incomeMinor).toBe(10_000_000);
    expect(insight.expenseMinor).toBe(50_000);
  });
});

describe('setMonthStartDay', () => {
  it('only allows days that exist in every month', () => {
    setMonthStartDay(29);
    expect(monthRange({ year: 2026, month: 1 }).startIso).toBe(new Date(2026, 1, 1).toISOString());
    setMonthStartDay(28);
    expect(monthRange({ year: 2026, month: 1 }).startIso).toBe(new Date(2026, 1, 28).toISOString());
  });
});

describe('periodRange', () => {
  it('covers this year up to the end of today', () => {
    expect(periodRange({ kind: 'ytd' }, local(2026, 10, 19))).toEqual({
      startIso: new Date(2026, 0, 1).toISOString(),
      endIso: new Date(2026, 9, 20).toISOString(),
    });
  });

  it('includes both ends of a custom range and rejects bad ones', () => {
    expect(periodRange({ kind: 'custom', from: '2026-10-01', to: '2026-10-07' }, new Date())).toEqual({
      startIso: new Date(2026, 9, 1).toISOString(),
      endIso: new Date(2026, 9, 8).toISOString(),
    });
    expect(periodRange({ kind: 'custom', from: '2026-10-07', to: '2026-10-01' }, new Date())).toBeNull();
    expect(periodRange({ kind: 'custom', from: '2026-02-30', to: '2026-03-01' }, new Date())).toBeNull();
    expect(periodRange({ kind: 'custom', from: 'oct', to: '2026-03-01' }, new Date())).toBeNull();
  });
});

describe('dashboard layout', () => {
  it('defaults to every section, shown, in the standard order', () => {
    expect(parseDashboardLayout(null)).toEqual(defaultDashboardLayout());
    expect(parseDashboardLayout('not json')).toEqual(defaultDashboardLayout());
    expect(defaultDashboardLayout().map(s => s.id)).toEqual(DASHBOARD_SECTIONS.map(s => s.id));
  });

  it('keeps the saved order and visibility, drops unknown and repeated sections, and adds new ones', () => {
    const saved = JSON.stringify([
      { id: 'recent', visible: true },
      { id: 'safe', visible: false },
      { id: 'mystery', visible: true },
      { id: 'recent', visible: false },
    ]);
    const layout = parseDashboardLayout(saved);
    expect(layout.filter(s => s.id === 'recent' || s.id === 'safe')).toEqual([
      { id: 'recent', visible: true },
      { id: 'safe', visible: false },
    ]);
    // Sections missing from the saved layout come back at their default place.
    expect(layout[0]).toEqual({ id: 'review', visible: true });
    expect(layout).toHaveLength(DASHBOARD_SECTIONS.length);
    expect(new Set(layout.map(s => s.id)).size).toBe(DASHBOARD_SECTIONS.length);
    expect(layout.filter(s => !s.visible).map(s => s.id)).toEqual(['safe']);
  });

  it('moves and hides sections', () => {
    const layout = defaultDashboardLayout();
    const moved = moveSection(layout, 'balances', -1);
    expect(moved.map(s => s.id).slice(0, 2)).toEqual(['balances', 'review']);
    expect(moveSection(layout, 'review', -1)).toEqual(layout);
    expect(moveSection(layout, 'recent', 1)).toEqual(layout);
    expect(setSectionVisible(layout, 'spending', false).find(s => s.id === 'spending')?.visible).toBe(false);
  });

  it('drops the removed Friends and family section from saved layouts', () => {
    const layout = parseDashboardLayout(JSON.stringify([{ id: 'people', visible: true }, { id: 'recent', visible: true }]));
    expect(layout.some(s => (s.id as string) === 'people')).toBe(false);
    expect(layout.find(s => s.id === 'balances')).toEqual({ id: 'balances', visible: true });
  });
});

describe('preference settings', () => {
  it('has sensible defaults', async () => {
    const db = await freshDb();
    expect(await getMonthStartDaySetting(db)).toBe(1);
    expect(await getThemePreference(db)).toBe('system');
    expect(await getAppLock(db)).toBe(false);
    expect(await getOnboarded(db)).toBe(false);
    expect(await getAlertTuning(db)).toEqual(DEFAULT_ALERT_TUNING);
  });

  it('saves and clamps values', async () => {
    const db = await freshDb();
    await setMonthStartDaySetting(db, 25);
    await setThemePreference(db, 'dark');
    await setAppLock(db, true);
    await setOnboarded(db);
    expect(await getMonthStartDaySetting(db)).toBe(25);
    expect(await getThemePreference(db)).toBe('dark');
    expect(await getAppLock(db)).toBe(true);
    expect(await getOnboarded(db)).toBe(true);
    await setMonthStartDaySetting(db, 31);
    expect(await getMonthStartDaySetting(db)).toBe(1);

    await setAlertTuning(db, { largePaymentMinor: 500_000, weeklyDigestDay: 5, cardReminderDaysBefore: 1, cardReminderHour: 18 });
    expect(await getAlertTuning(db)).toEqual({
      largePaymentMinor: 500_000,
      weeklyDigestDay: 5,
      cardReminderDaysBefore: 1,
      cardReminderHour: 18,
    });
    await setAlertTuning(db, { largePaymentMinor: null, weeklyDigestDay: 9 });
    expect(await getAlertTuning(db)).toMatchObject({ largePaymentMinor: null, weeklyDigestDay: 0, cardReminderHour: 18 });
  });
});

describe('large payment threshold', () => {
  it('uses the amount the user set instead of comparing with recent spending', async () => {
    const db = await freshDb();
    const at = local(2026, 10, 19).toISOString();
    expect(await checkUnusualExpense(db, 500_000, at, 500_000)).toBe(true);
    expect(await checkUnusualExpense(db, 499_999, at, 500_000)).toBe(false);
    expect(await checkUnusualExpense(db, 300_000, at, null)).toBe(false);
  });
});

describe('card reminder timing', () => {
  const now = local(2026, 10, 25);
  const bill = cardBill(
    { statementDay: 18, dueDay: 7 },
    { openingBalanceMinor: 0, beforeStatementMinor: -10_000, creditsSinceMinor: 0, debitsSinceMinor: 0 },
    now,
  );

  it('fires at the chosen hour and number of days before', () => {
    const reminders = cardReminders('a', 'Card', bill, now, String, 1, 18);
    expect(reminders.map(r => r.at.getTime())).toEqual([local(2026, 11, 6, 18).getTime(), local(2026, 11, 7, 18).getTime()]);
  });

  it('only reminds on the day when set to 0 days before', () => {
    expect(cardReminders('a', 'Card', bill, now, String, 0, 9).map(r => r.id)).toEqual(['card-due-a-2026-11-07-today']);
  });
});

describe('moveCategory', () => {
  it('reorders among siblings only, and leaves the ends in place', async () => {
    const db = await freshDb();
    const expenseRoots = async () =>
      (await listCategories(db)).filter(c => c.type === 'expense' && c.parentId === null).map(c => c.name);
    const before = await expenseRoots();
    await moveCategory(db, (await listCategories(db)).find(c => c.name === before[1])!.id, -1);
    const after = await expenseRoots();
    expect(after.slice(0, 2)).toEqual([before[1], before[0]]);
    expect(after.slice(2)).toEqual(before.slice(2));

    const top = (await listCategories(db)).find(c => c.name === after[0])!;
    await moveCategory(db, top.id, -1);
    expect(await expenseRoots()).toEqual(after);
  });

  it('moves subcategories within their parent and marks moved rows for sync', async () => {
    const db = await freshDb();
    const food = (await listCategories(db)).find(c => c.name === 'Food and dining')!.id;
    const a = await createCategory(db, { name: 'Lunch', type: 'expense', parentId: food });
    const b = await createCategory(db, { name: 'Snacks', type: 'expense', parentId: food });
    await db.runAsync("UPDATE categories SET updated_at = '2000-01-01T00:00:00.000Z'");
    await moveCategory(db, b, -1);
    const children = (await listCategories(db)).filter(c => c.parentId === food);
    expect(children.map(c => c.id)).toEqual([b, a]);
    const stale = await db.getAllAsync<{ id: string }>(
      "SELECT id FROM categories WHERE updated_at = '2000-01-01T00:00:00.000Z' AND id IN (?, ?)",
      a,
      b,
    );
    expect(stale).toEqual([]);
    const untouched = await db.getFirstAsync<{ n: number }>(
      "SELECT COUNT(*) AS n FROM categories WHERE updated_at <> '2000-01-01T00:00:00.000Z'",
    );
    expect(untouched?.n).toBe(2);
  });
});

describe('theme', () => {
  it('reads colours from the active scheme', () => {
    setActiveScheme('light');
    const lightText = colors.text;
    setActiveScheme('dark');
    expect(activeScheme()).toBe('dark');
    expect(colors.text).not.toBe(lightText);
    expect({ ...colors }.text).toBe(colors.text);
  });

  it('rebuilds themed styles for each scheme and caches them', () => {
    const build = jest.fn(() => ({ box: { backgroundColor: colors.surface } }));
    const styles = themedStyles(build);
    setActiveScheme('light');
    const light = styles.box.backgroundColor;
    expect(styles.box.backgroundColor).toBe(light);
    setActiveScheme('dark');
    expect(styles.box.backgroundColor).not.toBe(light);
    setActiveScheme('light');
    expect(styles.box.backgroundColor).toBe(light);
    expect(build).toHaveBeenCalledTimes(2);
  });
});
