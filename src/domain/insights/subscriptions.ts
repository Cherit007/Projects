import type { MinorUnits } from '../money/money';

export interface PastPayment {
  counterparty: string;
  amountMinor: MinorUnits;
  /** Local calendar day key YYYY-MM-DD. */
  day: string;
  categoryId: string | null;
  categoryName: string | null;
}

export interface DetectedSubscription {
  counterparty: string;
  amountMinor: MinorUnits;
  /** Typical day of month (1–28) the charge lands. */
  dayOfMonth: number;
  /** How many months this pattern appeared. */
  monthsSeen: number;
  categoryId: string | null;
  categoryName: string | null;
  /** Next expected local date YYYY-MM-DD. */
  nextDue: string;
}

function dayOfMonth(day: string): number {
  return Number(day.slice(8, 10));
}

function addMonths(day: string, months: number): string {
  const [y, m, d] = day.split('-').map(Number);
  const date = new Date(y, m - 1 + months, Math.min(d, 28));
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function monthKey(day: string): string {
  return day.slice(0, 7);
}

/**
 * Payees paid once a month, in at least two months, always at about the same
 * amount (±10%) on a similar day of the month (±3 days), are treated as
 * subscriptions. Shops visited often fail this: some month has two payments,
 * or an amount or date that does not fit.
 */
export function detectSubscriptions(
  payments: readonly PastPayment[],
  today: string,
): DetectedSubscription[] {
  const byPayee = new Map<string, PastPayment[]>();
  for (const p of payments) {
    const key = p.counterparty.trim().toLowerCase();
    if (!key) {
      continue;
    }
    byPayee.set(key, [...(byPayee.get(key) ?? []), p]);
  }

  const found: DetectedSubscription[] = [];
  for (const group of byPayee.values()) {
    const byMonth = new Map<string, PastPayment>();
    const pastMonths = group.filter(p => monthKey(p.day) !== monthKey(today));
    for (const p of [...pastMonths].sort((a, b) => a.day.localeCompare(b.day))) {
      byMonth.set(monthKey(p.day), p);
    }
    if (byMonth.size < 2 || byMonth.size !== pastMonths.length) {
      continue;
    }
    const samples = [...byMonth.values()];
    const latest = samples[samples.length - 1];
    const similar = samples.filter(p => {
      const amountOk =
        Math.abs(p.amountMinor - latest.amountMinor) <= Math.max(100, latest.amountMinor * 0.1);
      const dayOk = Math.abs(dayOfMonth(p.day) - dayOfMonth(latest.day)) <= 3;
      return amountOk && dayOk;
    });
    if (similar.length !== samples.length) {
      continue;
    }
    const avgDay = Math.round(
      similar.reduce((sum, p) => sum + dayOfMonth(p.day), 0) / similar.length,
    );
    let nextDue = `${today.slice(0, 8)}${String(Math.min(avgDay, 28)).padStart(2, '0')}`;
    if (nextDue <= today) {
      nextDue = addMonths(nextDue, 1);
    }
    // If we already paid this month at that amount, push to next month.
    if (group.some(p => monthKey(p.day) === monthKey(today)) && monthKey(nextDue) === monthKey(today)) {
      nextDue = addMonths(nextDue, 1);
    }
    found.push({
      counterparty: latest.counterparty.trim(),
      amountMinor: latest.amountMinor,
      dayOfMonth: avgDay,
      monthsSeen: similar.length,
      categoryId: latest.categoryId,
      categoryName: latest.categoryName,
      nextDue,
    });
  }
  return found.sort((a, b) => a.nextDue.localeCompare(b.nextDue) || a.counterparty.localeCompare(b.counterparty));
}

/** Bills due within the next `withinDays` days (inclusive of today). */
export function upcomingBills(
  subscriptions: readonly DetectedSubscription[],
  today: string,
  withinDays: number,
): DetectedSubscription[] {
  const limit = addMonths(today, 0);
  // compute today + withinDays
  const [y, m, d] = today.split('-').map(Number);
  const end = new Date(y, m - 1, d + withinDays);
  const endKey = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`;
  void limit;
  return subscriptions.filter(s => s.nextDue >= today && s.nextDue <= endKey);
}
