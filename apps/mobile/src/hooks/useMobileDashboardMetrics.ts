import { useMemo } from 'react';
import { getSport } from '@fixture-maker/domain/sports';
import { filterBySport } from '../utils/sportDataFilters';
import { getActiveLiveTournaments, getCompletedTournamentRows } from '../utils/liveTournaments';
import {
  buildDashboardDerivedData,
  formatCasualScoreLine,
  formatCasualTeam,
  getTopEloPlayer,
} from '../utils/dashboardMetrics';
import { sportUsesEloRatings } from '../utils/sportFeatures';
import { useMobileHomeData } from './useMobileHomeData';

export const useMobileDashboardMetrics = (groupId: string | null | undefined, sportId: string) => {
  const { tournamentHistory, casualMatches, isLoading, refetchAll } = useMobileHomeData(groupId);
  const sport = getSport(sportId);

  const sportHistory = useMemo(
    () => filterBySport(tournamentHistory as Array<{ sportId?: string }>, sportId),
    [sportId, tournamentHistory],
  );

  const sportCasual = useMemo(
    () => filterBySport(casualMatches as Array<{ sportId?: string }>, sportId),
    [casualMatches, sportId],
  );

  const activeLiveTournaments = useMemo(
    () => getActiveLiveTournaments(sportHistory),
    [sportHistory],
  );

  const completedTournaments = useMemo(
    () => getCompletedTournamentRows(sportHistory),
    [sportHistory],
  );

  const derived = useMemo(
    () => buildDashboardDerivedData({
      tournamentHistory: sportHistory,
      casualMatches: sportCasual,
      sportId,
    }),
    [sportCasual, sportHistory, sportId],
  );

  const topEloPlayer = useMemo(
    () => getTopEloPlayer(derived.eloLeaderboard),
    [derived.eloLeaderboard],
  );

  const statsPreviewRows = useMemo(
    () => (Array.isArray(derived.cumulativeAllTimeStats) ? derived.cumulativeAllTimeStats : [])
      .slice(0, 5)
      .map((row) => ({
        name: String((row as { name?: string })?.name || ''),
        matchesPlayed: Number((row as { matchesPlayed?: number })?.matchesPlayed || 0),
        matchesWon: Number((row as { matchesWon?: number })?.matchesWon || 0),
        winRate: Math.round(Number((row as { winPercentage?: number })?.winPercentage || 0)),
      }))
      .filter((row) => row.name),
    [derived.cumulativeAllTimeStats],
  );

  const liveInProgressCards = useMemo(() => (
    activeLiveTournaments.map((tournament) => {
      const fixtures = Array.isArray(tournament.fixtures) ? tournament.fixtures : [];
      const completed = fixtures.filter((match) => match?.completed).length;
      return {
        id: String(tournament.id || tournament.appwriteId || tournament.name),
        title: String(tournament.name || 'Live tournament'),
        subtitle: `${completed}/${fixtures.length} scored`,
        tournament,
      };
    })
  ), [activeLiveTournaments]);

  const liveCompletedRows = useMemo(() => {
    const tournamentRows = completedTournaments.slice(0, 20).map((tournament) => ({
      id: `t-${String(tournament.id || tournament.appwriteId || tournament.name)}`,
      kind: 'tournament' as const,
      title: String(tournament.name || 'Tournament'),
      subtitle: tournament.champion ? `Champion: ${String(tournament.champion)}` : 'Completed',
      tournament,
    }));

    const casualRows = sportCasual.slice(0, 20).map((match, index) => {
      const row = match as {
        id?: string;
        appwriteId?: string;
        team1?: Record<string, unknown>;
        team2?: Record<string, unknown>;
        score1?: number;
        score2?: number;
        date?: string;
      };
      return {
        id: `c-${String(row.id || row.appwriteId || index)}`,
        kind: 'casual' as const,
        title: `${formatCasualTeam(row.team1)} vs ${formatCasualTeam(row.team2)}`,
        subtitle: formatCasualScoreLine(row),
        match: row,
      };
    });

    return [...tournamentRows, ...casualRows].slice(0, 30);
  }, [completedTournaments, sportCasual]);

  const mobileStatsCards = useMemo(() => [
    {
      icon: '🏸',
      label: 'Matches',
      value: String(statsPreviewRows.reduce((sum, row) => sum + row.matchesPlayed, 0) || sportCasual.length),
    },
    {
      icon: '🏆',
      label: 'Tournaments',
      value: String(completedTournaments.length),
    },
    {
      icon: '⚡',
      label: 'Live',
      value: String(activeLiveTournaments.length),
    },
    {
      icon: '🎯',
      label: 'Casual',
      value: String(sportCasual.length),
    },
  ], [activeLiveTournaments.length, completedTournaments.length, sportCasual.length, statsPreviewRows]);

  return {
    sport,
    sportHistory,
    sportCasual,
    activeLiveTournaments,
    completedTournaments,
    derived,
    topEloPlayer,
    statsPreviewRows,
    liveInProgressCards,
    liveCompletedRows,
    mobileStatsCards,
    hideEloFeatures: !sportUsesEloRatings(sportId),
    isLoading,
    refetchAll,
    tournamentHistory,
    casualMatches,
  };
};
