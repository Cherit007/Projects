import React, { useEffect } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAppSession } from '../../context/AppSessionContext';
import { useMobileDashboardMetrics } from '../../hooks/useMobileDashboardMetrics';
import { useTournament } from '../../context/TournamentContext';
import { colors, dashboardStyles as styles } from '../../styles/dashboardStyles';
import type { RootStackParamList } from '../../navigation/types';

export default function HomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { activeGroup, sportId } = useAppSession();
  const { loadTournamentFromHistory } = useTournament();
  const metrics = useMobileDashboardMetrics(activeGroup?.id, sportId);

  useEffect(() => {
    navigation.getParent()?.setOptions({ headerShown: false });
  }, [navigation]);

  const handleResume = async (tournament: Record<string, unknown>) => {
    await loadTournamentFromHistory(tournament);
    navigation.navigate('Tournament');
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{metrics.sport?.name || 'Home'}</Text>
        <Text style={styles.headerSubtitle}>
          {activeGroup?.name ? `${activeGroup.name} workspace` : 'Your sport dashboard'}
        </Text>
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
        <View style={styles.hero}>
          <Text style={styles.heroLabel}>Start match</Text>
          <Text style={styles.heroTitle}>Casual or tournament</Text>
          <Text style={styles.heroCopy}>
            {metrics.sport?.name || sportId} · league format
          </Text>
          <Pressable style={styles.primaryBtn} onPress={() => navigation.navigate('MainTabs', { screen: 'Start' })}>
            <Text style={styles.primaryBtnText}>+ Start Match</Text>
          </Pressable>
        </View>

        <View style={styles.statsGrid}>
          {metrics.mobileStatsCards.map((card) => (
            <View key={card.label} style={styles.statCard}>
              <Text style={styles.statIcon}>{card.icon}</Text>
              <Text style={styles.statValue}>{card.value}</Text>
              <Text style={styles.statLabel}>{card.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>Quick access</Text>
            <Pressable onPress={() => navigation.navigate('MainTabs', { screen: 'Stats' })}>
              <Text style={styles.sectionLink}>View all</Text>
            </Pressable>
          </View>
          <View style={styles.card}>
            {!metrics.hideEloFeatures && (
              <Pressable style={styles.listRow} onPress={() => navigation.navigate('EloLeaderboard')}>
                <Text style={styles.listIcon}>🏅</Text>
                <View style={styles.listCopy}>
                  <Text style={styles.listTitle}>ELO Leaderboard</Text>
                  <Text style={styles.listSubtitle}>
                    {metrics.topEloPlayer
                      ? `${metrics.topEloPlayer.name} leads · ${metrics.topEloPlayer.rating} pts`
                      : 'Rankings build after match results'}
                  </Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </Pressable>
            )}
            <Pressable
              style={[styles.listRow, !metrics.hideEloFeatures ? null : styles.listRowLast]}
              onPress={() => navigation.navigate('MainTabs', { screen: 'Live' })}
            >
              <Text style={styles.listIcon}>▶️</Text>
              <View style={styles.listCopy}>
                <Text style={styles.listTitle}>Live & completed</Text>
                <Text style={styles.listSubtitle}>
                  {metrics.activeLiveTournaments.length} in progress · {metrics.liveCompletedRows.length} recent
                </Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
            <Pressable style={[styles.listRow, styles.listRowLast]} onPress={() => navigation.navigate('History')}>
              <Text style={styles.listIcon}>📜</Text>
              <View style={styles.listCopy}>
                <Text style={styles.listTitle}>Match history</Text>
                <Text style={styles.listSubtitle}>
                  {metrics.completedTournaments.length} tournaments · {metrics.sportCasual.length} casual
                </Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          </View>
        </View>

        {metrics.liveInProgressCards.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>In progress</Text>
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
          </View>
        )}

        {metrics.isLoading && metrics.liveInProgressCards.length === 0 && (
          <ActivityIndicator color={colors.primary} />
        )}
      </ScrollView>
    </View>
  );
}
