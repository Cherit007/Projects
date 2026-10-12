import { addMonths, isInRange, monthRange } from '../src/domain/period';

describe('monthRange', () => {
  it('starts at local midnight on the 1st and ends at the next month', () => {
    const range = monthRange({ year: 2026, month: 9 });
    expect(new Date(range.startIso).getDate()).toBe(1);
    expect(new Date(range.startIso).getHours()).toBe(0);
    expect(new Date(range.endIso).getMonth()).toBe(10);
  });

  it('includes the last moment of the month and excludes the next midnight', () => {
    const range = monthRange({ year: 2026, month: 9 });
    const lastMoment = new Date(2026, 9, 31, 23, 59, 59, 999).toISOString();
    const nextMidnight = new Date(2026, 10, 1, 0, 0, 0, 0).toISOString();
    expect(isInRange(lastMoment, range)).toBe(true);
    expect(isInRange(nextMidnight, range)).toBe(false);
  });

  it('rolls over the year in December', () => {
    const range = monthRange({ year: 2026, month: 11 });
    const end = new Date(range.endIso);
    expect(end.getFullYear()).toBe(2027);
    expect(end.getMonth()).toBe(0);
  });
});

describe('addMonths', () => {
  it('moves across year boundaries', () => {
    expect(addMonths({ year: 2026, month: 0 }, -1)).toEqual({ year: 2025, month: 11 });
    expect(addMonths({ year: 2026, month: 11 }, 1)).toEqual({ year: 2027, month: 0 });
  });
});
