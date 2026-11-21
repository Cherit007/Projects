import type { SQLiteDatabase } from 'expo-sqlite';

import { listAccounts } from '../../data/repositories/accounts';
import { listCategories } from '../../data/repositories/categories';
import { findMerchantRule } from '../../data/repositories/merchantRules';
import { nowIso } from '../../data/local/ids';
import { getAutoAddPayments, getOwnerName } from '../../data/repositories/settings';
import {
  createTransaction,
  hasMonthlyRepeat,
  lastCategory,
  listCategorisedPayees,
} from '../../data/repositories/transactions';
import {
  confirmCandidate,
  findPossibleDuplicate,
  getCandidate,
  linkCandidate,
  type UpiCandidate,
} from '../../data/repositories/upiCandidates';
import { predictCategoryName } from '../../domain/categories/autoCategory';
import { FRIENDS_CATEGORY, RENT_CATEGORY } from '../../domain/categories/defaults';
import { isOwnName, learnedCategoryId, learnWords, type LearnedWords } from '../../domain/categories/payeeHistory';
import { isUpiAccount, type Account, type Category, type TransactionInput } from '../../domain/types';
import { accountForDetectedPayment } from '../../domain/upi/smsAccount';
import { findWalletCredit, isWalletName, pairWalletMove, splitTopUpCharge } from './walletMoves';

/** Expense category for wallet top-up fees. */
const FEES_CATEGORY = 'Loan interest and fees';

/** Regular payments to a person from this amount (₹3,000) up are taken for rent. */
const RENT_MIN_MINOR = 300_000;

export interface Context {
  accounts: Account[];
  categories: Category[];
  learned: LearnedWords;
  ownerName: string;
  /** Payments not saved yet (e.g. earlier rows of a statement) that count as a monthly repeat. */
  pendingRepeat?: (payee: string, type: 'income' | 'expense', amountMinor: number, occurredAt: string) => boolean;
}

export type Payment = Pick<UpiCandidate, 'direction' | 'counterparty' | 'amountMinor' | 'payeeKind' | 'detectedAt'>;

/**
 * Category for a detected payment: the payee's last category, else what the
 * user gives payees ending in the same word, else the predicted one (a known
 * merchant, Friends for people, a shop category, or Other). Monthly
 * same-amount payments to a person become rent unless the user chose otherwise.
 */
export async function chooseCategory(db: SQLiteDatabase, candidate: Payment, context: Context): Promise<string | null> {
  const type = candidate.direction === 'credit' ? 'income' : 'expense';
  const payee = candidate.counterparty;
  const byName = (name: string) => context.categories.find(c => c.type === type && c.name === name)?.id ?? null;
  const rule = payee ? await findMerchantRule(db, payee) : null;
  if (rule && context.categories.some(c => c.id === rule.categoryId && c.type === type)) {
    return rule.categoryId;
  }
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
    (context.pendingRepeat?.(payee, type, candidate.amountMinor, candidate.detectedAt) ||
      (await hasMonthlyRepeat(db, payee, type, candidate.amountMinor, candidate.detectedAt)))
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
 * Saves a card charge at the wallet as a transfer from the card of the amount
 * that reached the wallet, and the rest as a fee on the card. When the
 * wallet's own "money added" message was saved first, that becomes the transfer.
 */
async function recordTopUp(
  db: SQLiteDatabase,
  candidate: UpiCandidate,
  chargeMinor: number,
  card: Account,
  wallet: Account,
  categories: readonly Category[],
): Promise<void> {
  const { topUpMinor, feeMinor } = splitTopUpCharge(chargeMinor);
  const credited = await findWalletCredit(db, wallet.id, topUpMinor, candidate.detectedAt);
  if (credited) {
    await db.runAsync(
      `UPDATE transactions SET type = 'transfer', account_id = ?, to_account_id = ?, category_id = NULL,
         counterparty = 'Wallet top-up', updated_at = ? WHERE id = ?`,
      card.id,
      wallet.id,
      nowIso(),
      credited,
    );
    await linkCandidate(db, candidate.id, credited);
  } else {
    await confirmCandidate(db, candidate, {
      type: 'transfer',
      amountMinor: topUpMinor,
      occurredAt: candidate.detectedAt,
      accountId: card.id,
      toAccountId: wallet.id,
      categoryId: null,
      counterparty: 'Wallet top-up',
      note: null,
    });
  }
  if (feeMinor > 0) {
    await createTransaction(
      db,
      {
        type: 'expense',
        amountMinor: feeMinor,
        occurredAt: candidate.detectedAt,
        accountId: card.id,
        toAccountId: null,
        categoryId: categories.find(c => c.type === 'expense' && c.name === FEES_CATEGORY)?.id ?? null,
        counterparty: `${wallet.name} top-up fee`,
        note: null,
      },
      { source: 'bank_sms', externalReference: null },
    );
  }
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
    const account = accountForDetectedPayment(candidate, accounts);
    if (!account) {
      continue;
    }
    const isSelf = (payee: string | null) => !payee || isOwnName(payee, ownerName) || isWalletName(payee);

    // A card charge at the wallet is a top-up: a transfer of what reached the wallet, plus the fee.
    const wallet = accounts.find(a => a.type === 'wallet' && !a.isArchived && isWalletName(a.name));
    if (account.type === 'card' && candidate.direction === 'debit' && wallet && isWalletName(candidate.counterparty)) {
      await recordTopUp(db, candidate, candidate.amountMinor, account, wallet, categories);
      added += 1;
      continue;
    }
    // One side of money moved from the wallet to the user's bank, the other side already saved.
    if (account.type !== 'card' && isSelf(candidate.counterparty)) {
      const paired = await pairWalletMove(
        db,
        account,
        candidate.direction,
        candidate.amountMinor,
        candidate.detectedAt,
        accounts,
        isSelf,
      );
      if (paired) {
        await linkCandidate(db, candidate.id, paired);
        added += 1;
        continue;
      }
    }

    let input: TransactionInput | null;
    if (isOwnName(candidate.counterparty, ownerName) && account.type !== 'card') {
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
