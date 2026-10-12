import type { SQLiteDatabase } from 'expo-sqlite';

import type { Budget } from '../../domain/budgets/budgets';
import { newId, nowIso } from '../local/ids';

interface BudgetRow {
  id: string;
  category_id: string;
  amount_minor: number;
}

export async function listBudgets(db: SQLiteDatabase): Promise<Budget[]> {
  const rows = await db.getAllAsync<BudgetRow>(
    `SELECT b.id, b.category_id, b.amount_minor FROM budgets b
     JOIN categories c ON c.id = b.category_id AND c.is_archived = 0`,
  );
  return rows.map(row => ({ id: row.id, categoryId: row.category_id, amountMinor: row.amount_minor }));
}

/** Creates or replaces the monthly budget for a category. */
export async function setBudget(db: SQLiteDatabase, categoryId: string, amountMinor: number): Promise<void> {
  const now = nowIso();
  const existing = await db.getFirstAsync<{ id: string }>(
    'SELECT id FROM budgets WHERE category_id = ?',
    categoryId,
  );
  if (existing) {
    await db.runAsync(
      'UPDATE budgets SET amount_minor = ?, updated_at = ? WHERE id = ?',
      amountMinor,
      now,
      existing.id,
    );
  } else {
    await db.runAsync(
      `INSERT INTO budgets (id, category_id, amount_minor, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`,
      newId(),
      categoryId,
      amountMinor,
      now,
      now,
    );
  }
}

export async function deleteBudget(db: SQLiteDatabase, categoryId: string): Promise<void> {
  await db.runAsync('DELETE FROM budgets WHERE category_id = ?', categoryId);
}
