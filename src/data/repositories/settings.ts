import type { SQLiteDatabase } from 'expo-sqlite';

import { DEFAULT_WARN_PERCENT } from '../../domain/budgets/budgets';

/** Device-local preferences. These are not synced. */
async function getSetting(db: SQLiteDatabase, key: string): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', key);
  return row?.value ?? null;
}

async function setSetting(db: SQLiteDatabase, key: string, value: string): Promise<void> {
  await db.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', key, value);
}

export async function getBudgetWarnPercent(db: SQLiteDatabase): Promise<number> {
  const value = Number(await getSetting(db, 'budget_warn_percent'));
  return Number.isInteger(value) && value > 0 && value <= 100 ? value : DEFAULT_WARN_PERCENT;
}

export async function setBudgetWarnPercent(db: SQLiteDatabase, percent: number): Promise<void> {
  await setSetting(db, 'budget_warn_percent', String(percent));
}

/** Whether detected payments with a recognised category are added without review. On by default. */
export async function getAutoAddPayments(db: SQLiteDatabase): Promise<boolean> {
  return (await getSetting(db, 'auto_add_payments')) !== '0';
}

export async function setAutoAddPayments(db: SQLiteDatabase, enabled: boolean): Promise<void> {
  await setSetting(db, 'auto_add_payments', enabled ? '1' : '0');
}

/** The user's name as banks show it, to recognise transfers between their own accounts. */
export async function getOwnerName(db: SQLiteDatabase): Promise<string> {
  return (await getSetting(db, 'owner_name')) ?? '';
}

export async function setOwnerName(db: SQLiteDatabase, name: string): Promise<void> {
  await setSetting(db, 'owner_name', name.trim());
}

/** Local insight notifications. Off | monthly | weekly (weekly includes monthly). */
export type InsightNotifyLevel = 'off' | 'monthly' | 'weekly';

export async function getInsightNotifyLevel(db: SQLiteDatabase): Promise<InsightNotifyLevel> {
  const value = await getSetting(db, 'insight_notify');
  return value === 'off' || value === 'monthly' || value === 'weekly' ? value : 'monthly';
}

export async function setInsightNotifyLevel(db: SQLiteDatabase, level: InsightNotifyLevel): Promise<void> {
  await setSetting(db, 'insight_notify', level);
}

export async function getInsightNotifyFlags(db: SQLiteDatabase): Promise<{
  pace: boolean;
  unusual: boolean;
  salary: boolean;
  bills: boolean;
}> {
  return {
    pace: (await getSetting(db, 'insight_pace')) !== '0',
    unusual: (await getSetting(db, 'insight_unusual')) !== '0',
    salary: (await getSetting(db, 'insight_salary')) !== '0',
    bills: (await getSetting(db, 'insight_bills')) !== '0',
  };
}

export async function setInsightNotifyFlag(
  db: SQLiteDatabase,
  flag: 'pace' | 'unusual' | 'salary' | 'bills',
  enabled: boolean,
): Promise<void> {
  await setSetting(db, `insight_${flag}`, enabled ? '1' : '0');
}

/** Last local calendar day we posted each insight, to avoid duplicates. */
export async function getInsightLastSent(db: SQLiteDatabase, kind: string): Promise<string | null> {
  return getSetting(db, `insight_sent_${kind}`);
}

export async function setInsightLastSent(db: SQLiteDatabase, kind: string, day: string): Promise<void> {
  await setSetting(db, `insight_sent_${kind}`, day);
}
