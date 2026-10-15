export interface MonthKey {
  year: number;
  /** 0-based, matching `Date#getMonth`. */
  month: number;
}

export interface DateRange {
  /** Inclusive, UTC ISO-8601. */
  startIso: string;
  /** Exclusive, UTC ISO-8601. */
  endIso: string;
}

export function monthKeyOf(date: Date): MonthKey {
  return { year: date.getFullYear(), month: date.getMonth() };
}

/** Month boundaries in the device's local timezone, expressed in UTC. */
export function monthRange({ year, month }: MonthKey): DateRange {
  return {
    startIso: new Date(year, month, 1).toISOString(),
    endIso: new Date(year, month + 1, 1).toISOString(),
  };
}

/** Year boundaries in the device's local timezone, expressed in UTC. */
export function yearRange(year: number): DateRange {
  return {
    startIso: new Date(year, 0, 1).toISOString(),
    endIso: new Date(year + 1, 0, 1).toISOString(),
  };
}

export function addMonths({ year, month }: MonthKey, delta: number): MonthKey {
  const date = new Date(year, month + delta, 1);
  return monthKeyOf(date);
}

export function isInRange(iso: string, range: DateRange): boolean {
  const time = Date.parse(iso);
  return time >= Date.parse(range.startIso) && time < Date.parse(range.endIso);
}

export function formatMonth(key: MonthKey, locale = 'en-IN'): string {
  return new Date(key.year, key.month, 1).toLocaleDateString(locale, {
    month: 'long',
    year: 'numeric',
  });
}
