import type { SQLiteDatabase } from 'expo-sqlite';

import { DEFAULT_CATEGORIES, FRIENDS_CATEGORY } from '../../domain/categories/defaults';
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
  async db => {
    await db.execAsync(`
      ALTER TABLE transactions ADD COLUMN source TEXT NOT NULL DEFAULT 'manual';
      ALTER TABLE transactions ADD COLUMN external_reference TEXT;

      CREATE TABLE upi_candidates (
        id TEXT PRIMARY KEY NOT NULL,
        package_name TEXT NOT NULL,
        source_app TEXT NOT NULL,
        status TEXT NOT NULL,
        direction TEXT,
        amount_minor INTEGER,
        counterparty TEXT,
        reference TEXT,
        detected_at TEXT NOT NULL,
        dedupe_key TEXT NOT NULL UNIQUE,
        review_state TEXT NOT NULL,
        transaction_id TEXT REFERENCES transactions (id) ON DELETE SET NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX idx_upi_candidates_review ON upi_candidates (review_state, detected_at);
    `);
  },
  async db => {
    const now = nowIso();
    await db.execAsync(`
      ALTER TABLE accounts ADD COLUMN updated_at TEXT NOT NULL DEFAULT '';
      ALTER TABLE categories ADD COLUMN created_at TEXT NOT NULL DEFAULT '';
      ALTER TABLE categories ADD COLUMN updated_at TEXT NOT NULL DEFAULT '';

      CREATE TABLE budgets (
        id TEXT PRIMARY KEY NOT NULL,
        category_id TEXT NOT NULL UNIQUE REFERENCES categories (id),
        amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE settings (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      );

      CREATE TABLE sync_meta (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        applying_remote INTEGER NOT NULL DEFAULT 0,
        user_id TEXT,
        last_synced_at TEXT
      );
      INSERT INTO sync_meta (id) VALUES (1);

      CREATE TABLE sync_cursors (
        table_name TEXT PRIMARY KEY NOT NULL,
        pulled_until TEXT NOT NULL
      );

      CREATE TABLE sync_outbox (
        table_name TEXT NOT NULL,
        row_id TEXT NOT NULL,
        changed_at TEXT NOT NULL,
        PRIMARY KEY (table_name, row_id)
      );
    `);
    await db.runAsync('UPDATE accounts SET updated_at = created_at');
    await db.runAsync('UPDATE categories SET created_at = ?, updated_at = ?', now, now);
    for (const table of SYNCED_TABLES) {
      await db.execAsync(outboxTriggers(table));
    }
  },
  async db => {
    // New installs already got these from DEFAULT_CATEGORIES in the first migration.
    const now = nowIso();
    for (const type of ['expense', 'income'] as const) {
      await db.runAsync(
        `INSERT INTO categories (id, name, type, sort_order, created_at, updated_at)
         SELECT ?, ?, ?, next_order, ?, ?
         FROM (SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_order FROM categories)
         WHERE NOT EXISTS (
           SELECT 1 FROM categories WHERE type = ? AND LOWER(name) = LOWER(?) AND parent_id IS NULL
         )`,
        newId(),
        FRIENDS_CATEGORY,
        type,
        now,
        now,
        type,
        FRIENDS_CATEGORY,
      );
    }
  },
];

/** Tables mirrored to the cloud when the user is signed in. */
export const SYNCED_TABLES = ['accounts', 'categories', 'transactions', 'budgets'] as const;
export type SyncedTable = (typeof SYNCED_TABLES)[number];

/**
 * Records every local change in `sync_outbox`, except changes written by the
 * sync engine itself while applying remote data.
 */
function outboxTriggers(table: SyncedTable): string {
  const guard = 'WHEN (SELECT applying_remote FROM sync_meta WHERE id = 1) = 0';
  const record = (row: 'NEW' | 'OLD') =>
    `INSERT OR REPLACE INTO sync_outbox (table_name, row_id, changed_at)
     VALUES ('${table}', ${row}.id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));`;
  return `
    CREATE TRIGGER ${table}_outbox_insert AFTER INSERT ON ${table} ${guard}
    BEGIN ${record('NEW')} END;
    CREATE TRIGGER ${table}_outbox_update AFTER UPDATE ON ${table} ${guard}
    BEGIN ${record('NEW')} END;
    CREATE TRIGGER ${table}_outbox_delete AFTER DELETE ON ${table} ${guard}
    BEGIN ${record('OLD')} END;
  `;
}

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
