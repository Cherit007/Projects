import type { CategoryType } from '../types';
import { FRIENDS_CATEGORY } from './defaults';
import { classifyPayee, isPersonPayee } from './payeeClassifier';

/**
 * Well-known payees mapped to default category names. Matched against the
 * payee as whole words (or VPA handles), so a person's name rarely matches.
 */
const RULES: readonly { category: string; type: CategoryType; words: readonly string[] }[] = [
  {
    category: 'Food and dining',
    type: 'expense',
    words: ['swiggy', 'zomato', 'eatsure', 'dominos', 'domino', 'pizza', 'kfc', 'mcdonalds', 'starbucks', 'restaurant', 'cafe', 'hotel', 'dhaba', 'bakery'],
  },
  {
    category: 'Groceries',
    type: 'expense',
    words: ['bigbasket', 'blinkit', 'zepto', 'instamart', 'dmart', 'jiomart', 'grofers', 'supermarket', 'kirana', 'more retail', 'reliance fresh', 'ratnadeep'],
  },
  {
    category: 'Transport',
    type: 'expense',
    words: ['uber', 'ola', 'rapido', 'namma yatri', 'metro', 'fastag', 'petrol', 'fuel', 'hpcl', 'bpcl', 'iocl', 'indian oil', 'shell', 'parking', 'redbus'],
  },
  {
    category: 'Shopping',
    type: 'expense',
    words: ['amazon', 'flipkart', 'myntra', 'ajio', 'meesho', 'nykaa', 'tata cliq', 'croma', 'reliance digital', 'decathlon', 'ikea', 'lenskart'],
  },
  {
    category: 'Utilities and bills',
    type: 'expense',
    words: ['airtel', 'jio', 'vodafone', 'vi', 'bsnl', 'act fibernet', 'electricity', 'bescom', 'tneb', 'msedcl', 'tata power', 'adani', 'water', 'gas', 'indane', 'hp gas', 'bharat gas', 'broadband', 'recharge', 'dth', 'tata play', 'bill'],
  },
  {
    category: 'Entertainment',
    type: 'expense',
    words: ['netflix', 'spotify', 'hotstar', 'jiocinema', 'prime video', 'youtube', 'bookmyshow', 'pvr', 'inox', 'sonyliv', 'zee5', 'steam', 'playstation'],
  },
  {
    category: 'Healthcare',
    type: 'expense',
    words: ['apollo', 'pharmeasy', '1mg', 'netmeds', 'medplus', 'pharmacy', 'medical', 'hospital', 'clinic', 'diagnostics', 'practo', 'cult fit', 'cultfit'],
  },
  {
    category: 'Travel',
    type: 'expense',
    words: ['makemytrip', 'goibibo', 'cleartrip', 'yatra', 'ixigo', 'irctc', 'indigo', 'air india', 'akasa', 'spicejet', 'oyo', 'airbnb', 'booking com'],
  },
  {
    category: 'Rent and housing',
    type: 'expense',
    words: ['rent', 'nobroker', 'nestaway', 'society', 'maintenance'],
  },
  {
    category: 'Education',
    type: 'expense',
    words: ['school', 'college', 'university', 'udemy', 'coursera', 'byjus', 'unacademy', 'tuition', 'fees'],
  },
  {
    category: 'Loan interest and fees',
    type: 'expense',
    words: ['emi', 'loan', 'bajaj finance', 'credit card', 'cc payment', 'annual fee', 'charges'],
  },
  { category: 'Salary', type: 'income', words: ['salary', 'payroll', 'sal'] },
  { category: 'Interest', type: 'income', words: ['interest', 'int pd', 'int cr'] },
  { category: 'Dividends', type: 'income', words: ['dividend', 'div'] },
];

function normalise(text: string): string {
  return ` ${text.toLowerCase().replace(/@[a-z]+/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim()} `;
}

/**
 * Name of the default category a payee most likely belongs to, or null when
 * it is not a recognised merchant (e.g. a payment to a person).
 */
export function guessCategoryName(payee: string | null, type: CategoryType): string | null {
  if (!payee) {
    return null;
  }
  const text = normalise(payee);
  for (const rule of RULES) {
    if (rule.type === type && rule.words.some(word => text.includes(` ${word} `))) {
      return rule.category;
    }
  }
  return null;
}

/**
 * Best category name for a payee without history: a known merchant, else the
 * on-device classifier (shops, expenses only), else Friends for a person.
 * Null means "ask the user".
 */
export function predictCategoryName(payee: string | null, type: CategoryType): string | null {
  return (
    guessCategoryName(payee, type) ??
    (type === 'expense' ? classifyPayee(payee) : null) ??
    (isPersonPayee(payee) ? FRIENDS_CATEGORY : null)
  );
}
