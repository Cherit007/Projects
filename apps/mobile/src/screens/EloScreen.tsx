import React from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAppSession } from '../context/AppSessionContext';
import { useMobileDashboardMetrics } from '../hooks/useMobileDashboardMetrics';
import { colors, dashboardStyles as styles } from '../styles/dashboardStyles';
import type { RootStackParamList } from '../navigation/types';

export default function EloScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { activeGroup, sportId } = useAppSession();
  const metrics = useMobileDashboardMetrics(activeGroup?.id, sportId);
  const rows = metrics.derived.eloLeaderboard.slice(0, 50);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={{ color: colors.primary, fontWeight: '600', marginBottom: 8 }}>← Back</Text>
        </Pressable>
        <Text style={styles.headerTitle}>ELO Leaderboard</Text>
        <Text style={styles.headerSubtitle}>{metrics.sport?.name || sportId} rankings</Text>
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
        {rows.length ? (
          <View style={styles.card}>
            {rows.map((row, index) => (
              <View
                key={String(row.name || index)}
                style={[styles.listRow, index === rows.length - 1 && styles.listRowLast]}
              >
                <Text style={styles.listIcon}>{index + 1}</Text>
                <View style={styles.listCopy}>
                  <Text style={styles.listTitle}>{String(row.name || 'Player')}</Text>
                  <Text style={styles.listSubtitle}>
                    {Number(row.rating || 1000)} pts · {Number(row.matchesPlayed || 0)} matches
                  </Text>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.emptyText}>ELO rankings appear after scored matches.</Text>
        )}
      </ScrollView>
    </View>
  );
}
