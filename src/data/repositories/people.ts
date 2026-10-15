import type { SQLiteDatabase } from 'expo-sqlite';

import { FAMILY_CATEGORY, FRIENDS_CATEGORY } from '../../domain/categories/defaults';
import type { MinorUnits } from '../../domain/money/money';
import { nowIso } from '../local/ids';

export interface PersonSummary {
  name: string;
  sentMinor: MinorUnits;
  receivedMinor: MinorUnits;
  count: number;
  lastAt: string;
  /** Their latest Friends or Family transaction is in Family. */
  family: boolean;
}

/**
 * Everyone with at least one transaction in a Friends or Family category,
 * with totals across all of their transactions (whatever the category),
 * most recent first.
 */
export async function listPeople(db: SQLiteDatabase): Promise<PersonSummary[]> {
  const rows = await db.getAllAsync<Omit<PersonSummary, 'family'> & { family: number }>(
    `WITH shared AS (
       SELECT LOWER(TRIM(f.counterparty)) AS person, c.name AS category,
              ROW_NUMBER() OVER (PARTITION BY LOWER(TRIM(f.counterparty)) ORDER BY f.occurred_at DESC) AS latest
       FROM transactions f
       JOIN categories c ON c.id = f.category_id
       WHERE c.name IN (?, ?) AND f.counterparty IS NOT NULL
     )
     SELECT MAX(t.counterparty) AS name,
            SUM(CASE WHEN t.type = 'expense' THEN t.amount_minor ELSE 0 END) AS sentMinor,
            SUM(CASE WHEN t.type = 'income' THEN t.amount_minor ELSE 0 END) AS receivedMinor,
            COUNT(*) AS count,
            MAX(t.occurred_at) AS lastAt,
            MAX(s.category = ?) AS family
     FROM transactions t
     JOIN shared s ON s.person = LOWER(TRIM(t.counterparty)) AND s.latest = 1
     WHERE t.type != 'transfer'
     GROUP BY LOWER(TRIM(t.counterparty))
     ORDER BY lastAt DESC`,
    FRIENDS_CATEGORY,
    FAMILY_CATEGORY,
    FAMILY_CATEGORY,
  );
  return rows.map(row => ({ ...row, family: row.family === 1 }));
}

/**
 * Moves a person's Friends transactions to Family or back. Later payments
 * follow, because a payee's last category is reused.
 */
export async function movePerson(db: SQLiteDatabase, name: string, to: 'friends' | 'family'): Promise<void> {
  const [from, target] = to === 'family' ? [FRIENDS_CATEGORY, FAMILY_CATEGORY] : [FAMILY_CATEGORY, FRIENDS_CATEGORY];
  await db.runAsync(
    `UPDATE transactions
     SET category_id = (
           SELECT id FROM categories
           WHERE name = ? AND type = transactions.type AND parent_id IS NULL AND is_archived = 0
           ORDER BY sort_order LIMIT 1
         ),
         updated_at = ?
     WHERE LOWER(TRIM(counterparty)) = LOWER(TRIM(?))
       AND category_id IN (SELECT id FROM categories WHERE name = ?)
       AND EXISTS (
         SELECT 1 FROM categories
         WHERE name = ? AND type = transactions.type AND parent_id IS NULL AND is_archived = 0
       )`,
    target,
    nowIso(),
    name,
    from,
    target,
  );
}
