import React from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { GroupStatRow } from '../../hooks/useGroupStats';

type StatsTabProps = {
  rows: GroupStatRow[];
  tournamentCount: number;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
};

export default function StatsTab({
  rows,
  tournamentCount,
  isLoading,
  isError,
  onRetry,
}: StatsTabProps) {
  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0f766e" />
        <Text style={styles.meta}>Loading group stats…</Text>
      </View>
    );
  }

  if (isError) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>Could not load group stats.</Text>
        <Pressable style={styles.button} onPress={onRetry}>
          <Text style={styles.buttonText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  if (rows.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyTitle}>No player stats yet</Text>
        <Text style={styles.emptyBody}>
          Complete tournaments in this group to build career stats. Loaded {tournamentCount} tournament{tournamentCount === 1 ? '' : 's'} from cloud.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.meta}>
        Group career stats · {tournamentCount} tournament{tournamentCount === 1 ? '' : 's'}
      </Text>
      <FlatList
        data={rows}
        keyExtractor={(item) => item.name}
        renderItem={({ item, index }) => (
          <View style={styles.card}>
            <Text style={styles.rank}>#{index + 1}</Text>
            <View style={styles.copy}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.detail}>
                {item.matchesPlayed} matches · {item.matchesWon} wins · {item.winRate}% win rate
              </Text>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  meta: {
    color: '#64748b',
    marginBottom: 12,
  },
  empty: {
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  emptyBody: {
    marginTop: 8,
    color: '#64748b',
    lineHeight: 20,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  rank: {
    width: 28,
    fontWeight: '700',
    color: '#0f766e',
  },
  copy: {
    flex: 1,
  },
  name: {
    fontWeight: '700',
    color: '#0f172a',
  },
  detail: {
    marginTop: 4,
    color: '#64748b',
    fontSize: 13,
  },
  error: {
    color: '#b91c1c',
    marginBottom: 12,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#0f766e',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
  },
});
