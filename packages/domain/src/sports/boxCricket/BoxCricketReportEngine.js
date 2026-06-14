import { calculateBoxCricketTeamStats } from './BoxCricketStatsEngine.js';
import { calculateBoxCricketStandings } from './BoxCricketRankingEngine.js';
import {
  createGenerateReport,
  createListReportTypes,
  findReportTypeDefinition,
} from '../reportTypes.js';

/** @type {import('../reportTypes.js').SportReportTypeDefinition[]} */
export const BOX_CRICKET_REPORT_CATALOG = [
  { id: 'topRunScorers', label: 'Top run scorers', description: 'Teams by runs scored' },
  { id: 'bestNRR', label: 'Best net run rate', description: 'League NRR leaders' },
  { id: 'highestTeamScore', label: 'Highest innings', description: 'Biggest team total in a match' },
];

export const listBoxCricketReportTypes = createListReportTypes(BOX_CRICKET_REPORT_CATALOG);

/** @returns {import('../reportTypes.js').SportReportResult|null} */
const generateBoxCricketReportByType = (reportType, context) => {
  const teams = Array.isArray(context?.teams) ? context.teams : [];
  const fixtures = Array.isArray(context?.fixtures) ? context.fixtures : [];
  const ruleConfig = context?.ruleConfig || {};
  const definition = findReportTypeDefinition(reportType, BOX_CRICKET_REPORT_CATALOG);
  if (!definition) return null;

  const completed = fixtures.filter((match) => match?.completed);

  if (reportType === 'highestTeamScore') {
    if (completed.length === 0) {
      return {
        type: reportType,
        title: definition.label,
        summary: 'Complete a match to generate this report.',
        rows: [],
      };
    }
    let best = null;
    completed.forEach((match) => {
      [
        { team: match.team1?.name, runs: Number(match.score1) },
        { team: match.team2?.name, runs: Number(match.score2) },
      ].forEach((entry) => {
        if (!Number.isFinite(entry.runs)) return;
        if (!best || entry.runs > best.runs) {
          best = { label: entry.team || 'Team', value: entry.runs };
        }
      });
    });
    return {
      type: reportType,
      title: definition.label,
      summary: 'Highest team total in a single innings',
      rows: best ? [{ rank: 1, label: best.label, value: `${best.value} runs` }] : [],
    };
  }

  const teamStats = calculateBoxCricketTeamStats(teams, fixtures);
  if (teamStats.length === 0 || completed.length === 0) {
    return {
      type: reportType,
      title: definition.label,
      summary: 'Complete matches to populate team reports.',
      rows: [],
    };
  }

  if (reportType === 'topRunScorers') {
    const ranked = [...teamStats].sort((a, b) => Number(b.totalScored || 0) - Number(a.totalScored || 0));
    return {
      type: reportType,
      title: definition.label,
      summary: 'Total runs scored across the league',
      rows: ranked.slice(0, 5).map((team, index) => ({
        rank: index + 1,
        label: team.name,
        value: `${team.totalScored} runs`,
        detail: `${team.matchesWon} wins`,
      })),
    };
  }

  if (reportType === 'bestNRR') {
    const standings = calculateBoxCricketStandings(teams, fixtures, ruleConfig);
    const ranked = [...standings].sort((a, b) => Number(b.netRunRate || 0) - Number(a.netRunRate || 0));
    return {
      type: reportType,
      title: definition.label,
      summary: 'Net run rate after completed matches',
      rows: ranked.slice(0, 5).map((team, index) => ({
        rank: index + 1,
        label: team.name,
        value: Number(team.netRunRate || 0).toFixed(3),
        detail: `${team.won} wins`,
      })),
    };
  }

  return null;
};

export const generateBoxCricketReport = createGenerateReport(
  BOX_CRICKET_REPORT_CATALOG,
  generateBoxCricketReportByType,
);
