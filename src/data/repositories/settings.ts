import type { SQLiteDatabase } from 'expo-sqlite';

import { DEFAULT_WARN_PERCENT } from '../../domain/budgets/budgets';
import { MAX_MONTH_START_DAY } from '../../domain/period';

/** Device-local preferences. These are not synced. */
async function getSetting(db: SQLiteDatabase, key: string): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', key);
  return row?.value ?? null;
}

async function setSetting(db: SQLiteDatabase, key: string, value: string): Promise<void> {
  await db.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', key, value);
}

export async function getBudgetWarnPercent(db: SQLiteDatabase): Promise<number> {
  const value = Number(await getSetting(db, 'budget_warn_percent'));
  return Number.isInteger(value) && value > 0 && value <= 100 ? value : DEFAULT_WARN_PERCENT;
}

export async function setBudgetWarnPercent(db: SQLiteDatabase, percent: number): Promise<void> {
  await setSetting(db, 'budget_warn_percent', String(percent));
}

/** Whether detected payments with a recognised category are added without review. On by default. */
export async function getAutoAddPayments(db: SQLiteDatabase): Promise<boolean> {
  return (await getSetting(db, 'auto_add_payments')) !== '0';
}

export async function setAutoAddPayments(db: SQLiteDatabase, enabled: boolean): Promise<void> {
  await setSetting(db, 'auto_add_payments', enabled ? '1' : '0');
}

/** The user's name as banks show it, to recognise transfers between their own accounts. */
export async function getOwnerName(db: SQLiteDatabase): Promise<string> {
  return (await getSetting(db, 'owner_name')) ?? '';
}

export async function setOwnerName(db: SQLiteDatabase, name: string): Promise<void> {
  await setSetting(db, 'owner_name', name.trim());
}

/** Local insight notifications. Off | monthly | weekly (weekly includes monthly). */
export type InsightNotifyLevel = 'off' | 'monthly' | 'weekly';

export async function getInsightNotifyLevel(db: SQLiteDatabase): Promise<InsightNotifyLevel> {
  const value = await getSetting(db, 'insight_notify');
  return value === 'off' || value === 'monthly' || value === 'weekly' ? value : 'monthly';
}

export async function setInsightNotifyLevel(db: SQLiteDatabase, level: InsightNotifyLevel): Promise<void> {
  await setSetting(db, 'insight_notify', level);
}

export type InsightNotifyFlag = 'pace' | 'unusual' | 'salary' | 'bills' | 'cards';

/** `cards` (credit card due-date reminders) works even when overview notifications are off. */
export async function getInsightNotifyFlags(db: SQLiteDatabase): Promise<Record<InsightNotifyFlag, boolean>> {
  return {
    pace: (await getSetting(db, 'insight_pace')) !== '0',
    unusual: (await getSetting(db, 'insight_unusual')) !== '0',
    salary: (await getSetting(db, 'insight_salary')) !== '0',
    bills: (await getSetting(db, 'insight_bills')) !== '0',
    cards: (await getSetting(db, 'insight_cards')) !== '0',
  };
}

export async function setInsightNotifyFlag(
  db: SQLiteDatabase,
  flag: InsightNotifyFlag,
  enabled: boolean,
): Promise<void> {
  await setSetting(db, `insight_${flag}`, enabled ? '1' : '0');
}

function intSetting(value: string | null, min: number, max: number, fallback: number): number {
  const n = Number(value);
  return value !== null && Number.isInteger(n) && n >= min && n <= max ? n : fallback;
}

/** Day of the month that months start on (1–28), e.g. the salary day. */
export async function getMonthStartDaySetting(db: SQLiteDatabase): Promise<number> {
  return intSetting(await getSetting(db, 'month_start_day'), 1, MAX_MONTH_START_DAY, 1);
}

export async function setMonthStartDaySetting(db: SQLiteDatabase, day: number): Promise<void> {
  await setSetting(db, 'month_start_day', String(intSetting(String(day), 1, MAX_MONTH_START_DAY, 1)));
}

export type ThemePreference = 'system' | 'light' | 'dark';

export async function getThemePreference(db: SQLiteDatabase): Promise<ThemePreference> {
  const value = await getSetting(db, 'theme');
  return value === 'light' || value === 'dark' ? value : 'system';
}

export async function setThemePreference(db: SQLiteDatabase, theme: ThemePreference): Promise<void> {
  await setSetting(db, 'theme', theme);
}

/** Whether opening the app needs fingerprint, face or the phone's passcode. Off by default. */
export async function getAppLock(db: SQLiteDatabase): Promise<boolean> {
  return (await getSetting(db, 'app_lock')) === '1';
}

export async function setAppLock(db: SQLiteDatabase, enabled: boolean): Promise<void> {
  await setSetting(db, 'app_lock', enabled ? '1' : '0');
}

/** Whether first-run setup has been finished or skipped. */
export async function getOnboarded(db: SQLiteDatabase): Promise<boolean> {
  return (await getSetting(db, 'onboarded')) === '1';
}

export async function setOnboarded(db: SQLiteDatabase): Promise<void> {
  await setSetting(db, 'onboarded', '1');
}

/** Raw saved dashboard layout; `parseDashboardLayout` turns it into sections. */
export async function getDashboardLayoutSetting(db: SQLiteDatabase): Promise<string | null> {
  return getSetting(db, 'dashboard_layout');
}

export async function setDashboardLayoutSetting(db: SQLiteDatabase, json: string): Promise<void> {
  await setSetting(db, 'dashboard_layout', json);
}

export interface AlertTuning {
  /** Every expense of at least this much is "large"; null uses the automatic rule. */
  largePaymentMinor: number | null;
  /** 0 = Sunday … 6 = Saturday. */
  weeklyDigestDay: number;
  /** Card reminders this many days before the due day (0 = only on the day). */
  cardReminderDaysBefore: number;
  /** Local hour card reminders fire at. */
  cardReminderHour: number;
}

export const DEFAULT_ALERT_TUNING: AlertTuning = {
  largePaymentMinor: null,
  weeklyDigestDay: 0,
  cardReminderDaysBefore: 3,
  cardReminderHour: 9,
};

export async function getAlertTuning(db: SQLiteDatabase): Promise<AlertTuning> {
  const large = await getSetting(db, 'large_payment_minor');
  const largeMinor = Number(large);
  return {
    largePaymentMinor: large !== null && Number.isSafeInteger(largeMinor) && largeMinor > 0 ? largeMinor : null,
    weeklyDigestDay: intSetting(await getSetting(db, 'weekly_digest_day'), 0, 6, DEFAULT_ALERT_TUNING.weeklyDigestDay),
    cardReminderDaysBefore: intSetting(
      await getSetting(db, 'card_reminder_days'),
      0,
      7,
      DEFAULT_ALERT_TUNING.cardReminderDaysBefore,
    ),
    cardReminderHour: intSetting(await getSetting(db, 'card_reminder_hour'), 0, 23, DEFAULT_ALERT_TUNING.cardReminderHour),
  };
}

export async function setAlertTuning(db: SQLiteDatabase, tuning: Partial<AlertTuning>): Promise<void> {
  if ('largePaymentMinor' in tuning) {
    if (tuning.largePaymentMinor === null || tuning.largePaymentMinor === undefined) {
      await db.runAsync("DELETE FROM settings WHERE key = 'large_payment_minor'");
    } else {
      await setSetting(db, 'large_payment_minor', String(tuning.largePaymentMinor));
    }
  }
  if (tuning.weeklyDigestDay !== undefined) {
    await setSetting(db, 'weekly_digest_day', String(intSetting(String(tuning.weeklyDigestDay), 0, 6, 0)));
  }
  if (tuning.cardReminderDaysBefore !== undefined) {
    await setSetting(db, 'card_reminder_days', String(intSetting(String(tuning.cardReminderDaysBefore), 0, 7, 3)));
  }
  if (tuning.cardReminderHour !== undefined) {
    await setSetting(db, 'card_reminder_hour', String(intSetting(String(tuning.cardReminderHour), 0, 23, 9)));
  }
}

/** Last local calendar day we posted each insight, to avoid duplicates. */
export async function getInsightLastSent(db: SQLiteDatabase, kind: string): Promise<string | null> {
  return getSetting(db, `insight_sent_${kind}`);
}

export async function setInsightLastSent(db: SQLiteDatabase, kind: string, day: string): Promise<void> {
  await setSetting(db, `insight_sent_${kind}`, day);
}
