import { boxCricketSport } from '../boxCricket.config.js';
import { createPairSportPlugin } from '../createPairSportPlugin.js';
import { validateBoxCricketMatchScore } from './boxCricketScoring.js';
import { calculateBoxCricketTeamStats } from './BoxCricketStatsEngine.js';
import { calculateBoxCricketStandings } from './BoxCricketRankingEngine.js';
import {
  generateBoxCricketReport,
  listBoxCricketReportTypes,
  BOX_CRICKET_REPORT_CATALOG,
} from './BoxCricketReportEngine.js';

/** @type {import('../types.js').SportPlugin} */
export const BoxCricketPlugin = createPairSportPlugin(boxCricketSport, {
  validateMatchScore: (score1, score2, ruleConfig, extras) => (
    validateBoxCricketMatchScore(score1, score2, ruleConfig, extras)
  ),
  calculatePlayerStats: calculateBoxCricketTeamStats,
  calculateStandings: calculateBoxCricketStandings,
  listReportTypes: listBoxCricketReportTypes,
  generateReport: generateBoxCricketReport,
});

export { BOX_CRICKET_REPORT_CATALOG } from './BoxCricketReportEngine.js';
