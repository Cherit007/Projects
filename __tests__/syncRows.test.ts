import {
  accountMergeKey,
  categoryMergeKey,
  shouldApplyRemote,
  toLocal,
  toRemote,
} from '../src/services/cloud/rows';

describe('row conversion', () => {
  const local = {
    id: 'a1',
    name: 'HDFC',
    type: 'bank',
    opening_balance_minor: 150000,
    currency: 'INR',
    is_archived: 1,
    created_at: '2026-10-01T10:00:00.000Z',
    updated_at: '2026-10-02T10:00:00.000Z',
  };

  it('converts booleans and keeps only schema columns', () => {
    expect(toRemote('accounts', { ...local, extra: 'x' })).toEqual({
      deleted: false,
      name: 'HDFC',
      type: 'bank',
      opening_balance_minor: 150000,
      currency: 'INR',
      is_archived: true,
      created_at: '2026-10-01T10:00:00.000Z',
      updated_at: '2026-10-02T10:00:00.000Z',
    });
  });

  it('round-trips through the remote shape', () => {
    const remote = { $id: 'a1', ...toRemote('accounts', local) };
    expect(toLocal('accounts', remote)).toEqual(local);
  });

  it('stores missing optional values as null', () => {
    const row = toLocal('transactions', { $id: 't1', type: 'expense', amount_minor: 100 });
    expect(row.note).toBeNull();
    expect(row.category_id).toBeNull();
  });
});

describe('shouldApplyRemote', () => {
  it('applies rows that do not exist locally', () => {
    expect(shouldApplyRemote(null, '2026-10-01T00:00:00.000Z')).toBe(true);
  });

  it('applies only strictly newer remote edits', () => {
    expect(shouldApplyRemote('2026-10-01T00:00:00.000Z', '2026-10-02T00:00:00.000Z')).toBe(true);
    expect(shouldApplyRemote('2026-10-02T00:00:00.000Z', '2026-10-01T00:00:00.000Z')).toBe(false);
    expect(shouldApplyRemote('2026-10-01T00:00:00.000Z', '2026-10-01T00:00:00.000Z')).toBe(false);
  });
});

describe('merge keys', () => {
  it('match defaults regardless of case and spacing', () => {
    expect(categoryMergeKey('expense', ' Food and dining', null)).toBe(
      categoryMergeKey('expense', 'food and dining ', null),
    );
    expect(accountMergeKey('cash', 'Cash')).toBe(accountMergeKey('cash', 'cash'));
  });

  it('distinguish subcategories by parent', () => {
    expect(categoryMergeKey('expense', 'Fuel', 'Transport')).not.toBe(categoryMergeKey('expense', 'Fuel', null));
  });
});
