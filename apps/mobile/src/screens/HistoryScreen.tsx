import React from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAppSession } from '../context/AppSessionContext';
import { useMobileDashboardMetrics } from '../hooks/useMobileDashboardMetrics';
import { useTournament } from '../context/TournamentContext';
import { colors, dashboardStyles as styles } from '../styles/dashboardStyles';
import type { RootStackParamList } from '../navigation/types';

export default function HistoryScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { activeGroup, sportId } = useAppSession();
  const { loadTournamentFromHistory } = useTournament();
  const metrics = useMobileDashboardMetrics(activeGroup?.id, sportId);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={{ color: colors.primary, fontWeight: '600', marginBottom: 8 }}>← Back</Text>
        </Pressable>
        <Text style={styles.headerTitle}>History</Text>
        <Text style={styles.headerSubtitle}>Tournaments and casual matches</Text>
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
        <Text style={styles.sectionTitle}>Tournaments</Text>
        {metrics.completedTournaments.length ? (
          <View style={styles.card}>
            {metrics.completedTournaments.map((tournament, index) => (
              <Pressable
                key={String(tournament.id || tournament.appwriteId || index)}
                style={[styles.listRow, index === metrics.completedTournaments.length - 1 && styles.listRowLast]}
                onPress={() => {
                  void loadTournamentFromHistory(tournament as Record<string, unknown>);
                  navigation.navigate('Tournament');
                }}
              >
                <Text style={styles.listIcon}>🏆</Text>
                <View style={styles.listCopy}>
                  <Text style={styles.listTitle}>{String(tournament.name || 'Tournament')}</Text>
                  <Text style={styles.listSubtitle}>
                    {tournament.champion ? `Champion: ${String(tournament.champion)}` : 'Completed'}
                  </Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <Text style={styles.emptyText}>No completed tournaments yet.</Text>
        )}

        <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Casual matches</Text>
        {metrics.sportCasual.length ? (
          <View style={styles.card}>
            {metrics.sportCasual.map((match, index) => {
              const row = match as {
                team1?: Record<string, unknown>;
                team2?: Record<string, unknown>;
                score1?: number;
                score2?: number;
              };
              const t1 = String(row.team1?.name || row.team1?.player || row.team1?.player1 || 'Team 1');
              const t2 = String(row.team2?.name || row.team2?.player || row.team2?.player1 || 'Team 2');
              return (
                <View
                  key={String((match as { id?: string }).id || index)}
                  style={[styles.listRow, index === metrics.sportCasual.length - 1 && styles.listRowLast]}
                >
                  <Text style={styles.listIcon}>🎯</Text>
                  <View style={styles.listCopy}>
                    <Text style={styles.listTitle}>{t1} vs {t2}</Text>
                    <Text style={styles.listSubtitle}>{row.score1 ?? 0} – {row.score2 ?? 0}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        ) : (
          <Text style={styles.emptyText}>No casual matches yet.</Text>
        )}
      </ScrollView>
    </View>
  );
}
