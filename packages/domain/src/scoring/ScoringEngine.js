import { calculatePointsTable } from './StandingsCalculator.js';
import {
  calculateNewElo,
  getPlayerLeaderboard,
  updatePlayerRatingsAfterMatch,
} from './EloCalculator.js';
import { BADMINTON_SCORING_CONFIG, resolveScoringConfig } from './scoringConfig.js';

export const ScoringEngine = {
  config: BADMINTON_SCORING_CONFIG,
  calculatePointsTable: (teams, fixtures, config) => (
    calculatePointsTable(teams, fixtures, resolveScoringConfig({ ...ScoringEngine.config, ...config }))
  ),
  calculateNewElo: (currentRating, opponentRating, actualScore, config) => (
    calculateNewElo(currentRating, opponentRating, actualScore, resolveScoringConfig({ ...ScoringEngine.config, ...config }))
  ),
  updatePlayerRatingsAfterMatch: (playerRatings, match, config) => (
    updatePlayerRatingsAfterMatch(playerRatings, match, resolveScoringConfig({ ...ScoringEngine.config, ...config }))
  ),
  getPlayerLeaderboard,
};

export {
  calculatePointsTable,
  calculateNewElo,
  getPlayerLeaderboard,
  updatePlayerRatingsAfterMatch,
};
