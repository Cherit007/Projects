import { accountIsAtBank } from '../statements/banks';
import { isUpiAccount, type Account } from '../types';

/** IFSC-style codes for the bank names bank SMS are labelled with ("HDFC Bank SMS"). */
const BANK_CODES: Readonly<Record<string, string>> = {
  'HDFC Bank': 'HDFC',
  SBI: 'SBIN',
  'ICICI Bank': 'ICIC',
  'Axis Bank': 'UTIB',
  'Kotak Bank': 'KKBK',
  'IDFC First Bank': 'IDFB',
  'Yes Bank': 'YESB',
  PNB: 'PUNB',
  'Bank of Baroda': 'BARB',
  'Canara Bank': 'CNRB',
  'Union Bank': 'UBIN',
  'IndusInd Bank': 'INDB',
  'Federal Bank': 'FDRL',
  MobiKwik: 'MOBK',
};

export interface DetectedPaymentSource {
  /** "HDFC Bank SMS", "SBI SMS", "Bank SMS", or a payment app's name. */
  sourceApp: string;
  card: boolean;
  accountLast4: string | null;
}

/**
 * The account a detected payment belongs to. Credit card messages go to the
 * card whose name ends in the same four digits, or the only card; bank and
 * wallet messages to the account at that bank (by last four digits when there
 * are several). With only one bank or wallet account, everything that is not
 * a card goes there. Returns null when it is unclear, so the payment waits for
 * review rather than landing in the wrong account.
 */
export function accountForDetectedPayment(
  source: DetectedPaymentSource,
  accounts: readonly Account[],
): Account | null {
  const active = accounts.filter(a => !a.isArchived);
  const byDigits = (list: Account[]) =>
    source.accountLast4 ? list.filter(a => a.name.includes(source.accountLast4!)) : [];

  if (source.card) {
    const cards = active.filter(a => a.type === 'card');
    const matching = byDigits(cards);
    if (matching.length === 1) {
      return matching[0];
    }
    return cards.length === 1 ? cards[0] : null;
  }

  const upi = active.filter(isUpiAccount);
  const bankName = source.sourceApp.replace(/\s+SMS$/i, '');
  const code = BANK_CODES[bankName];
  const atBank = code ? upi.filter(a => accountIsAtBank(a.name, code)) : [];
  if (atBank.length === 1) {
    return atBank[0];
  }
  const matching = byDigits(atBank.length > 0 ? atBank : upi);
  if (matching.length === 1) {
    return matching[0];
  }
  // A lone account is used unless its name says it is at a different bank than the message.
  const namedForAnotherBank = (account: Account) =>
    Object.values(BANK_CODES).some(other => other !== code && accountIsAtBank(account.name, other));
  if (upi.length === 1 && atBank.length === 0 && !(code && namedForAnotherBank(upi[0]))) {
    return upi[0];
  }
  if (upi.length === 0) {
    return active.find(a => a.type === 'cash') ?? null;
  }
  return null;
}
