import { parseToMinor, type MinorUnits } from '../money/money';
import { detectPayeeKind, type PayeeKind } from './payeeKind';

/** Package identifiers of payment apps whose notifications we parse. */
export const SUPPORTED_UPI_APPS: Readonly<Record<string, string>> = {
  'com.phonepe.app': 'PhonePe',
  'com.google.android.apps.nbu.paisa.user': 'Google Pay',
  'net.one97.paytm': 'Paytm',
  'in.org.npci.upiapp': 'BHIM',
};

export interface RawNotification {
  packageName: string;
  title: string | null;
  text: string | null;
  /** Epoch milliseconds. */
  postedAt: number;
}

export type UpiStatus = 'success' | 'pending' | 'failed' | 'request' | 'unknown';
export type UpiDirection = 'debit' | 'credit';

export interface ParsedUpiNotification {
  packageName: string;
  sourceApp: string;
  status: UpiStatus;
  direction: UpiDirection | null;
  amountMinor: MinorUnits | null;
  counterparty: string | null;
  reference: string | null;
  /** Merchant or person, when the message says so (P2M/P2A, QR or mobile-number UPI ID). */
  payeeKind: PayeeKind | null;
  postedAt: number;
  /** Bank SMS only: the message is about a credit card rather than a bank account. */
  card?: boolean;
  /** Bank SMS only: last four digits of the account or card it names ("XX1234", "ending 4005"). */
  accountLast4?: string | null;
}

export const SENSITIVE = /\b(otp|one[\s-]?time\s+password|upi\s+pin|mpin|cvv)\b/i;

/**
 * Bank alerts, especially emails, end with "Never share your OTP, PIN or CVV".
 * That warning is not a code, so it is removed before looking for one; a real
 * OTP message still mentions its code elsewhere and is still dropped.
 */
export function withoutSafetyWarnings(text: string): string {
  return text.replace(
    /[^.!\n]*\b(?:never|do\s+not|don'?t|not\s+to|nor)\s+(?:share|disclose|reveal|ask)\b[^.!\n]*[.!]?/gi,
    ' ',
  );
}
export const AMOUNT = /(?:₹|\bRs\.?|\bINR)\s*([\d,]+(?:\.\d{1,2})?)/i;
const REFERENCE =
  /\b(?:UPI\s*)?(?:Ref(?:erence)?\.?\s*(?:No\.?|ID|#)?|UTR|Txn\.?\s*ID|Transaction\s*ID)[\s:#-]*([A-Za-z0-9]{6,})/i;

const FAILED = /\b(fail(?:ed|ure)?|declined|unsuccessful|could\s+not|couldn't|reversed|refunded)\b/i;
const REQUEST = /\b(request(?:ed|s|ing)?|collect)\b/i;
const PENDING = /\b(pending|processing|in\s+progress|awaiting)\b/i;
const CREDIT = /\b(received|credited|got|added\s+to)\b/i;
const DEBIT = /\b(paid|sent|debited|payment\s+(?:of|to)|spent|transferred)\b/i;

const NAME = String.raw`([\p{L}\p{N}][\p{L}\p{M}\p{N} .&'@_-]{1,40}?)`;
const NAME_END = String.raw`(?=\s+(?:on|via|using|from|for|ref|upi|successfully|is|has|had|was|at|could|couldn't|cannot|failed|did|will)\b|[.,!|]|\s*$)`;
const DEBIT_PARTY = new RegExp(String.raw`\b(?:paid|sent|payment)\s+(?:of\s+\S+\s+)?to\s+${NAME}${NAME_END}`, 'iu');
const TO_PARTY = new RegExp(String.raw`\bto\s+${NAME}${NAME_END}`, 'iu');
const CREDIT_PARTY = new RegExp(String.raw`\b(?:from|by)\s+${NAME}${NAME_END}`, 'iu');
const REQUESTER = new RegExp(String.raw`^${NAME}\s+(?:has\s+)?request`, 'iu');

const ACCOUNT_LIKE = /\b(bank|a\/c|account|xx\d+|\*+\d+|wallet|upi\s+lite)\b/i;

function clean(value: string | undefined | null): string | null {
  const trimmed = value?.replace(/\s+/g, ' ').trim();
  if (!trimmed || ACCOUNT_LIKE.test(trimmed)) {
    return null;
  }
  return trimmed;
}

function detectStatus(text: string): UpiStatus {
  if (FAILED.test(text)) {
    return 'failed';
  }
  if (REQUEST.test(text)) {
    return 'request';
  }
  if (PENDING.test(text)) {
    return 'pending';
  }
  if (CREDIT.test(text) || DEBIT.test(text) || /\bsuccess(?:ful(?:ly)?)?\b/i.test(text)) {
    return 'success';
  }
  return 'unknown';
}

function detectDirection(text: string, status: UpiStatus): UpiDirection | null {
  if (status === 'request') {
    return 'debit';
  }
  if (CREDIT.test(text)) {
    return 'credit';
  }
  if (DEBIT.test(text)) {
    return 'debit';
  }
  return null;
}

function looksLikeName(title: string | null): boolean {
  return !!title && !AMOUNT.test(title) && detectStatus(title) === 'unknown' && title.length <= 40;
}

/**
 * Extracts payment details from a payment-app notification. Returns null for
 * unsupported apps, notifications with sensitive content (OTP, PIN) and
 * notifications that are not about a payment. Detection is best-effort:
 * formats vary by app and version, so results must be reviewed by the user.
 */
export function parseUpiNotification(
  raw: RawNotification,
  supportedApps: Readonly<Record<string, string>> = SUPPORTED_UPI_APPS,
): ParsedUpiNotification | null {
  const sourceApp = supportedApps[raw.packageName];
  if (!sourceApp) {
    return null;
  }
  const title = raw.title?.trim() || null;
  const body = raw.text?.trim() || null;
  const text = [title, body].filter(Boolean).join(' | ');
  if (!text || SENSITIVE.test(text)) {
    return null;
  }

  const amountMatch = AMOUNT.exec(text);
  const status = detectStatus(text);
  if (!amountMatch && status === 'unknown') {
    return null;
  }

  const direction = detectDirection(text, status);
  let counterparty: string | null = null;
  if (status === 'request') {
    counterparty = clean(REQUESTER.exec(text)?.[1]) ?? clean(CREDIT_PARTY.exec(text)?.[1]);
  } else if (direction === 'credit') {
    counterparty = clean(CREDIT_PARTY.exec(text)?.[1]);
  } else {
    counterparty = clean(DEBIT_PARTY.exec(text)?.[1]) ?? clean(TO_PARTY.exec(text)?.[1]);
  }
  if (!counterparty && looksLikeName(title)) {
    counterparty = title;
  }

  return {
    packageName: raw.packageName,
    sourceApp,
    status,
    direction,
    amountMinor: amountMatch ? parseToMinor(amountMatch[1]) : null,
    counterparty,
    payeeKind: detectPayeeKind(text),
    reference: REFERENCE.exec(text)?.[1] ?? null,
    postedAt: raw.postedAt,
  };
}

const DEDUPE_WINDOW_MS = 2 * 60 * 1000;

/**
 * Key used to recognise repeated notifications for the same payment. Prefers
 * the transaction reference; otherwise combines app, direction, amount,
 * counterparty and a two-minute time bucket (amount alone is not enough).
 */
export function dedupeKey(parsed: ParsedUpiNotification): string {
  if (parsed.reference) {
    return `ref:${parsed.reference.toUpperCase()}`;
  }
  const party = (parsed.counterparty ?? '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
  const bucket = Math.floor(parsed.postedAt / DEDUPE_WINDOW_MS);
  return [parsed.packageName, parsed.status, parsed.direction ?? '-', parsed.amountMinor ?? '-', party, bucket].join('|');
}

export type ReviewState = 'needs_review' | 'confirmed' | 'dismissed' | 'ignored';

/**
 * Failed payments and payment requests are never suggested as transactions;
 * they are kept as ignored so the user can still see them.
 */
export function initialReviewState(parsed: ParsedUpiNotification): ReviewState {
  return parsed.status === 'failed' || parsed.status === 'request' ? 'ignored' : 'needs_review';
}
