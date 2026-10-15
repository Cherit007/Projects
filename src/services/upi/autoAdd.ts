import type { SQLiteDatabase } from 'expo-sqlite';

import { listAccounts } from '../../data/repositories/accounts';
import { listCategories } from '../../data/repositories/categories';
import { getAutoAddPayments, getOwnerName } from '../../data/repositories/settings';
import { hasMonthlyRepeat, lastCategory, listCategorisedPayees } from '../../data/repositories/transactions';
import {
  confirmCandidate,
  findPossibleDuplicate,
  getCandidate,
  type UpiCandidate,
} from '../../data/repositories/upiCandidates';
import { predictCategoryName } from '../../domain/categories/autoCategory';
import { FRIENDS_CATEGORY, RENT_CATEGORY } from '../../domain/categories/defaults';
import { isOwnName, learnedCategoryId, learnWords, type LearnedWords } from '../../domain/categories/payeeHistory';
import { isUpiAccount, type Account, type Category, type TransactionInput } from '../../domain/types';

/** Regular payments to a person from this amount (₹3,000) up are taken for rent. */
const RENT_MIN_MINOR = 300_000;

interface Context {
  accounts: Account[];
  categories: Category[];
  learned: LearnedWords;
  ownerName: string;
}

/**
 * Category for a detected payment: the payee's last category, else what the
 * user gives payees ending in the same word, else the predicted one (a known
 * merchant, Friends for people, a shop category, or Other). Monthly
 * same-amount payments to a person become rent unless the user chose otherwise.
 */
async function chooseCategory(db: SQLiteDatabase, candidate: UpiCandidate, context: Context): Promise<string | null> {
  const type = candidate.direction === 'credit' ? 'income' : 'expense';
  const payee = candidate.counterparty;
  const byName = (name: string) => context.categories.find(c => c.type === type && c.name === name)?.id ?? null;
  const last = payee ? await lastCategory(db, payee, type) : null;
  const categoryId =
    last?.categoryId ??
    learnedCategoryId(context.learned, payee, type) ??
    byName(predictCategoryName(payee, type, candidate.payeeKind));

  const friends = byName(FRIENDS_CATEGORY);
  if (
    payee &&
    type === 'expense' &&
    categoryId === friends &&
    !last?.edited &&
    candidate.amountMinor !== null &&
    candidate.amountMinor >= RENT_MIN_MINOR &&
    (await hasMonthlyRepeat(db, payee, type, candidate.amountMinor, candidate.detectedAt))
  ) {
    return byName(RENT_CATEGORY) ?? categoryId;
  }
  return categoryId;
}

/**
 * A payment to or from the user's own name moves money between their
 * accounts. Recorded as a transfer when there is exactly one other bank or
 * wallet account to pair it with; otherwise null (left for review).
 */
function ownTransfer(candidate: UpiCandidate, account: Account, context: Context): TransactionInput | null {
  const other = context.accounts.filter(a => isUpiAccount(a) && a.id !== account.id);
  if (other.length !== 1 || candidate.amountMinor === null) {
    return null;
  }
  const outgoing = candidate.direction === 'debit';
  return {
    type: 'transfer',
    amountMinor: candidate.amountMinor,
    occurredAt: candidate.detectedAt,
    accountId: outgoing ? account.id : other[0].id,
    toAccountId: outgoing ? other[0].id : account.id,
    categoryId: null,
    counterparty: candidate.counterparty,
    note: null,
  };
}

/**
 * Adds detected payments: transfers to the user's own name between their
 * accounts, everything else with a category from chooseCategory. Failed or
 * pending payments, possible duplicates, unpaired own transfers and archived
 * categories stay in the review list. Returns how many were added.
 */
export async function autoAddCandidates(db: SQLiteDatabase, candidateIds: readonly string[]): Promise<number> {
  if (candidateIds.length === 0 || !(await getAutoAddPayments(db))) {
    return 0;
  }
  const [accounts, categories, payees, ownerName] = await Promise.all([
    listAccounts(db),
    listCategories(db),
    listCategorisedPayees(db),
    getOwnerName(db),
  ]);
  const account = accounts.find(isUpiAccount) ?? accounts.find(a => a.type === 'cash');
  if (!account) {
    return 0;
  }
  const context: Context = { accounts, categories, learned: learnWords(payees), ownerName };

  let added = 0;
  for (const id of candidateIds) {
    const candidate = await getCandidate(db, id);
    if (
      !candidate ||
      candidate.reviewState !== 'needs_review' ||
      candidate.status !== 'success' ||
      candidate.amountMinor === null ||
      candidate.direction === null ||
      (await findPossibleDuplicate(db, candidate))
    ) {
      continue;
    }
    let input: TransactionInput | null;
    if (isOwnName(candidate.counterparty, ownerName)) {
      input = ownTransfer(candidate, account, context);
    } else {
      const categoryId = await chooseCategory(db, candidate, context);
      input = categoryId
        ? {
            type: candidate.direction === 'credit' ? 'income' : 'expense',
            amountMinor: candidate.amountMinor,
            occurredAt: candidate.detectedAt,
            accountId: account.id,
            toAccountId: null,
            categoryId,
            counterparty: candidate.counterparty,
            note: null,
          }
        : null;
    }
    if (!input) {
      continue;
    }
    await confirmCandidate(db, candidate, input);
    added += 1;
  }
  return added;
}
