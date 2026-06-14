import React from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import type { FixtureMatch } from '../../types/tournament';

type FixturesTabProps = {
  fixtures: FixtureMatch[];
  loading: boolean;
  onSelectMatch: (match: FixtureMatch) => void;
  onScoreNext?: () => void;
  nextMatch: FixtureMatch | null;
  completedCount: number;
};

export default function FixturesTab({
  fixtures,
  loading,
  onSelectMatch,
  onScoreNext,
  nextMatch,
  completedCount,
}: FixturesTabProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.meta}>
        {completedCount}/{fixtures.length} matches scored
      </Text>
      {nextMatch && onScoreNext ? (
        <Pressable style={styles.nextButton} onPress={onScoreNext}>
          <Text style={styles.nextButtonText}>Score next match</Text>
        </Pressable>
      ) : null}

      <FlatList
        data={fixtures}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const scored = item.completed;
          const label = scored
            ? `${item.score1}-${item.score2}`
            : 'Tap to score';
          return (
            <Pressable style={styles.card} onPress={() => onSelectMatch(item)} disabled={loading}>
              <Text style={styles.cardTitle}>
                R{item.round || '-'} · {item.team1?.name || 'TBD'} vs {item.team2?.name || 'TBD'}
              </Text>
              <Text style={[styles.cardMeta, scored && styles.cardMetaDone]}>{label}</Text>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  meta: {
    color: '#64748b',
    marginBottom: 8,
  },
  nextButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#0f766e',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginBottom: 12,
  },
  nextButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  list: {
    paddingBottom: 24,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardTitle: {
    fontWeight: '600',
    color: '#0f172a',
  },
  cardMeta: {
    marginTop: 4,
    color: '#0f766e',
    fontWeight: '600',
  },
  cardMetaDone: {
    color: '#64748b',
  },
});
