import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { canLockApp, verifyOwner } from '@/components/AppLock';
import { haptic, PressableScale } from '@/components/PressableScale';
import { Button, Card, Chip, Input, SectionTitle } from '@/components/ui';
import type { ThemePreference } from '@/data/repositories/settings';
import { moveSection, sectionLabel, setSectionVisible, type DashboardSectionId } from '@/domain/dashboard';
import { formatMonth, MAX_MONTH_START_DAY, monthKeyOf } from '@/domain/period';
import { usePreferences } from '@/services/PreferencesProvider';
import { colors, themedStyles } from '@/theme/colors';

const THEMES: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'Same as phone' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

export default function PreferencesScreen() {
  const prefs = usePreferences();
  const [startDay, setStartDay] = useState(String(prefs.monthStartDay));
  const [busy, setBusy] = useState(false);

  const saveStartDay = async () => {
    const day = Number(startDay);
    if (!Number.isInteger(day) || day < 1 || day > MAX_MONTH_START_DAY) {
      Alert.alert('Check the day', `Enter a day from 1 to ${MAX_MONTH_START_DAY}.`);
      return;
    }
    await prefs.setMonthStart(day);
    haptic('success');
  };

  const toggleLock = async (enabled: boolean) => {
    setBusy(true);
    try {
      if (enabled) {
        if (!(await canLockApp())) {
          Alert.alert(
            'Set up a screen lock first',
            'App lock uses your phone’s fingerprint, face or passcode. Add one in the phone’s settings, then try again.',
          );
          return;
        }
        if (!(await verifyOwner('Turn on app lock'))) {
          return;
        }
      }
      await prefs.setAppLock(enabled);
      haptic('success');
    } catch (err) {
      Alert.alert('Could not change app lock', err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const move = (id: DashboardSectionId, delta: -1 | 1) => prefs.setDashboard(moveSection(prefs.dashboard, id, delta));
  const show = (id: DashboardSectionId, visible: boolean) =>
    prefs.setDashboard(setSectionVisible(prefs.dashboard, id, visible));

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <SectionTitle title="Appearance" />
      <Card style={styles.card}>
        <View style={styles.chips}>
          {THEMES.map(option => (
            <Chip
              key={option.value}
              label={option.label}
              selected={prefs.theme === option.value}
              onPress={() => prefs.setTheme(option.value)}
            />
          ))}
        </View>
      </Card>

      <SectionTitle title="Month starts on" />
      <Card style={styles.card}>
        <Text style={styles.body}>
          Set this to your salary day so months, budgets, safe-to-spend and monthly alerts follow your pay cycle.
        </Text>
        <View style={styles.row}>
          <Input
            style={styles.dayInput}
            value={startDay}
            onChangeText={setStartDay}
            keyboardType="number-pad"
            maxLength={2}
          />
          <Text style={[styles.body, styles.flex]}>day of each month (1–{MAX_MONTH_START_DAY})</Text>
          <Button title="Save" variant="secondary" onPress={saveStartDay} />
        </View>
        <Text style={styles.detail}>This month: {formatMonth(monthKeyOf(new Date()))}</Text>
      </Card>

      <SectionTitle title="Security" />
      <Card style={styles.card}>
        <View style={styles.row}>
          <View style={styles.flex}>
            <Text style={styles.title}>App lock</Text>
            <Text style={styles.detail}>
              Ask for fingerprint, face or the phone’s passcode when opening the app, and hide balances in the app
              switcher.{Platform.OS === 'android' ? ' Screenshots of the app are blocked while this is on.' : ''}
            </Text>
          </View>
          <Switch value={prefs.appLock} onValueChange={toggleLock} disabled={busy} trackColor={{ true: colors.primary }} />
        </View>
      </Card>

      <SectionTitle title="Dashboard sections" />
      <Card style={styles.card}>
        <Text style={styles.detail}>Turn sections off or move them. The balance summary always stays at the top.</Text>
        {prefs.dashboard.map((section, index) => (
          <View key={section.id} style={styles.sectionRow}>
            <Switch
              value={section.visible}
              onValueChange={v => show(section.id, v)}
              trackColor={{ true: colors.primary }}
            />
            <Text style={[styles.title, styles.flex, !section.visible && styles.off]}>{sectionLabel(section.id)}</Text>
            <Arrow icon="chevron-up" label="Move up" disabled={index === 0} onPress={() => move(section.id, -1)} />
            <Arrow
              icon="chevron-down"
              label="Move down"
              disabled={index === prefs.dashboard.length - 1}
              onPress={() => move(section.id, 1)}
            />
          </View>
        ))}
      </Card>
    </ScrollView>
  );
}

function Arrow({
  icon,
  label,
  disabled,
  onPress,
}: {
  icon: 'chevron-up' | 'chevron-down';
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <PressableScale
      accessibilityLabel={label}
      hapticKind="selection"
      hitSlop={6}
      disabled={disabled}
      onPress={onPress}
      style={[styles.arrow, disabled && styles.off]}
    >
      <Ionicons name={icon} size={18} color={colors.primary} />
    </PressableScale>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
    content: { padding: 16, gap: 14, paddingBottom: 48 },
    card: { gap: 12 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    flex: { flex: 1 },
    body: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
    title: { fontSize: 15, fontWeight: '600', color: colors.text },
    detail: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },
    dayInput: { width: 64, textAlign: 'center' },
    sectionRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    arrow: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    off: { opacity: 0.4 },
  }),
);
