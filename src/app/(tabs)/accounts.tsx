import { router } from 'expo-router';
import type { SQLiteDatabase } from 'expo-sqlite';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  Amount,
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
} from '@/components/ui';
import { getAccountFlows, listAccounts } from '@/data/repositories/accounts';
import { accountBalance } from '@/domain/accounting/accounting';
import { sumMinor } from '@/domain/money/money';
import { useFocusQuery } from '@/hooks/useFocusQuery';
import { colors } from '@/theme/colors';

const typeLabel = { cash: 'Cash', bank: 'Bank account', wallet: 'Wallet' };

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
  const total = sumMinor(accounts.filter(a => !a.isArchived).map(a => a.balanceMinor));

  return (
    <FlatList
      contentContainerStyle={styles.content}
      data={accounts}
      keyExtractor={item => item.id}
      ListHeaderComponent={
        <Card style={styles.totalCard}>
          <Text style={styles.totalLabel}>Total across accounts</Text>
          <Amount amountMinor={total} style={styles.totalAmount} />
        </Card>
      }
      ListEmptyComponent={
        <EmptyState title="No accounts yet" body="Add a cash or bank account to start tracking." />
      }
      renderItem={({ item }) => (
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push(`/account/${item.id}`)}
          style={[styles.row, item.isArchived && styles.archived]}
        >
          <View style={styles.rowText}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.meta}>
              {typeLabel[item.type]}
              {item.isArchived ? ' · Archived' : ''}
            </Text>
          </View>
          <Amount amountMinor={item.balanceMinor} />
        </Pressable>
      )}
      ListFooterComponent={
        <Button title="Add account" onPress={() => router.push('/account/new')} style={styles.add} />
      }
    />
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 8 },
  totalCard: { marginBottom: 8, gap: 4 },
  totalLabel: { color: colors.textMuted },
  totalAmount: { fontSize: 28 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  archived: { opacity: 0.5 },
  rowText: { flex: 1, gap: 2 },
  name: { fontSize: 16, fontWeight: '600', color: colors.text },
  meta: { color: colors.textMuted, fontSize: 13 },
  add: { marginTop: 12 },
});
