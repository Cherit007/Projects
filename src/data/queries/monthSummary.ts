import type { SQLiteDatabase } from 'expo-sqlite';

import { summarize, type PeriodSummary } from '../../domain/accounting/accounting';
import { monthRange, type MonthKey } from '../../domain/period';
import { listTransactions, type TransactionListItem } from '../repositories/transactions';

export interface MonthData {
  transactions: TransactionListItem[];
  summary: PeriodSummary;
}

/**
 * Loads every transaction in a month and its totals. The dashboard and the
 * transaction list both use this, so they always show the same numbers.
 */
export async function loadMonth(db: SQLiteDatabase, month: MonthKey): Promise<MonthData> {
  const transactions = await listTransactions(db, { range: monthRange(month), limit: -1 });
  return { transactions, summary: summarize(transactions) };
}
