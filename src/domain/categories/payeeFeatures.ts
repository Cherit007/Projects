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
  return [...new Set(words)].map(word => {
    const padded = `<${word}>`;
    const features = [`w:${word}`];
    for (const size of [3, 4]) {
      for (let i = 0; i + size <= padded.length; i++) {
        features.push(`c:${padded.slice(i, i + size)}`);
      }
    }
    return features;
  });
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
