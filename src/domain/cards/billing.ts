import type { MinorUnits } from '../money/money';

/** When a card's statement is generated and its bill is due, as days of the month (1–31). */
export interface CardCycle {
  statementDay: number;
  dueDay: number;
}

/** Ledger totals for one card around its last statement, as produced by a query. */
export interface CardFlows {
  /** Negative while money is owed, like the account balance. */
  openingBalanceMinor: MinorUnits;
  /** Net balance change from transactions up to the end of the statement day. */
  beforeStatementMinor: MinorUnits;
  /** Payments and refunds after the statement (positive). */
  creditsSinceMinor: MinorUnits;
  /** Purchases and other debits after the statement (positive). */
  debitsSinceMinor: MinorUnits;
}

export type CardBillStatus = 'due' | 'overdue' | 'paid' | 'nothing';

export interface CardBill {
  /** Local `YYYY-MM-DD` dates. */
  statementDate: string;
  dueDate: string;
  nextStatementDate: string;
  nextDueDate: string;
  /** Owed when the last statement was generated. */
  billedMinor: MinorUnits;
  /** Paid towards that statement since it was generated. */
  paidMinor: MinorUnits;
  /** Still to pay for that statement by `dueDate`. */
  remainingMinor: MinorUnits;
  /** Spent since the statement; it is billed on `nextStatementDate`. */
  unbilledMinor: MinorUnits;
  /** Everything owed on the card now. */
  owedMinor: MinorUnits;
  status: CardBillStatus;
  /** Days from today until `dueDate`; negative once it has passed. */
  daysToDue: number;
}

const DAY_MS = 86_400_000;

export function isValidCycleDay(day: number): boolean {
  return Number.isInteger(day) && day >= 1 && day <= 31;
}

/** `day` in the given month, falling back to the month's last day (31 → 28/29 Feb). */
function dayInMonth(year: number, month: number, day: number): Date {
  const last = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(day, last));
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function ymd(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function daysBetween(from: Date, to: Date): number {
  return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / DAY_MS);
}

/** The most recent statement date on or before today. */
export function lastStatementDate(statementDay: number, now: Date): Date {
  const today = startOfDay(now);
  const thisMonth = dayInMonth(today.getFullYear(), today.getMonth(), statementDay);
  return thisMonth <= today ? thisMonth : dayInMonth(today.getFullYear(), today.getMonth() - 1, statementDay);
}

/** The first `dueDay` after the statement date (due dates usually fall in the following month). */
export function dueDateAfter(statement: Date, dueDay: number): Date {
  const sameMonth = dayInMonth(statement.getFullYear(), statement.getMonth(), dueDay);
  return sameMonth > statement ? sameMonth : dayInMonth(statement.getFullYear(), statement.getMonth() + 1, dueDay);
}

/**
 * Transactions before this instant are on the last statement: everything up
 * to the end of the statement day, in local time.
 */
export function statementCutoffIso(statementDay: number, now: Date): string {
  const statement = lastStatementDate(statementDay, now);
  return new Date(statement.getFullYear(), statement.getMonth(), statement.getDate() + 1).toISOString();
}

export function cardBill(cycle: CardCycle, flows: CardFlows, now: Date): CardBill {
  const statement = lastStatementDate(cycle.statementDay, now);
  const due = dueDateAfter(statement, cycle.dueDay);
  const nextStatement = dayInMonth(statement.getFullYear(), statement.getMonth() + 1, cycle.statementDay);

  const billedMinor = Math.max(0, -(flows.openingBalanceMinor + flows.beforeStatementMinor));
  const paidMinor = Math.min(billedMinor, flows.creditsSinceMinor);
  const remainingMinor = billedMinor - paidMinor;
  const owedMinor = Math.max(
    0,
    -(flows.openingBalanceMinor + flows.beforeStatementMinor + flows.creditsSinceMinor - flows.debitsSinceMinor),
  );
  const daysToDue = daysBetween(now, due);

  let status: CardBillStatus;
  if (remainingMinor > 0) {
    status = daysToDue < 0 ? 'overdue' : 'due';
  } else {
    status = billedMinor > 0 ? 'paid' : 'nothing';
  }

  return {
    statementDate: ymd(statement),
    dueDate: ymd(due),
    nextStatementDate: ymd(nextStatement),
    nextDueDate: ymd(dueDateAfter(nextStatement, cycle.dueDay)),
    billedMinor,
    paidMinor,
    remainingMinor,
    unbilledMinor: flows.debitsSinceMinor,
    owedMinor,
    status,
    daysToDue,
  };
}

/** What can still be spent on the card; never below zero. */
export function availableCreditMinor(limitMinor: MinorUnits, owedMinor: MinorUnits): MinorUnits {
  return Math.max(0, limitMinor - owedMinor);
}

export interface CardReminder {
  id: string;
  /** Local time the reminder fires. */
  at: Date;
  title: string;
  body: string;
}

/** Reminders fire at this local hour. */
export const REMINDER_HOUR = 9;
export const REMINDER_DAYS_BEFORE = 3;

/**
 * Reminders for the card's next payment at `hour`, `daysBefore` days ahead
 * (none when 0) and on the due day, skipping any already in the past. When the last statement is
 * settled, they cover the next statement's due date if anything has been
 * spent since, so a reminder exists even if the app is not opened.
 */
export function cardReminders(
  accountId: string,
  cardName: string,
  bill: CardBill,
  now: Date,
  formatAmount: (minor: MinorUnits) => string,
  daysBefore = REMINDER_DAYS_BEFORE,
  hour = REMINDER_HOUR,
): CardReminder[] {
  let dueDate: string;
  let amount: string;
  if (bill.remainingMinor > 0 && bill.status === 'due') {
    dueDate = bill.dueDate;
    amount = formatAmount(bill.remainingMinor);
  } else if (bill.remainingMinor === 0 && bill.owedMinor > 0) {
    dueDate = bill.nextDueDate;
    amount = `about ${formatAmount(bill.owedMinor)}`;
  } else {
    return [];
  }

  const [y, m, d] = dueDate.split('-').map(Number);
  const label = new Date(y, m - 1, d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  const candidates: CardReminder[] = [
    ...(daysBefore > 0
      ? [
          {
            id: `card-due-${accountId}-${dueDate}-early`,
            at: new Date(y, m - 1, d - daysBefore, hour),
            title: `${cardName} bill due ${label}`,
            body: `Pay ${amount} by ${label} to avoid interest and late fees.`,
          },
        ]
      : []),
    {
      id: `card-due-${accountId}-${dueDate}-today`,
      at: new Date(y, m - 1, d, hour),
      title: `${cardName} bill due today`,
      body: `Pay ${amount} today to avoid interest and late fees.`,
    },
  ];
  return candidates.filter(reminder => reminder.at.getTime() > now.getTime());
}
