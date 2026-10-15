import type { SQLiteDatabase } from 'expo-sqlite';

import { FRIENDS_CATEGORY } from '../../domain/categories/defaults';
import type { MinorUnits } from '../../domain/money/money';

export interface PersonSummary {
  name: string;
  sentMinor: MinorUnits;
  receivedMinor: MinorUnits;
  count: number;
  lastAt: string;
}

/**
 * Everyone with at least one transaction in a Friends category, with totals
 * across all of their transactions (whatever the category), most recent first.
 */
export async function listPeople(db: SQLiteDatabase): Promise<PersonSummary[]> {
  return db.getAllAsync<PersonSummary>(
    `SELECT MAX(t.counterparty) AS name,
            SUM(CASE WHEN t.type = 'expense' THEN t.amount_minor ELSE 0 END) AS sentMinor,
            SUM(CASE WHEN t.type = 'income' THEN t.amount_minor ELSE 0 END) AS receivedMinor,
            COUNT(*) AS count,
            MAX(t.occurred_at) AS lastAt
     FROM transactions t
     WHERE t.counterparty IS NOT NULL AND t.type != 'transfer'
       AND LOWER(TRIM(t.counterparty)) IN (
         SELECT LOWER(TRIM(f.counterparty)) FROM transactions f
         JOIN categories c ON c.id = f.category_id
         WHERE c.name = ? AND f.counterparty IS NOT NULL
       )
     GROUP BY LOWER(TRIM(t.counterparty))
     ORDER BY lastAt DESC`,
    FRIENDS_CATEGORY,
  );
}
