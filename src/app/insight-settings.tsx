import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { Card, Chip, LoadingState, SectionTitle } from '@/components/ui';
import {
  getInsightNotifyFlags,
  getInsightNotifyLevel,
  setInsightNotifyFlag,
  setInsightNotifyLevel,
  type InsightNotifyLevel,
} from '@/data/repositories/settings';
import { useFocusQuery } from '@/hooks/useFocusQuery';
import { colors } from '@/theme/colors';

const LEVELS: { value: InsightNotifyLevel; label: string }[] = [
  { value: 'off', label: 'Off' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'weekly', label: 'Weekly + monthly' },
];

export default function InsightSettingsScreen() {
  const db = useSQLiteContext();
  const { data, isLoading, reload } = useFocusQuery(
    useCallback(async database => {
      const [level, flags] = await Promise.all([getInsightNotifyLevel(database), getInsightNotifyFlags(database)]);
      return { level, flags };
    }, []),
  );
  const [busy, setBusy] = useState(false);

  if (!data && isLoading) {
    return <LoadingState />;
  }
  if (!data) {
    return null;
  }

  const setLevel = async (level: InsightNotifyLevel) => {
    setBusy(true);
    await setInsightNotifyLevel(db, level);
    await reload();
    setBusy(false);
  };

  const setFlag = async (flag: 'pace' | 'unusual' | 'salary' | 'bills', enabled: boolean) => {
    setBusy(true);
    await setInsightNotifyFlag(db, flag, enabled);
    await reload();
    setBusy(false);
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <SectionTitle title="Overview notifications" />
      <Card style={styles.card}>
        <Text style={styles.body}>
          Computed on this phone. Monthly posts on the 1st for the previous month. Weekly digests run on Sundays.
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
      </Card>

      <SectionTitle title="Also alert me about" />
      <Card style={styles.card}>
        <FlagRow
          title="Mid-month spending pace"
          detail="On the 15th: at this rate you will hit ₹Y by month end"
          value={data.flags.pace}
          onChange={v => setFlag('pace', v)}
          disabled={busy || data.level === 'off'}
        />
        <FlagRow
          title="Large or unusual spends"
          detail="When a payment is much bigger than your recent ones"
          value={data.flags.unusual}
          onChange={v => setFlag('unusual', v)}
          disabled={busy || data.level === 'off'}
        />
        <FlagRow
          title="Salary or income credited"
          detail="When a payment is saved in the Salary category"
          value={data.flags.salary}
          onChange={v => setFlag('salary', v)}
          disabled={busy || data.level === 'off'}
        />
        <FlagRow
          title="Bills due in 3 days"
          detail="From subscriptions detected in your history"
          value={data.flags.bills}
          onChange={v => setFlag('bills', v)}
          disabled={busy || data.level === 'off'}
        />
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

const styles = StyleSheet.create({
  content: { padding: 16, gap: 14, paddingBottom: 48 },
  card: { gap: 14 },
  body: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  flag: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1, gap: 2 },
  title: { fontSize: 15, fontWeight: '600', color: colors.text },
  detail: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },
});
