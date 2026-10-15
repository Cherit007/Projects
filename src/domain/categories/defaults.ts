import type { CategoryType } from '../types';

/** Category for money sent to or received from people; the People screen lists its payees. */
export const FRIENDS_CATEGORY = 'Friends';
/** Fallbacks for payees that cannot be categorised more precisely. */
export const OTHER_CATEGORY = 'Other';
export const OTHER_INCOME_CATEGORY = 'Other income';

export const DEFAULT_CATEGORIES: readonly { name: string; type: CategoryType }[] =
  [
    { name: 'Food and dining', type: 'expense' },
    { name: 'Groceries', type: 'expense' },
    { name: 'Rent and housing', type: 'expense' },
    { name: 'Utilities and bills', type: 'expense' },
    { name: 'Transport', type: 'expense' },
    { name: 'Shopping', type: 'expense' },
    { name: 'Healthcare', type: 'expense' },
    { name: 'Entertainment', type: 'expense' },
    { name: 'Education', type: 'expense' },
    { name: 'Travel', type: 'expense' },
    { name: 'Family', type: 'expense' },
    { name: 'Friends', type: 'expense' },
    { name: 'Loan interest and fees', type: 'expense' },
    { name: 'Other', type: 'expense' },
    { name: 'Salary', type: 'income' },
    { name: 'Freelance', type: 'income' },
    { name: 'Business', type: 'income' },
    { name: 'Rental income', type: 'income' },
    { name: 'Interest', type: 'income' },
    { name: 'Dividends', type: 'income' },
    { name: 'Friends', type: 'income' },
    { name: 'Other income', type: 'income' },
  ];
