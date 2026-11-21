import type { SQLiteDatabase } from 'expo-sqlite';

import { ADDED_CATEGORIES, DEFAULT_CATEGORIES, FRIENDS_CATEGORY } from '../../domain/categories/defaults';
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
    for (const type of ['expense', 'income'] as const) {
      await addCategoryIfMissing(db, FRIENDS_CATEGORY, type);
    }
  },
  async db => {
    await db.execAsync('ALTER TABLE upi_candidates ADD COLUMN payee_kind TEXT');
    for (const { name, type } of ADDED_CATEGORIES) {
      await addCategoryIfMissing(db, name, type);
    }
  },
  async db => {
    // SQLite cannot change a CHECK constraint, so the table is rebuilt to allow credit cards.
    await db.execAsync(`
      CREATE TABLE accounts_new (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('cash', 'bank', 'wallet', 'card')),
        opening_balance_minor INTEGER NOT NULL DEFAULT 0,
        currency TEXT NOT NULL DEFAULT 'INR',
        is_archived INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT ''
      );
      INSERT INTO accounts_new (id, name, type, opening_balance_minor, currency, is_archived, created_at, updated_at)
        SELECT id, name, type, opening_balance_minor, currency, is_archived, created_at, updated_at FROM accounts;
      DROP TABLE accounts;
      ALTER TABLE accounts_new RENAME TO accounts;

      CREATE TABLE recurring_rules (
        id TEXT PRIMARY KEY NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'transfer')),
        amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
        account_id TEXT NOT NULL REFERENCES accounts (id),
        to_account_id TEXT REFERENCES accounts (id),
        category_id TEXT REFERENCES categories (id),
        counterparty TEXT,
        note TEXT,
        frequency TEXT NOT NULL CHECK (frequency IN ('weekly', 'monthly', 'yearly')),
        start_at TEXT NOT NULL,
        occurrences INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE receipts (
        transaction_id TEXT PRIMARY KEY NOT NULL REFERENCES transactions (id) ON DELETE CASCADE,
        uri TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `);
    await db.execAsync(outboxTriggers('accounts'));
  },
  async db => {
    // Insights and planning: local-only (backed up, not synced to Appwrite yet).
    await db.execAsync(`
      CREATE TABLE tags (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL COLLATE NOCASE UNIQUE,
        created_at TEXT NOT NULL
      );

      CREATE TABLE transaction_tags (
        transaction_id TEXT NOT NULL REFERENCES transactions (id) ON DELETE CASCADE,
        tag_id TEXT NOT NULL REFERENCES tags (id) ON DELETE CASCADE,
        PRIMARY KEY (transaction_id, tag_id)
      );

      CREATE TABLE merchant_rules (
        id TEXT PRIMARY KEY NOT NULL,
        match_text TEXT NOT NULL COLLATE NOCASE UNIQUE,
        category_id TEXT NOT NULL REFERENCES categories (id),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE transaction_splits (
        id TEXT PRIMARY KEY NOT NULL,
        transaction_id TEXT NOT NULL REFERENCES transactions (id) ON DELETE CASCADE,
        category_id TEXT NOT NULL REFERENCES categories (id),
        amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
        note TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0
      );

      CREATE INDEX idx_transaction_splits_txn ON transaction_splits (transaction_id);
      CREATE INDEX idx_transaction_tags_tag ON transaction_tags (tag_id);

      CREATE TABLE savings_goals (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        target_minor INTEGER NOT NULL CHECK (target_minor > 0),
        monthly_minor INTEGER NOT NULL CHECK (monthly_minor >= 0),
        saved_minor INTEGER NOT NULL DEFAULT 0 CHECK (saved_minor >= 0),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
  },
  async db => {
    // Credit card billing cycle: local-only (backed up, not synced to Appwrite yet).
    await db.execAsync(`
      CREATE TABLE card_details (
        account_id TEXT PRIMARY KEY NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
        statement_day INTEGER NOT NULL CHECK (statement_day BETWEEN 1 AND 31),
        due_day INTEGER NOT NULL CHECK (due_day BETWEEN 1 AND 31),
        credit_limit_minor INTEGER CHECK (credit_limit_minor IS NULL OR credit_limit_minor > 0),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
  },
  async db => {
    // Which account a bank SMS is about, so it can be filed under the right one.
    await db.execAsync(`
      ALTER TABLE upi_candidates ADD COLUMN is_card INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE upi_candidates ADD COLUMN account_last4 TEXT;
    `);
  },
  async db => {
    // Bank alerts the parser could not read, kept on this device for a week so the user can add them.
    // Never backed up or synced.
    await db.execAsync(`
      CREATE TABLE unread_messages (
        id TEXT PRIMARY KEY NOT NULL,
        text TEXT NOT NULL,
        received_at TEXT NOT NULL
      );
    `);
  },
];

async function addCategoryIfMissing(db: SQLiteDatabase, name: string, type: 'expense' | 'income'): Promise<void> {
  const now = nowIso();
  await db.runAsync(
    `INSERT INTO categories (id, name, type, sort_order, created_at, updated_at)
     SELECT ?, ?, ?, next_order, ?, ?
     FROM (SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_order FROM categories)
     WHERE NOT EXISTS (
       SELECT 1 FROM categories WHERE type = ? AND LOWER(name) = LOWER(?) AND parent_id IS NULL
     )`,
    newId(),
    name,
    type,
    now,
    now,
    type,
    name,
  );
}

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

export const SCHEMA_VERSION = MIGRATIONS.length;

export async function migrateDbIfNeeded(db: SQLiteDatabase, targetVersion = MIGRATIONS.length): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>(
    'PRAGMA user_version',
  );
  let version = row?.user_version ?? 0;
  // Table rebuilds drop tables that others reference, so foreign keys are
  // checked once at the end instead (the pragma is ignored inside a transaction).
  await db.execAsync('PRAGMA foreign_keys = OFF');
  // Runs inside SQLiteProvider's onInit, before any other query, so a regular
  // transaction cannot interleave with other work.
  while (version < targetVersion) {
    const migration = MIGRATIONS[version];
    const next = version + 1;
    await db.withTransactionAsync(async () => {
      await migration(db);
      const broken = await db.getFirstAsync('PRAGMA foreign_key_check');
      if (broken) {
        throw new Error(`Migration ${next} broke a foreign key: ${JSON.stringify(broken)}`);
      }
      await db.execAsync(`PRAGMA user_version = ${next}`);
    });
    version = next;
  }
  await db.execAsync('PRAGMA foreign_keys = ON');
}
