import { calculatePlayerStats } from '../../stats/PlayerStatsCalculator.js';

export const PICKLEBALL_STAT_KEYS = [
  'aces',
  'serviceWins',
  'serviceFaults',
  'unforcedErrors',
  'forcedErrors',
  'longRalliesWon',
];

/** @returns {Record<string, number>} */
export const createEmptyPickleballTeamStats = () => ({
  aces: 0,
  serviceWins: 0,
  serviceFaults: 0,
  unforcedErrors: 0,
  forcedErrors: 0,
  longRalliesWon: 0,
});

/** @returns {{ team1: Record<string, number>, team2: Record<string, number> }} */
export const normalizePickleballMatchStatistics = (statistics) => {
  const empty = createEmptyPickleballTeamStats();
  const source = statistics && typeof statistics === 'object' ? statistics : {};
  const normalizeTeam = (teamStats) => {
    const normalized = { ...empty };
    PICKLEBALL_STAT_KEYS.forEach((key) => {
      const value = Number(teamStats?.[key]);
      if (Number.isFinite(value) && value >= 0) {
        normalized[key] = value;
      }
    });
    return normalized;
  };
  return {
    team1: normalizeTeam(source.team1),
    team2: normalizeTeam(source.team2),
  };
};

const distributeTeamStatsToPlayers = (playerStats, players, teamStats) => {
  players.filter(Boolean).forEach((player) => {
    if (!playerStats[player]) return;
    PICKLEBALL_STAT_KEYS.forEach((key) => {
      playerStats[player][key] = (playerStats[player][key] || 0) + (teamStats[key] || 0);
    });
  });
};

export const calculatePickleballPlayerStats = (teams, fixtures) => {
  const baseEntries = calculatePlayerStats(teams, fixtures);
  const playerStats = Object.fromEntries(
    baseEntries.map((entry) => [entry.name, { ...entry, ...createEmptyPickleballTeamStats() }]),
  );

  fixtures.forEach((match) => {
    if (!match?.completed) return;
    const { team1, team2 } = normalizePickleballMatchStatistics(match.statistics);
    const team1Players = [match.team1?.player || match.team1?.player1, match.team1?.player2].filter(Boolean);
    const team2Players = [match.team2?.player || match.team2?.player1, match.team2?.player2].filter(Boolean);
    distributeTeamStatsToPlayers(playerStats, team1Players, team1);
    distributeTeamStatsToPlayers(playerStats, team2Players, team2);
  });

  return Object.values(playerStats).sort((a, b) => {
    if (b.matchesWon !== a.matchesWon) return b.matchesWon - a.matchesWon;
    const aWinRate = Number(a.winPercentage || 0);
    const bWinRate = Number(b.winPercentage || 0);
    if (bWinRate !== aWinRate) return bWinRate - aWinRate;
    if (b.matchesPlayed !== a.matchesPlayed) return b.matchesPlayed - a.matchesPlayed;
    return String(a.name || '').localeCompare(String(b.name || ''));
  });
};
