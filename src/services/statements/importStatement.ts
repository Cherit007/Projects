import type { SQLiteDatabase } from 'expo-sqlite';

import { nowIso } from '../../data/local/ids';
import { createAccount, getAccount, getAccountFlows, listAccounts, updateAccount } from '../../data/repositories/accounts';
import { listCategories } from '../../data/repositories/categories';
import { getOwnerName } from '../../data/repositories/settings';
import { createTransaction, lastCategory, listCategorisedPayees } from '../../data/repositories/transactions';
import { accountBalance } from '../../domain/accounting/accounting';
import { OTHER_CATEGORY, OTHER_INCOME_CATEGORY, SALARY_CATEGORY } from '../../domain/categories/defaults';
import { isOwnName, learnWords } from '../../domain/categories/payeeHistory';
import { accountIsAtBank, STATEMENT_BANK_CODE } from '../../domain/statements/banks';
import { parseNarration, type NarrationInfo } from '../../domain/statements/narration';
import type { ParsedStatement, StatementRow } from '../../domain/statements/types';
import { isUpiAccount, type Account, type TransactionInput } from '../../domain/types';
import { chooseCategory, type Context } from '../upi/autoAdd';

/** Stands in for the account id when the statement goes into a new account. */
export const NEW_ACCOUNT = 'new';

const DAY_MS = 24 * 60 * 60 * 1000;
/** Repeated credits from one payer at least this large (₹10,000) are taken for salary. */
const SALARY_MIN_MINOR = 1_000_000;

export interface PlannedRow {
  index: number;
  row: StatementRow;
  reference: string | null;
  /** What gets added: the account is NEW_ACCOUNT when the statement goes into a new account. */
  input: TransactionInput;
  /** Category name, or where a transfer goes. */
  label: string;
  /** A transaction already in the app that records this row. */
  existing: { id: string; accountId: string } | null;
}

export interface ImportPlan {
  statement: ParsedStatement;
  accountId: string;
  accountName: string;
  rows: PlannedRow[];
  /** Transactions in the account during the statement's dates that are not on the statement. */
  notOnStatement: number;
}

interface ExistingRow {
  id: string;
  type: 'income' | 'expense' | 'transfer';
  amount_minor: number;
  occurred_at: string;
  account_id: string;
  to_account_id: string | null;
  source: string;
  external_reference: string | null;
}

/** Statement dates are local calendar days; rows are placed at noon, a second apart, in statement order. */
function occurredAt(date: string, sequence: number): string {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, sequence).toISOString();
}

function localDay(iso: string): number {
  const d = new Date(iso);
  return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY_MS;
}

function statementDay(date: string): number {
  return Date.parse(`${date}T00:00:00Z`) / DAY_MS;
}

function dateRange(statement: ParsedStatement): { first: string; last: string } {
  const dates = [statement.periodStart, statement.periodEnd, ...statement.rows.map(row => row.date)].filter(
    (date): date is string => !!date,
  );
  dates.sort();
  return { first: dates[0], last: dates[dates.length - 1] };
}

/** The bank or wallet account a statement most likely belongs to, by name. */
export function suggestAccount(accounts: readonly Account[], statement: ParsedStatement): Account | null {
  const code = STATEMENT_BANK_CODE[statement.bank];
  return accounts.find(account => isUpiAccount(account) && !account.isArchived && accountIsAtBank(account.name, code)) ?? null;
}

/** Payers whose large credits repeat in at least two months at about the same amount. */
function salaryPayers(rows: readonly StatementRow[], infos: readonly NarrationInfo[]): Set<string> {
  const byPayer = new Map<string, { months: Set<string>; amounts: number[] }>();
  rows.forEach((row, i) => {
    const key = infos[i].payee?.toLowerCase();
    if (row.direction !== 'credit' || row.amountMinor < SALARY_MIN_MINOR || !key) {
      return;
    }
    const entry = byPayer.get(key) ?? { months: new Set(), amounts: [] };
    entry.months.add(row.date.slice(0, 7));
    entry.amounts.push(row.amountMinor);
    byPayer.set(key, entry);
  });
  const payers = new Set<string>();
  for (const [key, { months, amounts }] of byPayer) {
    if (months.size >= 2 && Math.max(...amounts) <= Math.min(...amounts) * 1.1) {
      payers.add(key);
    }
  }
  return payers;
}

/**
 * Works out what importing a statement into an account would do, without
 * saving anything: each row is either already in the app (same amount and
 * direction within a day, preferring the same reference and account) or
 * becomes a new transaction. Payments the app detected into another bank or
 * wallet account are moved to this one. The user's own name means a transfer
 * between their accounts, ATM withdrawals go to the cash account, and CRED or
 * credit-card payments go to the only credit card. Everything else gets the
 * category detected payments would get.
 */
export async function planStatementImport(
  db: SQLiteDatabase,
  statement: ParsedStatement,
  accountId: string,
): Promise<ImportPlan> {
  const [accounts, categories, payees, ownerName] = await Promise.all([
    listAccounts(db),
    listCategories(db),
    listCategorisedPayees(db),
    getOwnerName(db),
  ]);
  const account = accounts.find(a => a.id === accountId);
  if (accountId !== NEW_ACCOUNT && !account) {
    throw new Error('That account no longer exists.');
  }
  const accountName = account?.name ?? statement.bank;
  const planned: { payee: string; type: 'income' | 'expense'; amountMinor: number; at: number }[] = [];
  const context: Context = {
    accounts,
    categories,
    learned: learnWords(payees),
    ownerName,
    pendingRepeat: (payee, type, amountMinor, at) => {
      const time = Date.parse(at);
      return planned.some(
        p =>
          p.payee === payee.toLowerCase() &&
          p.type === type &&
          p.amountMinor >= amountMinor * 0.95 &&
          p.amountMinor <= amountMinor * 1.05 &&
          p.at >= time - 35 * DAY_MS &&
          p.at <= time - 25 * DAY_MS,
      );
    },
  };
  const categoryId = (name: string, type: 'income' | 'expense') =>
    categories.find(c => c.name === name && c.type === type && !c.isArchived)?.id ?? null;
  const categoryName = (id: string | null) => categories.find(c => c.id === id)?.name ?? 'Uncategorised';

  const others = accounts.filter(a => isUpiAccount(a) && a.id !== accountId);
  const ownBank = STATEMENT_BANK_CODE[statement.bank];
  const pairAccount = (otherBank: string | null): Account | null => {
    if (otherBank && otherBank !== ownBank) {
      return others.find(a => accountIsAtBank(a.name, otherBank)) ?? null;
    }
    return others.length === 1 ? others[0] : null;
  };
  const cash = accounts.find(a => a.type === 'cash');
  const cards = accounts.filter(a => a.type === 'card');
  const isOwn = (payee: string | null) => isOwnName(payee, ownerName) || isOwnName(payee, statement.holderName);

  const { first, last } = dateRange(statement);
  const existing = await db.getAllAsync<ExistingRow>(
    `SELECT id, type, amount_minor, occurred_at, account_id, to_account_id, source, external_reference
     FROM transactions WHERE occurred_at >= ? AND occurred_at < ?`,
    new Date(Date.parse(`${first}T00:00:00Z`) - 2 * DAY_MS).toISOString(),
    new Date(Date.parse(`${last}T00:00:00Z`) + 3 * DAY_MS).toISOString(),
  );
  const detectedElsewhere = (t: ExistingRow) =>
    (t.source === 'upi_notification' || t.source === 'bank_sms') &&
    t.account_id !== accountId &&
    others.some(a => a.id === t.account_id);
  const used = new Set<string>();
  /**
   * An existing transfer only stands for a row that moves money between the
   * same two accounts; an income or expense stands for any row in the same
   * direction (the user may have recorded their own transfer as spending).
   */
  const findExisting = (row: StatementRow, reference: string | null, input: TransactionInput): ExistingRow | null => {
    const day = statementDay(row.date);
    const debit = row.direction === 'debit';
    const counterpart = input.type === 'transfer' ? (debit ? input.toAccountId : input.accountId) : null;
    let best: ExistingRow | null = null;
    let bestScore = Infinity;
    for (const t of existing) {
      const gap = Math.abs(localDay(t.occurred_at) - day);
      if (used.has(t.id) || t.amount_minor !== row.amountMinor || gap > 1) {
        continue;
      }
      const sameTransfer =
        t.type === 'transfer' &&
        counterpart !== null &&
        (debit
          ? t.account_id === accountId && t.to_account_id === counterpart
          : t.to_account_id === accountId && t.account_id === counterpart);
      const here = sameTransfer || (t.type === (debit ? 'expense' : 'income') && t.account_id === accountId);
      const elsewhere = t.type === (debit ? 'expense' : 'income') && detectedElsewhere(t);
      if (!here && !elsewhere) {
        continue;
      }
      const score =
        (reference && t.external_reference === reference ? 0 : 20) +
        ((t.type === 'transfer') === (input.type === 'transfer') ? 0 : 6) +
        (here ? 0 : 10) +
        gap * 4;
      if (score < bestScore) {
        best = t;
        bestScore = score;
      }
    }
    return best;
  };

  const infos = statement.rows.map(row => parseNarration(row.narration));
  const salary = salaryPayers(statement.rows, infos);
  const perDay = new Map<string, number>();
  const rows: PlannedRow[] = [];
  for (const [index, row] of statement.rows.entries()) {
    const info = infos[index];
    const sequence = perDay.get(row.date) ?? 0;
    perDay.set(row.date, sequence + 1);
    const at = occurredAt(row.date, sequence);
    const debit = row.direction === 'debit';
    const type = debit ? 'expense' : 'income';
    const base: TransactionInput = {
      type,
      amountMinor: row.amountMinor,
      occurredAt: at,
      accountId,
      toAccountId: null,
      categoryId: null,
      counterparty: info.payee,
      note: null,
    };
    const transfer = (other: Account, label: string): { input: TransactionInput; label: string } => ({
      input: {
        ...base,
        type: 'transfer',
        accountId: debit ? accountId : other.id,
        toAccountId: debit ? other.id : accountId,
      },
      label,
    });

    let plan: { input: TransactionInput; label: string };
    const pair = isOwn(info.payee) ? pairAccount(info.otherBank) : null;
    if (pair) {
      plan = transfer(pair, debit ? `To ${pair.name}` : `From ${pair.name}`);
    } else if (isOwn(info.payee)) {
      const id = categoryId(debit ? OTHER_CATEGORY : OTHER_INCOME_CATEGORY, type);
      plan = { input: { ...base, categoryId: id }, label: debit ? 'To your other account' : 'From your other account' };
    } else if (info.channel === 'atm' && debit && cash) {
      plan = transfer(cash, `To ${cash.name}`);
    } else if (debit && cards.length === 1 && /^cred\b|credit\s*card/i.test(info.payee ?? '')) {
      plan = transfer(cards[0], `To ${cards[0].name}`);
    } else {
      let id = await chooseCategory(
        db,
        {
          direction: row.direction,
          counterparty: info.payee,
          amountMinor: row.amountMinor,
          payeeKind: info.payeeKind,
          detectedAt: at,
        },
        context,
      );
      const payer = info.payee?.toLowerCase();
      const learned = info.payee ? await lastCategory(db, info.payee, type) : null;
      if (
        !debit &&
        !learned &&
        (info.salary || (payer && salary.has(payer) && categoryName(id) === OTHER_INCOME_CATEGORY))
      ) {
        id = categoryId(SALARY_CATEGORY, 'income') ?? id;
      }
      plan = { input: { ...base, categoryId: id }, label: categoryName(id) };
      if (info.payee) {
        planned.push({ payee: info.payee.toLowerCase(), type, amountMinor: row.amountMinor, at: Date.parse(at) });
      }
    }

    const match = findExisting(row, info.reference, plan.input);
    if (match) {
      used.add(match.id);
    }
    rows.push({
      index,
      row,
      reference: info.reference,
      ...plan,
      existing: match ? { id: match.id, accountId: match.account_id } : null,
    });
  }

  const startDay = statementDay(first);
  const endDay = statementDay(last);
  const notOnStatement = existing.filter(t => {
    const day = localDay(t.occurred_at);
    return (
      !used.has(t.id) &&
      (t.account_id === accountId || t.to_account_id === accountId) &&
      day >= startDay &&
      day <= endDay
    );
  }).length;

  return { statement, accountId, accountName, rows, notOnStatement };
}

export interface ImportResult {
  accountId: string;
  added: number;
  moved: number;
}

/**
 * Saves a plan in one database transaction: adds the new rows (except
 * `skipped` indexes) and moves detected payments recorded in another account.
 * A new account starts at the statement's opening balance.
 */
export async function applyStatementImport(
  db: SQLiteDatabase,
  plan: ImportPlan,
  skipped: ReadonlySet<number> = new Set(),
): Promise<ImportResult> {
  let accountId = plan.accountId;
  let added = 0;
  let moved = 0;
  await db.withTransactionAsync(async () => {
    if (accountId === NEW_ACCOUNT) {
      accountId = await createAccount(db, {
        name: plan.accountName,
        type: 'bank',
        openingBalanceMinor: plan.statement.openingBalanceMinor ?? 0,
      });
    }
    const resolve = (id: string | null) => (id === NEW_ACCOUNT ? accountId : id);
    for (const row of plan.rows) {
      if (row.existing) {
        if (row.existing.accountId !== accountId && row.input.type !== 'transfer') {
          await db.runAsync(
            'UPDATE transactions SET account_id = ?, updated_at = ? WHERE id = ?',
            accountId,
            nowIso(),
            row.existing.id,
          );
          moved += 1;
        }
        continue;
      }
      if (skipped.has(row.index)) {
        continue;
      }
      await createTransaction(
        db,
        { ...row.input, accountId: resolve(row.input.accountId) ?? accountId, toAccountId: resolve(row.input.toAccountId) },
        { source: 'statement', externalReference: row.reference },
      );
      added += 1;
    }
  });
  return { accountId, added, moved };
}

export interface BalanceCheck {
  /** What the app shows for the account at the end of the statement. */
  appMinor: number;
  /** The statement's closing balance. */
  statementMinor: number;
}

/** The account's balance in the app at the end of the statement, next to the statement's closing balance. */
export async function checkStatementBalance(
  db: SQLiteDatabase,
  accountId: string,
  statement: ParsedStatement,
): Promise<BalanceCheck | null> {
  const account = await getAccount(db, accountId);
  if (!account || statement.closingBalanceMinor === null) {
    return null;
  }
  const { last } = dateRange(statement);
  const [year, month, day] = last.split('-').map(Number);
  const flows = await getAccountFlows(db, new Date(year, month - 1, day + 1).toISOString());
  return { appMinor: accountBalance(account, flows.get(accountId)), statementMinor: statement.closingBalanceMinor };
}

/** Changes the account's starting balance so its balance at the end of the statement matches it. */
export async function matchStatementBalance(db: SQLiteDatabase, accountId: string, check: BalanceCheck): Promise<void> {
  const account = await getAccount(db, accountId);
  if (!account) {
    return;
  }
  await updateAccount(db, accountId, {
    name: account.name,
    type: account.type,
    openingBalanceMinor: account.openingBalanceMinor + check.statementMinor - check.appMinor,
  });
}
