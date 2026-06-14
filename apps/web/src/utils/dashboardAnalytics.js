import { calculateCumulativePlayerStats } from '@fixture-maker/domain/stats/CumulativeStatsCalculator.js';
import { getPlayerLeaderboard } from '@fixture-maker/domain/scoring/EloCalculator.js';
import { deriveRatingsFromHistory } from './appHelpers';
import { filterBySport } from './sportDataFilters';
import { sportUsesEloRatings } from './sportFeatures';

const normalizeName = (value) => String(value || '').trim().toLowerCase();

const normalizeAnalyticsScope = ({
  tournamentHistory = [],
  casualMatches = [],
} = {}) => ({
  tournamentHistory: Array.isArray(tournamentHistory) ? tournamentHistory : [],
  casualMatches: Array.isArray(casualMatches) ? casualMatches : [],
});

export const getRecordedPlayersSet = ({
  tournamentHistory = [],
  casualMatches = [],
} = {}) => {
  const scope = normalizeAnalyticsScope({ tournamentHistory, casualMatches });
  const recordedRatings = deriveRatingsFromHistory({
    history: scope.tournamentHistory,
    casual: scope.casualMatches,
  });

  return new Set(
    Object.keys(recordedRatings || {})
      .map((name) => normalizeName(name))
      .filter(Boolean)
  );
};

export const filterLeaderboardRowsByRecordedMatches = (rows = [], scope = {}) => {
  const list = Array.isArray(rows) ? rows : [];
  const normalizedScope = normalizeAnalyticsScope(scope);
  const recordedPlayers = getRecordedPlayersSet(normalizedScope);

  if (recordedPlayers.size === 0) {
    return list.filter((entry) => Number(entry?.matchesPlayed || 0) > 0);
  }

  return list.filter((entry) => recordedPlayers.has(normalizeName(entry?.name)));
};

export const buildDashboardDerivedData = ({
  tournamentHistory = [],
  casualMatches = [],
  playerRatings = {},
  sportId = null,
} = {}) => {
  const scope = normalizeAnalyticsScope({ tournamentHistory, casualMatches });
  const filteredScope = sportId
    ? {
      tournamentHistory: filterBySport(scope.tournamentHistory, sportId),
      casualMatches: filterBySport(scope.casualMatches, sportId),
    }
    : scope;

  const effectiveRatings = sportId
    ? deriveRatingsFromHistory({
      history: filteredScope.tournamentHistory,
      casual: filteredScope.casualMatches,
    })
    : (playerRatings || {});

  const eloLeaderboard = sportUsesEloRatings(sportId)
    ? filterLeaderboardRowsByRecordedMatches(
      getPlayerLeaderboard(effectiveRatings),
      filteredScope,
    )
    : [];

  return {
    cumulativeAllTimeStats: calculateCumulativePlayerStats(filteredScope),
    eloLeaderboard,
  };
};
