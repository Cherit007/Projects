import React, { useMemo, useState } from 'react';
import {
  Alert,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useAppSession } from '../context/AppSessionContext';
import { useTournament } from '../context/TournamentContext';
import ScoreMatchModal from '../components/ScoreMatchModal';
import FixturesTab from '../components/tournament/FixturesTab';
import StatsTab from '../components/tournament/StatsTab';
import TableTab, { type PointsTableRow } from '../components/tournament/TableTab';
import TournamentSegmentTabs, { type TournamentSegment } from '../components/tournament/TournamentSegmentTabs';
import { useGroupStats } from '../hooks/useGroupStats';
import { findNextOpenFixture } from '../lib/tournamentDraft';
import type { FixtureMatch } from '../types/tournament';

export default function TournamentScreen() {
  const { sportId, activeGroup } = useAppSession();
  const {
    fixtures,
    pointsTable,
    activeTournament,
    tournamentName,
    tournamentFormat,
    saveMatchResult,
    loading,
  } = useTournament();
  const [selectedMatch, setSelectedMatch] = useState<FixtureMatch | null>(null);
  const [segment, setSegment] = useState<TournamentSegment>('fixtures');
  const groupStats = useGroupStats(activeGroup?.id, sportId);

  const nextMatch = useMemo(() => findNextOpenFixture(fixtures), [fixtures]);
  const completedCount = fixtures.filter((match) => match.completed).length;
  const showTable = tournamentFormat === 'league';

  const handleSaveScore = async (score1: string, score2: string) => {
    if (!selectedMatch) return;
    const result = await saveMatchResult(selectedMatch.id, score1, score2);
    if (!result.ok) {
      Alert.alert('Score', result.message || 'Could not save score.');
      return;
    }
    setSelectedMatch(null);
  };

  if (!activeTournament || fixtures.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyTitle}>No active tournament</Text>
        <Text style={styles.emptyBody}>
          Configure a tournament in Setup, add teams, then generate fixtures to start scoring.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{tournamentName || activeTournament.name}</Text>
      </View>

      <TournamentSegmentTabs
        active={segment}
        onChange={setSegment}
        showTable={showTable}
      />

      {segment === 'fixtures' ? (
        <FixturesTab
          fixtures={fixtures}
          loading={loading}
          completedCount={completedCount}
          nextMatch={nextMatch}
          onScoreNext={nextMatch ? () => setSelectedMatch(nextMatch) : undefined}
          onSelectMatch={setSelectedMatch}
        />
      ) : null}

      {segment === 'table' ? (
        <TableTab
          sportId={sportId}
          pointsTable={pointsTable as PointsTableRow[]}
        />
      ) : null}

      {segment === 'stats' ? (
        <StatsTab
          rows={groupStats.rows}
          tournamentCount={groupStats.tournamentCount}
          isLoading={groupStats.isLoading}
          isError={groupStats.isError}
          onRetry={() => { void groupStats.refetch(); }}
        />
      ) : null}

      <ScoreMatchModal
        visible={Boolean(selectedMatch)}
        match={selectedMatch}
        loading={loading}
        onClose={() => setSelectedMatch(null)}
        onSubmit={handleSaveScore}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  header: {
    marginBottom: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0f172a',
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#f8fafc',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
  },
  emptyBody: {
    marginTop: 8,
    color: '#64748b',
    lineHeight: 22,
  },
});
