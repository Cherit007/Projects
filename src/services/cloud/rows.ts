import type { SyncedTable } from '../../data/local/migrations';
import schema from './schema.json';

export type ColumnKind = 'text' | 'int' | 'bool';
type LocalRow = Record<string, unknown> & { id: string };
type RemoteRow = Record<string, unknown> & { $id: string };

export function columnsOf(table: SyncedTable): [string, ColumnKind][] {
  return Object.entries(schema[table]).map(([name, spec]) => [name, spec.split(':')[0] as ColumnKind]);
}

/** SQLite stores booleans as 0/1; Appwrite uses real booleans. */
export function toRemote(table: SyncedTable, row: LocalRow): Record<string, unknown> {
  const data: Record<string, unknown> = { deleted: false };
  for (const [name, kind] of columnsOf(table)) {
    const value = row[name];
    data[name] = kind === 'bool' ? value === 1 || value === true : (value ?? null);
  }
  return data;
}

export function toLocal(table: SyncedTable, remote: RemoteRow): LocalRow {
  const row: LocalRow = { id: remote.$id };
  for (const [name, kind] of columnsOf(table)) {
    const value = remote[name];
    row[name] = kind === 'bool' ? (value ? 1 : 0) : (value ?? null);
  }
  return row;
}

/**
 * Last edit wins, using the `updated_at` written by the device that made the
 * edit. Ties keep the local row, so a device's own pushes are not re-applied.
 */
export function shouldApplyRemote(localUpdatedAt: string | null, remoteUpdatedAt: string | null): boolean {
  if (localUpdatedAt === null) {
    return true;
  }
  if (!remoteUpdatedAt) {
    return false;
  }
  return remoteUpdatedAt > localUpdatedAt;
}

/**
 * Every new install seeds the same default categories and a Cash account with
 * random ids. On a device's first sync these keys find the matching cloud
 * rows so the defaults are merged instead of duplicated.
 */
export function categoryMergeKey(type: string, name: string, parentName: string | null): string {
  return `${type}|${name.trim().toLowerCase()}|${parentName?.trim().toLowerCase() ?? ''}`;
}

export function accountMergeKey(type: string, name: string): string {
  return `${type}|${name.trim().toLowerCase()}`;
}
