import type { StatementBank } from './types';

/** IFSC bank codes and how users usually name accounts at that bank. */
const ACCOUNT_NAMES: Readonly<Record<string, RegExp>> = {
  HDFC: /\bhdfc\b/i,
  SBIN: /\bsbi\b|state\s*bank/i,
  ICIC: /\bicici\b/i,
  UTIB: /\baxis\b/i,
  KKBK: /\bkotak\b/i,
  IDFB: /\bidfc\b/i,
  YESB: /\byes\s*bank\b/i,
  PUNB: /\bpnb\b|punjab\s*national/i,
  BARB: /\bbaroda\b|\bbob\b/i,
  CNRB: /\bcanara\b/i,
  UBIN: /\bunion\s*bank\b/i,
  INDB: /\bindusind\b/i,
  FDRL: /\bfederal\b/i,
  AIRP: /\bairtel\b/i,
  PYTM: /\bpaytm\b/i,
};

export const STATEMENT_BANK_CODE: Readonly<Record<StatementBank, string>> = {
  'HDFC Bank': 'HDFC',
  SBI: 'SBIN',
};

/** Whether an account's name says it is at the bank with this IFSC code. */
export function accountIsAtBank(accountName: string, bankCode: string): boolean {
  return ACCOUNT_NAMES[bankCode]?.test(accountName) ?? false;
}
