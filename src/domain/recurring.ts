export type Frequency = 'weekly' | 'monthly' | 'yearly';

export const FREQUENCY_LABEL: Record<Frequency, string> = {
  weekly: 'Every week',
  monthly: 'Every month',
  yearly: 'Every year',
};

/** Repeats created in one go at most, so a long-forgotten rule cannot flood the ledger. */
export const MAX_CATCH_UP = 60;

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/**
 * The `index`-th repeat (0 = the start), in local time. Monthly and yearly
 * repeats keep the start's day and fall back to the month's last day, so a
 * rule starting on 31 January runs on 28/29 February and 31 March.
 */
export function occurrenceAt(startIso: string, frequency: Frequency, index: number): string {
  const start = new Date(startIso);
  const time = [start.getHours(), start.getMinutes(), start.getSeconds(), start.getMilliseconds()] as const;
  if (frequency === 'weekly') {
    return new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7 * index, ...time).toISOString();
  }
  const months = frequency === 'monthly' ? index : 12 * index;
  const target = new Date(start.getFullYear(), start.getMonth() + months, 1);
  const day = Math.min(start.getDate(), daysInMonth(target.getFullYear(), target.getMonth()));
  return new Date(target.getFullYear(), target.getMonth(), day, ...time).toISOString();
}

/** Dates of the repeats due by `now` that have not been created yet. */
export function dueOccurrences(
  startIso: string,
  frequency: Frequency,
  created: number,
  now: Date,
  max = MAX_CATCH_UP,
): string[] {
  const due: string[] = [];
  for (let index = created; due.length < max; index++) {
    const at = occurrenceAt(startIso, frequency, index);
    if (Date.parse(at) > now.getTime()) {
      break;
    }
    due.push(at);
  }
  return due;
}
