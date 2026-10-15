import type { SQLiteDatabase } from 'expo-sqlite';
import { DatabaseSync } from 'node:sqlite';

type Param = string | number | null | boolean | undefined;

function params(args: unknown[]): (string | number | null)[] {
  const list = (args.length === 1 && Array.isArray(args[0]) ? args[0] : args) as Param[];
  return list.map(value => (value === undefined ? null : typeof value === 'boolean' ? Number(value) : value));
}

/**
 * In-memory SQLite with the subset of expo-sqlite's async API the
 * repositories use, so data code runs in Jest unchanged.
 */
export function createTestDb(): SQLiteDatabase {
  const db = new DatabaseSync(':memory:');
  const api = {
    execAsync: async (sql: string) => {
      db.exec(sql);
    },
    runAsync: async (sql: string, ...args: unknown[]) => {
      const result = db.prepare(sql).run(...params(args));
      return { changes: Number(result.changes), lastInsertRowId: Number(result.lastInsertRowid) };
    },
    getFirstAsync: async (sql: string, ...args: unknown[]) => {
      const row = db.prepare(sql).get(...params(args));
      return row ? { ...row } : null;
    },
    getAllAsync: async (sql: string, ...args: unknown[]) =>
      db
        .prepare(sql)
        .all(...params(args))
        .map(row => ({ ...row })),
    withTransactionAsync: async (task: () => Promise<void>) => {
      db.exec('BEGIN');
      try {
        await task();
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
  };
  return api as unknown as SQLiteDatabase;
}
