import { budgetCrossing, budgetLevel, budgetProgress } from '../src/domain/budgets/budgets';

describe('budgetLevel', () => {
  it('is ok below the warning threshold', () => {
    expect(budgetLevel(7999, 10000, 80)).toBe('ok');
  });

  it('warns from the threshold up to the limit', () => {
    expect(budgetLevel(8000, 10000, 80)).toBe('warning');
    expect(budgetLevel(10000, 10000, 80)).toBe('warning');
  });

  it('is over once spending exceeds the limit', () => {
    expect(budgetLevel(10001, 10000, 80)).toBe('over');
  });
});

describe('budgetProgress', () => {
  const names = new Map([
    ['food', 'Food'],
    ['rent', 'Rent'],
  ]);

  it('matches spending to budgets and sorts by usage', () => {
    const progress = budgetProgress(
      [
        { id: 'b1', categoryId: 'food', amountMinor: 10000 },
        { id: 'b2', categoryId: 'rent', amountMinor: 50000 },
      ],
      [
        { categoryId: 'food', name: 'Food', amountMinor: 9000 },
        { categoryId: null, name: 'Uncategorized', amountMinor: 500 },
      ],
      names,
      80,
    );
    expect(progress).toEqual([
      expect.objectContaining({ categoryId: 'food', spentMinor: 9000, remainingMinor: 1000, level: 'warning' }),
      expect.objectContaining({ categoryId: 'rent', spentMinor: 0, remainingMinor: 50000, level: 'ok' }),
    ]);
  });
});

describe('budgetCrossing', () => {
  it('reports when an expense moves a budget to a worse level', () => {
    expect(budgetCrossing(7000, 8500, 10000, 80)).toBe('warning');
    expect(budgetCrossing(9000, 10500, 10000, 80)).toBe('over');
    expect(budgetCrossing(7000, 12000, 10000, 80)).toBe('over');
  });

  it('stays quiet when the level does not change', () => {
    expect(budgetCrossing(1000, 2000, 10000, 80)).toBeNull();
    expect(budgetCrossing(8500, 9000, 10000, 80)).toBeNull();
    expect(budgetCrossing(11000, 12000, 10000, 80)).toBeNull();
  });
});
