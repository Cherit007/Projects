import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import type { SQLiteDatabase } from 'expo-sqlite';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';

import { haptic } from '@/components/PressableScale';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  SectionTitle,
} from '@/components/ui';
import {
  findPossibleDuplicate,
  listCandidates,
  setCandidateState,
  type UpiCandidate,
} from '@/data/repositories/upiCandidates';
import { formatMinor } from '@/domain/money/money';
import type { UpiStatus } from '@/domain/upi/parser';
import { useFocusQuery } from '@/hooks/useFocusQuery';
import { useUpi } from '@/services/upi/UpiProvider';
import { colors, radius } from '@/theme/colors';
import { formatDisplayDate } from '@/utils/dates';

interface ReviewItem {
  candidate: UpiCandidate;
  duplicate: { counterparty: string | null; occurredAt: string } | null;
}

/** `_syncedAt` only exists so the list reloads after each sync. */
async function loadReview(db: SQLiteDatabase, _syncedAt: number) {
  const [pending, ignored] = await Promise.all([
    listCandidates(db, ['needs_review']),
    listCandidates(db, ['ignored']),
  ]);
  const items: ReviewItem[] = await Promise.all(
    pending.map(async candidate => ({ candidate, duplicate: await findPossibleDuplicate(db, candidate) })),
  );
  return { items, ignored: ignored.slice(0, 20) };
}

const statusBadge: Record<UpiStatus, { label: string; color: string; background: string }> = {
  success: { label: 'Successful', color: colors.income, background: colors.incomeSoft },
  pending: { label: 'Pending', color: colors.warning, background: colors.warningSoft },
  unknown: { label: 'Unconfirmed', color: colors.transfer, background: colors.transferSoft },
  failed: { label: 'Failed', color: colors.expense, background: colors.expenseSoft },
  request: { label: 'Payment request', color: colors.transfer, background: colors.transferSoft },
};

export default function UpiReviewScreen() {
  const db = useSQLiteContext();
  const upi = useUpi();
  const { lastSyncAt } = upi;
  const { data, error, isLoading, reload } = useFocusQuery(
    useCallback((database: SQLiteDatabase) => loadReview(database, lastSyncAt), [lastSyncAt]),
  );

  if (error) {
    return <ErrorState error={error} onRetry={reload} />;
  }
  if (!data && isLoading) {
    return <LoadingState />;
  }
  if (!data) {
    return null;
  }

  const dismiss = async (candidate: UpiCandidate) => {
    haptic('light');
    await setCandidateState(db, candidate.id, 'dismissed');
    await Promise.all([reload(), upi.refresh()]);
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      {data.items.length === 0 ? (
        <EmptyState
          icon="checkmark-done-circle"
          title="All caught up"
          body="Payments detected from your UPI apps or bank SMS will appear here for a quick review."
        />
      ) : (
        <Text style={styles.intro}>
          Nothing is saved until you confirm it. Check the amount, pick a category and save.
        </Text>
      )}

      {data.items.map(({ candidate, duplicate }, index) => (
        <Animated.View
          key={candidate.id}
          entering={FadeInDown.delay(Math.min(index, 5) * 50).duration(300)}
          exiting={FadeOut.duration(200)}
        >
          <Card style={styles.card}>
            <View style={styles.cardTop}>
              <View
                style={[
                  styles.directionIcon,
                  { backgroundColor: candidate.direction === 'credit' ? colors.incomeSoft : colors.expenseSoft },
                ]}
              >
                <Ionicons
                  name={candidate.direction === 'credit' ? 'arrow-down' : 'arrow-up'}
                  size={20}
                  color={candidate.direction === 'credit' ? colors.income : colors.expense}
                />
              </View>
              <View style={styles.cardText}>
                <Text style={styles.amount}>
                  {candidate.amountMinor === null ? 'Amount unknown' : formatMinor(candidate.amountMinor)}
                </Text>
                <Text style={styles.party} numberOfLines={1}>
                  {candidate.direction === 'credit' ? 'From ' : 'To '}
                  {candidate.counterparty ?? 'unknown'}
                </Text>
                <Text style={styles.meta}>
                  {candidate.sourceApp} · {formatDisplayDate(candidate.detectedAt)}
                </Text>
              </View>
              <Badge {...statusBadge[candidate.status]} />
            </View>

            {duplicate && (
              <View style={styles.warning}>
                <Ionicons name="copy-outline" size={16} color={colors.warning} />
                <Text style={styles.warningText}>
                  Possible duplicate of {duplicate.counterparty || 'a transaction'} on{' '}
                  {formatDisplayDate(duplicate.occurredAt)}.
                </Text>
              </View>
            )}
            {candidate.status === 'pending' && (
              <View style={styles.warning}>
                <Ionicons name="time-outline" size={16} color={colors.warning} />
                <Text style={styles.warningText}>Still pending. Add it once the payment completes.</Text>
              </View>
            )}

            <View style={styles.actions}>
              <Button
                title="Dismiss"
                variant="secondary"
                icon="close"
                style={styles.action}
                onPress={() => dismiss(candidate)}
              />
              <Button
                title="Review & add"
                icon="checkmark"
                style={styles.action}
                onPress={() => router.push(`/transaction/new?candidateId=${candidate.id}`)}
              />
            </View>
          </Card>
        </Animated.View>
      ))}

      {data.ignored.length > 0 && (
        <View style={styles.ignored}>
          <SectionTitle title="Ignored automatically" />
          <Text style={styles.meta}>Failed payments and payment requests are never added as expenses.</Text>
          {data.ignored.map(candidate => (
            <View key={candidate.id} style={styles.ignoredRow}>
              <Text style={styles.ignoredText} numberOfLines={1}>
                {candidate.amountMinor === null ? '—' : formatMinor(candidate.amountMinor)} ·{' '}
                {candidate.counterparty ?? candidate.sourceApp}
              </Text>
              <Badge {...statusBadge[candidate.status]} />
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 14, paddingBottom: 48, flexGrow: 1 },
  intro: { color: colors.textMuted, lineHeight: 20 },
  card: { gap: 12 },
  cardTop: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  directionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardText: { flex: 1, gap: 2 },
  amount: { fontSize: 22, fontWeight: '800', color: colors.text, fontVariant: ['tabular-nums'] },
  party: { fontSize: 15, fontWeight: '600', color: colors.text },
  meta: { fontSize: 13, color: colors.textMuted },
  warning: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    backgroundColor: colors.warningSoft,
    padding: 10,
    borderRadius: radius.sm,
  },
  warningText: { flex: 1, color: colors.warning, fontSize: 13 },
  actions: { flexDirection: 'row', gap: 10 },
  action: { flex: 1, paddingVertical: 12 },
  ignored: { gap: 8, marginTop: 8 },
  ignoredRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingVertical: 6,
  },
  ignoredText: { flex: 1, color: colors.textMuted },
});
