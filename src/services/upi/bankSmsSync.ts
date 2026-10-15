import { Platform } from 'react-native';
import type { SQLiteDatabase } from 'expo-sqlite';

import BankSms from '../../../modules/bank-sms';
import { insertCandidate } from '../../data/repositories/upiCandidates';
import { parseBankSms } from '../../domain/upi/bankSms';
import { autoAddCandidates } from './autoAdd';

/** Present only in iOS builds that include the "Capture bank SMS" action. */
export const bankSmsNative = Platform.OS === 'ios' ? BankSms : null;

/** Moves bank SMS captured by the Shortcuts action into the review list. */
export async function syncBankSms(db: SQLiteDatabase): Promise<number> {
  if (!bankSmsNative) {
    return 0;
  }
  const queued = bankSmsNative.getPending();
  if (queued.length === 0) {
    return 0;
  }
  const inserted: string[] = [];
  for (const sms of queued) {
    const parsed = parseBankSms(sms.text, sms.receivedAt);
    const id = parsed ? await insertCandidate(db, parsed) : null;
    if (id) {
      inserted.push(id);
    }
  }
  bankSmsNative.remove(queued.map(s => s.id));
  await autoAddCandidates(db, inserted);
  return inserted.length;
}
