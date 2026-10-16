export const BACKUP_FORMAT = 'financetracker-backup';
export const BACKUP_VERSION = 1;

/** Restored in this order; detected-payment messages are never backed up. */
export const BACKUP_TABLES = [
  'accounts',
  'categories',
  'transactions',
  'budgets',
  'recurring_rules',
  'receipts',
  'settings',
  'tags',
  'transaction_tags',
  'merchant_rules',
  'transaction_splits',
  'savings_goals',
] as const;
export type BackupTable = (typeof BACKUP_TABLES)[number];

export type BackupValue = string | number | null;
export type BackupRow = Record<string, BackupValue>;

export interface Backup {
  format: typeof BACKUP_FORMAT;
  version: number;
  /** The database schema (`user_version`) the rows were written with. */
  schemaVersion: number;
  exportedAt: string;
  tables: Record<BackupTable, BackupRow[]>;
}

export class BackupError extends Error {}

function isRow(value: unknown): value is BackupRow {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value).every(v => v === null || typeof v === 'string' || (typeof v === 'number' && Number.isFinite(v)))
  );
}

/**
 * Reads a backup file, rejecting anything that is not a backup from this app
 * or was made by a newer version of it. Tables missing from older backups
 * are treated as empty.
 */
export function parseBackup(text: string, currentSchemaVersion: number): Backup {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new BackupError('This file is not a backup from this app.');
  }
  const backup = data as Partial<Backup> | null;
  if (!backup || typeof backup !== 'object' || backup.format !== BACKUP_FORMAT || typeof backup.tables !== 'object') {
    throw new BackupError('This file is not a backup from this app.');
  }
  if (typeof backup.version !== 'number' || backup.version > BACKUP_VERSION) {
    throw new BackupError('This backup was made by a newer version of the app. Update the app and try again.');
  }
  if (typeof backup.schemaVersion !== 'number' || backup.schemaVersion > currentSchemaVersion) {
    throw new BackupError('This backup was made by a newer version of the app. Update the app and try again.');
  }
  const tables = {} as Record<BackupTable, BackupRow[]>;
  for (const table of BACKUP_TABLES) {
    const rows: unknown = backup.tables?.[table] ?? [];
    if (!Array.isArray(rows) || !rows.every(isRow)) {
      throw new BackupError(`The backup is damaged (${table}).`);
    }
    tables[table] = rows;
  }
  if (tables.accounts.length === 0) {
    throw new BackupError('The backup has no accounts, so it cannot be restored.');
  }
  return {
    format: BACKUP_FORMAT,
    version: backup.version,
    schemaVersion: backup.schemaVersion,
    exportedAt: typeof backup.exportedAt === 'string' ? backup.exportedAt : '',
    tables,
  };
}

export function backupFileName(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `finance-backup-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.json`;
}
