import { calculateCumulativePlayerStats, getPlayerLeaderboard } from './calculations';
import { deriveRatingsFromHistory } from './appHelpers';

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
} = {}) => {
  const scope = normalizeAnalyticsScope({ tournamentHistory, casualMatches });

  return {
    cumulativeAllTimeStats: calculateCumulativePlayerStats(scope),
    eloLeaderboard: filterLeaderboardRowsByRecordedMatches(
      getPlayerLeaderboard(playerRatings || {}),
      scope
    ),
  };
};
