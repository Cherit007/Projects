import type { SQLiteDatabase } from 'expo-sqlite';

import type { Category, CategoryType } from '../../domain/types';
import { newId, nowIso } from '../local/ids';

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
  const now = nowIso();
  await db.runAsync(
    `INSERT INTO categories (id, name, type, parent_id, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    id,
    input.name.trim(),
    input.type,
    input.parentId,
    max?.next ?? 0,
    now,
    now,
  );
  return id;
}

export async function renameCategory(
  db: SQLiteDatabase,
  id: string,
  name: string,
): Promise<void> {
  await db.runAsync(
    'UPDATE categories SET name = ?, updated_at = ? WHERE id = ?',
    name.trim(),
    nowIso(),
    id,
  );
}

/**
 * Moves a category up (-1) or down (+1) among its siblings (same type and
 * parent), which sets the order in lists and pickers. Siblings are
 * renumbered in one transaction; only rows whose position changes are
 * touched, so sync uploads just those.
 */
export async function moveCategory(db: SQLiteDatabase, id: string, delta: -1 | 1): Promise<void> {
  await db.withTransactionAsync(async () => {
    const category = await db.getFirstAsync<CategoryRow>('SELECT * FROM categories WHERE id = ?', id);
    if (!category) {
      return;
    }
    const siblings = await db.getAllAsync<CategoryRow>(
      `SELECT * FROM categories
       WHERE type = ? AND parent_id IS ?
       ORDER BY sort_order, name`,
      category.type,
      category.parent_id,
    );
    const from = siblings.findIndex(s => s.id === id);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= siblings.length) {
      return;
    }
    [siblings[from], siblings[to]] = [siblings[to]!, siblings[from]!];
    const now = nowIso();
    for (const [index, sibling] of siblings.entries()) {
      if (sibling.sort_order !== index) {
        await db.runAsync('UPDATE categories SET sort_order = ?, updated_at = ? WHERE id = ?', index, now, sibling.id);
      }
    }
  });
}

/** Archiving hides a category from pickers but keeps past transactions intact. */
export async function setCategoryArchived(
  db: SQLiteDatabase,
  id: string,
  archived: boolean,
): Promise<void> {
  await db.runAsync(
    'UPDATE categories SET is_archived = ?, updated_at = ? WHERE id = ? OR parent_id = ?',
    archived ? 1 : 0,
    nowIso(),
    id,
    id,
  );
}
