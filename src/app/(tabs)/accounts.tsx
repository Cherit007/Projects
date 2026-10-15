import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import type { SQLiteDatabase } from 'expo-sqlite';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { PressableScale } from '@/components/PressableScale';
import { Amount, Button, EmptyState, ErrorState, LoadingState } from '@/components/ui';
import { getAccountFlows, listAccounts } from '@/data/repositories/accounts';
import { accountBalance } from '@/domain/accounting/accounting';
import { formatMinor, sumMinor } from '@/domain/money/money';
import type { AccountType } from '@/domain/types';
import { useFocusQuery } from '@/hooks/useFocusQuery';
import type { IconName } from '@/theme/categoryStyle';
import { colors, radius, shadow } from '@/theme/colors';

const typeInfo: Record<AccountType, { label: string; icon: IconName; color: string }> = {
  cash: { label: 'Cash', icon: 'cash-outline', color: colors.income },
  bank: { label: 'Bank account', icon: 'business-outline', color: colors.primary },
  wallet: { label: 'Wallet', icon: 'wallet-outline', color: '#D97706' },
  card: { label: 'Credit card', icon: 'card-outline', color: '#DB2777' },
};

async function loadAccounts(db: SQLiteDatabase) {
  const [accounts, flows] = await Promise.all([
    listAccounts(db, { includeArchived: true }),
    getAccountFlows(db),
  ]);
  return accounts.map(account => ({
    ...account,
    balanceMinor: accountBalance(account, flows.get(account.id)),
  }));
}

export default function AccountsScreen() {
  const { data, error, isLoading, reload } = useFocusQuery(loadAccounts);

  if (error) {
    return <ErrorState error={error} onRetry={reload} />;
  }
  if (!data && isLoading) {
    return <LoadingState />;
  }
  const accounts = data ?? [];
  const active = accounts.filter(a => !a.isArchived);
  const total = sumMinor(active.map(a => a.balanceMinor));

  return (
    <FlatList
      contentContainerStyle={styles.content}
      data={accounts}
      keyExtractor={item => item.id}
      ListHeaderComponent={
        <Animated.View entering={FadeInDown.duration(300)}>
          <LinearGradient
            colors={[colors.heroStart, colors.heroEnd]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.totalCard}
          >
            <Text style={styles.totalLabel}>Total across accounts</Text>
            <Text style={styles.totalAmount}>{formatMinor(total)}</Text>
            <Text style={styles.totalMeta}>
              {active.length} active account{active.length === 1 ? '' : 's'}
            </Text>
          </LinearGradient>
        </Animated.View>
      }
      ListEmptyComponent={
        <EmptyState icon="wallet-outline" title="No accounts yet" body="Add a cash, bank or credit card account to start tracking." />
      }
      renderItem={({ item, index }) => {
        const info = typeInfo[item.type];
        return (
          <Animated.View entering={FadeInDown.delay(60 + index * 50).duration(300)}>
            <PressableScale
              accessibilityRole="button"
              onPress={() => router.push(`/account/${item.id}`)}
              style={[styles.row, item.isArchived && styles.archived]}
            >
              <View style={[styles.icon, { backgroundColor: `${info.color}1F` }]}>
                <Ionicons name={info.icon} size={22} color={info.color} />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.meta}>
                  {info.label}
                  {item.type === 'card' ? (item.balanceMinor < 0 ? ' · Due' : ' · Nothing due') : ''}
                  {item.isArchived ? ' · Archived' : ''}
                </Text>
              </View>
              <Amount
                amountMinor={item.type === 'card' ? Math.abs(item.balanceMinor) : item.balanceMinor}
                style={item.balanceMinor < 0 ? { color: colors.expense } : undefined}
              />
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </PressableScale>
          </Animated.View>
        );
      }}
      ListFooterComponent={
        <Button
          title="Add account"
          icon="add"
          variant="secondary"
          onPress={() => router.push('/account/new')}
          style={styles.add}
        />
      }
    />
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 10, paddingBottom: 48 },
  totalCard: { marginBottom: 8, gap: 4, borderRadius: radius.lg, padding: 20, ...shadow },
  totalLabel: { color: '#E0E7FF', fontWeight: '600' },
  totalAmount: { color: '#fff', fontSize: 32, fontWeight: '800', fontVariant: ['tabular-nums'] },
  totalMeta: { color: '#E0E7FF', fontSize: 13 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    padding: 14,
    borderRadius: radius.lg,
    ...shadow,
  },
  icon: { width: 44, height: 44, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  archived: { opacity: 0.5 },
  rowText: { flex: 1, gap: 2 },
  name: { fontSize: 16, fontWeight: '700', color: colors.text },
  meta: { color: colors.textMuted, fontSize: 13 },
  add: { marginTop: 12 },
});
