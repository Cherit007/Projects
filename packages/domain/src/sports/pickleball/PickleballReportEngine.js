import { calculatePickleballPlayerStats } from './PickleballStatsEngine.js';
import {
  createGenerateReport,
  createListReportTypes,
  findReportTypeDefinition,
} from '../reportTypes.js';

/** @type {import('../reportTypes.js').SportReportTypeDefinition[]} */
export const PICKLEBALL_REPORT_CATALOG = [
  { id: 'topPlayers', label: 'Top players', description: 'Most match wins' },
  { id: 'mostAces', label: 'Most aces', description: 'Total aces in completed matches' },
  { id: 'bestServiceEfficiency', label: 'Best service efficiency', description: 'Service wins vs faults' },
  { id: 'longestMatch', label: 'Longest match', description: 'Highest combined point total' },
];

export const listPickleballReportTypes = createListReportTypes(PICKLEBALL_REPORT_CATALOG);

const serviceEfficiency = (player) => {
  const wins = Number(player?.serviceWins || 0);
  const faults = Number(player?.serviceFaults || 0);
  const attempts = wins + faults;
  if (attempts <= 0) return 0;
  return wins / attempts;
};

const buildRowsFromPlayers = (players, valueFn, formatValue) => (
  players.slice(0, 5).map((player, index) => ({
    rank: index + 1,
    label: player.name,
    value: formatValue(valueFn(player), player),
    detail: player.team ? String(player.team) : undefined,
  }))
);

/** @returns {import('../reportTypes.js').SportReportResult|null} */
const generatePickleballReportByType = (reportType, context) => {
  const teams = Array.isArray(context?.teams) ? context.teams : [];
  const fixtures = Array.isArray(context?.fixtures) ? context.fixtures : [];
  const definition = findReportTypeDefinition(reportType, PICKLEBALL_REPORT_CATALOG);
  if (!definition) return null;

  if (reportType === 'longestMatch') {
    const completed = fixtures.filter((match) => match?.completed);
    if (completed.length === 0) {
      return {
        type: reportType,
        title: definition.label,
        summary: 'Complete a match to generate this report.',
        rows: [],
      };
    }
    const longest = completed.reduce((best, match) => {
      const total = Number(match.score1 || 0) + Number(match.score2 || 0);
      if (!best || total > best.total) {
        return {
          total,
          label: `${match.team1?.name || 'Team 1'} vs ${match.team2?.name || 'Team 2'}`,
          detail: `${match.score1}-${match.score2}`,
        };
      }
      return best;
    }, null);
    return {
      type: reportType,
      title: definition.label,
      summary: `${longest.total} combined points`,
      rows: [{
        rank: 1,
        label: longest.label,
        value: String(longest.total),
        detail: longest.detail,
      }],
    };
  }

  const playerStats = calculatePickleballPlayerStats(teams, fixtures);
  if (playerStats.length === 0) {
    return {
      type: reportType,
      title: definition.label,
      summary: 'Complete matches to populate player reports.',
      rows: [],
    };
  }

  if (reportType === 'topPlayers') {
    const ranked = [...playerStats].sort((a, b) => {
      if (b.matchesWon !== a.matchesWon) return b.matchesWon - a.matchesWon;
      return Number(b.winPercentage || 0) - Number(a.winPercentage || 0);
    });
    return {
      type: reportType,
      title: definition.label,
      summary: 'Ranked by match wins',
      rows: buildRowsFromPlayers(ranked, (p) => p.matchesWon, (value) => `${value} wins`),
    };
  }

  if (reportType === 'mostAces') {
    const ranked = [...playerStats].sort((a, b) => Number(b.aces || 0) - Number(a.aces || 0));
    return {
      type: reportType,
      title: definition.label,
      summary: 'Players with recorded aces',
      rows: buildRowsFromPlayers(ranked, (p) => Number(p.aces || 0), (value) => `${value} aces`),
    };
  }

  if (reportType === 'bestServiceEfficiency') {
    const ranked = [...playerStats]
      .filter((player) => Number(player.serviceWins || 0) + Number(player.serviceFaults || 0) > 0)
      .sort((a, b) => serviceEfficiency(b) - serviceEfficiency(a));
    return {
      type: reportType,
      title: definition.label,
      summary: 'Service wins ÷ (wins + faults)',
      rows: buildRowsFromPlayers(
        ranked,
        serviceEfficiency,
        (value) => `${Math.round(value * 100)}%`,
      ),
    };
  }

  return null;
};

export const generatePickleballReport = createGenerateReport(
  PICKLEBALL_REPORT_CATALOG,
  generatePickleballReportByType,
);
