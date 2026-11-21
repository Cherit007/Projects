import { isUnusualSpend, spendingPace } from '../src/domain/insights/pace';
import { safeToSpend } from '../src/domain/insights/safeToSpend';
import { detectSubscriptions, upcomingBills, type DetectedSubscription } from '../src/domain/insights/subscriptions';
import { monthlyOverviewBody, paceBody, type MonthInsight } from '../src/data/queries/insights';

function stubInsight(over: Partial<MonthInsight> = {}): MonthInsight {
  return {
    month: { year: 2026, month: 9 },
    incomeMinor: 50_000_00,
    expenseMinor: 12_000_00,
    netMinor: 38_000_00,
    topCategories: [
      { name: 'Food', amountMinor: 5_000_00 },
      { name: 'Rent', amountMinor: 4_000_00 },
      { name: 'Transport', amountMinor: 3_000_00 },
    ],
    vsLastMonthExpensePct: 10,
    pace: { projectedMinor: 24_000_00, aheadOfLastMonth: false, dailyAverageMinor: 800_00 },
    safe: {
      leftoverMinor: 20_000_00,
      availableMinor: 50_000_00,
      cardDueMinor: 12_000_00,
      billsRemainingMinor: 8_000_00,
      goalsMinor: 10_000_00,
    },
    upcoming: [],
    ...over,
  };
}

describe('safeToSpend', () => {
  it('takes card dues, remaining bills and goals out of the money actually held', () => {
    expect(
      safeToSpend({
        availableMinor: 64_957_00,
        cardDueMinor: 23_304_00,
        billsRemainingMinor: 1_763_00,
        goalsMinor: 5_000_00,
      }),
    ).toEqual({
      leftoverMinor: 34_890_00,
      availableMinor: 64_957_00,
      cardDueMinor: 23_304_00,
      billsRemainingMinor: 1_763_00,
      goalsMinor: 5_000_00,
    });
  });

  it('can go negative when card dues are more than the balance', () => {
    expect(
      safeToSpend({ availableMinor: 10_000_00, cardDueMinor: 12_000_00, billsRemainingMinor: 0, goalsMinor: 0 })
        .leftoverMinor,
    ).toBe(-2_000_00);
  });

  it('treats all-zero inputs as zero leftover', () => {
    expect(
      safeToSpend({ availableMinor: 0, cardDueMinor: 0, billsRemainingMinor: 0, goalsMinor: 0 }).leftoverMinor,
    ).toBe(0);
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
    expect(pace.dailyAverageMinor).toBe(1_000_00);
  });

  it('does not flag ahead when under last month', () => {
    expect(
      spendingPace({
        spentMinor: 5_000_00,
        dayOfMonth: 15,
        daysInMonth: 30,
        lastMonthSpentMinor: 20_000_00,
      }).aheadOfLastMonth,
    ).toBe(false);
  });

  it('needs a 10% overrun to count as ahead', () => {
    // 10_000 projected vs 10_000 last → not ahead; 11_000 vs 10_000 → ahead
    expect(
      spendingPace({
        spentMinor: 5_000_00,
        dayOfMonth: 15,
        daysInMonth: 30,
        lastMonthSpentMinor: 10_000_00,
      }).aheadOfLastMonth,
    ).toBe(false);
    expect(
      spendingPace({
        spentMinor: 5_500_00,
        dayOfMonth: 15,
        daysInMonth: 30,
        lastMonthSpentMinor: 10_000_00,
      }).aheadOfLastMonth,
    ).toBe(true);
  });

  it('clamps day 0 and day past month end', () => {
    expect(
      spendingPace({
        spentMinor: 3_000_00,
        dayOfMonth: 0,
        daysInMonth: 30,
        lastMonthSpentMinor: null,
      }).dailyAverageMinor,
    ).toBe(3_000_00);
    expect(
      spendingPace({
        spentMinor: 31_000_00,
        dayOfMonth: 40,
        daysInMonth: 31,
        lastMonthSpentMinor: null,
      }).dailyAverageMinor,
    ).toBe(1_000_00);
  });

  it('never marks ahead when last month is null or zero', () => {
    expect(
      spendingPace({
        spentMinor: 50_000_00,
        dayOfMonth: 1,
        daysInMonth: 30,
        lastMonthSpentMinor: null,
      }).aheadOfLastMonth,
    ).toBe(false);
    expect(
      spendingPace({
        spentMinor: 50_000_00,
        dayOfMonth: 1,
        daysInMonth: 30,
        lastMonthSpentMinor: 0,
      }).aheadOfLastMonth,
    ).toBe(false);
  });

  it('handles zero spend on day 1', () => {
    expect(
      spendingPace({
        spentMinor: 0,
        dayOfMonth: 1,
        daysInMonth: 28,
        lastMonthSpentMinor: 10_000_00,
      }),
    ).toEqual({ projectedMinor: 0, aheadOfLastMonth: false, dailyAverageMinor: 0 });
  });
});

describe('isUnusualSpend', () => {
  it('flags amounts far above the recent median', () => {
    const recent = [100_00, 120_00, 90_00, 110_00, 95_00, 130_00];
    expect(isUnusualSpend(50_000_00, recent)).toBe(true);
    expect(isUnusualSpend(150_00, recent)).toBe(false);
  });

  it('never flags under ₹2,000 even with empty history', () => {
    expect(isUnusualSpend(1_999_00, [])).toBe(false);
    expect(isUnusualSpend(1_999_00, [10_00, 20_00, 30_00, 40_00, 50_00])).toBe(false);
  });

  it('with thin history requires ₹10,000+', () => {
    expect(isUnusualSpend(9_999_00, [100_00, 200_00])).toBe(false);
    expect(isUnusualSpend(10_000_00, [100_00, 200_00])).toBe(true);
    expect(isUnusualSpend(10_000_00, [])).toBe(true);
  });

  it('with enough history uses 3× median, floored at ₹2,000', () => {
    const tiny = [10_00, 20_00, 30_00, 40_00, 50_00]; // median 30 → 3× = 90, floor 2000
    expect(isUnusualSpend(2_000_00, tiny)).toBe(true);
    expect(isUnusualSpend(1_999_00, tiny)).toBe(false);
    const mid = [1_000_00, 1_000_00, 1_000_00, 1_000_00, 1_000_00]; // 3× = 3000
    expect(isUnusualSpend(2_999_00, mid)).toBe(false);
    expect(isUnusualSpend(3_000_00, mid)).toBe(true);
  });
});

describe('detectSubscriptions', () => {
  const base = (over: Partial<{ counterparty: string; amountMinor: number; day: string }> = {}) => ({
    counterparty: 'Netflix',
    amountMinor: 649_00,
    day: '2026-08-12',
    categoryId: 'c1',
    categoryName: 'Entertainment',
    ...over,
  });

  it('finds a merchant paid in two months at a similar amount and day', () => {
    const found = detectSubscriptions(
      [base(), base({ day: '2026-09-11' }), base({ counterparty: 'Swiggy', amountMinor: 250_00, day: '2026-09-01' })],
      '2026-10-05',
    );
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ counterparty: 'Netflix', amountMinor: 649_00, monthsSeen: 2 });
    expect(found[0]!.nextDue >= '2026-10-05').toBe(true);
  });

  it('ignores blank payees and single-month noise', () => {
    expect(
      detectSubscriptions(
        [
          base({ counterparty: '  ', day: '2026-08-01' }),
          base({ counterparty: '', day: '2026-09-01' }),
          base({ counterparty: 'Once', day: '2026-09-01' }),
        ],
        '2026-10-05',
      ),
    ).toEqual([]);
  });

  it('is case-insensitive and trims payee names', () => {
    const found = detectSubscriptions(
      [base({ counterparty: '  NETFLIX ' }), base({ counterparty: 'netflix', day: '2026-09-12' })],
      '2026-10-01',
    );
    expect(found).toHaveLength(1);
    expect(found[0]!.counterparty.toLowerCase()).toBe('netflix');
  });

  it('rejects when amounts diverge by more than 10%', () => {
    expect(
      detectSubscriptions(
        [base({ amountMinor: 1_000_00 }), base({ amountMinor: 1_200_00, day: '2026-09-12' })],
        '2026-10-05',
      ),
    ).toEqual([]);
  });

  it('accepts amounts within 10% or ₹1', () => {
    expect(
      detectSubscriptions(
        [base({ amountMinor: 1_000_00 }), base({ amountMinor: 1_100_00, day: '2026-09-12' })],
        '2026-10-05',
      ),
    ).toHaveLength(1);
    // tiny amounts: ±₹1 absolute floor
    expect(
      detectSubscriptions(
        [base({ amountMinor: 50, day: '2026-08-10' }), base({ amountMinor: 150, day: '2026-09-10' })],
        '2026-10-05',
      ),
    ).toHaveLength(1);
  });

  it('rejects when day-of-month differs by more than 3', () => {
    expect(
      detectSubscriptions([base({ day: '2026-08-01' }), base({ day: '2026-09-10' })], '2026-10-05'),
    ).toEqual([]);
  });

  it('pushes nextDue past today and past a charge already paid this month', () => {
    const unpaid = detectSubscriptions(
      [base({ day: '2026-08-20' }), base({ day: '2026-09-20' })],
      '2026-10-25',
    );
    expect(unpaid[0]!.nextDue.startsWith('2026-11')).toBe(true);

    const paidThisMonth = detectSubscriptions(
      [
        base({ day: '2026-08-12' }),
        base({ day: '2026-09-12' }),
        base({ day: '2026-10-11' }),
      ],
      '2026-10-05',
    );
    expect(paidThisMonth[0]!.nextDue.startsWith('2026-11')).toBe(true);
  });

  it('ignores shops visited often: two payments in a month, or a month that breaks the pattern', () => {
    const shop = (day: string, amountMinor: number) => base({ counterparty: 'Lalitha Traders', day, amountMinor });
    // Paid twice in September.
    expect(
      detectSubscriptions([shop('2026-08-27', 50_00), shop('2026-09-25', 50_00), shop('2026-09-28', 50_00), shop('2026-10-26', 50_00)], '2026-11-14'),
    ).toEqual([]);
    // September's payment is on a different day.
    expect(
      detectSubscriptions(
        [
          base({ counterparty: 'Sri Ganesh Wines', day: '2026-08-29', amountMinor: 1_100_00 }),
          base({ counterparty: 'Sri Ganesh Wines', day: '2026-09-19', amountMinor: 1_110_00 }),
          base({ counterparty: 'Sri Ganesh Wines', day: '2026-10-28', amountMinor: 1_050_00 }),
        ],
        '2026-11-14',
      ),
    ).toEqual([]);
    // A real auto-debit still counts.
    expect(
      detectSubscriptions(
        [
          base({ counterparty: 'Direct debit', day: '2026-08-30', amountMinor: 1_763_00 }),
          base({ counterparty: 'Direct debit', day: '2026-09-28', amountMinor: 1_763_00 }),
        ],
        '2026-11-14',
      ).map(s => [s.counterparty, s.nextDue]),
    ).toEqual([['Direct debit', '2026-11-28']]);
  });

  it('keeps nextDue on this month when the due day is still ahead and unpaid', () => {
    const found = detectSubscriptions(
      [base({ day: '2026-08-20' }), base({ day: '2026-09-20' })],
      '2026-10-05',
    );
    expect(found[0]!.nextDue).toBe('2026-10-20');
  });

  it('sorts by nextDue then name', () => {
    const found = detectSubscriptions(
      [
        base({ counterparty: 'Spotify', amountMinor: 119_00, day: '2026-08-25' }),
        base({ counterparty: 'Spotify', amountMinor: 119_00, day: '2026-09-25' }),
        base({ counterparty: 'Adobe', amountMinor: 999_00, day: '2026-08-10' }),
        base({ counterparty: 'Adobe', amountMinor: 999_00, day: '2026-09-10' }),
      ],
      '2026-10-01',
    );
    expect(found.map(s => s.counterparty)).toEqual(['Adobe', 'Spotify']);
  });
});

describe('upcomingBills', () => {
  const bill = (nextDue: string, name = 'X'): DetectedSubscription => ({
    counterparty: name,
    amountMinor: 100_00,
    dayOfMonth: Number(nextDue.slice(8)),
    monthsSeen: 2,
    categoryId: null,
    categoryName: null,
    nextDue,
  });

  it('includes today and the withinDays window, excludes past and far future', () => {
    const list = [bill('2026-10-04'), bill('2026-10-05'), bill('2026-10-08'), bill('2026-10-20')];
    expect(upcomingBills(list, '2026-10-05', 3).map(b => b.nextDue)).toEqual(['2026-10-05', '2026-10-08']);
  });

  it('handles month rollover', () => {
    expect(
      upcomingBills([bill('2026-11-01'), bill('2026-11-05')], '2026-10-30', 3).map(b => b.nextDue),
    ).toEqual(['2026-11-01']);
  });

  it('returns empty for empty input', () => {
    expect(upcomingBills([], '2026-10-05', 3)).toEqual([]);
  });
});

describe('insight copy', () => {
  it('monthly overview lists top categories and vs last month', () => {
    expect(monthlyOverviewBody(stubInsight())).toContain('You spent');
    expect(monthlyOverviewBody(stubInsight())).toContain('Food, Rent');
    expect(monthlyOverviewBody(stubInsight())).toContain('+10% vs last month');
    expect(monthlyOverviewBody(stubInsight({ vsLastMonthExpensePct: 0 }))).toContain('same as last month');
    expect(monthlyOverviewBody(stubInsight({ vsLastMonthExpensePct: -5 }))).toContain('-5% vs last month');
    expect(monthlyOverviewBody(stubInsight({ vsLastMonthExpensePct: null, topCategories: [] }))).toContain(
      'no categories yet',
    );
  });

  it('pace body mentions ahead of last month when flagged', () => {
    expect(paceBody(stubInsight())).not.toContain('ahead of last month');
    expect(
      paceBody(
        stubInsight({
          pace: { projectedMinor: 40_000_00, aheadOfLastMonth: true, dailyAverageMinor: 1_000_00 },
        }),
      ),
    ).toContain('ahead of last month');
  });
});
