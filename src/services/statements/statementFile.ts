import { loadNative } from '../loadNative';

export interface StatementFile {
  name: string;
  base64: string;
}

/** Lets the user choose a statement PDF. Returns null when cancelled. */
export async function pickStatementPdf(): Promise<StatementFile | null> {
  const { File } = await loadNative(() => import('expo-file-system'), 'Statement import');
  const picked = await File.pickFileAsync({ mimeTypes: ['application/pdf'] });
  if (picked.canceled) {
    return null;
  }
  return { name: picked.result.name, base64: await picked.result.base64() };
}
