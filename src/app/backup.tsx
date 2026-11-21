import Ionicons from '@expo/vector-icons/Ionicons';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

import { haptic } from '@/components/PressableScale';
import { Button, Card, SectionTitle } from '@/components/ui';
import type { Backup } from '@/domain/backup';
import { formatDisplayDate } from '@/utils/dates';
import { pickBackup, restoreFromBackup, shareBackup } from '@/services/backupFile';
import { useCloud } from '@/services/cloud/CloudProvider';
import { useRecurring } from '@/services/RecurringProvider';
import { useUpi } from '@/services/upi/UpiProvider';
import { colors, themedStyles } from '@/theme/colors';

export default function BackupScreen() {
  const db = useSQLiteContext();
  const cloud = useCloud();
  const upi = useUpi();
  const recurring = useRecurring();
  const [busy, setBusy] = useState<'export' | 'restore' | null>(null);

  const exportFile = async () => {
    setBusy('export');
    try {
      await shareBackup(db);
    } catch (err) {
      Alert.alert('Could not create backup', err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  const restore = async (backup: Backup) => {
    setBusy('restore');
    try {
      await restoreFromBackup(db, backup);
      await upi.refresh();
      await recurring.run();
      if (cloud.user) {
        cloud.sync();
      }
      haptic('success');
      Alert.alert('Backup restored', 'Your accounts, categories, transactions and budgets are back.');
    } catch (err) {
      Alert.alert('Could not restore', err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  const chooseFile = async () => {
    let backup: Backup | null;
    try {
      backup = await pickBackup();
    } catch (err) {
      Alert.alert('Could not read backup', err instanceof Error ? err.message : String(err));
      return;
    }
    if (!backup) {
      return;
    }
    const count = backup.tables.transactions.length;
    const made = backup.exportedAt ? ` made on ${formatDisplayDate(backup.exportedAt)}` : '';
    haptic('warning');
    Alert.alert(
      'Replace everything?',
      `This backup${made} has ${count} transaction${count === 1 ? '' : 's'}. All data on this phone will be replaced` +
        (cloud.user ? ', and the change will sync to your cloud backup.' : '.'),
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Replace', style: 'destructive', onPress: () => restore(backup) },
      ],
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.section}>
        <SectionTitle title="Back up to a file" />
        <Card style={styles.card}>
          <Text style={styles.body}>
            Saves your accounts, categories, transactions, budgets, repeating transactions and settings in one file.
            Keep it in Files, Google Drive or anywhere you like.
          </Text>
          <Point icon="lock-closed-outline" text="The file is not encrypted. Store it somewhere private." />
          <Point icon="image-outline" text="Receipt photos are not included." />
          <Point icon="flash-outline" text="Detected payment messages are never included." />
          <Button
            title={busy === 'export' ? 'Preparing…' : 'Create backup'}
            icon="download-outline"
            onPress={exportFile}
            disabled={busy !== null}
          />
        </Card>
      </View>

      <View style={styles.section}>
        <SectionTitle title="Restore" />
        <Card style={styles.card}>
          <Text style={styles.body}>
            Choose a backup file to replace all data on this phone with it. You are asked to confirm first.
          </Text>
          <Button
            title={busy === 'restore' ? 'Restoring…' : 'Restore from file'}
            icon="refresh-outline"
            variant="secondary"
            onPress={chooseFile}
            disabled={busy !== null}
          />
        </Card>
      </View>
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

const styles = themedStyles(() => StyleSheet.create({
  content: { padding: 16, gap: 20, paddingBottom: 48 },
  section: { gap: 10 },
  card: { gap: 12 },
  body: { color: colors.text, lineHeight: 20 },
  point: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  pointText: { flex: 1, color: colors.textMuted, fontSize: 13, lineHeight: 18 },
}));
