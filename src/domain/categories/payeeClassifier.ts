import model from './payeeModel.json';
import { decidePayee, scorePayee, type PayeeDecision } from './payeeFeatures';

interface PayeeModel {
  classes: string[];
  logPriors: number[];
  /** Feature → log-likelihood per class, in `classes` order. */
  features: Record<string, number[]>;
}

const { classes, logPriors, features } = model as PayeeModel;

/** Whether the payee is a person, and the expense category when it is a business (naive Bayes over payeeFeatures). */
export function predictPayee(payee: string | null, merchant = false): PayeeDecision {
  if (!payee?.trim()) {
    return { person: false, category: null };
  }
  return decidePayee(payee, classes, scorePayee(payee, logPriors, features), merchant);
}

/** Expense category for a business payee, or null for people and names the model is unsure about. */
export function classifyPayee(payee: string | null): string | null {
  return predictPayee(payee).category;
}

/** Whether the payee is most likely a person rather than a business or bank. */
export function isPersonPayee(payee: string | null): boolean {
  return predictPayee(payee).person;
}
