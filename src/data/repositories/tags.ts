import type { SQLiteDatabase } from 'expo-sqlite';

import { newId, nowIso } from '../local/ids';

export interface Tag {
  id: string;
  name: string;
  createdAt: string;
}

function tidy(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

export async function listTags(db: SQLiteDatabase): Promise<Tag[]> {
  const rows = await db.getAllAsync<{ id: string; name: string; created_at: string }>(
    'SELECT id, name, created_at FROM tags ORDER BY name COLLATE NOCASE',
  );
  return rows.map(r => ({ id: r.id, name: r.name, createdAt: r.created_at }));
}

/** Finds or creates a tag by name. */
export async function ensureTag(db: SQLiteDatabase, name: string): Promise<Tag | null> {
  const cleaned = tidy(name);
  if (!cleaned) {
    return null;
  }
  const existing = await db.getFirstAsync<{ id: string; name: string; created_at: string }>(
    'SELECT id, name, created_at FROM tags WHERE name = ? COLLATE NOCASE',
    cleaned,
  );
  if (existing) {
    return { id: existing.id, name: existing.name, createdAt: existing.created_at };
  }
  const id = newId();
  const createdAt = nowIso();
  await db.runAsync('INSERT INTO tags (id, name, created_at) VALUES (?, ?, ?)', id, cleaned, createdAt);
  return { id, name: cleaned, createdAt };
}

export async function listTagsForTransaction(db: SQLiteDatabase, transactionId: string): Promise<Tag[]> {
  const rows = await db.getAllAsync<{ id: string; name: string; created_at: string }>(
    `SELECT t.id, t.name, t.created_at FROM tags t
     JOIN transaction_tags tt ON tt.tag_id = t.id
     WHERE tt.transaction_id = ?
     ORDER BY t.name COLLATE NOCASE`,
    transactionId,
  );
  return rows.map(r => ({ id: r.id, name: r.name, createdAt: r.created_at }));
}

export async function setTransactionTags(
  db: SQLiteDatabase,
  transactionId: string,
  tagNames: readonly string[],
): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM transaction_tags WHERE transaction_id = ?', transactionId);
    for (const name of tagNames) {
      const tag = await ensureTag(db, name);
      if (tag) {
        await db.runAsync(
          'INSERT OR IGNORE INTO transaction_tags (transaction_id, tag_id) VALUES (?, ?)',
          transactionId,
          tag.id,
        );
      }
    }
  });
}
