import type { SQLiteDatabase } from 'expo-sqlite';

import { newId, nowIso } from '../local/ids';

export interface SavingsGoal {
  id: string;
  name: string;
  targetMinor: number;
  monthlyMinor: number;
  savedMinor: number;
  createdAt: string;
  updatedAt: string;
}

export async function listGoals(db: SQLiteDatabase): Promise<SavingsGoal[]> {
  const rows = await db.getAllAsync<{
    id: string;
    name: string;
    target_minor: number;
    monthly_minor: number;
    saved_minor: number;
    created_at: string;
    updated_at: string;
  }>('SELECT * FROM savings_goals ORDER BY name COLLATE NOCASE');
  return rows.map(r => ({
    id: r.id,
    name: r.name,
    targetMinor: r.target_minor,
    monthlyMinor: r.monthly_minor,
    savedMinor: r.saved_minor,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

export async function createGoal(
  db: SQLiteDatabase,
  input: { name: string; targetMinor: number; monthlyMinor: number },
): Promise<string> {
  const id = newId();
  const now = nowIso();
  await db.runAsync(
    `INSERT INTO savings_goals (id, name, target_minor, monthly_minor, saved_minor, created_at, updated_at)
     VALUES (?, ?, ?, ?, 0, ?, ?)`,
    id,
    input.name.trim(),
    input.targetMinor,
    input.monthlyMinor,
    now,
    now,
  );
  return id;
}

export async function deleteGoal(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync('DELETE FROM savings_goals WHERE id = ?', id);
}

/** Monthly contributions still planned toward goals this month. */
export async function monthlyGoalCommitmentMinor(db: SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ total: number | null }>(
    'SELECT SUM(monthly_minor) AS total FROM savings_goals',
  );
  return row?.total ?? 0;
}
