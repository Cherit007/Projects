import React, { useMemo } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { listSports } from '@fixture-maker/domain/sports';
import { useAppSession } from '../context/AppSessionContext';
import { useMobileHomeData } from '../hooks/useMobileHomeData';
import { buildSportHubSummary } from '../utils/sportDataFilters';
import { getActiveLiveTournaments } from '../utils/liveTournaments';
import { setLastSportForGroup } from '../utils/activeSportStorage';
import { dashboardStyles as styles } from '../styles/dashboardStyles';
import type { RootStackParamList } from '../navigation/types';

export default function SportHubScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { activeGroup, setSportId } = useAppSession();
  const { tournamentHistory, casualMatches } = useMobileHomeData(activeGroup?.id);

  const sports = useMemo(() => listSports().filter((sport) => sport.available), []);

  const summaries = useMemo(() => {
    const live = getActiveLiveTournaments(
      tournamentHistory as Array<{ status?: string; champion?: unknown; fixtures?: Array<{ completed?: boolean }> }>,
    );
    return sports.map((sport) => buildSportHubSummary({
      sportId: sport.id,
      tournamentHistory: tournamentHistory as Array<{ sportId?: string; fixtures?: unknown[] }>,
      casualMatches: casualMatches as Array<{ sportId?: string }>,
      activeLiveTournaments: live,
    }));
  }, [casualMatches, sports, tournamentHistory]);

  const handleSelect = async (sportId: string) => {
    setSportId(sportId);
    await setLastSportForGroup(activeGroup?.id, sportId);
    navigation.goBack();
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={{ color: '#0f766e', fontWeight: '600', marginBottom: 8 }}>← Back</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Sport hub</Text>
        <Text style={styles.headerSubtitle}>
          Choose a sport workspace{activeGroup?.name ? ` for ${activeGroup.name}` : ''}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {sports.map((sport) => {
          const summary = summaries.find((entry) => entry.sportId === sport.id);
          return (
            <Pressable key={sport.id} style={styles.card} onPress={() => { void handleSelect(sport.id); }}>
              <View style={styles.listRow}>
                <Text style={styles.listIcon}>{sport.icon}</Text>
                <View style={styles.listCopy}>
                  <Text style={styles.listTitle}>{sport.name}</Text>
                  <Text style={styles.listSubtitle}>
                    {summary?.inProgressCount || 0} in progress · {summary?.completedTournaments || 0} done · {summary?.casualMatches || 0} casual
                  </Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
