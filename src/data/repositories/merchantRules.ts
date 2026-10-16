import type { SQLiteDatabase } from 'expo-sqlite';

import { newId, nowIso } from '../local/ids';

export interface MerchantRule {
  id: string;
  matchText: string;
  categoryId: string;
  createdAt: string;
  updatedAt: string;
}

function tidy(text: string): string {
  return text.trim().replace(/\s+/g, ' ');
}

export async function listMerchantRules(db: SQLiteDatabase): Promise<MerchantRule[]> {
  const rows = await db.getAllAsync<{
    id: string;
    match_text: string;
    category_id: string;
    created_at: string;
    updated_at: string;
  }>('SELECT * FROM merchant_rules ORDER BY match_text COLLATE NOCASE');
  return rows.map(r => ({
    id: r.id,
    matchText: r.match_text,
    categoryId: r.category_id,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

/**
 * First rule whose match text is contained in the payee (case-insensitive),
 * longest match wins so "swiggy instamart" beats "swiggy".
 */
export async function findMerchantRule(
  db: SQLiteDatabase,
  payee: string | null | undefined,
): Promise<MerchantRule | null> {
  const hay = tidy(payee ?? '').toLowerCase();
  if (!hay) {
    return null;
  }
  const rules = await listMerchantRules(db);
  let best: MerchantRule | null = null;
  for (const rule of rules) {
    const needle = rule.matchText.toLowerCase();
    if (needle && hay.includes(needle) && (!best || needle.length > best.matchText.length)) {
      best = rule;
    }
  }
  return best;
}

export async function upsertMerchantRule(
  db: SQLiteDatabase,
  matchText: string,
  categoryId: string,
): Promise<MerchantRule> {
  const cleaned = tidy(matchText);
  if (!cleaned) {
    throw new Error('Enter a merchant name to match.');
  }
  const now = nowIso();
  const existing = await db.getFirstAsync<{ id: string; created_at: string }>(
    'SELECT id, created_at FROM merchant_rules WHERE match_text = ? COLLATE NOCASE',
    cleaned,
  );
  if (existing) {
    await db.runAsync(
      'UPDATE merchant_rules SET category_id = ?, updated_at = ? WHERE id = ?',
      categoryId,
      now,
      existing.id,
    );
    return {
      id: existing.id,
      matchText: cleaned,
      categoryId,
      createdAt: existing.created_at,
      updatedAt: now,
    };
  }
  const id = newId();
  await db.runAsync(
    'INSERT INTO merchant_rules (id, match_text, category_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    id,
    cleaned,
    categoryId,
    now,
    now,
  );
  return { id, matchText: cleaned, categoryId, createdAt: now, updatedAt: now };
}

export async function deleteMerchantRule(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync('DELETE FROM merchant_rules WHERE id = ?', id);
}
