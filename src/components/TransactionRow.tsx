import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import ReanimatedSwipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';

import type { TransactionListItem } from '@/data/repositories/transactions';
import { removeTransaction } from '@/services/removeTransaction';
import { useUpi } from '@/services/upi/UpiProvider';
import { colors } from '@/theme/colors';

import { CategoryIcon } from './CategoryIcon';
import { haptic, PressableScale } from './PressableScale';
import { Amount } from './ui';

interface Props {
  item: TransactionListItem;
  showDate?: boolean;
  /** When set, swiping the row left reveals Delete; called after the transaction is deleted. */
  onDeleted?: () => void;
}

export function TransactionRow({ item, showDate = false, onDeleted }: Props) {
  const title =
    item.type === 'transfer'
      ? `${item.accountName} → ${item.toAccountName ?? 'Unknown'}`
      : item.counterparty || item.categoryName || 'Uncategorized';
  const parts =
    item.type === 'transfer'
      ? ['Transfer']
      : [item.counterparty ? item.categoryName : null, item.accountName];
  if (showDate) {
    parts.unshift(
      new Date(item.occurredAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
    );
  }
  const isDetected = item.source === 'upi_notification' || item.source === 'bank_sms';

  const row = (
    <PressableScale
      accessibilityRole="button"
      accessibilityHint={onDeleted ? 'Swipe left to delete' : undefined}
      scaleTo={0.98}
      onPress={() => router.push(`/transaction/${item.id}`)}
      style={styles.row}
    >
      <CategoryIcon name={item.categoryName} type={item.type} />
      <View style={styles.text}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <View style={styles.metaRow}>
          {isDetected && <Ionicons name="flash" size={12} color={colors.primary} />}
          {item.source === 'recurring' && <Ionicons name="repeat" size={12} color={colors.primary} />}
          <Text style={styles.meta} numberOfLines={1}>
            {parts.filter(Boolean).join(' · ')}
          </Text>
        </View>
      </View>
      <Amount amountMinor={item.amountMinor} type={item.type} />
    </PressableScale>
  );

  if (!onDeleted) {
    return row;
  }
  return (
    <ReanimatedSwipeable
      friction={2}
      rightThreshold={40}
      overshootRight={false}
      onSwipeableWillOpen={() => haptic('selection')}
      renderRightActions={(_progress, _translation, swipeable) => (
        <DeleteAction id={item.id} title={title} swipeable={swipeable} onDeleted={onDeleted} />
      )}
    >
      {row}
    </ReanimatedSwipeable>
  );
}

function DeleteAction({
  id,
  title,
  swipeable,
  onDeleted,
}: {
  id: string;
  title: string;
  swipeable: SwipeableMethods;
  onDeleted: () => void;
}) {
  const db = useSQLiteContext();
  const upi = useUpi();

  const confirm = () => {
    haptic('warning');
    Alert.alert(
      'Delete transaction?',
      `${title} will be removed from your balances, budgets and reports. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => swipeable.close() },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeTransaction(db, id);
              await upi.refresh();
              haptic('success');
              onDeleted();
            } catch (err) {
              swipeable.close();
              Alert.alert('Could not delete transaction', err instanceof Error ? err.message : String(err));
            }
          },
        },
      ],
      { cancelable: true, onDismiss: () => swipeable.close() },
    );
  };

  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Delete ${title}`} onPress={confirm} style={styles.delete}>
      <Ionicons name="trash" size={20} color="#fff" />
      <Text style={styles.deleteText}>Delete</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  text: { flex: 1, gap: 3 },
  title: { fontSize: 16, fontWeight: '600', color: colors.text },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  meta: { fontSize: 13, color: colors.textMuted, flexShrink: 1 },
  delete: {
    width: 88,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    backgroundColor: colors.expense,
  },
  deleteText: { color: '#fff', fontSize: 12, fontWeight: '700' },
});
