import type { CategoryType } from '../types';
import type { PayeeKind } from '../upi/payeeKind';
import { FRIENDS_CATEGORY, OTHER_CATEGORY, OTHER_INCOME_CATEGORY } from './defaults';
import { predictPayee } from './payeeClassifier';

/**
 * Well-known payees mapped to default category names. Matched against the
 * payee as whole words (or VPA handles), so a person's name rarely matches.
 */
const RULES: readonly { category: string; type: CategoryType; words: readonly string[] }[] = [
  {
    category: 'Food and dining',
    type: 'expense',
    words: ['swiggy', 'zomato', 'eatsure', 'dominos', 'domino', 'pizza', 'kfc', 'mcdonalds', 'starbucks', 'restaurant', 'cafe', 'hotel', 'dhaba', 'bakery', 'juice', 'ice cream'],
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
    words: ['airtel', 'jio', 'vodafone', 'vi', 'bsnl', 'act fibernet', 'electricity', 'bescom', 'tneb', 'msedcl', 'tata power', 'adani', 'water', 'gas', 'indane', 'hp gas', 'bharat gas', 'broadband', 'recharge', 'dth', 'tata play', 'bill', 'cred', 'cred club', 'bharat connect'],
  },
  {
    category: 'Entertainment',
    type: 'expense',
    words: ['netflix', 'spotify', 'hotstar', 'jiocinema', 'prime video', 'youtube', 'bookmyshow', 'pvr', 'inox', 'sonyliv', 'zee5', 'steam', 'playstation', 'fancode', 'google play', 'playstore', 'apple media', 'apple services'],
  },
  {
    category: 'Healthcare',
    type: 'expense',
    words: ['apollo', 'pharmeasy', '1mg', 'netmeds', 'medplus', 'pharmacy', 'medical', 'hospital', 'clinic', 'diagnostics', 'practo'],
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
    category: 'Personal care',
    type: 'expense',
    words: ['salon', 'saloon', 'beauty parlour', 'beauty parlor', 'hair parlour', 'barber', 'spa', 'unisex salon', 'naturals salon', 'lakme salon', 'green trends', 'toni and guy', 'jawed habib'],
  },
  {
    category: 'Fitness',
    type: 'expense',
    words: ['gym', 'gymnasium', 'fitness', 'cult fit', 'cultfit', 'yoga', 'crossfit', 'golds gym', 'anytime fitness', 'snap fitness'],
  },
  { category: 'Loan interest and fees', type: 'expense', words: ['housing finance', 'home loan', 'home finance'] },
  {
    category: 'Insurance',
    type: 'expense',
    words: ['insurance', 'lic', 'policybazaar', 'acko', 'digit insurance', 'hdfc life', 'icici prudential', 'icici lombard', 'sbi life', 'star health', 'max life', 'tata aia', 'bajaj allianz', 'niva bupa', 'care health'],
  },
  {
    category: 'Investments',
    type: 'expense',
    words: ['zerodha', 'groww', 'upstox', 'kuvera', 'smallcase', 'angel one', 'angel broking', 'paytm money', 'coin by zerodha', 'mutual fund', 'mutual funds', 'sip', 'nps', 'indmoney', 'icici direct', 'hdfc securities', 'motilal oswal', 'sharekhan', 'bse star mf', 'nse clearing', 'iccl', 'indian clearing'],
  },
  {
    category: 'Donations',
    type: 'expense',
    words: ['temple', 'devasthanam', 'devasthan', 'mandir', 'church', 'masjid', 'gurudwara', 'donation', 'donations', 'charity', 'charitable trust', 'ttd', 'isckon', 'iskcon', 'giveindia', 'ketto', 'milaap', 'akshaya patra'],
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
 * Category name for a payee without history: a known merchant, else Friends
 * for a person, else the on-device classifier's shop category (expenses),
 * else Other / Other income. `kind` is what the payment message says about
 * the payee (P2M/P2A, QR or mobile-number UPI ID) and overrides the name.
 */
export function predictCategoryName(payee: string | null, type: CategoryType, kind: PayeeKind | null = null): string {
  const rule = kind === 'person' ? null : guessCategoryName(payee, type);
  if (rule) {
    return rule;
  }
  const { person, category } = predictPayee(payee, kind === 'merchant');
  if (kind === 'person' || person) {
    return FRIENDS_CATEGORY;
  }
  if (type === 'income') {
    return OTHER_INCOME_CATEGORY;
  }
  return category ?? OTHER_CATEGORY;
}
