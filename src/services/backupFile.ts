import type { SQLiteDatabase } from 'expo-sqlite';

import { exportBackup, restoreBackup } from '../data/backup';
import { SCHEMA_VERSION } from '../data/local/migrations';
import { backupFileName, parseBackup, type Backup } from '../domain/backup';
import { loadNative } from './loadNative';
import { receiptPhotoExists } from './receipts';

const fileSystem = () => loadNative(() => import('expo-file-system'), 'Backups');

/** Writes a backup file and opens the share sheet, so it can be saved to Files, Drive or sent anywhere. */
export async function shareBackup(db: SQLiteDatabase): Promise<void> {
  const [{ File, Paths }, Sharing] = await Promise.all([
    fileSystem(),
    loadNative(() => import('expo-sharing'), 'Backups'),
  ]);
  const backup = await exportBackup(db);
  const file = new File(Paths.cache, backupFileName(new Date()));
  if (file.exists) {
    file.delete();
  }
  file.create();
  file.write(JSON.stringify(backup));
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing is not available on this device.');
  }
  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/json',
    dialogTitle: 'Save backup',
    UTI: 'public.json',
  });
}

/** Lets the user choose a backup file. Returns null when cancelled; throws if the file is not a valid backup. */
export async function pickBackup(): Promise<Backup | null> {
  const { File } = await fileSystem();
  const picked = await File.pickFileAsync({ mimeTypes: ['application/json', 'text/plain', '*/*'] });
  if (picked.canceled) {
    return null;
  }
  return parseBackup(await picked.result.text(), SCHEMA_VERSION);
}

/** Restores a backup, keeping receipt photos only where the photo is still on this device. */
export async function restoreFromBackup(db: SQLiteDatabase, backup: Backup): Promise<void> {
  const receipts = [];
  for (const row of backup.tables.receipts) {
    if (typeof row.uri === 'string' && (await receiptPhotoExists(row.uri))) {
      receipts.push(row);
    }
  }
  await restoreBackup(db, { ...backup, tables: { ...backup.tables, receipts } });
}
