import type { SQLiteDatabase } from 'expo-sqlite';

import { isValidCycleDay } from '../../domain/cards/billing';
import { nowIso } from '../local/ids';

/** A credit card's billing cycle and limit. Stored on this device only. */
export interface CardDetails {
  accountId: string;
  statementDay: number;
  dueDay: number;
  creditLimitMinor: number | null;
}

interface CardDetailsRow {
  account_id: string;
  statement_day: number;
  due_day: number;
  credit_limit_minor: number | null;
}

function toDetails(row: CardDetailsRow): CardDetails {
  return {
    accountId: row.account_id,
    statementDay: row.statement_day,
    dueDay: row.due_day,
    creditLimitMinor: row.credit_limit_minor,
  };
}

export async function getCardDetails(db: SQLiteDatabase, accountId: string): Promise<CardDetails | null> {
  const row = await db.getFirstAsync<CardDetailsRow>('SELECT * FROM card_details WHERE account_id = ?', accountId);
  return row ? toDetails(row) : null;
}

export async function listCardDetails(db: SQLiteDatabase): Promise<Map<string, CardDetails>> {
  const rows = await db.getAllAsync<CardDetailsRow>('SELECT * FROM card_details');
  return new Map(rows.map(row => [row.account_id, toDetails(row)]));
}

export async function saveCardDetails(db: SQLiteDatabase, details: CardDetails): Promise<void> {
  if (!isValidCycleDay(details.statementDay) || !isValidCycleDay(details.dueDay)) {
    throw new Error('Statement and due days must be between 1 and 31.');
  }
  if (details.creditLimitMinor !== null && !(details.creditLimitMinor > 0)) {
    throw new Error('The credit limit must be greater than zero.');
  }
  const now = nowIso();
  await db.runAsync(
    `INSERT INTO card_details (account_id, statement_day, due_day, credit_limit_minor, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (account_id) DO UPDATE SET
       statement_day = excluded.statement_day,
       due_day = excluded.due_day,
       credit_limit_minor = excluded.credit_limit_minor,
       updated_at = excluded.updated_at`,
    details.accountId,
    details.statementDay,
    details.dueDay,
    details.creditLimitMinor,
    now,
    now,
  );
}

export async function deleteCardDetails(db: SQLiteDatabase, accountId: string): Promise<void> {
  await db.runAsync('DELETE FROM card_details WHERE account_id = ?', accountId);
}
