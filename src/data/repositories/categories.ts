import type { SQLiteDatabase } from 'expo-sqlite';

import type { Category, CategoryType } from '../../domain/types';
import { newId } from '../local/ids';

interface CategoryRow {
  id: string;
  name: string;
  type: CategoryType;
  parent_id: string | null;
  sort_order: number;
  is_archived: number;
}

function toCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    parentId: row.parent_id,
    sortOrder: row.sort_order,
    isArchived: row.is_archived === 1,
  };
}

export async function listCategories(
  db: SQLiteDatabase,
  { includeArchived = false } = {},
): Promise<Category[]> {
  const rows = await db.getAllAsync<CategoryRow>(
    `SELECT * FROM categories
     WHERE ? OR is_archived = 0
     ORDER BY type, sort_order, name`,
    includeArchived ? 1 : 0,
  );
  return rows.map(toCategory);
}

export async function createCategory(
  db: SQLiteDatabase,
  input: { name: string; type: CategoryType; parentId: string | null },
): Promise<string> {
  const id = newId();
  const max = await db.getFirstAsync<{ next: number }>(
    'SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM categories',
  );
  await db.runAsync(
    `INSERT INTO categories (id, name, type, parent_id, sort_order)
     VALUES (?, ?, ?, ?, ?)`,
    id,
    input.name.trim(),
    input.type,
    input.parentId,
    max?.next ?? 0,
  );
  return id;
}

export async function renameCategory(
  db: SQLiteDatabase,
  id: string,
  name: string,
): Promise<void> {
  await db.runAsync(
    'UPDATE categories SET name = ? WHERE id = ?',
    name.trim(),
    id,
  );
}

/** Archiving hides a category from pickers but keeps past transactions intact. */
export async function setCategoryArchived(
  db: SQLiteDatabase,
  id: string,
  archived: boolean,
): Promise<void> {
  await db.runAsync(
    'UPDATE categories SET is_archived = ? WHERE id = ? OR parent_id = ?',
    archived ? 1 : 0,
    id,
    id,
  );
}
