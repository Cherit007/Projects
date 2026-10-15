import Ionicons from '@expo/vector-icons/Ionicons';
import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import {
  FlatList,
  Platform,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import { haptic, PressableScale } from '@/components/PressableScale';
import { Button, Card } from '@/components/ui';
import { bankSmsNative } from '@/services/upi/bankSmsSync';
import { useUpi } from '@/services/upi/UpiProvider';
import type { IconName } from '@/theme/categoryStyle';
import { colors, radius } from '@/theme/colors';

export const SHORTCUT_KEYWORDS = ['debited', 'credited', 'Sent Rs'] as const;

const SAMPLE_SMS =
  'Sent Rs.250.00 From HDFC Bank A/C *1234 To SWIGGY On 12/10/26 Ref 412345678901 Not You? Call 18002586161';

interface Step {
  icon: IconName;
  title: string;
  body: string;
  copy?: { label: string; value: string }[];
}

const APP_NAME = Constants.expoConfig?.name ?? 'FinanceTracker';

/** Optional iCloud link to a shared iOS 27 shortcut that carries the automation. */
const AUTOMATION_URL = Constants.expoConfig?.extra?.iosAutomationUrl as string | undefined;

/**
 * A trigger phrase of a single space matches every text, so one automation
 * covers all banks; the action itself discards anything that is not a payment.
 */
const MATCH_ALL = { label: 'Copy a space', value: ' ' };

const IOS_MAJOR = Platform.OS === 'ios' ? parseInt(String(Platform.Version), 10) : 0;

function buildNativeSteps(): Step[] {
  const addAction: Step = {
    icon: 'flash-outline',
    title: `Add the ${APP_NAME} action`,
    body: `Tap the search box at the bottom, type ${APP_NAME} and tap Capture bank SMS. Then tap the blue Message word in the action and choose Shortcut Input.`,
    copy: [{ label: APP_NAME, value: APP_NAME }],
  };
  const finish: Step = {
    icon: 'checkmark-done-outline',
    title: 'Done – test it',
    body: 'Tap Done. From now on every bank alert is captured in the background and you get a notification. To test, have someone text you the sample message.',
    copy: [{ label: 'Copy sample message', value: SAMPLE_SMS }],
  };

  if (IOS_MAJOR >= 27) {
    return [
      {
        icon: 'albums-outline',
        title: 'Start a new automation',
        body: 'Open Shortcuts and tap Library at the bottom, then Automation, then the + button.',
      },
      {
        icon: 'create-outline',
        title: 'Skip the AI screen',
        body: 'If you see "Describe a shortcut", don’t type anything – tap Edit. Then tap Automation and choose Message.',
      },
      {
        icon: 'chatbubble-ellipses-outline',
        title: 'Catch every text',
        body: 'The trigger says "When I receive a message from Sender". Tap Sender, change it to Message, then paste a single space into the box (copy it below).',
        copy: [MATCH_ALL],
      },
      {
        icon: 'flash-off-outline',
        title: 'Let it run by itself',
        body: 'Tap the small arrow next to the trigger and turn off Confirm Before Run.',
      },
      addAction,
      finish,
    ];
  }
  return [
    {
      icon: 'add-circle-outline',
      title: 'Start a new automation',
      body: 'Open Shortcuts, tap the Automation tab at the bottom, then + (or New Automation), and choose Message.',
    },
    {
      icon: 'chatbubble-ellipses-outline',
      title: 'Catch every text',
      body: 'Tap Message Contains and paste a single space (copy it below). Select Run Immediately, turn off Notify When Run, then tap Next and New Blank Automation.',
      copy: [MATCH_ALL],
    },
    addAction,
    finish,
  ];
}

function buildLinkSteps(captureLink: string): Step[] {
  return [
    {
      icon: 'add-circle-outline',
      title: 'Choose the trigger',
      body: 'In Shortcuts, open the Automation tab, tap + and choose Message.',
    },
    {
      icon: 'chatbubble-ellipses-outline',
      title: 'Add the bank keyword',
      body: 'Tap Message Contains and paste debited. Select Run Immediately, turn off Notify When Run, then tap Next.',
      copy: [{ label: 'debited', value: 'debited' }],
    },
    {
      icon: 'code-slash-outline',
      title: 'Encode the message',
      body: 'Tap New Blank Automation, add the action URL Encode, and set its input to Shortcut Input → Content.',
    },
    {
      icon: 'link-outline',
      title: 'Add the app link',
      body: 'Add the action URL and paste the link. Then tap right after the = sign and insert the URL Encoded Text variable.',
      copy: [{ label: 'Copy link', value: captureLink }],
    },
    {
      icon: 'open-outline',
      title: 'Open the link',
      body: 'Add the action Open URLs (it uses the URL above automatically) and tap Done.',
    },
    {
      icon: 'repeat-outline',
      title: 'Repeat for other alerts',
      body: 'Create the same automation for messages containing credited and Sent Rs, so every bank format is covered.',
      copy: [
        { label: 'credited', value: 'credited' },
        { label: 'Sent Rs', value: 'Sent Rs' },
      ],
    },
  ];
}

function aiPrompts(captureLink: string) {
  return [
    {
      label: '1. Create the shortcut',
      value: `Make a shortcut named Capture payment that takes text, URL encodes it, and opens the URL ${captureLink} followed by the encoded text.`,
    },
    {
      label: '2. Create the automation',
      value: 'When I receive a message containing debited, run the Capture payment shortcut with the message.',
    },
  ];
}

async function copy(value: string) {
  // Loaded on demand: older Android development builds do not include this native module.
  const Clipboard = await import('expo-clipboard');
  await Clipboard.setStringAsync(value);
  haptic('success');
}

async function openAutomationBuilder() {
  try {
    await Linking.openURL('shortcuts://create-automation');
  } catch {
    await Linking.openURL('shortcuts://');
  }
}

function formatCapturedAt(ms: number): string {
  return new Date(ms).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

/** Notification permission and "is it working" status for the native action. */
function NativeStatusCard() {
  // Subscribing re-renders this card after each foreground sync, picking up new captures.
  useUpi();
  const [notifications, setNotifications] = useState<boolean | null>(null);
  const lastCaptured = bankSmsNative?.lastCapturedAt() ?? null;

  return (
    <Card style={styles.step}>
      <View style={styles.stepHeader}>
        <View style={styles.stepIcon}>
          <Ionicons
            name={lastCaptured ? 'checkmark-circle' : 'hourglass-outline'}
            size={22}
            color={lastCaptured ? colors.income : colors.primary}
          />
        </View>
        <Text style={styles.stepCount}>Status</Text>
      </View>
      <Text style={styles.stepTitle}>{lastCaptured ? 'Working' : 'Waiting for your first bank text'}</Text>
      <Text style={styles.stepBody}>
        {lastCaptured
          ? `Last payment captured ${formatCapturedAt(lastCaptured)}.`
          : 'Set up the automation below. Payments appear here as soon as your bank sends an alert.'}
      </Text>
      {notifications !== true && (
        <Button
          title="Allow payment notifications"
          variant="secondary"
          icon="notifications-outline"
          onPress={async () => setNotifications((await bankSmsNative?.requestNotificationPermission()) ?? false)}
        />
      )}
      {notifications === false && (
        <Text style={styles.hint}>Notifications are off. You can turn them on in iOS Settings → {APP_NAME}.</Text>
      )}
    </Card>
  );
}

export function ShortcutSetupGuide() {
  const native = bankSmsNative != null;
  const captureLink = `${Linking.createURL('capture')}?text=`;
  const steps = native ? buildNativeSteps() : buildLinkSteps(captureLink);
  const { width } = useWindowDimensions();
  const pageWidth = width - 32;
  const list = useRef<FlatList<Step>>(null);
  const [page, setPage] = useState(0);
  const [copied, setCopied] = useState<string | null>(null);

  const copyValue = async (value: string) => {
    await copy(value);
    setCopied(value);
  };

  const goTo = (index: number) => {
    list.current?.scrollToIndex({ index, animated: true });
    setPage(index);
  };

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    setPage(Math.round(event.nativeEvent.contentOffset.x / pageWidth));
  };

  return (
    <View style={styles.container}>
      {native && <NativeStatusCard />}
      {native && AUTOMATION_URL && (
        <Card style={styles.step}>
          <Text style={styles.stepTitle}>One-tap install (iOS 27)</Text>
          <Text style={styles.stepBody}>
            Add the ready-made automation, then switch it on in Shortcuts → Automation. Repeat with the steps below
            for credited and Sent Rs if your bank uses them.
          </Text>
          <Button title="Install automation" icon="download-outline" onPress={() => Linking.openURL(AUTOMATION_URL)} />
        </Card>
      )}
      {native ? (
        <>
          <Text style={styles.hint}>
            One automation catches every bank alert. Open Shortcuts and follow the cards below, switching back to this
            screen whenever you need the next step. The Shortcuts AI can’t create automations, so skip it.
          </Text>
          <Button title="Open Shortcuts" icon="flash" onPress={() => Linking.openURL('shortcuts://')} />
        </>
      ) : (
        <>
          <Card style={styles.step}>
            <View style={styles.stepHeader}>
              <View style={styles.stepIcon}>
                <Ionicons name="sparkles" size={22} color={colors.primary} />
              </View>
              <Text style={styles.stepCount}>Quickest</Text>
            </View>
            <Text style={styles.stepTitle}>Ask the Shortcuts AI</Text>
            <Text style={styles.stepBody}>
              Copy each prompt, paste it into the Shortcuts app&apos;s AI one at a time, and repeat prompt 2 with
              credited and Sent Rs. If the AI declines, use the steps below.
            </Text>
            {aiPrompts(captureLink).map(prompt => (
              <View key={prompt.label} style={styles.prompt}>
                <Text style={styles.promptLabel}>{prompt.label}</Text>
                <Text selectable style={styles.promptText}>
                  {prompt.value}
                </Text>
                <PressableScale onPress={() => copyValue(prompt.value)} style={styles.chip}>
                  <Ionicons
                    name={copied === prompt.value ? 'checkmark' : 'copy-outline'}
                    size={16}
                    color={colors.primary}
                  />
                  <Text style={styles.chipText}>{copied === prompt.value ? 'Copied' : 'Copy prompt'}</Text>
                </PressableScale>
              </View>
            ))}
            <Button
              title="Open Shortcuts"
              variant="secondary"
              icon="open-outline"
              onPress={() => Linking.openURL('shortcuts://')}
            />
          </Card>

          <Text style={styles.orText}>Or set it up step by step</Text>
          <Button
            title="Copy link & open Shortcuts"
            icon="flash"
            onPress={async () => {
              await copyValue(captureLink);
              await openAutomationBuilder();
            }}
          />
          <Text style={styles.hint}>
            The app link is copied for step 4. Follow the steps below; it takes about a minute.
          </Text>
        </>
      )}

      <FlatList
        ref={list}
        data={steps}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={step => step.title}
        onMomentumScrollEnd={onScroll}
        getItemLayout={(_, index) => ({ length: pageWidth, offset: pageWidth * index, index })}
        renderItem={({ item, index }) => (
          <View style={{ width: pageWidth }}>
            <Card style={styles.step}>
              <View style={styles.stepHeader}>
                <View style={styles.stepIcon}>
                  <Ionicons name={item.icon} size={22} color={colors.primary} />
                </View>
                <Text style={styles.stepCount}>
                  Step {index + 1} of {steps.length}
                </Text>
              </View>
              <Text style={styles.stepTitle}>{item.title}</Text>
              <Text style={styles.stepBody}>{item.body}</Text>
              {item.copy && (
                <View style={styles.chips}>
                  {item.copy.map(entry => (
                    <PressableScale key={entry.label} onPress={() => copyValue(entry.value)} style={styles.chip}>
                      <Ionicons
                        name={copied === entry.value ? 'checkmark' : 'copy-outline'}
                        size={16}
                        color={colors.primary}
                      />
                      <Text style={styles.chipText} numberOfLines={1}>
                        {entry.label}
                      </Text>
                    </PressableScale>
                  ))}
                </View>
              )}
            </Card>
          </View>
        )}
      />

      <View style={styles.pager}>
        <PressableScale disabled={page === 0} onPress={() => goTo(page - 1)} hitSlop={10}>
          <Ionicons name="chevron-back" size={24} color={page === 0 ? colors.border : colors.primary} />
        </PressableScale>
        <View style={styles.dots}>
          {steps.map((step, index) => (
            <View key={step.title} style={[styles.dot, index === page && styles.dotActive]} />
          ))}
        </View>
        <PressableScale disabled={page === steps.length - 1} onPress={() => goTo(page + 1)} hitSlop={10}>
          <Ionicons
            name="chevron-forward"
            size={24}
            color={page === steps.length - 1 ? colors.border : colors.primary}
          />
        </PressableScale>
      </View>

      <Button
        title="Test with a sample message"
        variant="secondary"
        icon="flask-outline"
        onPress={() => router.push({ pathname: '/capture', params: { text: SAMPLE_SMS } })}
      />
      {!native && captureLink.startsWith('exp') && (
        <Text style={styles.hint}>
          In Expo Go this link only works while npm start is running on your Mac, and changes if its IP address
          changes. An installed build uses financetracker://capture?text=.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12 },
  hint: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  step: { gap: 10, minHeight: 230 },
  stepHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stepIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCount: { color: colors.textMuted, fontWeight: '600' },
  stepTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  stepBody: { color: colors.text, lineHeight: 21, fontSize: 15 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
    maxWidth: '100%',
  },
  chipText: { color: colors.primary, fontWeight: '700' },
  prompt: {
    gap: 8,
    padding: 12,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'flex-start',
  },
  promptLabel: { fontWeight: '700', color: colors.textMuted, fontSize: 13 },
  promptText: { color: colors.text, lineHeight: 20 },
  orText: { textAlign: 'center', color: colors.textMuted, fontWeight: '600', marginTop: 4 },
  pager: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 },
  dots: { flexDirection: 'row', gap: 6 },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  dotActive: { backgroundColor: colors.primary, width: 20 },
});
