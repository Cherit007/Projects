import { Platform } from 'react-native';
import type { SQLiteDatabase } from 'expo-sqlite';

import BankSms from '../../../modules/bank-sms';
import { insertCandidate } from '../../data/repositories/upiCandidates';
import { parseBankSms } from '../../domain/upi/bankSms';

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
  let added = 0;
  for (const sms of queued) {
    const parsed = parseBankSms(sms.text, sms.receivedAt);
    if (parsed && (await insertCandidate(db, parsed))) {
      added += 1;
    }
  }
  bankSmsNative.remove(queued.map(s => s.id));
  return added;
}
