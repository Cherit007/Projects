import type { SQLiteDatabase } from 'expo-sqlite';

import type { CategorisedPayee } from '../../domain/categories/payeeHistory';
import type { MinorUnits } from '../../domain/money/money';
import type { DateRange } from '../../domain/period';
import type {
  Transaction,
  TransactionInput,
  TransactionType,
} from '../../domain/types';
import { newId, nowIso } from '../local/ids';

interface TransactionRow {
  id: string;
  type: TransactionType;
  amount_minor: number;
  currency: string;
  occurred_at: string;
  account_id: string;
  to_account_id: string | null;
  category_id: string | null;
  counterparty: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
}

interface TransactionListRow extends TransactionRow {
  source: TransactionSource;
  account_name: string;
  to_account_name: string | null;
  category_name: string | null;
}

export interface TransactionListItem extends Transaction {
  source: TransactionSource;
  accountName: string;
  toAccountName: string | null;
  categoryName: string | null;
}

function toTransaction(row: TransactionRow): Transaction {
  return {
    id: row.id,
    type: row.type,
    amountMinor: row.amount_minor,
    currency: row.currency,
    occurredAt: row.occurred_at,
    accountId: row.account_id,
    toAccountId: row.to_account_id,
    categoryId: row.category_id,
    counterparty: row.counterparty,
    note: row.note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface TransactionFilter {
  range?: DateRange;
  type?: TransactionType;
  accountId?: string;
  categoryId?: string;
  /** Exact payee, ignoring case and surrounding spaces. */
  counterparty?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export async function listTransactions(
  db: SQLiteDatabase,
  filter: TransactionFilter = {},
): Promise<TransactionListItem[]> {
  const where: string[] = [];
  const params: (string | number)[] = [];
  if (filter.range) {
    where.push('t.occurred_at >= ? AND t.occurred_at < ?');
    params.push(filter.range.startIso, filter.range.endIso);
  }
  if (filter.type) {
    where.push('t.type = ?');
    params.push(filter.type);
  }
  if (filter.accountId) {
    where.push('(t.account_id = ? OR t.to_account_id = ?)');
    params.push(filter.accountId, filter.accountId);
  }
  if (filter.categoryId) {
    where.push('(t.category_id = ? OR c.parent_id = ?)');
    params.push(filter.categoryId, filter.categoryId);
  }
  if (filter.counterparty) {
    where.push('LOWER(TRIM(t.counterparty)) = LOWER(TRIM(?))');
    params.push(filter.counterparty);
  }
  const search = filter.search?.trim();
  if (search) {
    where.push(
      "(t.counterparty LIKE ? ESCAPE '\\' OR t.note LIKE ? ESCAPE '\\' OR c.name LIKE ? ESCAPE '\\')",
    );
    const pattern = `%${search.replace(/[\\%_]/g, m => `\\${m}`)}%`;
    params.push(pattern, pattern, pattern);
  }
  params.push(filter.limit ?? 200, filter.offset ?? 0);

  const rows = await db.getAllAsync<TransactionListRow>(
    `SELECT t.*, a.name AS account_name, ta.name AS to_account_name,
            c.name AS category_name
     FROM transactions t
     JOIN accounts a ON a.id = t.account_id
     LEFT JOIN accounts ta ON ta.id = t.to_account_id
     LEFT JOIN categories c ON c.id = t.category_id
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY t.occurred_at DESC, t.created_at DESC
     LIMIT ? OFFSET ?`,
    params,
  );
  return rows.map(row => ({
    ...toTransaction(row),
    source: row.source,
    accountName: row.account_name,
    toAccountName: row.to_account_name,
    categoryName: row.category_name,
  }));
}

export async function getTransaction(
  db: SQLiteDatabase,
  id: string,
): Promise<Transaction | null> {
  const row = await db.getFirstAsync<TransactionRow>(
    'SELECT * FROM transactions WHERE id = ?',
    id,
  );
  return row ? toTransaction(row) : null;
}

function normalize(input: TransactionInput) {
  const isTransfer = input.type === 'transfer';
  return {
    toAccountId: isTransfer ? input.toAccountId : null,
    categoryId: isTransfer ? null : input.categoryId,
    counterparty: input.counterparty?.trim() || null,
    note: input.note?.trim() || null,
  };
}

export type TransactionSource = 'manual' | 'upi_notification' | 'bank_sms';

export async function createTransaction(
  db: SQLiteDatabase,
  input: TransactionInput,
  meta: { source: TransactionSource; externalReference: string | null } = {
    source: 'manual',
    externalReference: null,
  },
): Promise<string> {
  const id = newId();
  const now = nowIso();
  const n = normalize(input);
  await db.runAsync(
    `INSERT INTO transactions
       (id, type, amount_minor, occurred_at, account_id, to_account_id,
        category_id, counterparty, note, source, external_reference,
        created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    input.type,
    input.amountMinor,
    input.occurredAt,
    input.accountId,
    n.toAccountId,
    n.categoryId,
    n.counterparty,
    n.note,
    meta.source,
    meta.externalReference,
    now,
    now,
  );
  return id;
}

/** Category used the last time this payee appeared, for quick categorisation. */
export async function suggestCategory(
  db: SQLiteDatabase,
  counterparty: string,
  type: 'income' | 'expense',
): Promise<string | null> {
  return (await lastCategory(db, counterparty, type))?.categoryId ?? null;
}

/** The payee's last category, and whether the user edited that transaction after it was added. */
export async function lastCategory(
  db: SQLiteDatabase,
  counterparty: string,
  type: 'income' | 'expense',
): Promise<{ categoryId: string; edited: boolean } | null> {
  const row = await db.getFirstAsync<{ category_id: string; edited: number }>(
    `SELECT t.category_id, t.updated_at != t.created_at AS edited FROM transactions t
     JOIN categories c ON c.id = t.category_id AND c.is_archived = 0
     WHERE t.type = ? AND LOWER(TRIM(t.counterparty)) = LOWER(TRIM(?))
     ORDER BY t.occurred_at DESC
     LIMIT 1`,
    type,
    counterparty,
  );
  return row ? { categoryId: row.category_id, edited: row.edited === 1 } : null;
}

/** Every distinct payee with the categories it has been given, for learning from the user's choices. */
export async function listCategorisedPayees(db: SQLiteDatabase): Promise<CategorisedPayee[]> {
  return db.getAllAsync<CategorisedPayee>(
    `SELECT DISTINCT LOWER(TRIM(t.counterparty)) AS payee, t.type, t.category_id AS categoryId
     FROM transactions t
     JOIN categories c ON c.id = t.category_id AND c.is_archived = 0
     WHERE t.counterparty IS NOT NULL AND t.type != 'transfer'`,
  );
}

/**
 * Whether the payee got about the same amount (±5%) 25–35 days before
 * `occurredAt`, as with monthly rent.
 */
export async function hasMonthlyRepeat(
  db: SQLiteDatabase,
  counterparty: string,
  type: 'income' | 'expense',
  amountMinor: MinorUnits,
  occurredAt: string,
): Promise<boolean> {
  const at = Date.parse(occurredAt);
  const day = 24 * 60 * 60 * 1000;
  const row = await db.getFirstAsync<{ id: string }>(
    `SELECT id FROM transactions
     WHERE type = ? AND LOWER(TRIM(counterparty)) = LOWER(TRIM(?))
       AND amount_minor BETWEEN ? AND ?
       AND occurred_at BETWEEN ? AND ?
     LIMIT 1`,
    type,
    counterparty,
    Math.floor(amountMinor * 0.95),
    Math.ceil(amountMinor * 1.05),
    new Date(at - 35 * day).toISOString(),
    new Date(at - 25 * day).toISOString(),
  );
  return row !== null;
}

export async function updateTransaction(
  db: SQLiteDatabase,
  id: string,
  input: TransactionInput,
): Promise<void> {
  const n = normalize(input);
  await db.runAsync(
    `UPDATE transactions
     SET type = ?, amount_minor = ?, occurred_at = ?, account_id = ?,
         to_account_id = ?, category_id = ?, counterparty = ?, note = ?,
         updated_at = ?
     WHERE id = ?`,
    input.type,
    input.amountMinor,
    input.occurredAt,
    input.accountId,
    n.toAccountId,
    n.categoryId,
    n.counterparty,
    n.note,
    nowIso(),
    id,
  );
}

/**
 * A deleted transaction that came from a detected payment sends the payment
 * back to the review list instead of leaving it marked as added.
 */
export async function deleteTransaction(
  db: SQLiteDatabase,
  id: string,
): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE upi_candidates
       SET review_state = 'needs_review', transaction_id = NULL, updated_at = ?
       WHERE transaction_id = ?`,
      nowIso(),
      id,
    );
    await db.runAsync('DELETE FROM transactions WHERE id = ?', id);
  });
}
