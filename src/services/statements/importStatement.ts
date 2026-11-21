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
import { WALLET_PROVIDERS, type ParsedStatement, type StatementRow } from '../../domain/statements/types';
import { isUpiAccount, type Account, type TransactionInput } from '../../domain/types';
import { chooseCategory, type Context } from '../upi/autoAdd';

/** Stands in for the account id when the statement goes into a new account. */
export const NEW_ACCOUNT = 'new';

const DAY_MS = 24 * 60 * 60 * 1000;
/** Expense category for wallet top-up fees. */
const FEES_CATEGORY = 'Loan interest and fees';
/** MobiKwik charges about 3% (2.997%) to add money from a credit card. */
const TOP_UP_FEE = 0.02997;
/** A card charge up to this much above a top-up is taken for that top-up plus its fee. */
const MAX_TOP_UP_FEE = 0.035;
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
  /**
   * A transaction already in the app that records this row. `becomesTransfer`
   * marks the other account's side of a move between the user's own accounts,
   * recorded as spending or income before both accounts existed; importing
   * turns it into the transfer instead of adding a second entry.
   */
  existing: { id: string; accountId: string; becomesTransfer: boolean } | null;
  /** A wallet payment that failed and was refunded, or its refund; the two cancel out and are left out by default. */
  reversed: boolean;
  /** A wallet top-up from a credit card: the card's fee, saved as a separate expense on the card. */
  fee: { amountMinor: number; accountId: string; estimated: boolean } | null;
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
  counterparty: string | null;
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
    `SELECT id, type, amount_minor, occurred_at, account_id, to_account_id, source, external_reference, counterparty
     FROM transactions WHERE occurred_at >= ? AND occurred_at < ?`,
    new Date(Date.parse(`${first}T00:00:00Z`) - 2 * DAY_MS).toISOString(),
    new Date(Date.parse(`${last}T00:00:00Z`) + 3 * DAY_MS).toISOString(),
  );
  // Payments detected before the user added their bank accounts were filed under cash.
  const detectedElsewhere = (t: ExistingRow) =>
    (t.source === 'upi_notification' || t.source === 'bank_sms') &&
    t.account_id !== accountId &&
    (others.some(a => a.id === t.account_id) || t.account_id === cash?.id);
  const used = new Set<string>();

  const isWalletName = (payee: string | null) => !!payee && accountIsAtBank(payee, 'MOBK');
  const walletAccount = others.find(a => a.type === 'wallet' && accountIsAtBank(a.name, 'MOBK')) ?? null;
  /** On another account's statement, the other side of a move into or out of this one. */
  const selfLike = (payee: string | null) =>
    isOwn(payee) || (statement.bank === 'MobiKwik' && isWalletName(payee));
  /** Whether `other` already records the other side of this row (as a transfer, or as an own-name entry). */
  const counterpartIn = (other: string, row: StatementRow): boolean => {
    const day = statementDay(row.date);
    const debit = row.direction === 'debit';
    return existing.some(
      t =>
        !used.has(t.id) &&
        t.amount_minor === row.amountMinor &&
        Math.abs(localDay(t.occurred_at) - day) <= 1 &&
        ((t.type === 'transfer' &&
          (debit
            ? t.account_id === accountId && t.to_account_id === other
            : t.account_id === other && t.to_account_id === accountId)) ||
          (t.source === 'statement' &&
            t.account_id === other &&
            t.type === (debit ? 'income' : 'expense') &&
            selfLike(t.counterparty))),
    );
  };
  /** Accounts imported from a statement only take a transfer their statement shows. */
  const covered = (id: string) =>
    existing.some(t => t.source === 'statement' && (t.account_id === id || t.to_account_id === id));
  const pairOwn = (row: StatementRow, otherBank: string | null): Account | null => {
    const withCounterpart = others.filter(a => counterpartIn(a.id, row));
    if (withCounterpart.length > 0) {
      return withCounterpart.find(a => otherBank !== null && accountIsAtBank(a.name, otherBank)) ?? withCounterpart[0];
    }
    const fallback = pairAccount(otherBank);
    return fallback && !covered(fallback.id) ? fallback : null;
  };
  /**
   * Where money added to a wallet came from, and the fee for it:
   * - an account whose records show the payment;
   * - else a card charge a little above the top-up (the wallet's card fee) the same day or next;
   * - else the only credit card, with the usual fee estimated.
   * With several cards and no evidence it stays unknown.
   */
  const topUpSource = (
    row: StatementRow,
  ): { account: Account; charge: ExistingRow | null; feeMinor: number; estimated: boolean } | null => {
    const shown = [...others, ...cards].find(a => counterpartIn(a.id, row));
    if (shown) {
      return { account: shown, charge: null, feeMinor: 0, estimated: false };
    }
    const day = statementDay(row.date);
    const charge = existing.find(
      t =>
        !used.has(t.id) &&
        t.type === 'expense' &&
        cards.some(c => c.id === t.account_id) &&
        t.amount_minor >= row.amountMinor &&
        t.amount_minor <= Math.round(row.amountMinor * (1 + MAX_TOP_UP_FEE)) &&
        Math.abs(localDay(t.occurred_at) - day) <= 1,
    );
    if (charge) {
      const card = cards.find(c => c.id === charge.account_id)!;
      return { account: card, charge, feeMinor: charge.amount_minor - row.amountMinor, estimated: false };
    }
    return cards.length === 1
      ? { account: cards[0], charge: null, feeMinor: Math.round(row.amountMinor * TOP_UP_FEE), estimated: true }
      : null;
  };
  /** Wallet payments that failed and were refunded: "Paid to X" and "Refund from X" for the same amount. */
  const reversed = new Set<number>();
  if (WALLET_PROVIDERS.has(statement.bank)) {
    statement.rows.forEach((refund, i) => {
      if (refund.direction !== 'credit' || !/^(?:Refund|Money\s+received)\s+from\s/i.test(refund.narration)) {
        return;
      }
      const payee = refund.narration.replace(/^(?:Refund|Money\s+received)\s+from\s+/i, '').toLowerCase();
      const payment = statement.rows.findIndex(
        (paid, j) =>
          !reversed.has(j) &&
          paid.direction === 'debit' &&
          paid.amountMinor === refund.amountMinor &&
          Math.abs(statementDay(paid.date) - statementDay(refund.date)) <= 1 &&
          paid.narration.replace(/^Paid\s+to\s+/i, '').toLowerCase() === payee,
      );
      if (payment >= 0) {
        reversed.add(i);
        reversed.add(payment);
      }
    });
  }
  /**
   * An existing transfer only stands for a row that moves money between the
   * same two accounts; an income or expense stands for any row in the same
   * direction (the user may have recorded their own transfer as spending).
   * For a transfer, the other account's statement entry for the same move
   * (spending or income to the user's own name) also counts.
   */
  const findExisting = (
    row: StatementRow,
    reference: string | null,
    input: TransactionInput,
    hereOnly = false,
  ): { match: ExistingRow; becomesTransfer: boolean } | null => {
    const day = statementDay(row.date);
    const debit = row.direction === 'debit';
    const counterpart = input.type === 'transfer' ? (debit ? input.toAccountId : input.accountId) : null;
    let best: { match: ExistingRow; becomesTransfer: boolean } | null = null;
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
      const otherSide =
        counterpart !== null &&
        t.source === 'statement' &&
        t.account_id === counterpart &&
        t.type === (debit ? 'income' : 'expense') &&
        selfLike(t.counterparty);
      if (hereOnly ? !here : !here && !elsewhere && !otherSide) {
        continue;
      }
      const score =
        (reference && t.external_reference === reference ? 0 : 20) +
        ((t.type === 'transfer') === (input.type === 'transfer') || otherSide ? 0 : 6) +
        (here ? 0 : 10) +
        gap * 4;
      if (score < bestScore) {
        best = { match: t, becomesTransfer: otherSide && !here };
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
    // A bank entry naming the wallet is a top-up or withdrawal, unless the imported wallet shows nothing matching.
    const toWallet =
      walletAccount !== null &&
      isWalletName(info.payee) &&
      (counterpartIn(walletAccount.id, row) || !covered(walletAccount.id));
    const own = isOwn(info.payee) || toWallet;
    const topUp = !reversed.has(index) && !own && info.channel === 'topup' && !debit ? topUpSource(row) : null;
    const pair = reversed.has(index)
      ? null
      : toWallet
        ? walletAccount
        : own
          ? pairOwn(row, info.otherBank)
          : (topUp?.account ?? null);
    if (reversed.has(index)) {
      const id = categoryId(debit ? OTHER_CATEGORY : OTHER_INCOME_CATEGORY, type);
      plan = { input: { ...base, categoryId: id }, label: debit ? 'Failed payment, refunded' : 'Refund of a failed payment' };
    } else if (pair) {
      plan = transfer(pair, debit ? `To ${pair.name}` : `From ${pair.name}`);
    } else if (own) {
      const id = categoryId(debit ? OTHER_CATEGORY : OTHER_INCOME_CATEGORY, type);
      plan = { input: { ...base, categoryId: id }, label: debit ? 'To your other account' : 'From your other account' };
    } else if (info.channel === 'topup' || info.channel === 'cashback') {
      const id = categoryId(debit ? OTHER_CATEGORY : OTHER_INCOME_CATEGORY, type);
      plan = {
        input: { ...base, categoryId: id },
        label: info.channel === 'cashback' ? 'Cashback' : 'Top-up from an account not in the app',
      };
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

    let found = reversed.has(index) ? null : findExisting(row, info.reference, plan.input);
    // The card charge for a top-up (amount plus fee) becomes the transfer, and its fee a separate expense.
    if (!found && topUp?.charge) {
      found = { match: topUp.charge, becomesTransfer: true };
    }
    if (found) {
      used.add(found.match.id);
    }
    const charged = topUp !== null && (found === null || found.match === topUp.charge);
    rows.push({
      index,
      row,
      reference: info.reference,
      ...plan,
      label:
        charged && topUp.feeMinor > 0
          ? `${plan.label} + ₹${(topUp.feeMinor / 100).toFixed(2)} fee${topUp.estimated ? ' (estimated)' : ''}`
          : plan.label,
      existing: found
        ? { id: found.match.id, accountId: found.match.account_id, becomesTransfer: found.becomesTransfer }
        : null,
      reversed: reversed.has(index),
      fee:
        charged && topUp.feeMinor > 0
          ? { amountMinor: topUp.feeMinor, accountId: topUp.account.id, estimated: topUp.estimated }
          : null,
    });
  }
  // Failed payments are matched last and only within this account, so they never claim the
  // real payment of the same amount made right after them, or a payment detected elsewhere.
  for (const planned of rows) {
    if (!planned.reversed) {
      continue;
    }
    const found = findExisting(planned.row, planned.reference, planned.input, true);
    if (found) {
      used.add(found.match.id);
      planned.existing = { id: found.match.id, accountId: found.match.account_id, becomesTransfer: false };
    }
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
        type: WALLET_PROVIDERS.has(plan.statement.bank) ? 'wallet' : 'bank',
        openingBalanceMinor: plan.statement.openingBalanceMinor ?? 0,
      });
    }
    const resolve = (id: string | null) => (id === NEW_ACCOUNT ? accountId : id);
    const feeCategory = (await listCategories(db)).find(c => c.type === 'expense' && c.name === FEES_CATEGORY)?.id ?? null;
    const addFee = async (row: PlannedRow) => {
      if (!row.fee) {
        return;
      }
      await createTransaction(
        db,
        {
          type: 'expense',
          amountMinor: row.fee.amountMinor,
          occurredAt: row.input.occurredAt,
          accountId: row.fee.accountId,
          toAccountId: null,
          categoryId: feeCategory,
          counterparty: `${plan.statement.bank} top-up fee${row.fee.estimated ? ' (estimated)' : ''}`,
          note: null,
        },
        { source: 'statement', externalReference: null },
      );
    };
    for (const row of plan.rows) {
      if (row.existing?.becomesTransfer) {
        // A card charge for a top-up includes the fee; the transfer is the amount that reached the wallet.
        await db.runAsync(
          `UPDATE transactions SET type = 'transfer', amount_minor = ?, account_id = ?, to_account_id = ?,
             category_id = NULL, updated_at = ? WHERE id = ?`,
          row.row.amountMinor,
          resolve(row.input.accountId),
          resolve(row.input.toAccountId),
          nowIso(),
          row.existing.id,
        );
        await addFee(row);
        moved += 1;
        continue;
      }
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
      await addFee(row);
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
