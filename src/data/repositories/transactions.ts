import type { SQLiteDatabase } from 'expo-sqlite';

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
  account_name: string;
  to_account_name: string | null;
  category_name: string | null;
}

export interface TransactionListItem extends Transaction {
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

export async function createTransaction(
  db: SQLiteDatabase,
  input: TransactionInput,
): Promise<string> {
  const id = newId();
  const now = nowIso();
  const n = normalize(input);
  await db.runAsync(
    `INSERT INTO transactions
       (id, type, amount_minor, occurred_at, account_id, to_account_id,
        category_id, counterparty, note, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    input.type,
    input.amountMinor,
    input.occurredAt,
    input.accountId,
    n.toAccountId,
    n.categoryId,
    n.counterparty,
    n.note,
    now,
    now,
  );
  return id;
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

export async function deleteTransaction(
  db: SQLiteDatabase,
  id: string,
): Promise<void> {
  await db.runAsync('DELETE FROM transactions WHERE id = ?', id);
}
