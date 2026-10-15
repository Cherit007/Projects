import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { haptic } from '@/components/PressableScale';
import { Amount, Button, Card, Chip, Field, Input, SectionTitle } from '@/components/ui';
import { listAccounts } from '@/data/repositories/accounts';
import { formatMinor } from '@/domain/money/money';
import { parseStatement } from '@/domain/statements/parseStatement';
import { StatementError, type ParsedStatement } from '@/domain/statements/types';
import { isUpiAccount, type Account } from '@/domain/types';
import { useCloud } from '@/services/cloud/CloudProvider';
import {
  applyStatementImport,
  checkStatementBalance,
  matchStatementBalance,
  NEW_ACCOUNT,
  planStatementImport,
  suggestAccount,
  type BalanceCheck,
  type ImportPlan,
  type ImportResult,
  type PlannedRow,
} from '@/services/statements/importStatement';
import { PdfTextReader, type PdfTextReaderHandle } from '@/services/statements/PdfTextReader';
import { pickStatementPdf, type StatementFile } from '@/services/statements/statementFile';
import { colors, radius } from '@/theme/colors';

type Step =
  | { kind: 'start' }
  | { kind: 'password'; file: StatementFile; wrong: boolean }
  | { kind: 'busy'; message: string }
  | { kind: 'preview'; plan: ImportPlan; accounts: Account[] }
  | { kind: 'done'; plan: ImportPlan; result: ImportResult; check: BalanceCheck | null };

function toDate(date: string): Date {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day);
}

const shortDate = (date: string) => toDate(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
const longDate = (date: string) =>
  toDate(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

function period(statement: ParsedStatement): string {
  const { periodStart, periodEnd } = statement;
  return periodStart && periodEnd ? `${longDate(periodStart)} – ${longDate(periodEnd)}` : '';
}

export default function StatementImportScreen() {
  const db = useSQLiteContext();
  const cloud = useCloud();
  const reader = useRef<PdfTextReaderHandle>(null);
  const [step, setStep] = useState<Step>({ kind: 'start' });
  const [password, setPassword] = useState('');
  const [skipped, setSkipped] = useState<ReadonlySet<number>>(new Set());
  const [readerError, setReaderError] = useState<Error | null>(null);
  const onReaderError = useCallback((error: Error) => setReaderError(error), []);

  const fail = (title: string, error: unknown) => {
    setStep({ kind: 'start' });
    Alert.alert(title, error instanceof Error ? error.message : String(error));
  };

  const plan = async (statement: ParsedStatement, accountId?: string) => {
    setStep({ kind: 'busy', message: 'Matching with your transactions…' });
    const accounts = (await listAccounts(db)).filter(isUpiAccount);
    const id = accountId ?? suggestAccount(accounts, statement)?.id ?? NEW_ACCOUNT;
    setSkipped(new Set());
    setStep({ kind: 'preview', plan: await planStatementImport(db, statement, id), accounts });
  };

  const open = async (file: StatementFile, pdfPassword: string) => {
    if (!reader.current) {
      return;
    }
    setStep({ kind: 'busy', message: 'Reading the statement…' });
    try {
      const result = await reader.current.read(file.base64, pdfPassword);
      setPassword('');
      if (result.type !== 'pages') {
        setStep({ kind: 'password', file, wrong: result.type === 'wrong-password' });
        return;
      }
      await plan(parseStatement(result.pages));
    } catch (error) {
      fail(error instanceof StatementError ? 'Statement not supported' : 'Could not read the statement', error);
    }
  };

  const choose = async () => {
    try {
      const file = await pickStatementPdf();
      if (file) {
        await open(file, '');
      }
    } catch (error) {
      fail('Could not open the file', error);
    }
  };

  const changeAccount = async (statement: ParsedStatement, accountId: string) => {
    try {
      await plan(statement, accountId);
    } catch (error) {
      fail('Could not match the statement', error);
    }
  };

  const importRows = async (current: ImportPlan) => {
    setStep({ kind: 'busy', message: 'Adding transactions…' });
    try {
      const result = await applyStatementImport(db, current, skipped);
      const check = await checkStatementBalance(db, result.accountId, current.statement);
      if (cloud.user) {
        cloud.sync();
      }
      haptic('success');
      setStep({ kind: 'done', plan: current, result, check });
    } catch (error) {
      fail('Could not add the transactions', error);
    }
  };

  const matchBalance = async (done: Extract<Step, { kind: 'done' }>) => {
    if (!done.check) {
      return;
    }
    await matchStatementBalance(db, done.result.accountId, done.check);
    haptic('success');
    setStep({ ...done, check: await checkStatementBalance(db, done.result.accountId, done.plan.statement) });
  };

  return (
    <View style={styles.screen}>
      <PdfTextReader ref={reader} onError={onReaderError} />
      {step.kind === 'start' && <Start onChoose={choose} error={readerError} />}
      {step.kind === 'busy' && (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.muted}>{step.message}</Text>
        </View>
      )}
      {step.kind === 'password' && (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Card style={styles.card}>
            <Text style={styles.title}>{step.file.name}</Text>
            <Text style={styles.body}>
              This statement is protected. Enter the password your bank gave you for statements; it is only used to
              open the file on this phone and is not saved.
            </Text>
            <Field label="Statement password" error={step.wrong ? 'That password did not open the file.' : undefined}>
              <Input
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoFocus
                autoCapitalize="none"
                autoCorrect={false}
                onSubmitEditing={() => open(step.file, password)}
                accessibilityLabel="Statement password"
              />
            </Field>
            <Button title="Open" icon="lock-open-outline" onPress={() => open(step.file, password)} disabled={!password} />
            <Button
              title="Choose another file"
              variant="secondary"
              onPress={() => {
                setPassword('');
                setStep({ kind: 'start' });
              }}
            />
          </Card>
        </ScrollView>
      )}
      {step.kind === 'preview' && (
        <Preview
          plan={step.plan}
          accounts={step.accounts}
          skipped={skipped}
          onToggle={index =>
            setSkipped(current => {
              const next = new Set(current);
              if (!next.delete(index)) {
                next.add(index);
              }
              return next;
            })
          }
          onAccount={id => changeAccount(step.plan.statement, id)}
          onImport={() => importRows(step.plan)}
        />
      )}
      {step.kind === 'done' && <Done step={step} onMatch={() => matchBalance(step)} />}
    </View>
  );
}

function Start({ onChoose, error }: { onChoose: () => void; error: Error | null }) {
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Card style={styles.card}>
        <Text style={styles.body}>
          Add a month or more of transactions at once from your bank&apos;s account statement. HDFC Bank and SBI PDF
          statements are supported.
        </Text>
        <Point icon="phone-portrait-outline" text="The PDF is read on this phone. Nothing is uploaded." />
        <Point icon="copy-outline" text="Payments already in the app are recognised and not added twice." />
        <Point icon="eye-outline" text="You see everything before it is added." />
        {error && <Text style={styles.error}>{error.message}</Text>}
        <Button title="Choose statement PDF" icon="document-outline" onPress={onChoose} disabled={!!error} />
      </Card>
    </ScrollView>
  );
}

function Preview({
  plan,
  accounts,
  skipped,
  onToggle,
  onAccount,
  onImport,
}: {
  plan: ImportPlan;
  accounts: Account[];
  skipped: ReadonlySet<number>;
  onToggle: (index: number) => void;
  onAccount: (accountId: string) => void;
  onImport: () => void;
}) {
  const { statement } = plan;
  const fresh = plan.rows.filter(row => !row.existing);
  const adding = fresh.filter(row => !skipped.has(row.index)).length;
  const moving = plan.rows.filter(
    row => row.existing && row.existing.accountId !== plan.accountId && row.input.type !== 'transfer',
  ).length;
  const accountName = (id: string) => accounts.find(a => a.id === id)?.name ?? 'another account';

  const header = (
    <View style={styles.previewHeader}>
      <Card style={styles.card}>
        <Text style={styles.title}>
          {statement.bank}
          {statement.accountLast4 ? ` ••${statement.accountLast4}` : ''}
        </Text>
        <Text style={styles.muted}>
          {period(statement)} · {statement.rows.length} entries
        </Text>
        {statement.openingBalanceMinor !== null && statement.closingBalanceMinor !== null && (
          <Text style={styles.muted}>
            Opening {formatMinor(statement.openingBalanceMinor)} · Closing {formatMinor(statement.closingBalanceMinor)}
          </Text>
        )}
      </Card>
      {statement.problems.length > 0 && (
        <View style={styles.warning}>
          <Ionicons name="warning-outline" size={18} color={colors.warning} />
          <Text style={styles.warningText}>
            Some entries may have been misread. {statement.problems.join(' ')} Check the list before adding.
          </Text>
        </View>
      )}
      <SectionTitle title="Add to account" />
      <View style={styles.chips}>
        {accounts.map(account => (
          <Chip
            key={account.id}
            label={account.name}
            icon={account.type === 'wallet' ? 'wallet-outline' : 'business-outline'}
            selected={plan.accountId === account.id}
            onPress={() => onAccount(account.id)}
          />
        ))}
        <Chip
          label={`New: ${statement.bank}`}
          icon="add"
          selected={plan.accountId === NEW_ACCOUNT}
          onPress={() => onAccount(NEW_ACCOUNT)}
        />
      </View>
      <Text style={styles.body}>
        {fresh.length} new · {plan.rows.length - fresh.length} already in the app
        {moving > 0 ? ` (${moving} recorded in another account will move here)` : ''}.
      </Text>
      {fresh.length > 0 && <Text style={styles.muted}>Tap an entry to leave it out.</Text>}
    </View>
  );

  return (
    <View style={styles.screen}>
      <FlatList
        data={plan.rows}
        keyExtractor={row => String(row.index)}
        ListHeaderComponent={header}
        contentContainerStyle={styles.list}
        initialNumToRender={20}
        renderItem={({ item }) => (
          <Row
            row={item}
            skipped={skipped.has(item.index)}
            onPress={() => onToggle(item.index)}
            movedFrom={
              item.existing && item.existing.accountId !== plan.accountId && item.input.type !== 'transfer'
                ? accountName(item.existing.accountId)
                : null
            }
          />
        )}
      />
      <View style={styles.footer}>
        {fresh.length === 0 ? (
          <Button title="Everything is already in the app" variant="secondary" onPress={() => router.back()} />
        ) : (
          <Button
            title={`Add ${adding} transaction${adding === 1 ? '' : 's'}`}
            icon="checkmark"
            onPress={onImport}
            disabled={adding === 0 && moving === 0}
          />
        )}
      </View>
    </View>
  );
}

function Row({
  row,
  skipped,
  movedFrom,
  onPress,
}: {
  row: PlannedRow;
  skipped: boolean;
  movedFrom: string | null;
  onPress: () => void;
}) {
  const existing = row.existing !== null;
  const status = existing ? (movedFrom ? `Moves here from ${movedFrom}` : 'Already in the app') : row.label;
  const icon = existing ? 'checkmark-done' : skipped ? 'square-outline' : 'checkbox';
  return (
    <Pressable
      onPress={onPress}
      disabled={existing}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: !existing && !skipped, disabled: existing }}
      style={[styles.row, (existing || skipped) && styles.rowDim]}
    >
      <Ionicons name={icon} size={20} color={existing ? colors.textMuted : colors.primary} />
      <View style={styles.rowText}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {row.input.counterparty ?? row.label}
        </Text>
        <Text style={styles.rowMeta} numberOfLines={1}>
          {shortDate(row.row.date)} · {status}
        </Text>
      </View>
      <Amount amountMinor={row.row.amountMinor} type={row.input.type} style={styles.rowAmount} />
    </Pressable>
  );
}

function Done({ step, onMatch }: { step: Extract<Step, { kind: 'done' }>; onMatch: () => void }) {
  const { plan, result, check } = step;
  const last = plan.statement.rows[plan.statement.rows.length - 1]?.date ?? plan.statement.periodEnd;
  const end = plan.statement.periodEnd && last && plan.statement.periodEnd > last ? plan.statement.periodEnd : last;
  const matches = check !== null && check.appMinor === check.statementMinor;
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Card style={styles.card}>
        <Ionicons name="checkmark-circle" size={36} color={colors.income} />
        <Text style={styles.title}>
          Added {result.added} transaction{result.added === 1 ? '' : 's'} to {plan.accountName}
        </Text>
        {result.moved > 0 && (
          <Text style={styles.muted}>
            {result.moved} detected payment{result.moved === 1 ? ' was' : 's were'} moved to {plan.accountName}.
          </Text>
        )}
      </Card>
      {check && (
        <Card style={styles.card}>
          <SectionTitle title="Balance" />
          {matches ? (
            <Text style={styles.body}>
              {plan.accountName} shows {formatMinor(check.statementMinor)}
              {end ? ` on ${longDate(end)}` : ''}, the same as the statement.
            </Text>
          ) : (
            <>
              <Text style={styles.body}>
                The app shows {formatMinor(check.appMinor)} for {plan.accountName}
                {end ? ` on ${longDate(end)}` : ''}; the statement says {formatMinor(check.statementMinor)}. Usually the
                account&apos;s starting balance is out of date.
              </Text>
              <Button title="Match the statement" icon="git-compare-outline" onPress={onMatch} />
              <Text style={styles.muted}>
                Changes {plan.accountName}&apos;s starting balance by{' '}
                {formatMinor(check.statementMinor - check.appMinor)}, so this month&apos;s carried-over balance is right.
              </Text>
            </>
          )}
        </Card>
      )}
      {plan.notOnStatement > 0 && (
        <View style={styles.warning}>
          <Ionicons name="copy-outline" size={18} color={colors.warning} />
          <Text style={styles.warningText}>
            {plan.notOnStatement} transaction{plan.notOnStatement === 1 ? '' : 's'} in {plan.accountName} between these
            dates {plan.notOnStatement === 1 ? 'is' : 'are'} not on the statement. Check{' '}
            {plan.notOnStatement === 1 ? 'it' : 'them'} for duplicates or the wrong account.
          </Text>
        </View>
      )}
      <Button title="Done" onPress={() => router.back()} />
    </ScrollView>
  );
}

function Point({ icon, text }: { icon: React.ComponentProps<typeof Ionicons>['name']; text: string }) {
  return (
    <View style={styles.point}>
      <Ionicons name={icon} size={16} color={colors.textMuted} />
      <Text style={styles.pointText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 16, gap: 14, paddingBottom: 48 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
  card: { gap: 12 },
  title: { fontSize: 17, fontWeight: '700', color: colors.text },
  body: { color: colors.text, lineHeight: 20 },
  muted: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  error: { color: colors.danger, lineHeight: 20 },
  point: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  pointText: { flex: 1, color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  previewHeader: { gap: 12, paddingBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  list: { padding: 16, paddingBottom: 24 },
  warning: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    backgroundColor: colors.warningSoft,
    padding: 10,
    borderRadius: radius.sm,
  },
  warningText: { flex: 1, color: colors.warning, fontSize: 13, lineHeight: 18 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowDim: { opacity: 0.5 },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
  rowMeta: { fontSize: 12, color: colors.textMuted },
  rowAmount: { fontSize: 15 },
  footer: {
    padding: 16,
    paddingBottom: 28,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
});
