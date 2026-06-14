import { calculateCumulativePlayerStats } from '@fixture-maker/domain/stats/CumulativeStatsCalculator.js';
import { listSports, resolveSportId } from '@fixture-maker/domain/sports';
import { listSquadPlayerNames } from '@fixture-maker/domain/sports/boxCricket/squadUtils';
import { filterBySport } from './sportDataFilters';
import { sportUsesEloRatings } from './sportFeatures';
import { deriveRatingsFromHistory } from './appHelpers';

const normalizePlayerKey = (value) => String(value || '').trim().toLowerCase();

export const getTeamPlayerNames = (team, match = null) => {
  if (match?.sportId === 'boxCricket' || team?.squad?.length) {
    const squadNames = listSquadPlayerNames(team);
    if (squadNames.length > 0) return squadNames;
  }
  return [team?.player || team?.player1, team?.player2].filter(Boolean);
};

const findPlayerStatsRow = (playerName, scope) => {
  const playerKey = normalizePlayerKey(playerName);
  if (!playerKey) return null;
  return calculateCumulativePlayerStats(scope).find(
    (entry) => normalizePlayerKey(entry?.name) === playerKey,
  ) || null;
};

export const buildPlayerStatsBySport = ({
  playerName,
  tournamentHistory = [],
  casualMatches = [],
  playerRatings = {},
} = {}) => {
  const playerKey = normalizePlayerKey(playerName);
  if (!playerKey) return {};

  return listSports().reduce((acc, sport) => {
    const scope = {
      tournamentHistory: filterBySport(tournamentHistory, sport.id),
      casualMatches: filterBySport(casualMatches, sport.id),
    };
    const statsRow = findPlayerStatsRow(playerName, scope);
    const matchesPlayed = Number(statsRow?.matchesPlayed || 0);
    const sportRatings = matchesPlayed > 0
      ? deriveRatingsFromHistory({
        history: scope.tournamentHistory,
        casual: scope.casualMatches,
      })
      : {};

    acc[sport.id] = {
      sportId: sport.id,
      sportName: sport.name,
      sportIcon: sport.icon,
      usesElo: sportUsesEloRatings(sport.id),
      stats: matchesPlayed > 0 ? statsRow : null,
      rating: matchesPlayed > 0
        ? (sportRatings[playerName]?.rating ?? playerRatings?.[playerName]?.rating ?? null)
        : null,
    };
    return acc;
  }, {});
};

export const listSportsWithPlayerActivity = (statsBySport = {}) => (
  listSports().filter((sport) => Number(statsBySport[sport.id]?.stats?.matchesPlayed || 0) > 0)
);

export const resolveDefaultPlayerSportId = ({
  defaultSportId,
  statsBySport = {},
} = {}) => {
  const resolvedDefault = resolveSportId(defaultSportId);
  const activeSports = listSportsWithPlayerActivity(statsBySport);
  if (activeSports.some((sport) => sport.id === resolvedDefault)) {
    return resolvedDefault;
  }
  return activeSports[0]?.id || resolvedDefault;
};

export const filterPlayerHistoryForSport = (entries = [], sportId) => {
  const target = resolveSportId(sportId);
  return (Array.isArray(entries) ? entries : []).filter((entry) => {
    if (!entry?.sportId) return target === 'badminton';
    return entry.sportId === target;
  });
};
