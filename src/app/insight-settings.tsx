import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { haptic } from '@/components/PressableScale';
import { Button, Card, Chip, Input, LoadingState, SectionTitle } from '@/components/ui';
import {
  getAlertTuning,
  getInsightNotifyFlags,
  getInsightNotifyLevel,
  setAlertTuning,
  setInsightNotifyFlag,
  setInsightNotifyLevel,
  type AlertTuning,
  type InsightNotifyFlag,
  type InsightNotifyLevel,
} from '@/data/repositories/settings';
import { formatMinor, parseToMinor } from '@/domain/money/money';
import { getMonthStartDay } from '@/domain/period';
import { useFocusQuery } from '@/hooks/useFocusQuery';
import { scheduleCardReminders } from '@/services/insights/notifications';
import { colors, themedStyles } from '@/theme/colors';

const LEVELS: { value: InsightNotifyLevel; label: string }[] = [
  { value: 'off', label: 'Off' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'weekly', label: 'Weekly + monthly' },
];

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAYS_BEFORE = [0, 1, 2, 3, 5, 7];
const HOURS = [7, 9, 12, 18, 21];

function hourLabel(hour: number): string {
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return `${h} ${hour < 12 ? 'AM' : 'PM'}`;
}

function ordinal(day: number): string {
  const suffix = day % 10 === 1 && day !== 11 ? 'st' : day % 10 === 2 && day !== 12 ? 'nd' : day % 10 === 3 && day !== 13 ? 'rd' : 'th';
  return `${day}${suffix}`;
}

export default function InsightSettingsScreen() {
  const db = useSQLiteContext();
  const { data, isLoading, reload } = useFocusQuery(
    useCallback(async database => {
      const [level, flags, tuning] = await Promise.all([
        getInsightNotifyLevel(database),
        getInsightNotifyFlags(database),
        getAlertTuning(database),
      ]);
      return { level, flags, tuning };
    }, []),
  );
  const [busy, setBusy] = useState(false);
  /** What the user is typing; null shows the saved amount. */
  const [largeDraft, setLargeDraft] = useState<string | null>(null);

  if (!data && isLoading) {
    return <LoadingState />;
  }
  if (!data) {
    return null;
  }

  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    try {
      await work();
      await reload();
    } finally {
      setBusy(false);
    }
  };

  const setLevel = (level: InsightNotifyLevel) => run(() => setInsightNotifyLevel(db, level));

  const setFlag = (flag: InsightNotifyFlag, enabled: boolean) =>
    run(async () => {
      await setInsightNotifyFlag(db, flag, enabled);
      if (flag === 'cards') {
        await scheduleCardReminders(db).catch(() => undefined);
      }
    });

  const tune = (patch: Partial<AlertTuning>) =>
    run(async () => {
      await setAlertTuning(db, patch);
      if ('cardReminderDaysBefore' in patch || 'cardReminderHour' in patch) {
        await scheduleCardReminders(db).catch(() => undefined);
      }
    });

  const { tuning } = data;
  const largeText = largeDraft ?? (tuning.largePaymentMinor === null ? '' : String(tuning.largePaymentMinor / 100));

  const saveLarge = async () => {
    const minor = largeText.trim() ? parseToMinor(largeText) : null;
    if (largeText.trim() && (minor === null || minor <= 0)) {
      Alert.alert('Check the amount', 'Enter an amount greater than zero, or leave it blank for automatic.');
      return;
    }
    await tune({ largePaymentMinor: minor });
    setLargeDraft(null);
    haptic('success');
  };

  const off = busy || data.level === 'off';

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <SectionTitle title="Overview notifications" />
      <Card style={styles.card}>
        <Text style={styles.body}>
          Computed on this phone. The monthly overview posts on the {ordinal(getMonthStartDay())} for the month just
          ended; the weekly digest on {WEEKDAY_NAMES[tuning.weeklyDigestDay]}s.
        </Text>
        <View style={styles.chips}>
          {LEVELS.map(option => (
            <Chip
              key={option.value}
              label={option.label}
              selected={data.level === option.value}
              onPress={() => !busy && setLevel(option.value)}
            />
          ))}
        </View>
        {data.level === 'weekly' && (
          <>
            <Text style={styles.title}>Weekly digest on</Text>
            <View style={styles.chips}>
              {WEEKDAYS.map((label, day) => (
                <Chip
                  key={label}
                  label={label}
                  selected={tuning.weeklyDigestDay === day}
                  onPress={() => !busy && tune({ weeklyDigestDay: day })}
                />
              ))}
            </View>
          </>
        )}
      </Card>

      <SectionTitle title="Also alert me about" />
      <Card style={styles.card}>
        <FlagRow
          title="Mid-month spending pace"
          detail="Halfway through the month: at this rate you will hit ₹Y by month end"
          value={data.flags.pace}
          onChange={v => setFlag('pace', v)}
          disabled={off}
        />
        <FlagRow
          title="Large or unusual spends"
          detail={
            tuning.largePaymentMinor === null
              ? 'When a payment is much bigger than your recent ones'
              : `Every payment of ${formatMinor(tuning.largePaymentMinor)} or more`
          }
          value={data.flags.unusual}
          onChange={v => setFlag('unusual', v)}
          disabled={off}
        />
        {data.flags.unusual && (
          <View style={styles.inline}>
            <Input
              style={styles.flex}
              value={largeText}
              onChangeText={setLargeDraft}
              keyboardType="decimal-pad"
              placeholder="Automatic (or e.g. 5000)"
            />
            <Button title="Save" variant="secondary" onPress={saveLarge} disabled={off} />
          </View>
        )}
        <FlagRow
          title="Salary or income credited"
          detail="When a payment is saved in the Salary category"
          value={data.flags.salary}
          onChange={v => setFlag('salary', v)}
          disabled={off}
        />
        <FlagRow
          title="Bills due in 3 days"
          detail="From subscriptions detected in your history"
          value={data.flags.bills}
          onChange={v => setFlag('bills', v)}
          disabled={off}
        />
      </Card>

      <SectionTitle title="Payment reminders" />
      <Card style={styles.card}>
        <FlagRow
          title="Credit card due dates"
          detail="For cards with statement and due days set. Works even when overview notifications are off."
          value={data.flags.cards}
          onChange={v => setFlag('cards', v)}
          disabled={busy}
        />
        {data.flags.cards && (
          <>
            <Text style={styles.title}>Remind me before the due day</Text>
            <View style={styles.chips}>
              {DAYS_BEFORE.map(days => (
                <Chip
                  key={days}
                  label={days === 0 ? 'Only on the day' : `${days} day${days === 1 ? '' : 's'}`}
                  selected={tuning.cardReminderDaysBefore === days}
                  onPress={() => !busy && tune({ cardReminderDaysBefore: days })}
                />
              ))}
            </View>
            <Text style={styles.title}>At</Text>
            <View style={styles.chips}>
              {HOURS.map(hour => (
                <Chip
                  key={hour}
                  label={hourLabel(hour)}
                  selected={tuning.cardReminderHour === hour}
                  onPress={() => !busy && tune({ cardReminderHour: hour })}
                />
              ))}
            </View>
          </>
        )}
      </Card>
    </ScrollView>
  );
}

function FlagRow({
  title,
  detail,
  value,
  onChange,
  disabled,
}: {
  title: string;
  detail: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.flag}>
      <View style={styles.flex}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.detail}>{detail}</Text>
      </View>
      <Switch value={value} onValueChange={onChange} disabled={disabled} trackColor={{ true: colors.primary }} />
    </View>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
    content: { padding: 16, gap: 14, paddingBottom: 48 },
    card: { gap: 14 },
    body: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    flag: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    inline: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    flex: { flex: 1, gap: 2 },
    title: { fontSize: 15, fontWeight: '600', color: colors.text },
    detail: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },
  }),
);
