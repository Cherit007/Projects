import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text } from 'react-native';

import { Button, ErrorState, Field, Input, LoadingState, Segmented } from '@/components/ui';
import {
  createAccount,
  getAccount,
  setAccountArchived,
  updateAccount,
} from '@/data/repositories/accounts';
import { parseToMinor } from '@/domain/money/money';
import type { Account, AccountType } from '@/domain/types';
import { colors } from '@/theme/colors';

const typeOptions = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank', label: 'Bank' },
  { value: 'wallet', label: 'Wallet' },
  { value: 'card', label: 'Card' },
] as const;

export default function AccountForm() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const db = useSQLiteContext();
  const [account, setAccount] = useState<Account | null | undefined>(isNew ? null : undefined);
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('bank');
  const [opening, setOpening] = useState('0');
  const [errors, setErrors] = useState<{ name?: string; opening?: string }>({});
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<Error>();

  useEffect(() => {
    if (isNew) {
      return;
    }
    getAccount(db, id)
      .then(found => {
        setAccount(found);
        if (found) {
          setName(found.name);
          setType(found.type);
          const shown = found.type === 'card' ? -found.openingBalanceMinor : found.openingBalanceMinor;
          setOpening((shown / 100).toFixed(2));
        }
      })
      .catch(setLoadError);
  }, [db, id, isNew]);

  if (loadError) {
    return <ErrorState error={loadError} />;
  }
  if (account === undefined) {
    return <LoadingState />;
  }
  if (!isNew && account === null) {
    return <ErrorState error={new Error('This account no longer exists.')} />;
  }

  const save = async () => {
    const openingMinor = parseToMinor(opening || '0');
    const nextErrors = {
      name: name.trim() ? undefined : 'Enter a name.',
      opening: openingMinor === null ? 'Enter a valid amount, e.g. 1500.50' : undefined,
    };
    setErrors(nextErrors);
    if (nextErrors.name || nextErrors.opening || openingMinor === null) {
      return;
    }
    setSaving(true);
    try {
      const input = { name, type, openingBalanceMinor: type === 'card' ? -openingMinor : openingMinor };
      if (isNew) {
        await createAccount(db, input);
      } else {
        await updateAccount(db, id, input);
      }
      router.back();
    } catch (err) {
      Alert.alert('Could not save account', String(err));
      setSaving(false);
    }
  };

  const toggleArchive = async () => {
    if (!account) {
      return;
    }
    await setAccountArchived(db, account.id, !account.isArchived);
    router.back();
  };

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: isNew ? 'New account' : 'Edit account' }} />
      <Field label="Name" error={errors.name}>
        <Input value={name} onChangeText={setName} placeholder="e.g. HDFC Savings" autoFocus={isNew} />
      </Field>
      <Field label="Type">
        <Segmented options={typeOptions} value={type} onChange={setType} />
      </Field>
      <Field label={type === 'card' ? 'Amount owed now (₹)' : 'Opening balance (₹)'} error={errors.opening}>
        <Input value={opening} onChangeText={setOpening} keyboardType="decimal-pad" />
      </Field>
      {type === 'card' && (
        <Text style={styles.hint}>
          Record card purchases as expenses on this card. When you pay the bill, add a transfer from your bank
          account to the card.
        </Text>
      )}
      <Button title={saving ? 'Saving…' : 'Save'} onPress={save} disabled={saving} />
      {account && (
        <Button
          title={account.isArchived ? 'Restore account' : 'Archive account'}
          variant="secondary"
          onPress={toggleArchive}
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 16 },
  hint: { color: colors.textMuted, fontSize: 13, lineHeight: 18, marginTop: -6 },
});
