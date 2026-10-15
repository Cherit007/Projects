import type { SQLiteDatabase } from 'expo-sqlite';

import { listAccounts } from '../../data/repositories/accounts';
import { listCategories } from '../../data/repositories/categories';
import { getAutoAddPayments } from '../../data/repositories/settings';
import { suggestCategory } from '../../data/repositories/transactions';
import {
  confirmCandidate,
  findPossibleDuplicate,
  getCandidate,
} from '../../data/repositories/upiCandidates';
import { guessCategoryName } from '../../domain/categories/autoCategory';

/**
 * Adds newly detected payments whose category can be worked out: the payee's
 * last category, else a well-known merchant. Anything uncertain (unknown
 * payee, possible duplicate, failed or pending payment) stays in the review
 * list. Returns how many were added.
 */
export async function autoAddCandidates(db: SQLiteDatabase, candidateIds: readonly string[]): Promise<number> {
  if (candidateIds.length === 0 || !(await getAutoAddPayments(db))) {
    return 0;
  }
  const [accounts, categories] = await Promise.all([listAccounts(db), listCategories(db)]);
  const account = accounts.find(a => a.type !== 'cash') ?? accounts[0];
  if (!account) {
    return 0;
  }

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
    const type = candidate.direction === 'credit' ? 'income' : 'expense';
    let categoryId = candidate.counterparty ? await suggestCategory(db, candidate.counterparty, type) : null;
    if (!categoryId) {
      const name = guessCategoryName(candidate.counterparty, type);
      categoryId = categories.find(c => c.type === type && c.name === name)?.id ?? null;
    }
    if (!categoryId) {
      continue;
    }
    await confirmCandidate(db, candidate, {
      type,
      amountMinor: candidate.amountMinor,
      occurredAt: candidate.detectedAt,
      accountId: account.id,
      toAccountId: null,
      categoryId,
      counterparty: candidate.counterparty,
      note: null,
    });
    added += 1;
  }
  return added;
}
