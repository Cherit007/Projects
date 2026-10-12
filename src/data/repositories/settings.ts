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
