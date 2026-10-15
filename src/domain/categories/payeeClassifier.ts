import model from './payeeModel.json';
import { scorePayee } from './payeeFeatures';

/** Class the model uses for names that say nothing about the spending. */
export const UNKNOWN_CLASS = '__unknown__';
/** Class the model uses for people's names. */
export const PERSON_CLASS = '__person__';

const MIN_CONFIDENCE = 0.6;
const MIN_PERSON_CONFIDENCE = 0.7;

interface PayeeModel {
  classes: string[];
  logPriors: number[];
  /** Feature → log-likelihood per class, in `classes` order. */
  features: Record<string, number[]>;
}

const { classes, logPriors, features } = model as PayeeModel;

export interface PayeePrediction {
  category: string;
  confidence: number;
}

/** Most likely class for a payee with its probability (naive Bayes over payeeFeatures). */
export function predictPayee(payee: string): PayeePrediction {
  const scores = scorePayee(payee, logPriors, features);
  const best = scores.indexOf(Math.max(...scores));
  const total = scores.reduce((sum, score) => sum + Math.exp(score - scores[best]), 0);
  return { category: classes[best], confidence: 1 / total };
}

/**
 * Expense category name for a payee, or null when the model is unsure or
 * the payee looks like a person.
 */
export function classifyPayee(payee: string | null): string | null {
  if (!payee?.trim()) {
    return null;
  }
  const { category, confidence } = predictPayee(payee);
  return category !== UNKNOWN_CLASS && category !== PERSON_CLASS && confidence >= MIN_CONFIDENCE ? category : null;
}

/** Whether the payee is most likely a person rather than a business. */
export function isPersonPayee(payee: string | null): boolean {
  if (!payee?.trim()) {
    return false;
  }
  const { category, confidence } = predictPayee(payee);
  return category === PERSON_CLASS && confidence >= MIN_PERSON_CONFIDENCE;
}
