import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInRight } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { haptic } from '@/components/PressableScale';
import { Button, Card, Field, Input, Segmented, TextLink } from '@/components/ui';
import { createAccount, listAccounts } from '@/data/repositories/accounts';
import { saveCardDetails } from '@/data/repositories/cards';
import { setOwnerName } from '@/data/repositories/settings';
import { isValidCycleDay } from '@/domain/cards/billing';
import { formatMinor, parseToMinor } from '@/domain/money/money';
import { MAX_MONTH_START_DAY } from '@/domain/period';
import type { Account, AccountType } from '@/domain/types';
import { useFocusQuery } from '@/hooks/useFocusQuery';
import { usePreferences } from '@/services/PreferencesProvider';
import { colors, radius, themedStyles } from '@/theme/colors';

const STEPS = 3;

const kindOptions = [
  { value: 'bank', label: 'Bank' },
  { value: 'card', label: 'Credit card' },
  { value: 'wallet', label: 'Wallet' },
] as const;

export default function OnboardingScreen() {
  const db = useSQLiteContext();
  const prefs = usePreferences();
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [startDay, setStartDay] = useState(prefs.monthStartDay === 1 ? '' : String(prefs.monthStartDay));
  const [aboutError, setAboutError] = useState<string>();

  const finish = async () => {
    await prefs.finishOnboarding();
    haptic('success');
    router.replace('/');
  };

  const saveAbout = async () => {
    const day = startDay.trim() ? Number(startDay) : 1;
    if (!Number.isInteger(day) || day < 1 || day > MAX_MONTH_START_DAY) {
      setAboutError(`Enter a day from 1 to ${MAX_MONTH_START_DAY}, or leave it blank for the 1st.`);
      return;
    }
    setAboutError(undefined);
    if (name.trim()) {
      await setOwnerName(db, name);
    }
    await prefs.setMonthStart(day);
    setStep(2);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.topBar}>
          <View style={styles.dots}>
            {Array.from({ length: STEPS }, (_, i) => (
              <View key={i} style={[styles.dot, i <= step && styles.dotActive]} />
            ))}
          </View>
          <TextLink label="Skip" onPress={finish} />
        </View>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {step === 0 && (
            <Animated.View entering={FadeInRight.duration(250)} style={styles.step}>
              <View style={styles.hero}>
                <Ionicons name="wallet" size={36} color={colors.primary} />
              </View>
              <Text style={styles.title}>Welcome to Many Tracker</Text>
              <Text style={styles.body}>Track what you earn, spend and owe, with almost no typing.</Text>
              <Card style={styles.card}>
                <Point icon="phone-portrait-outline" text="Your data is saved on this phone. Cloud backup is optional." />
                <Point icon="shield-checkmark-outline" text="The app never asks for your UPI PIN, OTP or bank password, and cannot make payments." />
                <Point icon="notifications-outline" text="Reminders and insights are worked out on the phone; nothing is sent anywhere." />
              </Card>
              <Button title="Get started" icon="arrow-forward" onPress={() => setStep(1)} />
            </Animated.View>
          )}

          {step === 1 && (
            <Animated.View entering={FadeInRight.duration(250)} style={styles.step}>
              <Text style={styles.title}>About you</Text>
              <Field label="Your name, as your bank shows it">
                <Input value={name} onChangeText={setName} placeholder="e.g. Cherit Sharma" autoCapitalize="words" />
              </Field>
              <Text style={styles.hint}>Used to spot transfers between your own accounts. Optional.</Text>
              <Field label="Day your salary arrives" error={aboutError}>
                <Input
                  value={startDay}
                  onChangeText={setStartDay}
                  placeholder="1"
                  keyboardType="number-pad"
                  maxLength={2}
                />
              </Field>
              <Text style={styles.hint}>
                Months, budgets and safe-to-spend start on this day, so a month lines up with your pay. Leave blank to use
                calendar months. You can change it later in Settings.
              </Text>
              <Button title="Continue" icon="arrow-forward" onPress={saveAbout} />
            </Animated.View>
          )}

          {step === 2 && (
            <Animated.View entering={FadeInRight.duration(250)} style={styles.step}>
              <Text style={styles.title}>Your accounts</Text>
              <Text style={styles.body}>
                Add the bank accounts and credit cards you use. A Cash account is already there.
              </Text>
              <AccountsStep />
              <Button title="Finish" icon="checkmark" onPress={finish} />
            </Animated.View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Point({ icon, text }: { icon: React.ComponentProps<typeof Ionicons>['name']; text: string }) {
  return (
    <View style={styles.point}>
      <Ionicons name={icon} size={20} color={colors.primary} />
      <Text style={[styles.body, styles.flex]}>{text}</Text>
    </View>
  );
}

function AccountsStep() {
  const db = useSQLiteContext();
  const { data: accounts, reload } = useFocusQuery(useCallback((d: typeof db) => listAccounts(d), []));
  const [kind, setKind] = useState<Extract<AccountType, 'bank' | 'card' | 'wallet'>>('bank');
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [statementDay, setStatementDay] = useState('');
  const [dueDay, setDueDay] = useState('');
  const [saving, setSaving] = useState(false);

  const add = async () => {
    const amountMinor = parseToMinor(amount || '0');
    const statement = statementDay.trim() ? Number(statementDay) : null;
    const due = dueDay.trim() ? Number(dueDay) : null;
    if (!name.trim() || amountMinor === null) {
      Alert.alert('Check the details', 'Enter a name and a valid amount.');
      return;
    }
    if (kind === 'card' && (statement === null) !== (due === null)) {
      Alert.alert('Check the details', 'Enter both the statement day and the due day, or neither.');
      return;
    }
    if (kind === 'card' && statement !== null && due !== null && !(isValidCycleDay(statement) && isValidCycleDay(due))) {
      Alert.alert('Check the details', 'Statement and due days must be from 1 to 31.');
      return;
    }
    setSaving(true);
    try {
      const id = await createAccount(db, {
        name,
        type: kind,
        openingBalanceMinor: kind === 'card' ? -amountMinor : amountMinor,
      });
      if (kind === 'card' && statement !== null && due !== null) {
        await saveCardDetails(db, { accountId: id, statementDay: statement, dueDay: due, creditLimitMinor: null });
      }
      haptic('success');
      setName('');
      setAmount('');
      setStatementDay('');
      setDueDay('');
      reload();
    } catch (err) {
      Alert.alert('Could not add account', err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {(accounts ?? []).length > 0 && (
        <Card style={styles.list}>
          {(accounts ?? []).map((account: Account) => (
            <View key={account.id} style={styles.listRow}>
              <Ionicons
                name={account.type === 'card' ? 'card-outline' : account.type === 'cash' ? 'cash-outline' : 'business-outline'}
                size={18}
                color={colors.textMuted}
              />
              <Text style={[styles.listName, styles.flex]}>{account.name}</Text>
              <Text style={styles.listAmount}>
                {account.type === 'card'
                  ? `${formatMinor(-account.openingBalanceMinor)} owed`
                  : formatMinor(account.openingBalanceMinor)}
              </Text>
            </View>
          ))}
        </Card>
      )}
      <Card style={styles.card}>
        <Segmented options={kindOptions} value={kind} onChange={setKind} />
        <Input
          value={name}
          onChangeText={setName}
          placeholder={kind === 'card' ? 'e.g. HDFC Regalia' : kind === 'wallet' ? 'e.g. Paytm' : 'e.g. SBI Savings'}
        />
        <Input
          value={amount}
          onChangeText={setAmount}
          placeholder={kind === 'card' ? 'Amount owed now ₹' : 'Balance now ₹'}
          keyboardType="decimal-pad"
        />
        {kind === 'card' && (
          <View style={styles.row}>
            <Input
              style={styles.flex}
              value={statementDay}
              onChangeText={setStatementDay}
              placeholder="Statement day"
              keyboardType="number-pad"
              maxLength={2}
            />
            <Input
              style={styles.flex}
              value={dueDay}
              onChangeText={setDueDay}
              placeholder="Due day"
              keyboardType="number-pad"
              maxLength={2}
            />
          </View>
        )}
        <Button title={saving ? 'Adding…' : 'Add account'} icon="add" variant="secondary" onPress={add} disabled={saving} />
      </Card>
    </>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    flex: { flex: 1 },
    topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 8 },
    dots: { flexDirection: 'row', gap: 6 },
    dot: { width: 24, height: 6, borderRadius: 3, backgroundColor: colors.track },
    dotActive: { backgroundColor: colors.primary },
    content: { padding: 20, paddingBottom: 48 },
    step: { gap: 16 },
    hero: {
      width: 72,
      height: 72,
      borderRadius: 24,
      backgroundColor: colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 12,
    },
    title: { fontSize: 26, fontWeight: '800', color: colors.text },
    body: { fontSize: 15, lineHeight: 21, color: colors.textMuted },
    hint: { fontSize: 13, lineHeight: 18, color: colors.textMuted, marginTop: -8 },
    card: { gap: 12 },
    point: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
    list: { gap: 10, borderRadius: radius.lg },
    listRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    listName: { color: colors.text, fontWeight: '600' },
    listAmount: { color: colors.textMuted, fontSize: 13, fontVariant: ['tabular-nums'] },
    row: { flexDirection: 'row', gap: 10 },
  }),
);
