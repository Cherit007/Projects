import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { haptic } from '@/components/PressableScale';
import {
  Button,
  Chip,
  EmptyState,
  ErrorState,
  Field,
  Input,
  LoadingState,
  Segmented,
  typeColor,
} from '@/components/ui';
import { budgetAlert, loadBudgetSummary } from '@/data/queries/budgetSummary';
import { listAccounts } from '@/data/repositories/accounts';
import { listCategories } from '@/data/repositories/categories';
import { getOwnerName } from '@/data/repositories/settings';
import {
  createTransaction,
  deleteTransaction,
  getTransaction,
  listCategorisedPayees,
  suggestCategory,
  updateTransaction,
} from '@/data/repositories/transactions';
import {
  confirmCandidate,
  findPossibleDuplicate,
  getCandidate,
  type UpiCandidate,
} from '@/data/repositories/upiCandidates';
import { validateTransaction, type ValidationErrors } from '@/domain/accounting/accounting';
import { predictCategoryName } from '@/domain/categories/autoCategory';
import { isOwnName, learnedCategoryId, learnWords } from '@/domain/categories/payeeHistory';
import { parseToMinor } from '@/domain/money/money';
import { monthKeyOf } from '@/domain/period';
import type { Account, Category, Transaction, TransactionInput, TransactionType } from '@/domain/types';
import { useUpi } from '@/services/upi/UpiProvider';
import { categoryStyle } from '@/theme/categoryStyle';
import { colors, radius, shadow } from '@/theme/colors';
import { formatDisplayDate, fromLocalDateInput, toLocalDateInput } from '@/utils/dates';

const typeOptions = [
  { value: 'expense', label: 'Expense' },
  { value: 'income', label: 'Income' },
  { value: 'transfer', label: 'Transfer' },
] as const;

interface Loaded {
  accounts: Account[];
  categories: Category[];
  existing: Transaction | null;
  candidate: UpiCandidate | null;
  duplicate: { counterparty: string | null; occurredAt: string } | null;
}

export default function TransactionForm() {
  const { id, candidateId } = useLocalSearchParams<{ id: string; candidateId?: string }>();
  const isNew = id === 'new';
  const db = useSQLiteContext();
  const upi = useUpi();

  const [loaded, setLoaded] = useState<Loaded>();
  const [loadError, setLoadError] = useState<Error>();
  const [type, setType] = useState<TransactionType>('expense');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [suggestedCategoryId, setSuggestedCategoryId] = useState<string | null>(null);
  const [accountId, setAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState<string | null>(null);
  const [date, setDate] = useState(toLocalDateInput(new Date().toISOString()));
  const [counterparty, setCounterparty] = useState('');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [saving, setSaving] = useState(false);
  const [{ today, yesterday }] = useState(() => {
    const now = new Date();
    const prev = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 12);
    return {
      today: toLocalDateInput(now.toISOString()),
      yesterday: toLocalDateInput(prev.toISOString()),
    };
  });

  useEffect(() => {
    const load = async (): Promise<Loaded> => {
      const [accounts, categories, existing, candidate] = await Promise.all([
        listAccounts(db, { includeArchived: true }),
        listCategories(db, { includeArchived: true }),
        isNew ? Promise.resolve(null) : getTransaction(db, id),
        isNew && candidateId ? getCandidate(db, candidateId) : Promise.resolve(null),
      ]);
      const duplicate = candidate ? await findPossibleDuplicate(db, candidate) : null;
      return { accounts, categories, existing, candidate, duplicate };
    };

    load()
      .then(async result => {
        setLoaded(result);
        const { accounts, existing, candidate } = result;
        if (existing) {
          setType(existing.type);
          setAmount((existing.amountMinor / 100).toFixed(2));
          setCategoryId(existing.categoryId);
          setAccountId(existing.accountId);
          setToAccountId(existing.toAccountId);
          setDate(toLocalDateInput(existing.occurredAt));
          setCounterparty(existing.counterparty ?? '');
          setNote(existing.note ?? '');
          return;
        }
        const active = accounts.filter(a => !a.isArchived);
        const defaultAccount = (candidate && active.find(a => a.type !== 'cash')) || active[0];
        if (defaultAccount) {
          setAccountId(defaultAccount.id);
        }
        if (candidate) {
          const candidateType = candidate.direction === 'credit' ? 'income' : 'expense';
          setType(candidateType);
          if (candidate.amountMinor !== null) {
            setAmount((candidate.amountMinor / 100).toFixed(2));
          }
          setDate(toLocalDateInput(candidate.detectedAt));
          setCounterparty(candidate.counterparty ?? '');
          if (isOwnName(candidate.counterparty, await getOwnerName(db))) {
            setType('transfer');
            const other = active.filter(a => a.type !== 'cash' && a.id !== defaultAccount?.id);
            if (other.length === 1 && defaultAccount) {
              const outgoing = candidate.direction !== 'credit';
              setAccountId(outgoing ? defaultAccount.id : other[0].id);
              setToAccountId(outgoing ? other[0].id : defaultAccount.id);
            }
          } else if (candidate.counterparty) {
            const predicted = predictCategoryName(candidate.counterparty, candidateType, candidate.payeeKind);
            const suggestion =
              (await suggestCategory(db, candidate.counterparty, candidateType)) ??
              learnedCategoryId(learnWords(await listCategorisedPayees(db)), candidate.counterparty, candidateType) ??
              result.categories.find(c => !c.isArchived && c.type === candidateType && c.name === predicted)?.id ??
              null;
            setCategoryId(suggestion);
            setSuggestedCategoryId(suggestion);
          }
        }
      })
      .catch(setLoadError);
  }, [db, id, isNew, candidateId]);

  const categoryOptions = useMemo(() => {
    if (!loaded || type === 'transfer') {
      return [];
    }
    const byId = new Map(loaded.categories.map(c => [c.id, c]));
    return loaded.categories
      .filter(c => c.type === type && (!c.isArchived || c.id === categoryId))
      .map(c => {
        const parent = c.parentId ? byId.get(c.parentId) : undefined;
        return {
          id: c.id,
          label: parent ? `${parent.name} › ${c.name}` : c.name,
          style: categoryStyle(parent?.name ?? c.name, type),
        };
      });
  }, [loaded, type, categoryId]);

  if (loadError) {
    return <ErrorState error={loadError} />;
  }
  if (!loaded) {
    return <LoadingState />;
  }
  if (!isNew && !loaded.existing) {
    return <ErrorState error={new Error('This transaction no longer exists.')} />;
  }
  if (candidateId && !loaded.candidate) {
    return <ErrorState error={new Error('This detected payment no longer exists.')} />;
  }
  if (loaded.candidate?.reviewState === 'confirmed') {
    return (
      <EmptyState
        icon="checkmark-circle"
        title="Already added"
        body="This payment has already been saved as a transaction."
        action={<Button title="Close" onPress={() => router.back()} />}
      />
    );
  }

  const { candidate } = loaded;
  const accountOptions = loaded.accounts.filter(
    a => !a.isArchived || a.id === accountId || a.id === toAccountId,
  );
  if (accountOptions.length === 0) {
    return (
      <EmptyState
        title="Add an account first"
        body="Transactions need an account such as Cash or a bank account."
        action={<Button title="Add account" onPress={() => router.replace('/account/new')} />}
      />
    );
  }

  const accent = typeColor[type];

  const changeType = (next: TransactionType) => {
    setType(next);
    setCategoryId(null);
    setSuggestedCategoryId(null);
    setErrors({});
  };

  const save = async () => {
    const amountMinor = parseToMinor(amount);
    const occurredAt = fromLocalDateInput(date, loaded.existing?.occurredAt ?? candidate?.detectedAt);
    const input: TransactionInput = {
      type,
      amountMinor: amountMinor ?? 0,
      occurredAt: occurredAt ?? '',
      accountId,
      toAccountId: type === 'transfer' ? toAccountId : null,
      categoryId: type === 'transfer' ? null : categoryId,
      counterparty,
      note,
    };
    const nextErrors = validateTransaction(input, loaded.categories);
    if (amountMinor === null && amount.trim()) {
      nextErrors.amountMinor = 'Enter a valid amount, e.g. 250 or 99.50';
    }
    if (!occurredAt) {
      nextErrors.occurredAt = 'Use the format YYYY-MM-DD.';
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      haptic('warning');
      return;
    }
    setSaving(true);
    try {
      const budgetMonth = monthKeyOf(new Date(input.occurredAt));
      const before = type === 'expense' ? await loadBudgetSummary(db, budgetMonth) : null;
      if (candidate) {
        await confirmCandidate(db, candidate, input);
        await upi.refresh();
      } else if (isNew) {
        await createTransaction(db, input);
      } else {
        await updateTransaction(db, id, input);
      }
      const category = loaded.categories.find(c => c.id === input.categoryId);
      const alert =
        before && category
          ? budgetAlert(before, await loadBudgetSummary(db, budgetMonth), category.parentId ?? category.id)
          : null;
      haptic(alert ? 'warning' : 'success');
      router.back();
      if (alert) {
        Alert.alert(alert.title, alert.message);
      }
    } catch (err) {
      haptic('warning');
      Alert.alert('Could not save transaction', err instanceof Error ? err.message : String(err));
      setSaving(false);
    }
  };

  const confirmDelete = () => {
    haptic('warning');
    Alert.alert('Delete transaction?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteTransaction(db, id);
          await upi.refresh();
          router.back();
        },
      },
    ]);
  };

  const title = candidate ? 'Add detected payment' : isNew ? 'New transaction' : 'Edit transaction';

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Stack.Screen options={{ title }} />

        {candidate && (
          <Animated.View entering={FadeInDown.duration(300)} style={styles.banner}>
            <Ionicons name="flash" size={18} color={colors.primary} />
            <Text style={styles.bannerText}>
              Detected in {candidate.sourceApp} on {formatDisplayDate(candidate.detectedAt)}. Check the details
              before saving.
            </Text>
          </Animated.View>
        )}
        {loaded.duplicate && (
          <Animated.View entering={FadeInDown.delay(60).duration(300)} style={[styles.banner, styles.warning]}>
            <Ionicons name="copy-outline" size={18} color={colors.warning} />
            <Text style={[styles.bannerText, { color: colors.warning }]}>
              A similar transaction ({loaded.duplicate.counterparty || 'no payee'},{' '}
              {formatDisplayDate(loaded.duplicate.occurredAt)}) already exists. Make sure this isn&apos;t a
              duplicate.
            </Text>
          </Animated.View>
        )}

        <Segmented options={typeOptions} value={type} onChange={changeType} tint={value => typeColor[value]} />

        <View style={[styles.amountCard, { borderColor: errors.amountMinor ? colors.danger : 'transparent' }]}>
          <Text style={[styles.currency, { color: accent }]}>₹</Text>
          <TextInput
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor={colors.border}
            autoFocus={isNew && !candidate}
            style={[styles.amountInput, { color: accent }]}
            accessibilityLabel="Amount in rupees"
          />
        </View>
        {errors.amountMinor && (
          <Animated.Text entering={FadeIn} style={styles.error}>
            {errors.amountMinor}
          </Animated.Text>
        )}

        {type !== 'transfer' && (
          <Field label="Category" error={errors.categoryId}>
            {suggestedCategoryId && categoryId === suggestedCategoryId && (
              <Text style={styles.hint}>Suggested from your last payment to {counterparty}.</Text>
            )}
            <View style={styles.chips}>
              {categoryOptions.map(c => (
                <Chip
                  key={c.id}
                  label={c.label}
                  icon={c.style.icon}
                  color={c.style.color}
                  selected={categoryId === c.id}
                  onPress={() => setCategoryId(c.id)}
                />
              ))}
            </View>
          </Field>
        )}

        <Field label={type === 'transfer' ? 'From account' : 'Account'} error={errors.accountId}>
          <View style={styles.chips}>
            {accountOptions.map(a => (
              <Chip
                key={a.id}
                label={a.name}
                icon={accountIcon(a.type)}
                selected={accountId === a.id}
                onPress={() => setAccountId(a.id)}
              />
            ))}
          </View>
        </Field>

        {type === 'transfer' && (
          <Field label="To account" error={errors.toAccountId}>
            <View style={styles.chips}>
              {accountOptions.map(a => (
                <Chip
                  key={a.id}
                  label={a.name}
                  icon={accountIcon(a.type)}
                  selected={toAccountId === a.id}
                  onPress={() => setToAccountId(a.id)}
                />
              ))}
            </View>
            {accountOptions.length < 2 && <Text style={styles.hint}>Add a second account to make transfers.</Text>}
          </Field>
        )}

        <Field label="Date" error={errors.occurredAt}>
          <View style={styles.chips}>
            <Chip label="Today" icon="today-outline" selected={date === today} onPress={() => setDate(today)} />
            <Chip label="Yesterday" selected={date === yesterday} onPress={() => setDate(yesterday)} />
          </View>
          <Input value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" autoCapitalize="none" />
        </Field>

        {type !== 'transfer' && (
          <Field label={type === 'income' ? 'From (optional)' : 'Paid to (optional)'}>
            <Input value={counterparty} onChangeText={setCounterparty} placeholder="e.g. Swiggy" />
          </Field>
        )}

        <Field label="Note (optional)">
          <Input value={note} onChangeText={setNote} multiline placeholder="Anything to remember" />
        </Field>

        <Button
          title={saving ? 'Saving…' : candidate ? 'Add transaction' : 'Save'}
          icon="checkmark"
          onPress={save}
          disabled={saving}
          hapticKind="none"
          style={{ backgroundColor: accent }}
        />
        {!isNew && <Button title="Delete" variant="danger" icon="trash-outline" onPress={confirmDelete} />}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function accountIcon(type: Account['type']) {
  return type === 'cash' ? 'cash-outline' : type === 'wallet' ? 'wallet-outline' : 'business-outline';
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16, gap: 18, paddingBottom: 48 },
  banner: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    padding: 12,
  },
  warning: { backgroundColor: colors.warningSoft },
  bannerText: { flex: 1, color: colors.primary, lineHeight: 19 },
  amountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    paddingVertical: 18,
    paddingHorizontal: 16,
    ...shadow,
  },
  currency: { fontSize: 34, fontWeight: '700' },
  amountInput: { fontSize: 44, fontWeight: '800', minWidth: 80, textAlign: 'center', fontVariant: ['tabular-nums'] },
  error: { color: colors.danger, fontSize: 13, marginTop: -10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  hint: { color: colors.textMuted, fontSize: 13 },
});
