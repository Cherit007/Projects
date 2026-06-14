import { FixtureEngine } from '../fixture/index.js';
import {
  calculateNewElo,
  calculatePointsTable,
  resolveScoringConfig,
  updatePlayerRatingsAfterMatch,
} from '../scoring/index.js';
import { calculatePlayerStats, calculateCumulativePlayerStats } from '../stats/index.js';
import { predictMatchOutcome, getUpsetAlert } from '../predictions/index.js';
import { buildAiMatchSummary, detectNewlyUnlockedBadges } from '../narrative/index.js';
import { parseRuleConfig } from './ruleConfig.js';

/**
 * @param {import('./types.js').SportConfig} sportConfig
 * @param {{ validateMatchScore?: Function, calculatePlayerStats?: Function, calculateCumulativePlayerStats?: Function, calculateStandings?: Function }} [options]
 * @returns {import('./types.js').SportPlugin}
 */
export const createPairSportPlugin = (sportConfig, options = {}) => {
  const resolveScoringConfigForSport = (ruleConfig) => (
    resolveScoringConfig({
      ...sportConfig.scoring,
      ...parseRuleConfig(ruleConfig),
    })
  );

  const plugin = {
    id: sportConfig.id,
    config: sportConfig,
    fixture: {
      generateFixturesByFormat: (teams, formatOptions) => (
        FixtureEngine.generateFixturesByFormat(teams, formatOptions)
      ),
    },
    scoring: {
      resolveConfig: resolveScoringConfigForSport,
      calculatePointsTable: (teams, fixtures, ruleConfig) => (
        calculatePointsTable(teams, fixtures, resolveScoringConfigForSport(ruleConfig))
      ),
      calculateNewElo: (ratingA, ratingB, scoreA, ruleConfig) => (
        calculateNewElo(ratingA, ratingB, scoreA, resolveScoringConfigForSport(ruleConfig))
      ),
      updatePlayerRatingsAfterMatch: (playerRatings, match, ruleConfig) => (
        updatePlayerRatingsAfterMatch(
          playerRatings,
          match,
          resolveScoringConfigForSport(ruleConfig),
        )
      ),
      ...(options.validateMatchScore
        ? { validateMatchScore: options.validateMatchScore }
        : {}),
    },
    stats: {
      calculatePlayerStats: options.calculatePlayerStats || calculatePlayerStats,
      calculateCumulativePlayerStats: options.calculateCumulativePlayerStats || calculateCumulativePlayerStats,
    },
    predictions: {
      predictMatchOutcome,
      getUpsetAlert,
    },
    narrative: {
      buildAiMatchSummary,
      detectNewlyUnlockedBadges,
    },
    rankings: {
      calculateStandings: options.calculateStandings || ((teams, fixtures, ruleConfig) => (
        calculatePointsTable(teams, fixtures, resolveScoringConfigForSport(ruleConfig))
      )),
    },
    reports: {
      listReportTypes: options.listReportTypes || (() => []),
      generateReport: options.generateReport || (() => null),
    },
  };

  return plugin;
};

/** @returns {{ valid: boolean, message?: string }} */
export const validateBasicMatchScore = (score1, score2) => {
  if (score1 === '' || score2 === '' || score1 === score2) {
    return { valid: false, message: 'Invalid scores' };
  }
  return { valid: true };
};
