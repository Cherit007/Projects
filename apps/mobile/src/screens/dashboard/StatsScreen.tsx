import React from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAppSession } from '../../context/AppSessionContext';
import { useMobileDashboardMetrics } from '../../hooks/useMobileDashboardMetrics';
import { colors, dashboardStyles as styles } from '../../styles/dashboardStyles';
import type { RootStackParamList } from '../../navigation/types';

export default function StatsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { activeGroup, sportId } = useAppSession();
  const metrics = useMobileDashboardMetrics(activeGroup?.id, sportId);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Stats</Text>
        <Text style={styles.headerSubtitle}>Player performance for {metrics.sport?.name || sportId}</Text>
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
        {!metrics.hideEloFeatures && (
          <Pressable style={styles.card} onPress={() => navigation.navigate('EloLeaderboard')}>
            <View style={styles.listRow}>
              <Text style={styles.listIcon}>🏅</Text>
              <View style={styles.listCopy}>
                <Text style={styles.listTitle}>ELO Leaderboard</Text>
                <Text style={styles.listSubtitle}>
                  {metrics.topEloPlayer
                    ? `${metrics.topEloPlayer.name} · ${metrics.topEloPlayer.rating}`
                    : 'Open full rankings'}
                </Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </View>
          </Pressable>
        )}

        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>All-time leaders</Text>
            <Pressable onPress={() => navigation.navigate('History')}>
              <Text style={styles.sectionLink}>History</Text>
            </Pressable>
          </View>

          {metrics.statsPreviewRows.length ? (
            <View style={styles.card}>
              {metrics.statsPreviewRows.map((row, index) => (
                <View
                  key={row.name}
                  style={[styles.listRow, index === metrics.statsPreviewRows.length - 1 && styles.listRowLast]}
                >
                  <Text style={styles.listIcon}>👤</Text>
                  <View style={styles.listCopy}>
                    <Text style={styles.listTitle}>{row.name}</Text>
                    <Text style={styles.listSubtitle}>
                      {row.matchesWon}W / {row.matchesPlayed} played · {row.winRate}% win
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyText}>Stats appear after you score matches.</Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
