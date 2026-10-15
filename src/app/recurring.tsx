import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useSQLiteContext, type SQLiteDatabase } from 'expo-sqlite';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CategoryIcon } from '@/components/CategoryIcon';
import { haptic } from '@/components/PressableScale';
import { Amount, Button, Card, EmptyState, ErrorState, LoadingState } from '@/components/ui';
import { deleteRecurringRule, listRecurringRules, type RecurringRule } from '@/data/repositories/recurring';
import { FREQUENCY_LABEL } from '@/domain/recurring';
import { useFocusQuery } from '@/hooks/useFocusQuery';
import { colors, radius, shadow } from '@/theme/colors';
import { formatDisplayDate } from '@/utils/dates';

const load = (db: SQLiteDatabase) => listRecurringRules(db);

export default function RecurringScreen() {
  const { data, error, isLoading, reload } = useFocusQuery(load);

  if (error) {
    return <ErrorState error={error} onRetry={reload} />;
  }
  if (!data && isLoading) {
    return <LoadingState />;
  }
  if (!data || data.length === 0) {
    return (
      <EmptyState
        icon="repeat"
        title="Nothing repeats yet"
        body="When you add a transaction such as rent, a subscription or your salary, choose Repeat to have it added again every week, month or year."
        action={<Button title="Add transaction" icon="add" onPress={() => router.push('/transaction/new')} />}
      />
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.intro}>
        These are added on their own when they fall due, the next time you open the app. Repeats stay on this phone,
        so another signed-in device does not add them twice.
      </Text>
      {data.map(rule => (
        <RuleCard key={rule.id} rule={rule} onStopped={reload} />
      ))}
    </ScrollView>
  );
}

function RuleCard({ rule, onStopped }: { rule: RecurringRule; onStopped: () => void }) {
  const db = useSQLiteContext();
  const title =
    rule.input.type === 'transfer'
      ? `${rule.accountName} → ${rule.toAccountName ?? 'Unknown'}`
      : rule.input.counterparty || rule.categoryName || 'Uncategorized';

  const confirmStop = () => {
    haptic('warning');
    Alert.alert('Stop repeating?', 'Transactions already added stay. No new ones will be added.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Stop',
        style: 'destructive',
        onPress: async () => {
          await deleteRecurringRule(db, rule.id);
          onStopped();
        },
      },
    ]);
  };

  return (
    <Card style={styles.card}>
      <View style={styles.row}>
        <CategoryIcon name={rule.categoryName} type={rule.input.type} />
        <View style={styles.flex}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.meta}>
            {FREQUENCY_LABEL[rule.frequency]} · {rule.input.type === 'transfer' ? 'Transfer' : rule.accountName}
          </Text>
        </View>
        <Amount amountMinor={rule.input.amountMinor} type={rule.input.type} />
      </View>
      <View style={styles.footer}>
        <Ionicons name="calendar-outline" size={15} color={colors.textMuted} />
        <Text style={[styles.meta, styles.flex]}>Next on {formatDisplayDate(rule.nextAt)}</Text>
        <Button title="Stop" variant="secondary" icon="stop-circle-outline" onPress={confirmStop} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 12, paddingBottom: 48 },
  intro: { color: colors.textMuted, lineHeight: 20 },
  card: { gap: 12, borderRadius: radius.lg, ...shadow },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1 },
  title: { fontSize: 16, fontWeight: '700', color: colors.text },
  meta: { color: colors.textMuted, fontSize: 13 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
