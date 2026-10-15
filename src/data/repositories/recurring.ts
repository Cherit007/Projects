import type { SQLiteDatabase } from 'expo-sqlite';

import { dueOccurrences, occurrenceAt, type Frequency } from '../../domain/recurring';
import type { TransactionInput, TransactionType } from '../../domain/types';
import { newId, nowIso } from '../local/ids';
import { createTransaction } from './transactions';

interface RuleRow {
  id: string;
  type: TransactionType;
  amount_minor: number;
  account_id: string;
  to_account_id: string | null;
  category_id: string | null;
  counterparty: string | null;
  note: string | null;
  frequency: Frequency;
  start_at: string;
  occurrences: number;
}

export interface RecurringRule {
  id: string;
  input: Omit<TransactionInput, 'occurredAt'>;
  frequency: Frequency;
  startAt: string;
  /** Repeats already created, the first one included. */
  occurrences: number;
  nextAt: string;
  accountName: string;
  toAccountName: string | null;
  categoryName: string | null;
}

function toInput(row: RuleRow): Omit<TransactionInput, 'occurredAt'> {
  return {
    type: row.type,
    amountMinor: row.amount_minor,
    accountId: row.account_id,
    toAccountId: row.to_account_id,
    categoryId: row.category_id,
    counterparty: row.counterparty,
    note: row.note,
  };
}

export async function listRecurringRules(db: SQLiteDatabase): Promise<RecurringRule[]> {
  const rows = await db.getAllAsync<
    RuleRow & { account_name: string; to_account_name: string | null; category_name: string | null }
  >(
    `SELECT r.*, a.name AS account_name, ta.name AS to_account_name, c.name AS category_name
     FROM recurring_rules r
     JOIN accounts a ON a.id = r.account_id
     LEFT JOIN accounts ta ON ta.id = r.to_account_id
     LEFT JOIN categories c ON c.id = r.category_id`,
  );
  return rows
    .map(row => ({
      id: row.id,
      input: toInput(row),
      frequency: row.frequency,
      startAt: row.start_at,
      occurrences: row.occurrences,
      nextAt: occurrenceAt(row.start_at, row.frequency, row.occurrences),
      accountName: row.account_name,
      toAccountName: row.to_account_name,
      categoryName: row.category_name,
    }))
    .sort((a, b) => a.nextAt.localeCompare(b.nextAt));
}

/**
 * Repeats `input` from its date on. The transaction for that first date is
 * created by the caller, so the rule starts with one occurrence.
 */
export async function createRecurringRule(
  db: SQLiteDatabase,
  input: TransactionInput,
  frequency: Frequency,
): Promise<string> {
  const id = newId();
  const now = nowIso();
  const isTransfer = input.type === 'transfer';
  await db.runAsync(
    `INSERT INTO recurring_rules
       (id, type, amount_minor, account_id, to_account_id, category_id, counterparty, note,
        frequency, start_at, occurrences, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    id,
    input.type,
    input.amountMinor,
    input.accountId,
    isTransfer ? input.toAccountId : null,
    isTransfer ? null : input.categoryId,
    input.counterparty?.trim() || null,
    input.note?.trim() || null,
    frequency,
    input.occurredAt,
    now,
    now,
  );
  return id;
}

export async function deleteRecurringRule(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync('DELETE FROM recurring_rules WHERE id = ?', id);
}

/** Creates every repeat that is due by `now`. Returns how many transactions were added. */
export async function runDueRecurring(db: SQLiteDatabase, now = new Date()): Promise<number> {
  const rows = await db.getAllAsync<RuleRow>('SELECT * FROM recurring_rules');
  let added = 0;
  for (const row of rows) {
    const due = dueOccurrences(row.start_at, row.frequency, row.occurrences, now);
    if (due.length === 0) {
      continue;
    }
    await db.withTransactionAsync(async () => {
      for (const occurredAt of due) {
        await createTransaction(db, { ...toInput(row), occurredAt }, { source: 'recurring', externalReference: null });
      }
      await db.runAsync(
        'UPDATE recurring_rules SET occurrences = ?, updated_at = ? WHERE id = ?',
        row.occurrences + due.length,
        nowIso(),
        row.id,
      );
    });
    added += due.length;
  }
  return added;
}
