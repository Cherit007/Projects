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

/** Days 29–31 do not exist in every month, so a month can start on the 1st to the 28th. */
export const MAX_MONTH_START_DAY = 28;

let monthStartDay = 1;

/**
 * The day of the month a "month" starts on, e.g. 25 for someone paid on the
 * 25th: the October month then runs from 25 October to 24 November. Every
 * month boundary in the app follows it. Set from the user's settings at startup.
 */
export function setMonthStartDay(day: number): void {
  monthStartDay = Number.isInteger(day) && day >= 1 && day <= MAX_MONTH_START_DAY ? day : 1;
}

export function getMonthStartDay(): number {
  return monthStartDay;
}

/** The month a date falls in: before the start day it still belongs to the previous month. */
export function monthKeyOf(date: Date): MonthKey {
  if (date.getDate() >= monthStartDay) {
    return { year: date.getFullYear(), month: date.getMonth() };
  }
  return addMonths({ year: date.getFullYear(), month: date.getMonth() }, -1);
}

/** Month boundaries in the device's local timezone, expressed in UTC. */
export function monthRange({ year, month }: MonthKey): DateRange {
  return {
    startIso: new Date(year, month, monthStartDay).toISOString(),
    endIso: new Date(year, month + 1, monthStartDay).toISOString(),
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
  return { year: date.getFullYear(), month: date.getMonth() };
}

/** Whole days in the month, and how many of them have started by `now` (all of them for past months). */
export function monthProgress(key: MonthKey, now: Date): { days: number; elapsed: number } {
  const start = new Date(key.year, key.month, monthStartDay);
  const end = new Date(key.year, key.month + 1, monthStartDay);
  const days = Math.round((end.getTime() - start.getTime()) / 86_400_000);
  if (now < start) {
    return { days, elapsed: 0 };
  }
  if (now >= end) {
    return { days, elapsed: days };
  }
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return { days, elapsed: Math.round((today.getTime() - start.getTime()) / 86_400_000) + 1 };
}

/** What the dashboard shows: one month, this year so far, or chosen days (local `YYYY-MM-DD`, both included). */
export type Period =
  | { kind: 'month'; month: MonthKey }
  | { kind: 'ytd' }
  | { kind: 'custom'; from: string; to: string };

function parseDay(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) {
    return null;
  }
  const [y, m, d] = match.slice(1).map(Number) as [number, number, number];
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d ? date : null;
}

/** Null for a custom period with an invalid or reversed range. */
export function periodRange(period: Period, now: Date): DateRange | null {
  if (period.kind === 'month') {
    return monthRange(period.month);
  }
  if (period.kind === 'ytd') {
    return {
      startIso: new Date(now.getFullYear(), 0, 1).toISOString(),
      endIso: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString(),
    };
  }
  const from = parseDay(period.from);
  const to = parseDay(period.to);
  if (!from || !to || to < from) {
    return null;
  }
  return {
    startIso: from.toISOString(),
    endIso: new Date(to.getFullYear(), to.getMonth(), to.getDate() + 1).toISOString(),
  };
}

export function isInRange(iso: string, range: DateRange): boolean {
  const time = Date.parse(iso);
  return time >= Date.parse(range.startIso) && time < Date.parse(range.endIso);
}

/** "October 2026", or "25 Oct – 24 Nov" when months do not start on the 1st. */
export function formatMonth(key: MonthKey, locale = 'en-IN'): string {
  if (monthStartDay === 1) {
    return new Date(key.year, key.month, 1).toLocaleDateString(locale, {
      month: 'long',
      year: 'numeric',
    });
  }
  const short = (date: Date) => date.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
  const start = new Date(key.year, key.month, monthStartDay);
  const end = new Date(key.year, key.month + 1, monthStartDay - 1);
  const sameYear = start.getFullYear() === new Date().getFullYear() && end.getFullYear() === start.getFullYear();
  return `${short(start)} – ${short(end)}${sameYear ? '' : ` ${end.getFullYear()}`}`;
}

/** The month's name ("October"), for phrases like "carried over from September". */
export function monthName(key: MonthKey, locale = 'en-IN'): string {
  return new Date(key.year, key.month, 1).toLocaleDateString(locale, { month: 'long' });
}
