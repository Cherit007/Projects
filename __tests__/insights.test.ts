import { isUnusualSpend, spendingPace } from '../src/domain/insights/pace';
import { safeToSpend } from '../src/domain/insights/safeToSpend';
import { detectSubscriptions, upcomingBills } from '../src/domain/insights/subscriptions';

describe('safeToSpend', () => {
  it('subtracts spent, remaining bills and goals from the income basis', () => {
    expect(
      safeToSpend({
        incomeMinor: 50_000_00,
        expectedIncomeMinor: 50_000_00,
        spentMinor: 10_000_00,
        billsRemainingMinor: 5_000_00,
        goalsMinor: 5_000_00,
      }).leftoverMinor,
    ).toBe(30_000_00);
  });

  it('uses expected income when this month is still empty', () => {
    expect(
      safeToSpend({
        incomeMinor: 0,
        expectedIncomeMinor: 40_000_00,
        spentMinor: 2_000_00,
        billsRemainingMinor: 0,
        goalsMinor: 0,
      }).incomeBasisMinor,
    ).toBe(40_000_00);
  });
});

describe('spendingPace', () => {
  it('projects the month from the daily average', () => {
    const pace = spendingPace({
      spentMinor: 15_000_00,
      dayOfMonth: 15,
      daysInMonth: 30,
      lastMonthSpentMinor: 20_000_00,
    });
    expect(pace.projectedMinor).toBe(30_000_00);
    expect(pace.aheadOfLastMonth).toBe(true);
  });
});

describe('isUnusualSpend', () => {
  it('flags amounts far above the recent median', () => {
    const recent = [100_00, 120_00, 90_00, 110_00, 95_00, 130_00];
    expect(isUnusualSpend(50_000_00, recent)).toBe(true);
    expect(isUnusualSpend(150_00, recent)).toBe(false);
  });
});

describe('detectSubscriptions', () => {
  it('finds a merchant paid in two months at a similar amount and day', () => {
    const found = detectSubscriptions(
      [
        { counterparty: 'Netflix', amountMinor: 649_00, day: '2026-08-12', categoryId: 'c1', categoryName: 'Entertainment' },
        { counterparty: 'Netflix', amountMinor: 649_00, day: '2026-09-11', categoryId: 'c1', categoryName: 'Entertainment' },
        { counterparty: 'Swiggy', amountMinor: 250_00, day: '2026-09-01', categoryId: 'c2', categoryName: 'Food' },
      ],
      '2026-10-05',
    );
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ counterparty: 'Netflix', amountMinor: 649_00 });
    expect(found[0]!.nextDue >= '2026-10-05').toBe(true);
    expect(upcomingBills(found, '2026-10-05', 30)).toHaveLength(1);
  });
});
