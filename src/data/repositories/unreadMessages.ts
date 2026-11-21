import type { SQLiteDatabase } from 'expo-sqlite';

import { AMOUNT } from '../../domain/upi/parser';
import { parseToMinor } from '../../domain/money/money';
import { newId } from '../local/ids';

/** Unread bank alerts are deleted after this long. */
export const UNREAD_KEEP_DAYS = 7;

export interface UnreadMessage {
  id: string;
  text: string;
  receivedAt: string;
  /** The first amount in the text, to start a transaction with. */
  amountMinor: number | null;
}

/**
 * Keeps a bank alert the parser could not read. Only text that already passed
 * the capture filter (a transaction word and an amount, no codes) gets here,
 * so personal messages never do.
 */
export async function saveUnreadMessage(db: SQLiteDatabase, text: string, receivedAt: number): Promise<void> {
  await db.runAsync(
    'INSERT INTO unread_messages (id, text, received_at) VALUES (?, ?, ?)',
    newId(),
    text,
    new Date(receivedAt).toISOString(),
  );
}

export async function purgeUnreadMessages(db: SQLiteDatabase, now = new Date()): Promise<void> {
  await db.runAsync(
    'DELETE FROM unread_messages WHERE received_at < ?',
    new Date(now.getTime() - UNREAD_KEEP_DAYS * 24 * 60 * 60 * 1000).toISOString(),
  );
}

export async function listUnreadMessages(db: SQLiteDatabase): Promise<UnreadMessage[]> {
  const rows = await db.getAllAsync<{ id: string; text: string; received_at: string }>(
    'SELECT id, text, received_at FROM unread_messages ORDER BY received_at DESC',
  );
  return rows.map(row => {
    const amount = AMOUNT.exec(row.text)?.[1];
    return {
      id: row.id,
      text: row.text,
      receivedAt: row.received_at,
      amountMinor: amount ? parseToMinor(amount) : null,
    };
  });
}

export async function countUnreadMessages(db: SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM unread_messages');
  return row?.count ?? 0;
}

export async function deleteUnreadMessage(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync('DELETE FROM unread_messages WHERE id = ?', id);
}
