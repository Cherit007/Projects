import type { SQLiteDatabase } from 'expo-sqlite';

import type { AccountFlow } from '../../domain/accounting/accounting';
import type { Account, AccountType } from '../../domain/types';
import { newId, nowIso } from '../local/ids';

interface AccountRow {
  id: string;
  name: string;
  type: AccountType;
  opening_balance_minor: number;
  currency: string;
  is_archived: number;
  created_at: string;
}

function toAccount(row: AccountRow): Account {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    openingBalanceMinor: row.opening_balance_minor,
    currency: row.currency,
    isArchived: row.is_archived === 1,
    createdAt: row.created_at,
  };
}

export interface AccountInput {
  name: string;
  type: AccountType;
  openingBalanceMinor: number;
}

export async function listAccounts(
  db: SQLiteDatabase,
  { includeArchived = false } = {},
): Promise<Account[]> {
  const rows = await db.getAllAsync<AccountRow>(
    `SELECT * FROM accounts
     WHERE ? OR is_archived = 0
     ORDER BY is_archived, created_at`,
    includeArchived ? 1 : 0,
  );
  return rows.map(toAccount);
}

export async function getAccount(
  db: SQLiteDatabase,
  id: string,
): Promise<Account | null> {
  const row = await db.getFirstAsync<AccountRow>(
    'SELECT * FROM accounts WHERE id = ?',
    id,
  );
  return row ? toAccount(row) : null;
}

export async function createAccount(
  db: SQLiteDatabase,
  input: AccountInput,
): Promise<string> {
  const id = newId();
  const now = nowIso();
  await db.runAsync(
    `INSERT INTO accounts (id, name, type, opening_balance_minor, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    id,
    input.name.trim(),
    input.type,
    input.openingBalanceMinor,
    now,
    now,
  );
  return id;
}

export async function updateAccount(
  db: SQLiteDatabase,
  id: string,
  input: AccountInput,
): Promise<void> {
  await db.runAsync(
    `UPDATE accounts SET name = ?, type = ?, opening_balance_minor = ?, updated_at = ?
     WHERE id = ?`,
    input.name.trim(),
    input.type,
    input.openingBalanceMinor,
    nowIso(),
    id,
  );
}

export async function setAccountArchived(
  db: SQLiteDatabase,
  id: string,
  archived: boolean,
): Promise<void> {
  await db.runAsync(
    'UPDATE accounts SET is_archived = ?, updated_at = ? WHERE id = ?',
    archived ? 1 : 0,
    nowIso(),
    id,
  );
}

/** Per-account totals, aggregated in SQL: lifetime, or only before `beforeIso` (exclusive). */
export async function getAccountFlows(
  db: SQLiteDatabase,
  beforeIso?: string,
): Promise<Map<string, AccountFlow>> {
  const cutoff = beforeIso ? 'WHERE occurred_at < ?' : '';
  const rows = await db.getAllAsync<{
    account_id: string;
    income: number;
    expense: number;
    transfers_in: number;
    transfers_out: number;
  }>(`
    SELECT account_id,
           SUM(CASE WHEN kind = 'income' THEN amount ELSE 0 END) AS income,
           SUM(CASE WHEN kind = 'expense' THEN amount ELSE 0 END) AS expense,
           SUM(CASE WHEN kind = 'in' THEN amount ELSE 0 END) AS transfers_in,
           SUM(CASE WHEN kind = 'out' THEN amount ELSE 0 END) AS transfers_out
    FROM (
      SELECT account_id,
             CASE type WHEN 'transfer' THEN 'out' ELSE type END AS kind,
             amount_minor AS amount
      FROM transactions
      ${cutoff}
      UNION ALL
      SELECT to_account_id, 'in', amount_minor
      FROM transactions
      WHERE type = 'transfer' AND to_account_id IS NOT NULL ${beforeIso ? 'AND occurred_at < ?' : ''}
    )
    GROUP BY account_id
  `, beforeIso ? [beforeIso, beforeIso] : []);
  return new Map(
    rows.map(row => [
      row.account_id,
      {
        accountId: row.account_id,
        incomeMinor: row.income,
        expenseMinor: row.expense,
        transfersInMinor: row.transfers_in,
        transfersOutMinor: row.transfers_out,
      },
    ]),
  );
}
