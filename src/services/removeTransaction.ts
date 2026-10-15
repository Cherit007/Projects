import type { SQLiteDatabase } from 'expo-sqlite';

import { getReceiptUri } from '@/data/repositories/receipts';
import { deleteTransaction } from '@/data/repositories/transactions';

import { deleteReceiptPhoto } from './receipts';

/** Deletes a transaction and its receipt photo, which lives outside the database. */
export async function removeTransaction(db: SQLiteDatabase, id: string): Promise<void> {
  const receiptUri = await getReceiptUri(db, id);
  await deleteTransaction(db, id);
  await deleteReceiptPhoto(receiptUri).catch(() => undefined);
}
