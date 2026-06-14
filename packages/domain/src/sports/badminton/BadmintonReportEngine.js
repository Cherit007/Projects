import { calculatePlayerStats } from '../../stats/PlayerStatsCalculator.js';
import {
  createGenerateReport,
  createListReportTypes,
  findReportTypeDefinition,
} from '../reportTypes.js';

/** @type {import('../reportTypes.js').SportReportTypeDefinition[]} */
export const BADMINTON_REPORT_CATALOG = [
  { id: 'topPlayers', label: 'Top players', description: 'Most match wins' },
  { id: 'mostPoints', label: 'Most points scored', description: 'Total points across matches' },
];

export const listBadmintonReportTypes = createListReportTypes(BADMINTON_REPORT_CATALOG);

/** @returns {import('../reportTypes.js').SportReportResult|null} */
const generateBadmintonReportByType = (reportType, context) => {
  const teams = Array.isArray(context?.teams) ? context.teams : [];
  const fixtures = Array.isArray(context?.fixtures) ? context.fixtures : [];
  const definition = findReportTypeDefinition(reportType, BADMINTON_REPORT_CATALOG);
  if (!definition) return null;

  const playerStats = calculatePlayerStats(teams, fixtures);
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
      rows: ranked.slice(0, 5).map((player, index) => ({
        rank: index + 1,
        label: player.name,
        value: `${player.matchesWon} wins`,
        detail: player.team ? String(player.team) : undefined,
      })),
    };
  }

  if (reportType === 'mostPoints') {
    const ranked = [...playerStats].sort((a, b) => Number(b.totalScored || 0) - Number(a.totalScored || 0));
    return {
      type: reportType,
      title: definition.label,
      summary: 'Total points scored in completed matches',
      rows: ranked.slice(0, 5).map((player, index) => ({
        rank: index + 1,
        label: player.name,
        value: `${player.totalScored} pts`,
        detail: player.team ? String(player.team) : undefined,
      })),
    };
  }

  return null;
};

export const generateBadmintonReport = createGenerateReport(
  BADMINTON_REPORT_CATALOG,
  generateBadmintonReportByType,
);
