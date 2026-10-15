/**
 * Features of a payee name for the category classifier, grouped per word:
 * the whole word first, then its 3- and 4-letter fragments, so spelling
 * variants ("medico", "medicals") share evidence. Shared by the app and
 * scripts/train-payee-classifier.mts, so it must stay free of imports.
 */
export function payeeFeatures(payee: string): string[][] {
  const words = payee
    .toLowerCase()
    .replace(/@[a-z0-9.]+/g, ' ')
    .replace(/[^a-z]+/g, ' ')
    .split(' ')
    .filter(word => word.length > 1);
  const groups = [...new Set(words)].map(word => {
    const padded = `<${word}>`;
    const features = [`w:${word}`];
    for (const size of [3, 4]) {
      for (let i = 0; i + size <= padded.length; i++) {
        features.push(`c:${padded.slice(i, i + size)}`);
      }
    }
    return features;
  });
  // The last word tells most: a surname for people, "stores" or "petroleum" for shops.
  if (words.length > 1) {
    groups.push([`l:${words[words.length - 1]}`]);
  }
  return groups;
}

/** Class the model uses for businesses whose name says nothing about the spending (incl. banks). */
export const UNKNOWN_CLASS = '__unknown__';
/** Class the model uses for people's names. */
export const PERSON_CLASS = '__person__';
/** A payee is treated as a person when this likely or more. */
export const MIN_PERSON_PROBABILITY = 0.4;
/** A business gets a category when this share of the business probability agrees; else Other. */
export const MIN_CATEGORY_CONFIDENCE = 0.35;

/** UPI IDs made of a mobile number belong to people; merchants use QR or named IDs. */
const MOBILE_VPA = /^(\+?91)?[6-9]\d{9}@[a-z.]+$/i;

export interface PayeeDecision {
  person: boolean;
  /** Expense category for a business, or null when unsure (vague names, banks). */
  category: string | null;
}

/** Reads person vs business and the business category from the class scores of scorePayee. */
export function decidePayee(payee: string, classes: readonly string[], scores: readonly number[]): PayeeDecision {
  if (MOBILE_VPA.test(payee.trim())) {
    return { person: true, category: null };
  }
  if (payeeFeatures(payee).length === 0) {
    return { person: false, category: null };
  }
  const top = Math.max(...scores);
  const weights = scores.map(score => Math.exp(score - top));
  const total = weights.reduce((sum, w) => sum + w, 0);
  const probability = weights.map(w => w / total);
  const personProbability = probability[classes.indexOf(PERSON_CLASS)] ?? 0;
  if (personProbability >= MIN_PERSON_PROBABILITY) {
    return { person: true, category: null };
  }
  let best = -1;
  classes.forEach((name, c) => {
    if (name !== PERSON_CLASS && name !== UNKNOWN_CLASS && (best < 0 || probability[c] > probability[best])) {
      best = c;
    }
  });
  const confidence = best < 0 ? 0 : probability[best] / (1 - personProbability);
  return { person: false, category: confidence >= MIN_CATEGORY_CONFIDENCE ? classes[best] : null };
}

/**
 * Class scores for a payee: each known word counts once; an unknown word
 * counts as the average of its known fragments, so fragments of one word
 * are not counted as independent evidence.
 */
export function scorePayee(
  payee: string,
  logPriors: readonly number[],
  weights: Readonly<Record<string, readonly number[]>>,
): number[] {
  const scores = [...logPriors];
  for (const [word, ...fragments] of payeeFeatures(payee)) {
    const known = weights[word] ? [weights[word]] : fragments.map(f => weights[f]).filter(w => w !== undefined);
    for (const w of known) {
      for (let c = 0; c < scores.length; c++) {
        scores[c] += w[c] / known.length;
      }
    }
  }
  return scores;
}
