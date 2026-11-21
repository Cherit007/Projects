import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

import { haptic } from '@/components/PressableScale';
import { Button, Card, EmptyState, Input, LoadingState, SectionTitle } from '@/components/ui';
import { ProgressBar } from '@/components/ProgressBar';
import { createGoal, deleteGoal, listGoals } from '@/data/repositories/goals';
import { formatMinor, parseToMinor } from '@/domain/money/money';
import { useFocusQuery } from '@/hooks/useFocusQuery';
import { colors, themedStyles } from '@/theme/colors';

export default function GoalsScreen() {
  const db = useSQLiteContext();
  const { data, isLoading, reload } = useFocusQuery(useCallback(db => listGoals(db), []));
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [monthly, setMonthly] = useState('');
  const [saving, setSaving] = useState(false);

  if (!data && isLoading) {
    return <LoadingState />;
  }

  const save = async () => {
    const targetMinor = parseToMinor(target);
    const monthlyMinor = parseToMinor(monthly || '0');
    if (!name.trim() || targetMinor === null || targetMinor <= 0 || monthlyMinor === null || monthlyMinor < 0) {
      Alert.alert('Check the amounts', 'Enter a name, a target greater than zero, and a monthly amount.');
      return;
    }
    setSaving(true);
    try {
      await createGoal(db, { name: name.trim(), targetMinor, monthlyMinor });
      haptic('success');
      setName('');
      setTarget('');
      setMonthly('');
      await reload();
    } catch (err) {
      Alert.alert('Could not save goal', err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Card style={styles.card}>
        <Text style={styles.help}>
          Monthly amounts reduce safe-to-spend on the dashboard so you leave room for these goals.
        </Text>
        <Input value={name} onChangeText={setName} placeholder="Emergency fund" />
        <Input value={target} onChangeText={setTarget} placeholder="Target ₹" keyboardType="decimal-pad" />
        <Input value={monthly} onChangeText={setMonthly} placeholder="Put aside each month ₹" keyboardType="decimal-pad" />
        <Button title={saving ? 'Saving…' : 'Add goal'} icon="add" onPress={save} disabled={saving} />
      </Card>

      <SectionTitle title={`${(data ?? []).length} goal${(data ?? []).length === 1 ? '' : 's'}`} />
      {(data ?? []).length === 0 ? (
        <EmptyState icon="flag-outline" title="No savings goals" body="Add one to protect money in safe-to-spend." />
      ) : (
        (data ?? []).map(goal => {
          const ratio = goal.targetMinor > 0 ? Math.min(1, goal.savedMinor / goal.targetMinor) : 0;
          return (
            <Card key={goal.id} style={styles.goal}>
              <View style={styles.row}>
                <View style={styles.flex}>
                  <Text style={styles.title}>{goal.name}</Text>
                  <Text style={styles.muted}>
                    {formatMinor(goal.savedMinor)} of {formatMinor(goal.targetMinor)} ·{' '}
                    {formatMinor(goal.monthlyMinor)} / month
                  </Text>
                </View>
                <Button
                  title="Remove"
                  variant="secondary"
                  onPress={() =>
                    Alert.alert('Remove goal?', goal.name, [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Remove',
                        style: 'destructive',
                        onPress: async () => {
                          await deleteGoal(db, goal.id);
                          await reload();
                        },
                      },
                    ])
                  }
                />
              </View>
              <ProgressBar ratio={ratio} color={colors.primary} />
            </Card>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  content: { padding: 16, gap: 12, paddingBottom: 48 },
  card: { gap: 12 },
  help: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  goal: { gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1, gap: 2 },
  title: { fontSize: 16, fontWeight: '600', color: colors.text },
  muted: { fontSize: 13, color: colors.textMuted },
}));
