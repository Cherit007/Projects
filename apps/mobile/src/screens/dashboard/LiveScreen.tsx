import React, { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAppSession } from '../../context/AppSessionContext';
import { useMobileDashboardMetrics } from '../../hooks/useMobileDashboardMetrics';
import { useTournament } from '../../context/TournamentContext';
import { colors, dashboardStyles as styles } from '../../styles/dashboardStyles';
import type { RootStackParamList } from '../../navigation/types';

export default function LiveScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { activeGroup, sportId } = useAppSession();
  const { loadTournamentFromHistory } = useTournament();
  const metrics = useMobileDashboardMetrics(activeGroup?.id, sportId);
  const [tab, setTab] = useState<'progress' | 'completed'>('progress');

  const handleResume = async (tournament: Record<string, unknown>) => {
    await loadTournamentFromHistory(tournament);
    navigation.navigate('Tournament');
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Live</Text>
        <Text style={styles.headerSubtitle}>In progress and completed matches</Text>
      </View>

      <View style={[styles.chipRow, { paddingHorizontal: 16, marginBottom: 8 }]}>
        <Pressable
          style={[styles.chip, tab === 'progress' && styles.chipActive]}
          onPress={() => setTab('progress')}
        >
          <Text style={[styles.chipText, tab === 'progress' && styles.chipTextActive]}>
            In progress ({metrics.liveInProgressCards.length})
          </Text>
        </Pressable>
        <Pressable
          style={[styles.chip, tab === 'completed' && styles.chipActive]}
          onPress={() => setTab('completed')}
        >
          <Text style={[styles.chipText, tab === 'completed' && styles.chipTextActive]}>
            Completed ({metrics.liveCompletedRows.length})
          </Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={(
          <RefreshControl
            refreshing={metrics.isLoading}
            onRefresh={() => { void metrics.refetchAll(); }}
            tintColor={colors.primary}
          />
        )}
      >
        {tab === 'progress' ? (
          metrics.liveInProgressCards.length ? (
            <View style={styles.card}>
              {metrics.liveInProgressCards.map((card, index) => (
                <Pressable
                  key={card.id}
                  style={[styles.listRow, index === metrics.liveInProgressCards.length - 1 && styles.listRowLast]}
                  onPress={() => { void handleResume(card.tournament as Record<string, unknown>); }}
                >
                  <Text style={styles.listIcon}>🏆</Text>
                  <View style={styles.listCopy}>
                    <Text style={styles.listTitle}>{card.title}</Text>
                    <Text style={styles.listSubtitle}>{card.subtitle}</Text>
                  </View>
                  <Text style={styles.chevron}>›</Text>
                </Pressable>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyText}>No tournaments in progress for this sport.</Text>
          )
        ) : (
          metrics.liveCompletedRows.length ? (
            <View style={styles.card}>
              {metrics.liveCompletedRows.map((row, index) => (
                <Pressable
                  key={row.id}
                  style={[styles.listRow, index === metrics.liveCompletedRows.length - 1 && styles.listRowLast]}
                  onPress={() => {
                    if (row.kind === 'tournament' && row.tournament) {
                      void handleResume(row.tournament as Record<string, unknown>);
                    }
                  }}
                >
                  <Text style={styles.listIcon}>{row.kind === 'casual' ? '🎯' : '🏆'}</Text>
                  <View style={styles.listCopy}>
                    <Text style={styles.listTitle}>{row.title}</Text>
                    <Text style={styles.listSubtitle}>{row.subtitle}</Text>
                  </View>
                  {row.kind === 'tournament' ? <Text style={styles.chevron}>›</Text> : null}
                </Pressable>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyText}>No completed matches yet.</Text>
          )
        )}
      </ScrollView>
    </View>
  );
}
