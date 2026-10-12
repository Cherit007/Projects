import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  Button,
  Chip,
  EmptyState,
  ErrorState,
  Field,
  Input,
  LoadingState,
  Segmented,
} from '@/components/ui';
import { listAccounts } from '@/data/repositories/accounts';
import { listCategories } from '@/data/repositories/categories';
import {
  createTransaction,
  deleteTransaction,
  getTransaction,
  updateTransaction,
} from '@/data/repositories/transactions';
import {
  validateTransaction,
  type ValidationErrors,
} from '@/domain/accounting/accounting';
import { parseToMinor } from '@/domain/money/money';
import type {
  Account,
  Category,
  Transaction,
  TransactionInput,
  TransactionType,
} from '@/domain/types';
import { colors } from '@/theme/colors';
import { fromLocalDateInput, toLocalDateInput } from '@/utils/dates';

const typeOptions = [
  { value: 'expense', label: 'Expense' },
  { value: 'income', label: 'Income' },
  { value: 'transfer', label: 'Transfer' },
] as const;

interface Loaded {
  accounts: Account[];
  categories: Category[];
  existing: Transaction | null;
}

export default function TransactionForm() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const db = useSQLiteContext();

  const [loaded, setLoaded] = useState<Loaded>();
  const [loadError, setLoadError] = useState<Error>();
  const [type, setType] = useState<TransactionType>('expense');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
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
    Promise.all([
      listAccounts(db, { includeArchived: true }),
      listCategories(db, { includeArchived: true }),
      isNew ? Promise.resolve(null) : getTransaction(db, id),
    ])
      .then(([accounts, categories, existing]) => {
        setLoaded({ accounts, categories, existing });
        if (existing) {
          setType(existing.type);
          setAmount((existing.amountMinor / 100).toFixed(2));
          setCategoryId(existing.categoryId);
          setAccountId(existing.accountId);
          setToAccountId(existing.toAccountId);
          setDate(toLocalDateInput(existing.occurredAt));
          setCounterparty(existing.counterparty ?? '');
          setNote(existing.note ?? '');
        } else {
          const firstActive = accounts.find(a => !a.isArchived);
          if (firstActive) {
            setAccountId(firstActive.id);
          }
        }
      })
      .catch(setLoadError);
  }, [db, id, isNew]);

  const categoryOptions = useMemo(() => {
    if (!loaded || type === 'transfer') {
      return [];
    }
    const byId = new Map(loaded.categories.map(c => [c.id, c]));
    return loaded.categories
      .filter(c => c.type === type && (!c.isArchived || c.id === categoryId))
      .map(c => ({
        id: c.id,
        label: c.parentId ? `${byId.get(c.parentId)?.name ?? ''} › ${c.name}` : c.name,
      }));
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

  const changeType = (next: TransactionType) => {
    setType(next);
    setCategoryId(null);
    setErrors({});
  };

  const save = async () => {
    const amountMinor = parseToMinor(amount);
    const occurredAt = fromLocalDateInput(date, loaded.existing?.occurredAt);
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
      return;
    }
    setSaving(true);
    try {
      if (isNew) {
        await createTransaction(db, input);
      } else {
        await updateTransaction(db, id, input);
      }
      router.back();
    } catch (err) {
      Alert.alert('Could not save transaction', String(err));
      setSaving(false);
    }
  };

  const confirmDelete = () => {
    Alert.alert('Delete transaction?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteTransaction(db, id);
          router.back();
        },
      },
    ]);
  };

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: isNew ? 'New transaction' : 'Edit transaction' }} />
      <Segmented options={typeOptions} value={type} onChange={changeType} />

      <Field label="Amount (₹)" error={errors.amountMinor}>
        <Input
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          placeholder="0.00"
          autoFocus={isNew}
          style={styles.amountInput}
        />
      </Field>

      {type !== 'transfer' && (
        <Field label="Category" error={errors.categoryId}>
          <View style={styles.chips}>
            {categoryOptions.map(c => (
              <Chip key={c.id} label={c.label} selected={categoryId === c.id} onPress={() => setCategoryId(c.id)} />
            ))}
          </View>
        </Field>
      )}

      <Field label={type === 'transfer' ? 'From account' : 'Account'} error={errors.accountId}>
        <View style={styles.chips}>
          {accountOptions.map(a => (
            <Chip key={a.id} label={a.name} selected={accountId === a.id} onPress={() => setAccountId(a.id)} />
          ))}
        </View>
      </Field>

      {type === 'transfer' && (
        <Field label="To account" error={errors.toAccountId}>
          <View style={styles.chips}>
            {accountOptions.map(a => (
              <Chip key={a.id} label={a.name} selected={toAccountId === a.id} onPress={() => setToAccountId(a.id)} />
            ))}
          </View>
          {accountOptions.length < 2 && (
            <Text style={styles.hint}>Add a second account to make transfers.</Text>
          )}
        </Field>
      )}

      <Field label="Date" error={errors.occurredAt}>
        <View style={styles.chips}>
          <Chip label="Today" selected={date === today} onPress={() => setDate(today)} />
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
        <Input value={note} onChangeText={setNote} multiline />
      </Field>

      <Button title={saving ? 'Saving…' : 'Save'} onPress={save} disabled={saving} />
      {!isNew && <Button title="Delete" variant="danger" onPress={confirmDelete} />}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 16, paddingBottom: 48 },
  amountInput: { fontSize: 28, fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  hint: { color: colors.textMuted, fontSize: 13 },
});
