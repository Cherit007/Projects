import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import type { PersonSummary } from '@/data/repositories/people';
import { formatMinor } from '@/domain/money/money';
import { colors, themedStyles } from '@/theme/colors';

import { PressableScale } from './PressableScale';
import { Amount, Badge } from './ui';

/** "RAHUL SHARMA" → "Rahul Sharma"; names with mixed case are left alone. */
export function displayName(name: string): string {
  return name === name.toUpperCase() ? name.toLowerCase().replace(/\b\w/g, ch => ch.toUpperCase()) : name;
}

export function PersonRow({ person }: { person: PersonSummary }) {
  const net = person.receivedMinor - person.sentMinor;
  const parts = [
    person.sentMinor > 0 ? `Sent ${formatMinor(person.sentMinor)}` : null,
    person.receivedMinor > 0 ? `Received ${formatMinor(person.receivedMinor)}` : null,
  ];
  return (
    <PressableScale
      accessibilityRole="button"
      scaleTo={0.98}
      onPress={() => router.push({ pathname: '/people/[name]', params: { name: person.name } })}
      style={styles.row}
    >
      <View style={styles.avatar}>
        <Text style={styles.initial}>{displayName(person.name).charAt(0)}</Text>
      </View>
      <View style={styles.text}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>
            {displayName(person.name)}
          </Text>
          {person.family && <Badge label="Family" color={colors.primary} background={colors.primarySoft} />}
        </View>
        <Text style={styles.meta} numberOfLines={1}>
          {parts.filter(Boolean).join(' · ')}
        </Text>
      </View>
      {net !== 0 && <Amount amountMinor={Math.abs(net)} type={net > 0 ? 'income' : 'expense'} />}
    </PressableScale>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: { color: colors.primary, fontWeight: '800', fontSize: 16 },
  text: { flex: 1, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { flexShrink: 1, fontSize: 15, fontWeight: '700', color: colors.text },
  meta: { fontSize: 13, color: colors.textMuted },
}));
