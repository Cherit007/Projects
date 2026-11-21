import { Platform } from 'react-native';
import type { SQLiteDatabase } from 'expo-sqlite';

import BankSms from '../../../modules/bank-sms';
import { purgeUnreadMessages, saveUnreadMessage } from '../../data/repositories/unreadMessages';
import { insertCandidate } from '../../data/repositories/upiCandidates';
import { parseBankSms } from '../../domain/upi/bankSms';

/** Present only in iOS builds that include the "Capture bank SMS" action. */
export const bankSmsNative = Platform.OS === 'ios' ? BankSms : null;

/**
 * Moves bank SMS and emails captured by the Shortcuts action into the review
 * list. Alerts in a format the app cannot read are kept for a week so the user
 * can add them by hand instead of losing them.
 */
export async function syncBankSms(db: SQLiteDatabase): Promise<number> {
  await purgeUnreadMessages(db);
  if (!bankSmsNative) {
    return 0;
  }
  const queued = bankSmsNative.getPending();
  if (queued.length === 0) {
    return 0;
  }
  let inserted = 0;
  for (const sms of queued) {
    const parsed = parseBankSms(sms.text, sms.receivedAt);
    if (!parsed) {
      await saveUnreadMessage(db, sms.text, sms.receivedAt);
    } else if (await insertCandidate(db, parsed)) {
      inserted += 1;
    }
  }
  bankSmsNative.remove(queued.map(s => s.id));
  return inserted;
}
