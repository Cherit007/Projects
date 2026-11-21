import { parseToMinor } from '../money/money';
import {
  AMOUNT,
  SENSITIVE,
  withoutSafetyWarnings,
  type ParsedUpiNotification,
  type UpiDirection,
  type UpiStatus,
} from './parser';
import { detectPayeeKind } from './payeeKind';

/** Candidates created from forwarded bank SMS use this in place of an app package. */
export const SMS_SOURCE = 'sms';

const BANKS: [RegExp, string][] = [
  [/\bHDFC\b/i, 'HDFC Bank'],
  [/\bSBI\b|State Bank/i, 'SBI'],
  [/\bICICI\b/i, 'ICICI Bank'],
  [/\bAxis\b/i, 'Axis Bank'],
  [/\bKotak\b/i, 'Kotak Bank'],
  [/\bIDFC\b/i, 'IDFC First Bank'],
  [/\bYes\s*Bank\b/i, 'Yes Bank'],
  [/\bPNB\b|Punjab National/i, 'PNB'],
  [/\bBank of Baroda\b|\bBOB\b/i, 'Bank of Baroda'],
  [/\bCanara\b/i, 'Canara Bank'],
  [/\bUnion Bank\b/i, 'Union Bank'],
  [/\bIndusInd\b/i, 'IndusInd Bank'],
  [/\bFederal Bank\b/i, 'Federal Bank'],
  [/mobi\s*kwik/i, 'MobiKwik'],
];

/** "Credit Card XX4005", "card ending 4005", "Card x4885", "HDFC Bank Card 4885", "BLOCK CC 4885". */
const CARD = /\bcredit\s*card\b|\bCC\s*\d{4}\b|\bcard\s*(?:no\.?\s*)?(?:ending(?:\s+(?:in|with))?\s*|x+|\*+)?\s*\d{4}\b/i;
const DEBIT_CARD = /\bdebit\s*card\b/i;
const LAST4 = [
  /(?:\bending(?:\s+(?:in|with))?\s*|x{2,}|\*{2,}|\bA\/?c\s*(?:no\.?\s*)?[x*]*)(\d{4})\b/i,
  /\bcard\s*(?:no\.?\s*)?x?(\d{4})\b/i,
  /\bCC\s*(\d{4})\b/i,
];
/** Card SMS name the shop after "at" or "on": "At MOBIKWIK On 2026-11-14", "on 16-Oct-26 on MOBIKWIK". */
const CARD_MERCHANT = /\b(?:at|on)\s+([A-Za-z][A-Za-z0-9 .&'_-]{1,40}?)(?=\s+(?:on|at|ref|avl|not|via|for|info|by)\b|[.,;:]|\s*$)/gi;

function cardMerchant(text: string): string | null {
  for (const match of text.matchAll(CARD_MERCHANT)) {
    const name = cleanParty(match[1]);
    if (name && !/^(?:hdfc|sbi|icici|axis|kotak)\b/i.test(name)) {
      return name;
    }
  }
  return null;
}

const DEBIT = /\b(debited|sent|paid|spent|withdrawn|transferred|trf\s+to)\b/i;
const CREDIT = /\b(credited|received|deposited|added\s+to)\b/i;
const FAILED = /\b(fail(?:ed|ure)?|declined|unsuccessful|could\s+not|not\s+processed|reversal)\b/i;
const REQUEST = /\b(has\s+requested|requested\s+(?:money|rs|inr|₹)|collect\s+request)\b/i;

/** SBI-style "debited by 250.0" has no currency marker. */
const BARE_AMOUNT = /\b(?:debited|credited)\s+(?:by|with|for)\s+(?:Rs\.?|INR|₹)?\s*([\d,]+(?:\.\d{1,2})?)/i;

const REFERENCES = [
  /\bRef(?:erence)?\.?\s*(?:No\.?|num(?:ber)?|ID)?[\s:#.-]*(\d{6,})/i,
  /\bUTR\s*(?:No\.?)?[\s:#-]*([A-Za-z0-9]{6,})/i,
  /\bUPI[\s:/-]*(?:P2[AM]\/)?(\d{12})\b/i,
  /\b(\d{12})\b/,
];

const NAME = String.raw`([\p{L}\p{N}][\p{L}\p{M}\p{N} .&'@_-]{1,40}?)`;
const STOP = String.raw`(?=\s+(?:on|via|using|from|ref|refno|upi|not|avl|bal|info|dated|thru|through|at|is|has|was|of)\b|[,;:!|(]|\.(?=\s|$)|\s*$)`;
/** Bank emails give the UPI ID and then the name: "to VPA paytmqr2810@paytm KATA SURESH on 14-11-26". */
const NAME_AFTER_VPA = String.raw`\s+VPA\s+\S+@\S+\s+([A-Za-z][A-Za-z .&'-]{1,40}?)${STOP}`;
const PAYEES = [
  /\bUPI\/(?:P2[AM]\/)?\d+\/([^\s/]{2,40})/i,
  new RegExp(String.raw`\bto${NAME_AFTER_VPA}`, 'iu'),
  /;\s*([A-Za-z0-9][A-Za-z0-9 .&'_-]{1,40}?)\s+credited\b/i,
  new RegExp(String.raw`\b(?:trf\s+)?to\s+(?:VPA\s+)?${NAME}${STOP}`, 'iu'),
];
const PAYERS = [
  /\bUPI\/(?:P2[AM]\/)?\d+\/([^\s/]{2,40})/i,
  new RegExp(String.raw`\b(?:from|by)${NAME_AFTER_VPA}`, 'iu'),
  new RegExp(String.raw`\b(?:from|by)\s+(?:VPA\s+)?${NAME}${STOP}`, 'iu'),
];
const REQUESTER = new RegExp(String.raw`^(?:Dear\s+\w+,?\s*)?${NAME}\s+has\s+requested`, 'iu');

const ACCOUNT_LIKE = /\b(bank|a\/?c|acct|account|card|xx\d*|x\d{3,}|\*+\d+|wallet|your|you|u)\b|^\d+$/i;

function cleanParty(value: string | undefined): string | null {
  let party = value?.replace(/\s+/g, ' ').trim();
  if (!party) {
    return null;
  }
  if (party.includes('@')) {
    party = party.split('@')[0];
  }
  party = party.replace(/[._-]+$/, '').trim();
  if (party.length < 2 || ACCOUNT_LIKE.test(party) || AMOUNT.test(party)) {
    return null;
  }
  return party;
}

/** Tries every occurrence of each pattern, so "Greetings from HDFC Bank" does not hide "from RAVI". */
function firstMatch(patterns: RegExp[], text: string, clean: (v: string | undefined) => string | null) {
  for (const pattern of patterns) {
    const global = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`);
    for (const match of text.matchAll(global)) {
      const value = clean(match[1]);
      if (value) {
        return value;
      }
    }
  }
  return null;
}

/** Whichever of debit/credit is mentioned first describes the account holder's side. */
function detectDirection(text: string): UpiDirection | null {
  const debit = DEBIT.exec(text)?.index ?? Infinity;
  const credit = CREDIT.exec(text)?.index ?? Infinity;
  if (debit === Infinity && credit === Infinity) {
    return null;
  }
  return debit <= credit ? 'debit' : 'credit';
}

/**
 * Extracts a payment from a bank's transaction SMS (forwarded by an iOS
 * Shortcuts automation, or pasted). Returns null for OTPs, promotions and
 * anything that is not a completed debit or credit. Best-effort: formats
 * differ between banks, so the result is always reviewed by the user.
 */
export function parseBankSms(message: string, receivedAt: number): ParsedUpiNotification | null {
  const text = withoutSafetyWarnings(message).replace(/\s+/g, ' ').trim();
  if (!text || SENSITIVE.test(text)) {
    return null;
  }

  const amountText = AMOUNT.exec(text)?.[1] ?? BARE_AMOUNT.exec(text)?.[1];
  const amountMinor = amountText ? parseToMinor(amountText) : null;
  const direction = detectDirection(text);

  let status: UpiStatus;
  if (REQUEST.test(text)) {
    status = 'request';
  } else if (FAILED.test(text)) {
    status = 'failed';
  } else if (direction) {
    status = 'success';
  } else {
    return null;
  }
  if (amountMinor === null && status === 'success') {
    return null;
  }

  let counterparty: string | null;
  if (status === 'request') {
    counterparty = cleanParty(REQUESTER.exec(text)?.[1]);
  } else if (direction === 'credit') {
    counterparty = firstMatch(PAYERS, text, cleanParty);
  } else {
    counterparty = firstMatch(PAYEES, text, cleanParty);
  }

  const card = CARD.test(text) && !DEBIT_CARD.test(text);
  if (card && direction === 'debit' && !counterparty) {
    counterparty = cardMerchant(text);
  }
  // A card spend at a wallet names the wallet; the message comes from the card's bank.
  const bank = BANKS.find(([pattern]) => pattern.test(card ? text.replace(/mobi\s*kwik/gi, '') : text))?.[1];
  return {
    packageName: SMS_SOURCE,
    sourceApp: bank ? `${bank} SMS` : 'Bank SMS',
    status,
    direction: status === 'request' ? 'debit' : direction,
    amountMinor,
    counterparty,
    reference: firstMatch(REFERENCES, text, v => v ?? null),
    payeeKind: detectPayeeKind(text),
    postedAt: receivedAt,
    card,
    accountLast4: LAST4.map(pattern => pattern.exec(text)?.[1]).find(Boolean) ?? null,
  };
}
