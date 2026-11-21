import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useCallback } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { billSummary } from '@/components/cardBill';
import { PressableScale } from '@/components/PressableScale';
import { ProgressBar } from '@/components/ProgressBar';
import { Button, Card, EmptyState, ErrorState, LoadingState, TextLink } from '@/components/ui';
import { loadCardsOverview, type CardSummary } from '@/data/queries/cards';
import { formatMinor } from '@/domain/money/money';
import { useFocusQuery } from '@/hooks/useFocusQuery';
import { colors, radius, shadow, themedStyles } from '@/theme/colors';
import { formatShortLocalDate } from '@/utils/dates';

export default function CardsScreen() {
  const { data, error, isLoading, reload } = useFocusQuery(useCallback(db => loadCardsOverview(db), []));

  if (error) {
    return <ErrorState error={error} onRetry={reload} />;
  }
  if (!data && isLoading) {
    return <LoadingState />;
  }
  if (!data || data.cards.length === 0) {
    return (
      <EmptyState
        icon="card-outline"
        title="No credit cards yet"
        body="Add a card account with its statement and due days to see what you owe and when to pay."
        action={<Button title="Add credit card" icon="add" onPress={() => router.push('/account/new')} />}
      />
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Animated.View entering={FadeInDown.duration(300)}>
        <LinearGradient
          colors={[colors.heroStart, colors.heroEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <Text style={styles.heroLabel}>Total outstanding</Text>
          <Text style={styles.heroAmount}>{formatMinor(data.totalOwedMinor)}</Text>
          <View style={styles.heroRow}>
            <Text style={styles.heroText}>Due on statements already generated</Text>
            <Text style={styles.heroValue}>{formatMinor(data.totalBilledDueMinor)}</Text>
          </View>
          {data.totalLimitMinor > 0 && (
            <View style={styles.heroRow}>
              <Text style={styles.heroText}>Total credit limit</Text>
              <Text style={styles.heroValue}>{formatMinor(data.totalLimitMinor)}</Text>
            </View>
          )}
        </LinearGradient>
      </Animated.View>

      {data.cards.map((card, index) => (
        <Animated.View key={card.account.id} entering={FadeInDown.delay(60 + index * 50).duration(300)}>
          <CardTile card={card} />
        </Animated.View>
      ))}

      <Text style={styles.footnote}>
        Billing days and limits are kept on this phone and in backups; they are not synced to your other devices.
      </Text>
    </ScrollView>
  );
}

function CardTile({ card }: { card: CardSummary }) {
  const { account, bill, details, owedMinor, availableMinor } = card;
  const summary = bill ? billSummary(bill) : null;
  const limit = details?.creditLimitMinor ?? null;
  const usage = limit ? owedMinor / limit : 0;

  return (
    <Card style={styles.card}>
      <PressableScale accessibilityRole="button" onPress={() => router.push(`/account/${account.id}`)} style={styles.titleRow}>
        <View style={styles.icon}>
          <Ionicons name="card-outline" size={20} color={CARD_COLOR} />
        </View>
        <View style={styles.flex}>
          <Text style={styles.name}>{account.name}</Text>
          {summary && <Text style={[styles.status, { color: summary.color }]}>{summary.text}</Text>}
        </View>
        <Ionicons name="create-outline" size={18} color={colors.textMuted} />
      </PressableScale>

      <View style={styles.amountRow}>
        <Text style={styles.muted}>Outstanding</Text>
        <Text style={styles.owed}>{formatMinor(owedMinor)}</Text>
      </View>

      {limit !== null && (
        <View style={styles.limit}>
          <ProgressBar ratio={usage} color={usage >= 0.9 ? colors.expense : usage >= 0.3 ? colors.warning : colors.income} />
          <Text style={styles.muted}>
            {formatMinor(availableMinor ?? 0)} available of {formatMinor(limit)} · {Math.round(usage * 100)}% used
          </Text>
        </View>
      )}

      {bill ? (
        <View style={styles.details}>
          <Detail label={`Statement on ${formatShortLocalDate(bill.statementDate)}`} value={formatMinor(bill.billedMinor)} />
          {bill.paidMinor > 0 && <Detail label="Paid since" value={formatMinor(bill.paidMinor)} />}
          <Detail
            label={`Due by ${formatShortLocalDate(bill.dueDate)}`}
            value={bill.remainingMinor > 0 ? formatMinor(bill.remainingMinor) : 'Paid'}
            color={bill.status === 'overdue' ? colors.expense : bill.remainingMinor > 0 ? undefined : colors.income}
          />
          <Detail label="Spent since statement" value={formatMinor(bill.unbilledMinor)} />
          <Detail
            label="Next statement"
            value={`${formatShortLocalDate(bill.nextStatementDate)} · due ${formatShortLocalDate(bill.nextDueDate)}`}
          />
        </View>
      ) : (
        <View style={styles.setup}>
          <Text style={styles.muted}>Add the statement and due days to see the bill and get payment reminders.</Text>
          <TextLink label="Set up billing days" onPress={() => router.push(`/account/${account.id}`)} />
        </View>
      )}

      {owedMinor > 0 && (
        <Button
          title="Record payment"
          icon="arrow-forward"
          variant="secondary"
          onPress={() => {
            const due = bill && bill.remainingMinor > 0 ? bill.remainingMinor : owedMinor;
            router.push({
              pathname: '/transaction/[id]',
              params: { id: 'new', payCard: account.id, amount: (due / 100).toFixed(2) },
            });
          }}
        />
      )}
    </Card>
  );
}

function Detail({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.detail}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, color ? { color } : undefined]}>{value}</Text>
    </View>
  );
}

const CARD_COLOR = '#DB2777';

const styles = themedStyles(() => StyleSheet.create({
  content: { padding: 16, gap: 12, paddingBottom: 48 },
  hero: { borderRadius: radius.lg, padding: 20, gap: 6, ...shadow },
  heroLabel: { color: '#E0E7FF', fontWeight: '600' },
  heroAmount: { color: '#fff', fontSize: 32, fontWeight: '800', fontVariant: ['tabular-nums'] },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  heroText: { color: '#E0E7FF', flex: 1 },
  heroValue: { color: '#fff', fontWeight: '700', fontVariant: ['tabular-nums'] },
  card: { gap: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: `${CARD_COLOR}1F`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: { flex: 1, gap: 2 },
  name: { fontSize: 16, fontWeight: '700', color: colors.text },
  status: { fontSize: 13, fontWeight: '600' },
  amountRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  owed: { fontSize: 24, fontWeight: '800', color: colors.text, fontVariant: ['tabular-nums'] },
  limit: { gap: 6 },
  details: { gap: 8, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12 },
  detail: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  detailLabel: { color: colors.textMuted, flex: 1 },
  detailValue: { color: colors.text, fontWeight: '600', fontVariant: ['tabular-nums'] },
  setup: { gap: 8 },
  muted: { color: colors.textMuted, fontSize: 13 },
  footnote: { color: colors.textMuted, fontSize: 12, lineHeight: 17, textAlign: 'center', marginTop: 4 },
}));
