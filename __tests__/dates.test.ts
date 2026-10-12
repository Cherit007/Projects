import { fromLocalDateInput, toLocalDateInput } from '../src/utils/dates';

describe('date input helpers', () => {
  it('round-trips a local date and keeps the time of day', () => {
    const source = new Date(2026, 9, 12, 21, 30).toISOString();
    const iso = fromLocalDateInput('2026-10-05', source);
    expect(iso).not.toBeNull();
    const parsed = new Date(iso!);
    expect(toLocalDateInput(iso!)).toBe('2026-10-05');
    expect(parsed.getHours()).toBe(21);
    expect(parsed.getMinutes()).toBe(30);
  });

  it.each(['', '2026-13-01', '2026-02-30', '05/10/2026', '2026-1-5'])(
    'rejects %s',
    value => {
      expect(fromLocalDateInput(value)).toBeNull();
    },
  );
});
