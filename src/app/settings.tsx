import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { haptic, PressableScale } from '@/components/PressableScale';
import { Button, Card, SectionTitle } from '@/components/ui';
import { useCloud } from '@/services/cloud/CloudProvider';
import { useUpi } from '@/services/upi/UpiProvider';
import { colors } from '@/theme/colors';

function formatSyncTime(iso: string | null): string {
  if (!iso) {
    return 'Not synced yet';
  }
  return `Last synced ${new Date(iso).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  })}`;
}

export default function SettingsScreen() {
  const cloud = useCloud();
  const upi = useUpi();
  const [signingIn, setSigningIn] = useState(false);

  const signIn = async () => {
    setSigningIn(true);
    try {
      await cloud.signInWithGoogle();
      haptic('success');
    } catch (err) {
      Alert.alert('Sign-in failed', err instanceof Error ? err.message : String(err));
    } finally {
      setSigningIn(false);
    }
  };

  const confirmSignOut = () =>
    Alert.alert(
      'Sign out?',
      'Your data stays on this phone. Changes made while signed out will sync when you sign in again.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign out', style: 'destructive', onPress: () => cloud.signOut() },
      ],
    );

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Animated.View entering={FadeInDown.duration(300)} style={styles.section}>
        <SectionTitle title="Backup & sync" />
        <Card style={styles.card}>{renderAccount()}</Card>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(60).duration(300)} style={styles.section}>
        <SectionTitle title="Features" />
        {(upi.available || Platform.OS === 'ios') && (
          <LinkRow
            icon="flash"
            title="Payment detection"
            detail={upi.available ? (upi.enabled ? 'On' : 'Off') : 'From bank SMS with Shortcuts'}
            href="/upi-settings"
          />
        )}
        <LinkRow icon="repeat" title="Repeating transactions" detail="Rent, subscriptions, salary" href="/recurring" />
        <LinkRow icon="bar-chart" title="Reports" detail="Month and year totals" href="/reports" />
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(120).duration(300)} style={styles.section}>
        <SectionTitle title="Your data" />
        <LinkRow icon="document-outline" title="Backup and restore" detail="Save everything to a file" href="/backup" />
      </Animated.View>
    </ScrollView>
  );

  function renderAccount() {
    if (!cloud.configured) {
      return (
        <View style={styles.row}>
          <Ionicons name="cloud-offline-outline" size={24} color={colors.textMuted} />
          <View style={styles.flex}>
            <Text style={styles.title}>Sync is not set up</Text>
            <Text style={styles.muted}>
              This build has no cloud backend configured. Everything is saved on this device only.
            </Text>
          </View>
        </View>
      );
    }

    if (cloud.status === 'loading') {
      return <ActivityIndicator color={colors.primary} />;
    }

    if (cloud.status === 'signedOut' || !cloud.user) {
      return (
        <>
          <View style={styles.row}>
            <Ionicons name="cloud-outline" size={24} color={colors.primary} />
            <View style={styles.flex}>
              <Text style={styles.title}>Back up your data</Text>
              <Text style={styles.muted}>
                Optional. Sign in to back up and sync across devices. Without an account the app keeps working
                offline. Detected payment messages are never uploaded.
              </Text>
            </View>
          </View>
          <Button
            title={signingIn ? 'Opening Google…' : 'Sign in with Google'}
            icon="logo-google"
            onPress={signIn}
            disabled={signingIn}
          />
        </>
      );
    }

    return (
      <>
        <View style={styles.row}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(cloud.user.name || cloud.user.email || '?').charAt(0).toUpperCase()}</Text>
          </View>
          <View style={styles.flex}>
            <Text style={styles.title}>{cloud.user.name || 'Signed in'}</Text>
            <Text style={styles.muted}>{cloud.user.email}</Text>
          </View>
        </View>
        <View style={styles.syncRow}>
          {cloud.syncing ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Ionicons
              name={cloud.syncError ? 'alert-circle' : 'checkmark-circle'}
              size={18}
              color={cloud.syncError ? colors.warning : colors.income}
            />
          )}
          <Text style={[styles.muted, styles.flex]}>
            {cloud.syncing
              ? 'Syncing…'
              : cloud.syncError
                ? `Sync failed: ${cloud.syncError}`
                : formatSyncTime(cloud.lastSyncedAt)}
            {!cloud.syncing && cloud.pendingChanges > 0 ? ` · ${cloud.pendingChanges} pending` : ''}
          </Text>
        </View>
        <View style={styles.buttons}>
          <View style={styles.flex}>
            <Button title="Sync now" icon="sync" variant="secondary" onPress={cloud.sync} disabled={cloud.syncing} />
          </View>
          <View style={styles.flex}>
            <Button title="Sign out" icon="log-out-outline" variant="secondary" onPress={confirmSignOut} />
          </View>
        </View>
      </>
    );
  }
}

function LinkRow({
  icon,
  title,
  detail,
  href,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  detail: string;
  href: '/upi-settings' | '/recurring' | '/reports' | '/backup';
}) {
  return (
    <PressableScale hapticKind="light" onPress={() => router.push(href)}>
      <Card style={styles.linkRow}>
        <View style={styles.icon}>
          <Ionicons name={icon} size={20} color={colors.primary} />
        </View>
        <View style={styles.flex}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.muted}>{detail}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
      </Card>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 20, paddingBottom: 48 },
  section: { gap: 10 },
  card: { gap: 14 },
  row: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  flex: { flex: 1 },
  title: { fontSize: 16, fontWeight: '700', color: colors.text },
  muted: { color: colors.textMuted, fontSize: 13, lineHeight: 18, marginTop: 2 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 18 },
  syncRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  buttons: { flexDirection: 'row', gap: 10 },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
