import { parseToMinor, type MinorUnits } from '../money/money';
import {
  StatementError,
  type ParsedStatement,
  type StatementBank,
  type StatementPages,
  type StatementRow,
  type TextItem,
} from './types';

interface Line {
  y: number;
  items: TextItem[];
  text: string;
}

/** Text whose baselines differ by this much or less is on the same line. */
const SAME_LINE = 2;

function toLines(items: readonly TextItem[]): Line[] {
  const sorted = items.filter(item => item.s.trim()).sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: { y: number; items: TextItem[] }[] = [];
  for (const item of sorted) {
    const last = lines[lines.length - 1];
    if (last && last.y - item.y <= SAME_LINE) {
      last.items.push(item);
    } else {
      lines.push({ y: item.y, items: [item] });
    }
  }
  return lines.map(line => {
    const ordered = line.items.sort((a, b) => a.x - b.x);
    return { y: line.y, items: ordered, text: ordered.map(item => item.s.trim()).join(' ') };
  });
}

const MONEY = /^-?[\d,]+\.\d{1,2}\s*(?:CR|DR)?$/i;

function parseMoney(text: string): MinorUnits | null {
  const match = /^(-?[\d,]+\.\d{1,2})\s*(CR|DR)?$/i.exec(text.trim());
  const value = match ? parseToMinor(match[1]) : null;
  if (value === null) {
    return null;
  }
  return match?.[2]?.toUpperCase() === 'DR' ? -value : value;
}

interface RowAmounts {
  amountMinor: MinorUnits;
  balanceMinor: MinorUnits | null;
  /** From the column the amount is in; the running balance overrides it. */
  direction: 'debit' | 'credit';
}

interface Layout {
  bank: StatementBank;
  detect: (firstPage: string) => boolean;
  isHeader: (line: Line) => boolean;
  /** Matches a row's date as the first text on its line. */
  date: RegExp;
  /** Position of the description among the items on a row's date line. */
  narrationIndex: number;
  /** How far above its date line a row's description may start, in points. */
  lead: number;
  /**
   * A wrapped line ending more than this many points short of the column's
   * edge was broken at a space; otherwise a long word was cut.
   */
  wrapGap: number;
  amounts: (line: Line, narrationEnd: number, headings: Line | undefined) => RowAmounts | null;
}

const HDFC: Layout = {
  bank: 'HDFC Bank',
  detect: text => /HDFC\s*BANK/i.test(text) && /Withdrawal\s*Amt/i.test(text),
  // Only the first page has column headings; every page has the "Statement of account" line.
  isHeader: line => line.items.some(item => item.s.trim() === 'Narration') || /Statement of account$/i.test(line.text),
  date: /^(\d{2})\/(\d{2})\/(\d{2})$/,
  narrationIndex: 1,
  lead: SAME_LINE,
  wrapGap: 25,
  amounts(line, narrationEnd, headings) {
    const money = line.items.filter(item => item.x >= narrationEnd && MONEY.test(item.s.trim()));
    if (money.length < 2) {
      return null;
    }
    const amount = parseMoney(money[money.length - 2].s);
    if (amount === null) {
      return null;
    }
    const deposit = headings?.items.find(item => /^Deposit/i.test(item.s.trim()));
    return {
      amountMinor: amount,
      balanceMinor: parseMoney(money[money.length - 1].s),
      direction: deposit && money[money.length - 2].x >= deposit.x - 10 ? 'credit' : 'debit',
    };
  },
};

/** SBI prints "-" in the empty debit or credit column. */
const SBI: Layout = {
  bank: 'SBI',
  detect: text => /State\s+Bank\s+of\s+India/i.test(text) || /\bSBIN0\d{6}\b/.test(text),
  isHeader: line => line.items.some(item => item.s.trim() === 'Balance'),
  date: /^(\d{2})\/(\d{2})\/(\d{4})$/,
  narrationIndex: 2,
  lead: 8.5,
  wrapGap: 6,
  amounts(line, narrationEnd) {
    const cells = line.items
      .filter(item => item.x >= narrationEnd)
      .map(item => item.s.trim())
      .filter(text => text === '-' || MONEY.test(text));
    if (cells.length < 3) {
      return null;
    }
    const [debit, credit, balance] = cells.slice(-3).map(text => (text === '-' ? null : parseMoney(text)));
    const amount = debit ?? credit;
    if (amount === null || amount === undefined) {
      return null;
    }
    return { amountMinor: amount, balanceMinor: balance ?? null, direction: debit !== null ? 'debit' : 'credit' };
  },
};

const LAYOUTS = [HDFC, SBI];

const STOP = /STATEMENT\s+SUMMARY|^Page\s+no\b|computer\s+generated|^\*?Closing balance includes/i;
/** Text after the description, e.g. a reference number, value date, "-" or an amount. */
const CELL = /^[-\d,./]+(?:\s*(?:CR|DR))?$/i;

function isoDate(match: RegExpExecArray): string {
  const [, day, month, year] = match;
  return `${year.length === 2 ? `20${year}` : year}-${month}-${day}`;
}

function anyDate(text: string): string | null {
  const match = /^(\d{2})[/-](\d{2})[/-](\d{2}|\d{4})$/.exec(text);
  return match ? isoDate(match) : null;
}

interface Part {
  y: number;
  text: string;
  right: number;
}

interface RawRow {
  date: string;
  amounts: RowAmounts;
  parts: Part[];
}

function titleCase(name: string): string {
  return name.toLowerCase().replace(/(^|[\s.'-])(\p{L})/gu, (_, gap: string, letter: string) => gap + letter.toUpperCase());
}

function holderName(lines: readonly Line[]): string | null {
  for (const line of lines) {
    const left = line.items.filter(item => item.x < 300).map(item => item.s.trim()).join(' ');
    const match = /^(?:MR|MRS|MS|MISS|DR|SHRI|SMT)\.?\s+([A-Za-z][A-Za-z .]{2,60})$/i.exec(left);
    if (match) {
      return titleCase(match[1].trim());
    }
  }
  return null;
}

interface Summary {
  openingMinor: MinorUnits | null;
  closingMinor: MinorUnits | null;
  debitCount: number;
  creditCount: number;
  debitsMinor: MinorUnits | null;
  creditsMinor: MinorUnits | null;
}

/** The totals both banks print at the end: opening, debit count, credit count, debits, credits, closing. */
function summary(pages: readonly Line[][]): Summary | null {
  for (const lines of pages) {
    const at = lines.findIndex(line => /Opening\s+Balance|Brought\s+Forward/i.test(line.text));
    const values = at >= 0 ? lines[at + 1]?.items.map(item => item.s.trim()) : undefined;
    if (values && values.length >= 6) {
      const [opening, debitCount, creditCount, debits, credits, closing] = values.slice(-6);
      return {
        openingMinor: parseMoney(opening),
        closingMinor: parseMoney(closing),
        debitCount: Number(debitCount),
        creditCount: Number(creditCount),
        debitsMinor: parseMoney(debits),
        creditsMinor: parseMoney(credits),
      };
    }
  }
  return null;
}

function formatRupees(minor: MinorUnits): string {
  return `₹${(minor / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Reads the transactions in an HDFC Bank or SBI account statement from the
 * text of its PDF. Debit or credit comes from the running balance where
 * possible, else from the column the amount is in. Throws StatementError for
 * other banks or when no transactions are found.
 */
export function parseStatement(pages: StatementPages): ParsedStatement {
  const pageLines = pages.map(toLines);
  const firstPage = (pageLines[0] ?? []).map(line => line.text).join('\n');
  const layout = LAYOUTS.find(candidate => candidate.detect(firstPage));
  if (!layout) {
    throw new StatementError('Only HDFC Bank and SBI account statements can be read for now.');
  }

  const headings = pageLines.flat().find(line => line.items.length >= 4 && layout.isHeader(line));
  const bodies: Line[][] = [];
  for (const lines of pageLines) {
    const headerAt = lines.findLastIndex(layout.isHeader);
    if (headerAt < 0) {
      continue;
    }
    const body: Line[] = [];
    for (const line of lines.slice(headerAt + 1)) {
      if (STOP.test(line.text)) {
        break;
      }
      body.push(line);
    }
    bodies.push(body);
  }

  const isDateLine = (line: Line) =>
    line.items.length > layout.narrationIndex + 1 && layout.date.test(line.items[0].s.trim());
  const dateLines = bodies.flatMap(lines => lines.filter(isDateLine));
  if (dateLines.length === 0) {
    throw new StatementError('No transactions were found in this statement.');
  }
  const narrationStart = Math.min(...dateLines.map(line => line.items[layout.narrationIndex].x)) - 6;
  const narrationEnd =
    Math.min(
      ...dateLines.map(line => {
        const next = line.items.slice(layout.narrationIndex + 1).find(item => CELL.test(item.s.trim()));
        return next?.x ?? Infinity;
      }),
    ) - 1;

  const describe = (line: Line): Part | null => {
    const items = line.items.filter(item => item.x >= narrationStart && item.x < narrationEnd);
    if (items.length === 0) {
      return null;
    }
    const last = items[items.length - 1];
    return { y: line.y, text: items.map(item => item.s.trim()).join(' '), right: last.x + last.w };
  };

  const raw: RawRow[] = [];
  for (const lines of bodies) {
    const pageRows: { line: Line; row: RawRow }[] = [];
    for (const line of lines.filter(isDateLine)) {
      const date = layout.date.exec(line.items[0].s.trim());
      const amounts = layout.amounts(line, narrationEnd, headings);
      if (date && amounts) {
        const row = { date: isoDate(date), amounts, parts: [] };
        pageRows.push({ line, row });
        raw.push(row);
      }
    }
    const pageStart = raw.length - pageRows.length;
    for (const line of lines) {
      const part = describe(line);
      if (!part) {
        continue;
      }
      let owner: RawRow | undefined;
      for (const { line: dateLine, row } of pageRows) {
        if (dateLine.y + layout.lead >= line.y) {
          owner = row;
        } else {
          break;
        }
      }
      // Text above the page's first row continues the last row of the previous page.
      (owner ?? raw[pageStart - 1])?.parts.push(part);
    }
  }

  if (raw.length === 0) {
    throw new StatementError('No transactions were found in this statement.');
  }
  const columnRight = Math.max(...raw.flatMap(row => row.parts.map(part => part.right)));
  const join = (parts: Part[]): string => {
    let text = '';
    let previous: Part | null = null;
    for (const part of parts) {
      const spaced =
        previous !== null &&
        columnRight - previous.right > layout.wrapGap &&
        !/[-/]$/.test(text) &&
        !/^[-/]/.test(part.text);
      text += (spaced ? ' ' : '') + part.text;
      previous = part;
    }
    return text.replace(/\s+/g, ' ').trim();
  };

  const totals = summary(pageLines);
  const first = raw[0].amounts;
  let balance: MinorUnits | null =
    totals?.openingMinor ??
    (first.balanceMinor !== null
      ? first.balanceMinor + (first.direction === 'debit' ? first.amountMinor : -first.amountMinor)
      : null);
  const opening = balance;
  let breaks = 0;
  const rows: StatementRow[] = raw.map(({ date, amounts, parts }) => {
    let direction = amounts.direction;
    if (balance !== null && amounts.balanceMinor !== null) {
      if (balance - amounts.amountMinor === amounts.balanceMinor) {
        direction = 'debit';
      } else if (balance + amounts.amountMinor === amounts.balanceMinor) {
        direction = 'credit';
      } else {
        breaks += 1;
      }
    }
    balance = amounts.balanceMinor;
    return {
      date,
      direction,
      amountMinor: amounts.amountMinor,
      balanceMinor: amounts.balanceMinor,
      narration: join(parts),
    };
  });

  const problems: string[] = [];
  if (breaks > 0) {
    problems.push(`${breaks} ${breaks === 1 ? 'entry does' : 'entries do'} not match the running balance.`);
  }
  if (totals) {
    const debits = rows.filter(row => row.direction === 'debit');
    const credits = rows.filter(row => row.direction === 'credit');
    const sum = (list: StatementRow[]) => list.reduce((total, row) => total + row.amountMinor, 0);
    if (debits.length !== totals.debitCount || credits.length !== totals.creditCount) {
      problems.push(
        `Read ${debits.length} debits and ${credits.length} credits; the statement lists ` +
          `${totals.debitCount} and ${totals.creditCount}.`,
      );
    } else if (sum(debits) !== totals.debitsMinor || sum(credits) !== totals.creditsMinor) {
      problems.push(
        `Debits add up to ${formatRupees(sum(debits))} and credits to ${formatRupees(sum(credits))}, ` +
          'which differs from the statement totals.',
      );
    }
  }

  const firstText = firstPage.replace(/\s+/g, ' ');
  const period = /From\s*:?\s*(\d{2}[/-]\d{2}[/-]\d{4})\s*(?:To\s*:?|to)\s*(\d{2}[/-]\d{2}[/-]\d{4})/i.exec(firstText);
  const account = /Account\s*(?:No|Number)\.?\s*:?\s*(\d{6,})/i.exec(firstText);
  return {
    bank: layout.bank,
    holderName: holderName(pageLines[0] ?? []),
    accountLast4: account ? account[1].slice(-4) : null,
    periodStart: period ? anyDate(period[1]) : (rows[0]?.date ?? null),
    periodEnd: period ? anyDate(period[2]) : (rows[rows.length - 1]?.date ?? null),
    openingBalanceMinor: opening,
    closingBalanceMinor: totals?.closingMinor ?? rows[rows.length - 1]?.balanceMinor ?? null,
    rows,
    problems,
  };
}
