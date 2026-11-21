import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button, ErrorState, Field, Input, LoadingState, Segmented } from '@/components/ui';
import {
  createAccount,
  getAccount,
  setAccountArchived,
  updateAccount,
} from '@/data/repositories/accounts';
import { deleteCardDetails, getCardDetails, saveCardDetails } from '@/data/repositories/cards';
import { isValidCycleDay } from '@/domain/cards/billing';
import { parseToMinor } from '@/domain/money/money';
import type { Account, AccountType } from '@/domain/types';
import { scheduleCardReminders } from '@/services/insights/notifications';
import { colors, themedStyles } from '@/theme/colors';

const typeOptions = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank', label: 'Bank' },
  { value: 'wallet', label: 'Wallet' },
  { value: 'card', label: 'Card' },
] as const;

type FormErrors = { name?: string; opening?: string; statementDay?: string; dueDay?: string; limit?: string };

/** A blank field is null; anything else that is not a day of the month is NaN. */
function parseDay(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const day = Number(trimmed);
  return isValidCycleDay(day) ? day : Number.NaN;
}

export default function AccountForm() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const db = useSQLiteContext();
  const [account, setAccount] = useState<Account | null | undefined>(isNew ? null : undefined);
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('bank');
  const [opening, setOpening] = useState('0');
  const [statementDay, setStatementDay] = useState('');
  const [dueDay, setDueDay] = useState('');
  const [limit, setLimit] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<Error>();

  useEffect(() => {
    if (isNew) {
      return;
    }
    Promise.all([getAccount(db, id), getCardDetails(db, id)])
      .then(([found, card]) => {
        setAccount(found);
        if (found) {
          setName(found.name);
          setType(found.type);
          const shown = found.type === 'card' ? -found.openingBalanceMinor : found.openingBalanceMinor;
          setOpening((shown / 100).toFixed(2));
        }
        if (card) {
          setStatementDay(String(card.statementDay));
          setDueDay(String(card.dueDay));
          setLimit(card.creditLimitMinor === null ? '' : (card.creditLimitMinor / 100).toFixed(2));
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
    const isCard = type === 'card';
    const statement = isCard ? parseDay(statementDay) : null;
    const due = isCard ? parseDay(dueDay) : null;
    const limitMinor = isCard && limit.trim() ? parseToMinor(limit) : null;
    const nextErrors: FormErrors = {
      name: name.trim() ? undefined : 'Enter a name.',
      opening: openingMinor === null ? 'Enter a valid amount, e.g. 1500.50' : undefined,
    };
    if (isCard) {
      if (Number.isNaN(statement)) {
        nextErrors.statementDay = 'Enter a day from 1 to 31.';
      } else if (statement === null && due !== null) {
        nextErrors.statementDay = 'Enter the statement day too.';
      }
      if (Number.isNaN(due)) {
        nextErrors.dueDay = 'Enter a day from 1 to 31.';
      } else if (due === null && statement !== null) {
        nextErrors.dueDay = 'Enter the due day too.';
      }
      if (limit.trim() && (limitMinor === null || limitMinor <= 0)) {
        nextErrors.limit = 'Enter a limit greater than zero, or leave it blank.';
      } else if (limitMinor !== null && statement === null && due === null) {
        nextErrors.limit = 'Add the statement and due days to save a limit.';
      }
    }
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean) || openingMinor === null) {
      return;
    }
    setSaving(true);
    try {
      const input = { name, type, openingBalanceMinor: isCard ? -openingMinor : openingMinor };
      let accountId = id;
      if (isNew) {
        accountId = await createAccount(db, input);
      } else {
        await updateAccount(db, id, input);
      }
      if (isCard && statement !== null && due !== null) {
        await saveCardDetails(db, { accountId, statementDay: statement, dueDay: due, creditLimitMinor: limitMinor });
      } else {
        await deleteCardDetails(db, accountId);
      }
      scheduleCardReminders(db).catch(() => undefined);
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
        <>
          <Text style={styles.hint}>
            Record card purchases as expenses on this card. When you pay the bill, add a transfer from your bank
            account to the card.
          </Text>
          <View style={styles.row}>
            <View style={styles.flex}>
              <Field label="Statement day" error={errors.statementDay}>
                <Input value={statementDay} onChangeText={setStatementDay} keyboardType="number-pad" placeholder="e.g. 18" maxLength={2} />
              </Field>
            </View>
            <View style={styles.flex}>
              <Field label="Payment due day" error={errors.dueDay}>
                <Input value={dueDay} onChangeText={setDueDay} keyboardType="number-pad" placeholder="e.g. 7" maxLength={2} />
              </Field>
            </View>
          </View>
          <Text style={styles.hint}>
            Days of the month, as printed on your statement. A due day earlier than the statement day means the
            following month. You get payment reminders before the due day (change when in Insights and alerts).
          </Text>
          <Field label="Credit limit (₹, optional)" error={errors.limit}>
            <Input value={limit} onChangeText={setLimit} keyboardType="decimal-pad" placeholder="e.g. 200000" />
          </Field>
        </>
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

const styles = themedStyles(() => StyleSheet.create({
  content: { padding: 16, gap: 16 },
  hint: { color: colors.textMuted, fontSize: 13, lineHeight: 18, marginTop: -6 },
  row: { flexDirection: 'row', gap: 12 },
  flex: { flex: 1 },
}));
