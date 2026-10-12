import Ionicons from '@expo/vector-icons/Ionicons';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { PermissionsAndroid, Platform, ScrollView, Share, StyleSheet, Switch, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { haptic } from '@/components/PressableScale';
import { Button, Card, EmptyState, SectionTitle } from '@/components/ui';
import { SUPPORTED_UPI_APPS } from '@/domain/upi/parser';
import { upiNative } from '@/services/upi/upiSync';
import { useUpi } from '@/services/upi/UpiProvider';
import type { IconName } from '@/theme/categoryStyle';
import { colors, radius } from '@/theme/colors';

const needsPostPermission = Platform.OS === 'android' && Number(Platform.Version) >= 33;

export default function UpiSettingsScreen() {
  const upi = useUpi();
  const [canNotify, setCanNotify] = useState(!needsPostPermission);

  useEffect(() => {
    if (needsPostPermission) {
      PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS).then(setCanNotify);
    }
  }, [upi.accessGranted]);

  if (!upi.available && Platform.OS === 'ios') {
    return <SmsShortcutGuide />;
  }
  if (!upi.available) {
    return (
      <EmptyState
        icon="phone-portrait-outline"
        title="Not available here"
        body="Payment detection needs the Android app build. It is not possible on iOS or in Expo Go."
      />
    );
  }

  const toggle = async (next: boolean) => {
    haptic('selection');
    upi.setEnabled(next);
    if (next && needsPostPermission && !canNotify) {
      const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
      setCanNotify(result === PermissionsAndroid.RESULTS.GRANTED);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Animated.View entering={FadeInDown.duration(300)}>
        <Card style={styles.toggleCard}>
          <View style={styles.toggleIcon}>
            <Ionicons name="flash" size={22} color={colors.primary} />
          </View>
          <View style={styles.toggleText}>
            <Text style={styles.toggleTitle}>Detect UPI payments</Text>
            <Text style={styles.muted}>Suggest transactions from payment app notifications</Text>
          </View>
          <Switch
            value={upi.enabled}
            onValueChange={toggle}
            trackColor={{ true: colors.primary, false: colors.border }}
            thumbColor="#fff"
          />
        </Card>
      </Animated.View>

      {upi.enabled && (
        <Animated.View entering={FadeInDown.delay(60).duration(300)} style={styles.section}>
          <SectionTitle title="Setup" />
          <StatusRow
            ok={upi.accessGranted}
            title="Notification access"
            body={
              upi.accessGranted
                ? 'Granted. Only the payment apps below are read.'
                : 'Android requires you to allow this app to read notifications.'
            }
            action={
              !upi.accessGranted && (
                <Button title="Open settings" icon="open-outline" onPress={() => upiNative?.openAccessSettings()} />
              )
            }
          />
          {needsPostPermission && (
            <StatusRow
              ok={canNotify}
              title="Review reminders"
              body={
                canNotify
                  ? 'You will get a prompt when a payment is detected.'
                  : 'Optional. Allow notifications to get a prompt after each payment.'
              }
            />
          )}
          {upi.accessGranted && (
            <Button title="Open review list" variant="secondary" icon="list" onPress={() => router.push('/upi-review')} />
          )}
        </Animated.View>
      )}

      <Animated.View entering={FadeInDown.delay(120).duration(300)} style={styles.section}>
        <SectionTitle title="Supported apps" />
        <View style={styles.apps}>
          {Object.values(SUPPORTED_UPI_APPS).map(name => (
            <View key={name} style={styles.app}>
              <Text style={styles.appText}>{name}</Text>
            </View>
          ))}
        </View>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(180).duration(300)} style={styles.section}>
        <SectionTitle title="Your privacy" />
        <Card style={styles.privacy}>
          <PrivacyPoint icon="phone-portrait-outline" text="Notifications are read and processed only on this device." />
          <PrivacyPoint icon="key-outline" text="Messages that look like OTPs or PINs are discarded immediately." />
          <PrivacyPoint icon="hand-left-outline" text="Nothing is saved until you review and confirm it." />
          <PrivacyPoint icon="ban-outline" text="This app never asks for your UPI PIN and never makes payments." />
          <PrivacyPoint
            icon="information-circle-outline"
            text="Detection is best effort. Payment apps change their messages, so some payments may be missed."
          />
        </Card>
      </Animated.View>

      {__DEV__ && (
        <Card style={styles.dev}>
          <Text style={styles.devTitle}>Developer testing</Text>
          <Text style={styles.devText}>
            adb shell &apos;cmd notification post -S bigtext -t &quot;₹250 paid to Swiggy&quot; tag1 &quot;Paid from HDFC
            Bank&quot;&apos;
          </Text>
        </Card>
      )}
    </ScrollView>
  );
}

const SAMPLE_SMS =
  'Sent Rs.250.00 From HDFC Bank A/C *1234 To SWIGGY On 12/10/26 Ref 412345678901 Not You? Call 18002586161';

const SHORTCUT_STEPS = [
  'Open the Shortcuts app → Automation → New Automation → Message.',
  'Set "Message Contains" to debited, choose Run Immediately, turn off Notify When Run, then tap Next → New Blank Automation.',
  'Add the action "URL Encode" and set its input to Shortcut Input → Content.',
  'Add a "Text" action containing the link below, followed by the URL Encoded Text variable.',
  'Add "Open URLs" and set it to that Text. Done.',
  'Repeat for messages containing credited and Sent Rs, used by some banks.',
];

function shortcutPrompt(captureLink: string): string {
  return [
    'Make a shortcut called "Capture payment":',
    '1. Take the text I give it (ask me if there is none).',
    '2. URL-encode it.',
    `3. Open this link with the encoded text added at the end: ${captureLink}`,
    '',
    'Then make 3 automations: when I get a message containing "debited", "credited" or "Sent Rs",',
    'run "Capture payment" with the message text. Run immediately, without notifying me.',
  ].join('\n');
}

function SmsShortcutGuide() {
  const captureLink = `${Linking.createURL('capture')}?text=`;
  const prompt = shortcutPrompt(captureLink);
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Animated.View entering={FadeInDown.duration(300)}>
        <Card style={styles.toggleCard}>
          <View style={styles.toggleIcon}>
            <Ionicons name="chatbubble-ellipses" size={22} color={colors.primary} />
          </View>
          <View style={styles.toggleText}>
            <Text style={styles.toggleTitle}>Capture payments from bank SMS</Text>
            <Text style={styles.muted}>
              iPhone apps cannot read notifications. Instead, a Shortcuts automation sends each bank SMS to this
              app, which opens with the payment ready to confirm.
            </Text>
          </View>
        </Card>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(40).duration(300)} style={styles.section}>
        <SectionTitle title="Quick setup with AI" />
        <Card style={styles.privacy}>
          <Text style={styles.muted}>
            Copy this prompt into the Shortcuts app&apos;s AI assistant. If it cannot create the automations, add them
            using the steps below.
          </Text>
          <Text selectable style={styles.pointText}>
            {prompt}
          </Text>
          <Button title="Copy prompt" icon="copy-outline" onPress={() => Share.share({ message: prompt })} />
        </Card>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(60).duration(300)} style={styles.section}>
        <SectionTitle title="Manual setup" />
        <Card style={styles.privacy}>
          {SHORTCUT_STEPS.map((step, index) => (
            <View key={step} style={styles.point}>
              <Text style={styles.stepNumber}>{index + 1}</Text>
              <Text style={styles.pointText}>{step}</Text>
            </View>
          ))}
        </Card>
        <Card style={styles.dev}>
          <Text style={styles.devTitle}>Link for step 4</Text>
          <Text selectable style={styles.devText}>
            {captureLink}
          </Text>
        </Card>
        <Button
          title="Try a sample message"
          variant="secondary"
          icon="flask-outline"
          onPress={() => router.push({ pathname: '/capture', params: { text: SAMPLE_SMS } })}
        />
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(120).duration(300)} style={styles.section}>
        <SectionTitle title="Your privacy" />
        <Card style={styles.privacy}>
          <PrivacyPoint icon="phone-portrait-outline" text="Messages are read only on this phone. The text is never saved or uploaded." />
          <PrivacyPoint icon="key-outline" text="Messages that look like OTPs or PINs are discarded immediately." />
          <PrivacyPoint icon="hand-left-outline" text="Nothing is saved until you review and confirm it." />
          <PrivacyPoint
            icon="information-circle-outline"
            text="Detection is best effort. Bank message formats vary, so check each payment before saving."
          />
        </Card>
      </Animated.View>
    </ScrollView>
  );
}

function StatusRow({
  ok,
  title,
  body,
  action,
}: {
  ok: boolean;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <Card style={styles.statusCard}>
      <View style={styles.statusRow}>
        <Ionicons
          name={ok ? 'checkmark-circle' : 'alert-circle'}
          size={24}
          color={ok ? colors.income : colors.warning}
        />
        <View style={styles.toggleText}>
          <Text style={styles.statusTitle}>{title}</Text>
          <Text style={styles.muted}>{body}</Text>
        </View>
      </View>
      {action}
    </Card>
  );
}

function PrivacyPoint({ icon, text }: { icon: IconName; text: string }) {
  return (
    <View style={styles.point}>
      <Ionicons name={icon} size={18} color={colors.primary} />
      <Text style={styles.pointText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 20, paddingBottom: 48 },
  section: { gap: 10 },
  muted: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  toggleCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  toggleIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleText: { flex: 1, gap: 2 },
  toggleTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  statusCard: { gap: 12 },
  statusRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  statusTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  apps: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  app: {
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  appText: { fontWeight: '600', color: colors.text },
  privacy: { gap: 14 },
  point: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  pointText: { flex: 1, color: colors.text, lineHeight: 20 },
  stepNumber: { width: 18, fontWeight: '800', color: colors.primary, lineHeight: 20 },
  dev: { gap: 6, backgroundColor: colors.surfaceMuted },
  devTitle: { fontWeight: '700', color: colors.textMuted },
  devText: { fontFamily: Platform.select({ android: 'monospace', default: 'Menlo' }), fontSize: 12, color: colors.text },
});
