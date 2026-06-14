import { badmintonSport } from '../badminton.config.js';
import { createPairSportPlugin, validateBasicMatchScore } from '../createPairSportPlugin.js';
import {
  generateBadmintonReport,
  listBadmintonReportTypes,
} from './BadmintonReportEngine.js';

/** @type {import('../types.js').SportPlugin} */
export const BadmintonPlugin = createPairSportPlugin(badmintonSport, {
  validateMatchScore: validateBasicMatchScore,
  listReportTypes: listBadmintonReportTypes,
  generateReport: generateBadmintonReport,
});
