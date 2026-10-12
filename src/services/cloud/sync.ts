import type { SQLiteDatabase } from 'expo-sqlite';
import { Permission, Query, Role, type Models, type TablesDB } from 'react-native-appwrite';

import { nowIso } from '../../data/local/ids';
import { SYNCED_TABLES, type SyncedTable } from '../../data/local/migrations';
import { cloud } from './client';
import { cloudConfig } from './config';
import {
  accountMergeKey,
  categoryMergeKey,
  columnsOf,
  shouldApplyRemote,
  toLocal,
  toRemote,
} from './rows';

type RemoteRow = Models.DefaultRow & Record<string, unknown>;
type LocalRow = Record<string, unknown> & { id: string };

const PAGE_SIZE = 100;
const MAX_PUSH_BATCHES = 50;

export interface SyncResult {
  pushed: number;
  pulled: number;
}

/**
 * Two-way sync for the signed-in user: pushes the local outbox, then pulls
 * rows changed in the cloud since the last pull. Safe to call repeatedly.
 */
export async function syncNow(db: SQLiteDatabase, userId: string): Promise<SyncResult> {
  const services = cloud();
  if (!services) {
    throw new Error('Cloud sync is not configured.');
  }
  const { tables } = services;
  const meta = await db.getFirstAsync<{ user_id: string | null }>('SELECT user_id FROM sync_meta WHERE id = 1');
  if (meta?.user_id !== userId) {
    await db.runAsync('DELETE FROM sync_cursors');
    await mergeWithCloud(db, tables);
    await enqueueAllLocalRows(db);
  }

  let pulled = 0;
  for (const table of SYNCED_TABLES) {
    pulled += await pullTable(db, tables, table);
  }
  const pushed = await pushOutbox(db, tables, userId);
  await db.runAsync('UPDATE sync_meta SET user_id = ?, last_synced_at = ? WHERE id = 1', userId, nowIso());
  return { pushed, pulled };
}

/** Forgets which account the local data belongs to; local data is kept. */
export async function resetSyncState(db: SQLiteDatabase): Promise<void> {
  await db.runAsync('UPDATE sync_meta SET user_id = NULL, last_synced_at = NULL WHERE id = 1');
  await db.runAsync('DELETE FROM sync_cursors');
}

export async function lastSyncedAt(db: SQLiteDatabase): Promise<string | null> {
  const row = await db.getFirstAsync<{ last_synced_at: string | null }>(
    'SELECT last_synced_at FROM sync_meta WHERE id = 1',
  );
  return row?.last_synced_at ?? null;
}

export async function pendingChangeCount(db: SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM sync_outbox');
  return row?.count ?? 0;
}

async function listAllRemote(tables: TablesDB, table: SyncedTable, since: string | null): Promise<RemoteRow[]> {
  const rows: RemoteRow[] = [];
  let lastId: string | undefined;
  for (;;) {
    const queries = [Query.orderAsc('$updatedAt'), Query.orderAsc('$id'), Query.limit(PAGE_SIZE)];
    if (since) {
      queries.push(Query.greaterThanEqual('$updatedAt', since));
    }
    if (lastId) {
      queries.push(Query.cursorAfter(lastId));
    }
    const page = await tables.listRows<RemoteRow>({
      databaseId: cloudConfig.databaseId,
      tableId: table,
      queries,
      total: false,
    });
    rows.push(...page.rows);
    if (page.rows.length < PAGE_SIZE) {
      return rows;
    }
    lastId = page.rows[page.rows.length - 1].$id;
  }
}

/**
 * Runs `work` in one transaction with outbox triggers off, so rows written
 * from the cloud are not pushed straight back. Foreign keys are checked at
 * commit, because rows can arrive in any order.
 */
async function applyingRemote(db: SQLiteDatabase, work: () => Promise<void>): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.execAsync('PRAGMA defer_foreign_keys = ON');
    await db.runAsync('UPDATE sync_meta SET applying_remote = 1 WHERE id = 1');
    try {
      await work();
    } finally {
      await db.runAsync('UPDATE sync_meta SET applying_remote = 0 WHERE id = 1');
    }
  });
}

async function upsertLocal(db: SQLiteDatabase, table: SyncedTable, row: LocalRow): Promise<void> {
  const columns = ['id', ...columnsOf(table).map(([name]) => name)];
  const updates = columns.slice(1).map(c => `${c} = excluded.${c}`);
  if (table === 'budgets') {
    await db.runAsync('DELETE FROM budgets WHERE category_id = ? AND id <> ?', row.category_id as string, row.id);
  }
  await db.runAsync(
    `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})
     ON CONFLICT (id) DO UPDATE SET ${updates.join(', ')}`,
    columns.map(c => row[c] as string | number | null),
  );
}

/** Applies one remote row if it is newer than the local copy. Returns whether it changed anything. */
async function applyRemoteRow(db: SQLiteDatabase, table: SyncedTable, remote: RemoteRow): Promise<boolean> {
  const local = await db.getFirstAsync<{ updated_at: string }>(
    `SELECT updated_at FROM ${table} WHERE id = ?`,
    remote.$id,
  );
  if (!shouldApplyRemote(local?.updated_at ?? null, (remote.updated_at as string | null) ?? null)) {
    return false;
  }
  if (remote.deleted) {
    if (!local) {
      return false;
    }
    await db.runAsync(`DELETE FROM ${table} WHERE id = ?`, remote.$id);
  } else {
    await upsertLocal(db, table, toLocal(table, remote));
  }
  await db.runAsync('DELETE FROM sync_outbox WHERE table_name = ? AND row_id = ?', table, remote.$id);
  return true;
}

async function pullTable(db: SQLiteDatabase, tables: TablesDB, table: SyncedTable): Promise<number> {
  const cursor = await db.getFirstAsync<{ pulled_until: string }>(
    'SELECT pulled_until FROM sync_cursors WHERE table_name = ?',
    table,
  );
  const rows = await listAllRemote(tables, table, cursor?.pulled_until ?? null);
  if (rows.length === 0) {
    return 0;
  }
  let changed = 0;
  await applyingRemote(db, async () => {
    for (const remote of rows) {
      if (await applyRemoteRow(db, table, remote)) {
        changed += 1;
      }
    }
    await db.runAsync(
      'INSERT OR REPLACE INTO sync_cursors (table_name, pulled_until) VALUES (?, ?)',
      table,
      rows[rows.length - 1].$updatedAt,
    );
  });
  return changed;
}

async function pushOutbox(db: SQLiteDatabase, tables: TablesDB, userId: string): Promise<number> {
  const user = Role.user(userId);
  const permissions = [Permission.read(user), Permission.update(user), Permission.delete(user)];
  let pushed = 0;
  for (let batch = 0; batch < MAX_PUSH_BATCHES; batch++) {
    const entries = await db.getAllAsync<{ table_name: SyncedTable; row_id: string; changed_at: string }>(
      'SELECT * FROM sync_outbox ORDER BY changed_at LIMIT ?',
      PAGE_SIZE,
    );
    if (entries.length === 0) {
      break;
    }
    for (const entry of entries) {
      const row = await db.getFirstAsync<LocalRow>(`SELECT * FROM ${entry.table_name} WHERE id = ?`, entry.row_id);
      await tables.upsertRow({
        databaseId: cloudConfig.databaseId,
        tableId: entry.table_name,
        rowId: entry.row_id,
        data: row ? toRemote(entry.table_name, row) : { deleted: true, updated_at: nowIso() },
        permissions,
      });
      await db.runAsync(
        'DELETE FROM sync_outbox WHERE table_name = ? AND row_id = ? AND changed_at = ?',
        entry.table_name,
        entry.row_id,
        entry.changed_at,
      );
      pushed += 1;
    }
  }
  return pushed;
}

/** Queues every local row, so data created before signing in is uploaded. */
async function enqueueAllLocalRows(db: SQLiteDatabase): Promise<void> {
  for (const table of SYNCED_TABLES) {
    await db.runAsync(
      `INSERT OR IGNORE INTO sync_outbox (table_name, row_id, changed_at)
       SELECT ?, id, updated_at FROM ${table}`,
      table,
    );
  }
}

/**
 * First sync on this device: brings in the cloud's accounts and categories
 * and folds local defaults (seeded with different ids on every install) into
 * the matching cloud rows, moving their transactions and budgets across.
 */
async function mergeWithCloud(db: SQLiteDatabase, tables: TablesDB): Promise<void> {
  const [remoteAccounts, remoteCategories] = await Promise.all([
    listAllRemote(tables, 'accounts', null),
    listAllRemote(tables, 'categories', null),
  ]);
  const liveAccounts = remoteAccounts.filter(r => !r.deleted);
  const liveCategories = remoteCategories.filter(r => !r.deleted);
  if (liveAccounts.length === 0 && liveCategories.length === 0) {
    return;
  }

  const remoteCategoryName = new Map(liveCategories.map(r => [r.$id, r.name as string]));
  const remoteCategoryByKey = new Map<string, string>();
  for (const r of liveCategories) {
    const parentName = r.parent_id ? (remoteCategoryName.get(r.parent_id as string) ?? null) : null;
    const key = categoryMergeKey(r.type as string, r.name as string, parentName);
    if (!remoteCategoryByKey.has(key)) {
      remoteCategoryByKey.set(key, r.$id);
    }
  }
  const remoteAccountByKey = new Map<string, string>();
  for (const r of liveAccounts) {
    const key = accountMergeKey(r.type as string, r.name as string);
    if (!remoteAccountByKey.has(key)) {
      remoteAccountByKey.set(key, r.$id);
    }
  }

  const localCategories = await db.getAllAsync<{ id: string; name: string; type: string; parent_id: string | null }>(
    'SELECT id, name, type, parent_id FROM categories',
  );
  const localCategoryName = new Map(localCategories.map(c => [c.id, c.name]));
  const localAccounts = await db.getAllAsync<{ id: string; name: string; type: string }>(
    'SELECT id, name, type FROM accounts',
  );
  const remoteIds = new Set([...liveAccounts, ...liveCategories].map(r => r.$id));

  await applyingRemote(db, async () => {
    for (const remote of liveAccounts) {
      await applyRemoteRow(db, 'accounts', remote);
    }
    for (const remote of liveCategories) {
      await applyRemoteRow(db, 'categories', remote);
    }
    for (const local of localCategories) {
      const parentName = local.parent_id ? (localCategoryName.get(local.parent_id) ?? null) : null;
      const target = remoteCategoryByKey.get(categoryMergeKey(local.type, local.name, parentName));
      if (!target || target === local.id || remoteIds.has(local.id)) {
        continue;
      }
      await db.runAsync('UPDATE transactions SET category_id = ? WHERE category_id = ?', target, local.id);
      await db.runAsync('UPDATE categories SET parent_id = ? WHERE parent_id = ?', target, local.id);
      await db.runAsync('UPDATE OR IGNORE budgets SET category_id = ? WHERE category_id = ?', target, local.id);
      await db.runAsync('DELETE FROM budgets WHERE category_id = ?', local.id);
      await db.runAsync('DELETE FROM categories WHERE id = ?', local.id);
    }
    for (const local of localAccounts) {
      const target = remoteAccountByKey.get(accountMergeKey(local.type, local.name));
      if (!target || target === local.id || remoteIds.has(local.id)) {
        continue;
      }
      await db.runAsync('UPDATE transactions SET account_id = ? WHERE account_id = ?', target, local.id);
      await db.runAsync('UPDATE transactions SET to_account_id = ? WHERE to_account_id = ?', target, local.id);
      await db.runAsync('DELETE FROM accounts WHERE id = ?', local.id);
    }
  });
}
