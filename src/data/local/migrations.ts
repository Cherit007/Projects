import type { SQLiteDatabase } from 'expo-sqlite';

import { DEFAULT_CATEGORIES } from '../../domain/categories/defaults';
import { newId, nowIso } from './ids';

type Migration = (db: SQLiteDatabase) => Promise<void>;

/** Append only. Each entry upgrades the schema by one `user_version`. */
const MIGRATIONS: readonly Migration[] = [
  async db => {
    await db.execAsync(`
      CREATE TABLE accounts (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('cash', 'bank', 'wallet')),
        opening_balance_minor INTEGER NOT NULL DEFAULT 0,
        currency TEXT NOT NULL DEFAULT 'INR',
        is_archived INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      );

      CREATE TABLE categories (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
        parent_id TEXT REFERENCES categories (id),
        sort_order INTEGER NOT NULL DEFAULT 0,
        is_archived INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE transactions (
        id TEXT PRIMARY KEY NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'transfer')),
        amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
        currency TEXT NOT NULL DEFAULT 'INR',
        occurred_at TEXT NOT NULL,
        account_id TEXT NOT NULL REFERENCES accounts (id),
        to_account_id TEXT REFERENCES accounts (id),
        category_id TEXT REFERENCES categories (id),
        counterparty TEXT,
        note TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX idx_transactions_occurred_at ON transactions (occurred_at);
      CREATE INDEX idx_transactions_account ON transactions (account_id, occurred_at);
      CREATE INDEX idx_transactions_to_account ON transactions (to_account_id);
      CREATE INDEX idx_transactions_category ON transactions (category_id, occurred_at);
    `);

    for (const [index, category] of DEFAULT_CATEGORIES.entries()) {
      await db.runAsync(
        'INSERT INTO categories (id, name, type, sort_order) VALUES (?, ?, ?, ?)',
        newId(),
        category.name,
        category.type,
        index,
      );
    }
    await db.runAsync(
      'INSERT INTO accounts (id, name, type, created_at) VALUES (?, ?, ?, ?)',
      newId(),
      'Cash',
      'cash',
      nowIso(),
    );
  },
];

export async function migrateDbIfNeeded(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('PRAGMA foreign_keys = ON');
  const row = await db.getFirstAsync<{ user_version: number }>(
    'PRAGMA user_version',
  );
  let version = row?.user_version ?? 0;
  // Runs inside SQLiteProvider's onInit, before any other query, so a regular
  // transaction cannot interleave with other work.
  while (version < MIGRATIONS.length) {
    const migration = MIGRATIONS[version];
    const next = version + 1;
    await db.withTransactionAsync(async () => {
      await migration(db);
      await db.execAsync(`PRAGMA user_version = ${next}`);
    });
    version = next;
  }
}
