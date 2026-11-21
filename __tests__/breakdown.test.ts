import { categoryBreakdown } from '../src/domain/accounting/breakdown';

const item = (type: 'income' | 'expense' | 'transfer', amountMinor: number, categoryId: string | null, categoryName: string | null) => ({
  type,
  amountMinor,
  categoryId,
  categoryName,
});

describe('categoryBreakdown', () => {
  const items = [
    item('income', 123_602_00, 'sal', 'Salary'),
    item('income', 500_00, 'oth', 'Other income'),
    item('income', 315_00, 'oth', 'Other income'),
    item('income', 20_000_00, 'fr', 'Friends'),
    item('expense', 250_00, 'food', 'Food and dining'),
    item('expense', 1_000_00, null, null),
    item('transfer', 5_000_00, null, null),
  ];

  it('totals income by category, largest first, with counts', () => {
    expect(categoryBreakdown(items, 'income')).toEqual([
      { categoryId: 'sal', name: 'Salary', amountMinor: 123_602_00, count: 1 },
      { categoryId: 'fr', name: 'Friends', amountMinor: 20_000_00, count: 1 },
      { categoryId: 'oth', name: 'Other income', amountMinor: 815_00, count: 2 },
    ]);
  });

  it('keeps uncategorised spending and ignores transfers', () => {
    expect(categoryBreakdown(items, 'expense')).toEqual([
      { categoryId: null, name: 'Uncategorised', amountMinor: 1_000_00, count: 1 },
      { categoryId: 'food', name: 'Food and dining', amountMinor: 250_00, count: 1 },
    ]);
  });

  it('is empty when there is nothing of that kind', () => {
    expect(categoryBreakdown([], 'income')).toEqual([]);
    expect(categoryBreakdown([item('transfer', 1, null, null)], 'expense')).toEqual([]);
  });
});
