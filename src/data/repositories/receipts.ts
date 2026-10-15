import type { SQLiteDatabase } from 'expo-sqlite';

import { nowIso } from '../local/ids';

/** Receipt photos stay on this device: the table is not synced. */
export async function getReceiptUri(db: SQLiteDatabase, transactionId: string): Promise<string | null> {
  const row = await db.getFirstAsync<{ uri: string }>('SELECT uri FROM receipts WHERE transaction_id = ?', transactionId);
  return row?.uri ?? null;
}

export async function setReceiptUri(db: SQLiteDatabase, transactionId: string, uri: string | null): Promise<void> {
  if (uri === null) {
    await db.runAsync('DELETE FROM receipts WHERE transaction_id = ?', transactionId);
    return;
  }
  await db.runAsync(
    `INSERT INTO receipts (transaction_id, uri, created_at) VALUES (?, ?, ?)
     ON CONFLICT (transaction_id) DO UPDATE SET uri = excluded.uri`,
    transactionId,
    uri,
    nowIso(),
  );
}

export async function listReceiptUris(db: SQLiteDatabase): Promise<string[]> {
  const rows = await db.getAllAsync<{ uri: string }>('SELECT uri FROM receipts');
  return rows.map(row => row.uri);
}
