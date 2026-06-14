import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export type TournamentSegment = 'fixtures' | 'table' | 'stats';

type TournamentSegmentTabsProps = {
  active: TournamentSegment;
  onChange: (segment: TournamentSegment) => void;
  showTable?: boolean;
};

const SEGMENTS: Array<{ key: TournamentSegment; label: string }> = [
  { key: 'fixtures', label: 'Fixtures' },
  { key: 'table', label: 'Table' },
  { key: 'stats', label: 'Stats' },
];

export default function TournamentSegmentTabs({
  active,
  onChange,
  showTable = true,
}: TournamentSegmentTabsProps) {
  const visibleSegments = showTable
    ? SEGMENTS
    : SEGMENTS.filter((segment) => segment.key !== 'table');

  return (
    <View style={styles.row}>
      {visibleSegments.map((segment) => {
        const selected = active === segment.key;
        return (
          <Pressable
            key={segment.key}
            style={[styles.tab, selected && styles.tabActive]}
            onPress={() => onChange(segment.key)}
          >
            <Text style={[styles.tabText, selected && styles.tabTextActive]}>{segment.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  tab: {
    flex: 1,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  tabActive: {
    backgroundColor: '#0f766e',
    borderColor: '#0f766e',
  },
  tabText: {
    fontWeight: '600',
    color: '#334155',
    fontSize: 13,
  },
  tabTextActive: {
    color: '#fff',
  },
});
