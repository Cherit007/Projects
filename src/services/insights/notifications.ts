import type { SQLiteDatabase } from 'expo-sqlite';
import { Platform } from 'react-native';

import {
  checkUnusualExpense,
  loadMonthInsight,
  monthlyOverviewBody,
  paceBody,
} from '@/data/queries/insights';
import {
  getAlertTuning,
  getInsightLastSent,
  getInsightNotifyFlags,
  getInsightNotifyLevel,
  setInsightLastSent,
} from '@/data/repositories/settings';
import { loadCardsOverview } from '@/data/queries/cards';
import { cardReminders } from '@/domain/cards/billing';
import { SALARY_CATEGORY } from '@/domain/categories/defaults';
import { formatMinor } from '@/domain/money/money';
import { addMonths, getMonthStartDay, monthKeyOf, monthProgress } from '@/domain/period';
import { listCategories } from '@/data/repositories/categories';
import { toLocalDateInput } from '@/utils/dates';

import { loadNative } from '../loadNative';

const notifications = () => loadNative(() => import('expo-notifications'), 'Insight notifications');

async function ensurePermission(): Promise<boolean> {
  if (Platform.OS === 'web') {
    return false;
  }
  const Notifications = await notifications();
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) {
    return true;
  }
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted;
}

async function notify(title: string, body: string, id: string): Promise<void> {
  const Notifications = await notifications();
  await Notifications.scheduleNotificationAsync({
    identifier: id,
    content: { title, body, sound: false },
    trigger: null,
  });
}

/**
 * Runs on app open. Posts at most one of each insight kind per local day,
 * based on Settings. All computation stays on the device.
 */
export async function runInsightNotifications(db: SQLiteDatabase, now = new Date()): Promise<void> {
  const level = await getInsightNotifyLevel(db);
  if (level === 'off') {
    return;
  }
  if (!(await ensurePermission())) {
    return;
  }
  const flags = await getInsightNotifyFlags(db);
  const today = toLocalDateInput(now.toISOString());
  const month = monthKeyOf(now);
  const insight = await loadMonthInsight(db, month, now);

  // Monthly overview on the first day of the month (covers the previous month).
  if (now.getDate() === getMonthStartDay() && (await getInsightLastSent(db, 'monthly')) !== today) {
    const last = await loadMonthInsight(db, addMonths(month, -1), now);
    await notify('Monthly overview', monthlyOverviewBody(last), `insight-monthly-${today}`);
    await setInsightLastSent(db, 'monthly', today);
  }

  // Weekly digest on the chosen weekday (Sunday by default).
  const { weeklyDigestDay } = await getAlertTuning(db);
  if (level === 'weekly' && now.getDay() === weeklyDigestDay && (await getInsightLastSent(db, 'weekly')) !== today) {
    await notify(
      'This week in Many Tracker',
      `So far this month you have spent ${formatMinor(insight.expenseMinor)}. ${paceBody(insight)}`,
      `insight-weekly-${today}`,
    );
    await setInsightLastSent(db, 'weekly', today);
  }

  // Mid-month pace on the month's 15th day.
  if (flags.pace && monthProgress(month, now).elapsed === 15 && (await getInsightLastSent(db, 'pace')) !== today) {
    await notify('Spending pace', paceBody(insight), `insight-pace-${today}`);
    await setInsightLastSent(db, 'pace', today);
  }

  // Upcoming bills within 3 days.
  if (flags.bills && (await getInsightLastSent(db, 'bills')) !== today) {
    const soon = insight.upcoming.filter(b => {
      const [y, m, d] = b.nextDue.split('-').map(Number);
      const due = new Date(y, m - 1, d);
      const diff = (due.getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) / 86_400_000;
      return diff >= 0 && diff <= 3;
    });
    if (soon.length > 0) {
      const first = soon[0]!;
      await notify(
        soon.length === 1 ? 'Bill due soon' : `${soon.length} bills due soon`,
        `${first.counterparty} · ${formatMinor(first.amountMinor)} on ${first.nextDue}`,
        `insight-bills-${today}`,
      );
      await setInsightLastSent(db, 'bills', today);
    }
  }
}

const CARD_REMINDER_PREFIX = 'card-due-';

/**
 * Replaces the scheduled credit card due-date reminders with ones for each
 * card's current bill. Runs on app open and after card transactions, so a
 * paid bill stops reminding. Permission is only asked when a reminder is due.
 */
export async function scheduleCardReminders(db: SQLiteDatabase, now = new Date()): Promise<void> {
  if (Platform.OS === 'web') {
    return;
  }
  const [flags, tuning] = await Promise.all([getInsightNotifyFlags(db), getAlertTuning(db)]);
  const reminders = flags.cards
    ? (await loadCardsOverview(db, now)).cards.flatMap(card =>
        card.bill
          ? cardReminders(
              card.account.id,
              card.account.name,
              card.bill,
              now,
              formatMinor,
              tuning.cardReminderDaysBefore,
              tuning.cardReminderHour,
            )
          : [],
      )
    : [];

  const Notifications = await notifications();
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const request of scheduled) {
    if (request.identifier.startsWith(CARD_REMINDER_PREFIX)) {
      await Notifications.cancelScheduledNotificationAsync(request.identifier);
    }
  }
  if (reminders.length === 0 || !(await ensurePermission())) {
    return;
  }
  for (const reminder of reminders) {
    await Notifications.scheduleNotificationAsync({
      identifier: reminder.id,
      content: { title: reminder.title, body: reminder.body },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: reminder.at },
    });
  }
}

/** Call after saving an expense or income to surface unusual spend or salary. */
export async function notifyOnSave(
  db: SQLiteDatabase,
  input: { type: 'income' | 'expense' | 'transfer'; amountMinor: number; occurredAt: string; categoryId: string | null; counterparty: string | null },
): Promise<void> {
  if (input.type === 'transfer') {
    return;
  }
  const level = await getInsightNotifyLevel(db);
  if (level === 'off') {
    return;
  }
  const flags = await getInsightNotifyFlags(db);
  if (!(await ensurePermission())) {
    return;
  }
  const today = toLocalDateInput(new Date().toISOString());

  if (input.type === 'expense' && flags.unusual) {
    const { largePaymentMinor } = await getAlertTuning(db);
    if (await checkUnusualExpense(db, input.amountMinor, input.occurredAt, largePaymentMinor)) {
      await notify(
        'Large payment',
        `${input.counterparty || 'A payment'} for ${formatMinor(input.amountMinor)} looks bigger than usual.`,
        `insight-unusual-${input.occurredAt}-${input.amountMinor}`,
      );
    }
  }

  if (input.type === 'income' && flags.salary && input.categoryId) {
    const categories = await listCategories(db, { includeArchived: true });
    const salary = categories.find(c => c.name === SALARY_CATEGORY);
    if (salary && input.categoryId === salary.id && (await getInsightLastSent(db, `salary-${today}`)) !== today) {
      await notify(
        'Income credited',
        `${input.counterparty || 'Income'} · ${formatMinor(input.amountMinor)}`,
        `insight-salary-${today}`,
      );
      await setInsightLastSent(db, `salary-${today}`, today);
    }
  }
}
