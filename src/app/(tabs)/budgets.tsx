import Ionicons from '@expo/vector-icons/Ionicons';
import { useSQLiteContext, type SQLiteDatabase } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { CategoryIcon } from '@/components/CategoryIcon';
import { ProgressBar, levelColor } from '@/components/ProgressBar';
import { haptic, PressableScale } from '@/components/PressableScale';
import {
  Button,
  Card,
  Chip,
  ErrorState,
  Input,
  LoadingState,
  MonthSelector,
  SectionTitle,
} from '@/components/ui';
import { loadBudgetSummary } from '@/data/queries/budgetSummary';
import { deleteBudget, setBudget } from '@/data/repositories/budgets';
import { listCategories } from '@/data/repositories/categories';
import { setBudgetWarnPercent } from '@/data/repositories/settings';
import type { BudgetProgress } from '@/domain/budgets/budgets';
import { formatMinor, parseToMinor } from '@/domain/money/money';
import { monthKeyOf, type MonthKey } from '@/domain/period';
import { useFocusQuery } from '@/hooks/useFocusQuery';
import { colors, themedStyles } from '@/theme/colors';

const WARN_OPTIONS = [70, 80, 90] as const;

async function loadBudgetsScreen(db: SQLiteDatabase, month: MonthKey) {
  const [summary, categories] = await Promise.all([loadBudgetSummary(db, month), listCategories(db)]);
  const budgeted = new Set(summary.progress.map(p => p.categoryId));
  const unbudgeted = categories.filter(c => c.type === 'expense' && c.parentId === null && !budgeted.has(c.id));
  return { ...summary, unbudgeted };
}

export default function BudgetsScreen() {
  const db = useSQLiteContext();
  const [month, setMonth] = useState<MonthKey>(() => monthKeyOf(new Date()));
  const [editing, setEditing] = useState<string | null>(null);
  const { data, error, isLoading, reload } = useFocusQuery(
    useCallback((database: SQLiteDatabase) => loadBudgetsScreen(database, month), [month]),
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

  const run = async (action: () => Promise<void>) => {
    try {
      await action();
      setEditing(null);
      reload();
    } catch (err) {
      Alert.alert('Could not update budget', err instanceof Error ? err.message : String(err));
    }
  };

  const overall = data.totalLimitMinor ? data.totalSpentMinor / data.totalLimitMinor : 0;

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <MonthSelector value={month} onChange={setMonth} />

      {data.progress.length > 0 && (
        <Animated.View entering={FadeInDown.duration(300)}>
          <Card style={styles.summary}>
            <Text style={styles.summaryLabel}>Spent of monthly budgets</Text>
            <Text style={styles.summaryAmount}>
              {formatMinor(data.totalSpentMinor)}
              <Text style={styles.summaryOf}> of {formatMinor(data.totalLimitMinor)}</Text>
            </Text>
            <ProgressBar ratio={overall} color={overall > 1 ? colors.expense : colors.primary} height={10} />
            <Text style={styles.muted}>
              {data.totalLimitMinor >= data.totalSpentMinor
                ? `${formatMinor(data.totalLimitMinor - data.totalSpentMinor)} left this month`
                : `${formatMinor(data.totalSpentMinor - data.totalLimitMinor)} over budget`}
            </Text>
          </Card>
        </Animated.View>
      )}

      {data.progress.length > 0 && (
        <View style={styles.section}>
          <SectionTitle title="Budgets" />
          {data.progress.map((item, index) => (
            <Animated.View key={item.budgetId} entering={FadeInDown.delay(60 + index * 40).duration(300)}>
              <BudgetRow
                item={item}
                editing={editing === item.categoryId}
                onEdit={() => setEditing(editing === item.categoryId ? null : item.categoryId)}
                onSave={amount => run(() => setBudget(db, item.categoryId, amount))}
                onRemove={() => run(() => deleteBudget(db, item.categoryId))}
              />
            </Animated.View>
          ))}
        </View>
      )}

      {data.unbudgeted.length > 0 && (
        <View style={styles.section}>
          <SectionTitle title={data.progress.length ? 'Add a budget' : 'Set your first budget'} />
          {data.progress.length === 0 && (
            <Text style={styles.muted}>
              Pick a category and set how much you want to spend on it each month.
            </Text>
          )}
          {data.unbudgeted.map(category => (
            <Card key={category.id} style={styles.addRow}>
              <PressableScale
                style={styles.rowHeader}
                onPress={() => setEditing(editing === category.id ? null : category.id)}
              >
                <CategoryIcon name={category.name} type="expense" size={36} />
                <Text style={styles.name}>{category.name}</Text>
                <Ionicons
                  name={editing === category.id ? 'close' : 'add-circle'}
                  size={24}
                  color={colors.primary}
                />
              </PressableScale>
              {editing === category.id && (
                <AmountEditor onSave={amount => run(() => setBudget(db, category.id, amount))} />
              )}
            </Card>
          ))}
        </View>
      )}

      <View style={styles.section}>
        <SectionTitle title="Warn me at" />
        <View style={styles.chips}>
          {WARN_OPTIONS.map(percent => (
            <Chip
              key={percent}
              label={`${percent}% used`}
              selected={data.warnPercent === percent}
              onPress={() => run(() => setBudgetWarnPercent(db, percent))}
            />
          ))}
        </View>
        <Text style={styles.muted}>
          You&apos;ll see a warning when an expense takes a budget past this point, and again when it goes over.
        </Text>
      </View>
    </ScrollView>
  );
}

function BudgetRow({
  item,
  editing,
  onEdit,
  onSave,
  onRemove,
}: {
  item: BudgetProgress;
  editing: boolean;
  onEdit: () => void;
  onSave: (amountMinor: number) => void;
  onRemove: () => void;
}) {
  const color = levelColor[item.level];
  return (
    <Card style={styles.row}>
      <PressableScale style={styles.rowHeader} onPress={onEdit}>
        <CategoryIcon name={item.name} type="expense" size={36} />
        <View style={styles.rowText}>
          <Text style={styles.name}>{item.name}</Text>
          <Text style={styles.muted}>
            {formatMinor(item.spentMinor)} of {formatMinor(item.limitMinor)}
          </Text>
        </View>
        <View style={styles.rowRight}>
          <Text style={[styles.remaining, { color }]}>
            {item.remainingMinor >= 0 ? formatMinor(item.remainingMinor) : formatMinor(-item.remainingMinor)}
          </Text>
          <Text style={[styles.remainingLabel, { color }]}>{item.remainingMinor >= 0 ? 'left' : 'over'}</Text>
        </View>
      </PressableScale>
      <ProgressBar ratio={item.ratio} color={color} />
      {editing && (
        <AmountEditor initialMinor={item.limitMinor} onSave={onSave} onRemove={onRemove} />
      )}
    </Card>
  );
}

function AmountEditor({
  initialMinor,
  onSave,
  onRemove,
}: {
  initialMinor?: number;
  onSave: (amountMinor: number) => void;
  onRemove?: () => void;
}) {
  const [value, setValue] = useState(initialMinor ? String(initialMinor / 100) : '');
  const [error, setError] = useState<string>();
  const save = () => {
    const minor = parseToMinor(value);
    if (!minor || minor <= 0) {
      haptic('warning');
      setError('Enter a monthly amount greater than zero.');
      return;
    }
    haptic('success');
    onSave(minor);
  };
  return (
    <Animated.View entering={FadeIn.duration(200)} style={styles.editor}>
      <View style={styles.editorRow}>
        <Text style={styles.currency}>₹</Text>
        <Input
          value={value}
          onChangeText={text => {
            setValue(text);
            setError(undefined);
          }}
          keyboardType="decimal-pad"
          placeholder="Monthly limit"
          autoFocus
          onSubmitEditing={save}
          style={styles.editorInput}
        />
        <Button title="Save" onPress={save} hapticKind="none" style={styles.editorButton} />
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
      {onRemove && (
        <Button title="Remove budget" variant="danger" icon="trash-outline" onPress={onRemove} />
      )}
    </Animated.View>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  content: { padding: 16, gap: 18, paddingBottom: 48 },
  section: { gap: 10 },
  muted: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  summary: { gap: 8 },
  summaryLabel: { color: colors.textMuted, fontWeight: '600' },
  summaryAmount: { fontSize: 26, fontWeight: '800', color: colors.text, fontVariant: ['tabular-nums'] },
  summaryOf: { fontSize: 15, fontWeight: '600', color: colors.textMuted },
  row: { gap: 12, padding: 14 },
  addRow: { gap: 12, padding: 14 },
  rowHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowText: { flex: 1, gap: 2 },
  name: { flex: 1, fontSize: 16, fontWeight: '700', color: colors.text },
  rowRight: { alignItems: 'flex-end' },
  remaining: { fontSize: 16, fontWeight: '800', fontVariant: ['tabular-nums'] },
  remainingLabel: { fontSize: 12, fontWeight: '600' },
  chips: { flexDirection: 'row', gap: 8 },
  editor: { gap: 10 },
  editorRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  currency: { fontSize: 20, fontWeight: '700', color: colors.text },
  editorInput: { flex: 1 },
  editorButton: { paddingVertical: 12 },
  error: { color: colors.danger, fontSize: 13 },
}));
