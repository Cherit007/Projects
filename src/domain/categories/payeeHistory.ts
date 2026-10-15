import type { CategoryType } from '../types';

function words(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/@\S+/g, ' ')
    .replace(/[^a-z]+/g, ' ')
    .split(' ')
    .filter(Boolean);
}

/**
 * Whether a payee is the user themself, e.g. "CHERIT REDDY", "Reddy Cherit"
 * or "CHERIT R" for the name "Cherit Reddy": every word of the payee is one
 * of the user's names or its initial, and at least one full name matches.
 */
export function isOwnName(payee: string | null, ownerName: string | null): boolean {
  const own = words(ownerName ?? '');
  const theirs = words(payee ?? '');
  if (own.length === 0 || theirs.length === 0) {
    return false;
  }
  const fullMatch = theirs.some(word => word.length >= 3 && own.includes(word));
  const allKnown = theirs.every(word => own.includes(word) || (word.length === 1 && own.some(o => o[0] === word)));
  return fullMatch && allKnown;
}

/** The word that says most about a payee: usually "sweets", "medicals" or a surname. */
export function lastWord(payee: string | null): string | null {
  const all = words(payee ?? '').filter(word => word.length >= 3);
  return all.length > 1 ? all[all.length - 1] : null;
}

export interface CategorisedPayee {
  payee: string;
  type: CategoryType;
  categoryId: string;
}

/** Category ids by "type:last word", each with the distinct payees that taught it. */
export type LearnedWords = Map<string, Map<string, Set<string>>>;

export function learnWords(rows: readonly CategorisedPayee[]): LearnedWords {
  const learned: LearnedWords = new Map();
  for (const { payee, type, categoryId } of rows) {
    const word = lastWord(payee);
    if (!word) {
      continue;
    }
    const key = `${type}:${word}`;
    const byCategory = learned.get(key) ?? new Map<string, Set<string>>();
    const payees = byCategory.get(categoryId) ?? new Set<string>();
    payees.add(payee.trim().toLowerCase());
    byCategory.set(categoryId, payees);
    learned.set(key, byCategory);
  }
  return learned;
}

const MIN_PAYEES = 2;
const MIN_SHARE = 0.8;

/**
 * Category the user gives payees ending in the same word ("Sharma Sweets",
 * "Gupta Sweets" → "Agarwal Sweets"), when at least two different payees
 * agree.
 */
export function learnedCategoryId(learned: LearnedWords, payee: string | null, type: CategoryType): string | null {
  const word = lastWord(payee);
  const byCategory = word ? learned.get(`${type}:${word}`) : undefined;
  if (!byCategory) {
    return null;
  }
  const counts = [...byCategory].map(([categoryId, payees]) => [categoryId, payees.size] as const);
  const total = counts.reduce((sum, [, n]) => sum + n, 0);
  const [best, n] = counts.sort((a, b) => b[1] - a[1])[0];
  return n >= MIN_PAYEES && n / total >= MIN_SHARE ? best : null;
}
