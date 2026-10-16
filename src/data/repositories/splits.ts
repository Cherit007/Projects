import type { SQLiteDatabase } from 'expo-sqlite';

import { newId } from '../local/ids';

export interface TransactionSplit {
  id: string;
  transactionId: string;
  categoryId: string;
  amountMinor: number;
  note: string | null;
  sortOrder: number;
  categoryName?: string;
}

export interface SplitInput {
  categoryId: string;
  amountMinor: number;
  note?: string | null;
}

export async function listSplits(db: SQLiteDatabase, transactionId: string): Promise<TransactionSplit[]> {
  const rows = await db.getAllAsync<{
    id: string;
    transaction_id: string;
    category_id: string;
    amount_minor: number;
    note: string | null;
    sort_order: number;
    category_name: string | null;
  }>(
    `SELECT s.*, c.name AS category_name
     FROM transaction_splits s
     LEFT JOIN categories c ON c.id = s.category_id
     WHERE s.transaction_id = ?
     ORDER BY s.sort_order, s.id`,
    transactionId,
  );
  return rows.map(r => ({
    id: r.id,
    transactionId: r.transaction_id,
    categoryId: r.category_id,
    amountMinor: r.amount_minor,
    note: r.note,
    sortOrder: r.sort_order,
    categoryName: r.category_name ?? undefined,
  }));
}

/** Replaces all splits for a transaction. Pass [] to clear. Sum must equal the transaction amount when non-empty. */
export async function setSplits(
  db: SQLiteDatabase,
  transactionId: string,
  splits: readonly SplitInput[],
): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM transaction_splits WHERE transaction_id = ?', transactionId);
    for (const [index, split] of splits.entries()) {
      if (split.amountMinor <= 0) {
        throw new Error('Each split must be greater than zero.');
      }
      await db.runAsync(
        `INSERT INTO transaction_splits (id, transaction_id, category_id, amount_minor, note, sort_order)
         VALUES (?, ?, ?, ?, ?, ?)`,
        newId(),
        transactionId,
        split.categoryId,
        split.amountMinor,
        split.note?.trim() || null,
        index,
      );
    }
  });
}

/** Category spending that respects splits: split lines replace the parent category amount. */
export async function spendingByCategoryWithSplits(
  db: SQLiteDatabase,
  rangeStartIso: string,
  rangeEndIso: string,
): Promise<Map<string, number>> {
  const unsplit = await db.getAllAsync<{ category_id: string; total: number }>(
    `SELECT t.category_id, SUM(t.amount_minor) AS total
     FROM transactions t
     WHERE t.type = 'expense'
       AND t.occurred_at >= ? AND t.occurred_at < ?
       AND t.category_id IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM transaction_splits s WHERE s.transaction_id = t.id)
     GROUP BY t.category_id`,
    rangeStartIso,
    rangeEndIso,
  );
  const split = await db.getAllAsync<{ category_id: string; total: number }>(
    `SELECT s.category_id, SUM(s.amount_minor) AS total
     FROM transaction_splits s
     JOIN transactions t ON t.id = s.transaction_id
     WHERE t.type = 'expense'
       AND t.occurred_at >= ? AND t.occurred_at < ?
     GROUP BY s.category_id`,
    rangeStartIso,
    rangeEndIso,
  );
  const map = new Map<string, number>();
  for (const row of [...unsplit, ...split]) {
    map.set(row.category_id, (map.get(row.category_id) ?? 0) + row.total);
  }
  return map;
}
