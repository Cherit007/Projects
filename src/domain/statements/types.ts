import type { MinorUnits } from '../money/money';

/** A piece of text on a PDF page; x and y are in points from the bottom-left corner. */
export interface TextItem {
  s: string;
  x: number;
  y: number;
  /** Width in points. */
  w: number;
}

/** Text of every page of a statement, as read from the PDF. */
export type StatementPages = readonly (readonly TextItem[])[];

export type StatementBank = 'HDFC Bank' | 'SBI' | 'MobiKwik';

/** Statements from these are for a wallet rather than a bank account. */
export const WALLET_PROVIDERS: ReadonlySet<StatementBank> = new Set(['MobiKwik']);

export interface StatementRow {
  /** Transaction date, YYYY-MM-DD. */
  date: string;
  direction: 'debit' | 'credit';
  amountMinor: MinorUnits;
  /** Balance after this row, when the statement shows it. */
  balanceMinor: MinorUnits | null;
  /** The bank's description, with wrapped lines joined. */
  narration: string;
}

export interface ParsedStatement {
  bank: StatementBank;
  holderName: string | null;
  accountLast4: string | null;
  /** YYYY-MM-DD, inclusive. */
  periodStart: string | null;
  periodEnd: string | null;
  openingBalanceMinor: MinorUnits | null;
  closingBalanceMinor: MinorUnits | null;
  rows: StatementRow[];
  /** Mismatches with the statement's own totals, which mean rows may have been misread. */
  problems: string[];
}

export class StatementError extends Error {}
