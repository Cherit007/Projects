import { pickleballSport } from '../pickleball.config.js';
import { createPairSportPlugin } from '../createPairSportPlugin.js';
import { validatePickleballMatchScore } from './pickleballScoring.js';
import { calculatePickleballPlayerStats } from './PickleballStatsEngine.js';
import { calculatePickleballStandings } from './PickleballRankingEngine.js';
import {
  generatePickleballReport,
  listPickleballReportTypes,
  PICKLEBALL_REPORT_CATALOG,
} from './PickleballReportEngine.js';

/** @type {import('../types.js').SportPlugin} */
export const PickleballPlugin = createPairSportPlugin(pickleballSport, {
  validateMatchScore: validatePickleballMatchScore,
  calculatePlayerStats: calculatePickleballPlayerStats,
  calculateStandings: calculatePickleballStandings,
  listReportTypes: listPickleballReportTypes,
  generateReport: generatePickleballReport,
});

export { PICKLEBALL_REPORT_CATALOG } from './PickleballReportEngine.js';
