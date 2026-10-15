import type { SQLiteDatabase } from 'expo-sqlite';

import {
  BACKUP_FORMAT,
  BACKUP_TABLES,
  BACKUP_VERSION,
  type Backup,
  type BackupRow,
  type BackupTable,
} from '../domain/backup';
import { SCHEMA_VERSION } from './local/migrations';

export async function exportBackup(db: SQLiteDatabase, now = new Date()): Promise<Backup> {
  const tables = {} as Record<BackupTable, BackupRow[]>;
  for (const table of BACKUP_TABLES) {
    tables[table] = await db.getAllAsync<BackupRow>(`SELECT * FROM ${table}`);
  }
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: now.toISOString(),
    tables,
  };
}

/**
 * Replaces all data with the backup's, in one transaction: on any problem
 * nothing changes. Columns this version does not know are dropped and missing
 * ones get their defaults, so older backups restore too. The review list of
 * detected payments is cleared, since its links point at replaced transactions.
 */
export async function restoreBackup(db: SQLiteDatabase, backup: Backup): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.execAsync('PRAGMA defer_foreign_keys = ON');
    await db.runAsync('DELETE FROM upi_candidates');
    for (const table of [...BACKUP_TABLES].reverse()) {
      await db.runAsync(`DELETE FROM ${table}`);
    }
    for (const table of BACKUP_TABLES) {
      const known = new Set(
        (await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`)).map(column => column.name),
      );
      for (const row of backup.tables[table]) {
        const columns = Object.keys(row).filter(column => known.has(column));
        if (columns.length === 0) {
          continue;
        }
        await db.runAsync(
          `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
          columns.map(column => row[column]),
        );
      }
    }
  });
}
