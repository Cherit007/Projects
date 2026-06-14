import { useMemo } from 'react';
import { calculateCumulativePlayerStats } from '@fixture-maker/domain/stats';
import { resolveSportId } from '@fixture-maker/domain/sports';
import { useGroupCloudData } from './useGroupCloudData';

export type GroupStatRow = {
  name: string;
  matchesPlayed: number;
  matchesWon: number;
  winRate: number;
};

export const useGroupStats = (groupId: string | null | undefined, sportId: string) => {
  const { data: tournamentHistory = [], isLoading, isFetching, isError, refetch } = useGroupCloudData(groupId);
  const resolvedSportId = resolveSportId(sportId);

  const rows = useMemo(() => {
    const filteredHistory = tournamentHistory.filter((entry) => {
      const sport = (entry as { sportId?: string })?.sportId;
      return !sport || sport === resolvedSportId;
    });
    const statsArray = calculateCumulativePlayerStats(filteredHistory, []);
    return (Array.isArray(statsArray) ? statsArray : [])
      .map((entry) => ({
        name: String(entry?.name || '').trim(),
        matchesPlayed: Number(entry?.matchesPlayed || 0),
        matchesWon: Number(entry?.matchesWon || 0),
        winRate: Math.round(Number(entry?.winPercentage || 0)),
      }))
      .filter((entry) => entry.name && entry.matchesPlayed > 0);
  }, [resolvedSportId, tournamentHistory]);

  return {
    rows,
    tournamentCount: tournamentHistory.length,
    isLoading: isLoading && rows.length === 0,
    isFetching,
    isError,
    refetch,
  };
};
