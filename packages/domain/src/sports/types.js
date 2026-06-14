/**
 * @typedef {Object} FixtureStrategy
 * @property {(teams: Array<Object>, options?: Object) => import('../../fixture/FixtureEngine.js').FixtureGenerationResult} generateFixturesByFormat
 */

/**
 * @typedef {Object} SportScoringStrategy
 * @property {(ruleConfig?: Object) => import('../../scoring/scoringConfig.js').ScoringConfig} resolveConfig
 * @property {(teams: Array<Object>, fixtures: Array<Object>, ruleConfig?: Object) => Array<Object>} calculatePointsTable
 * @property {(ratingA: number, ratingB: number, scoreA: number, ruleConfig?: Object) => number} calculateNewElo
 * @property {(playerRatings: Object, match: Object, ruleConfig?: Object) => Object} updatePlayerRatingsAfterMatch
 */

/**
 * @typedef {Object} SportStatsStrategy
 * @property {(...args: unknown[]) => unknown} calculatePlayerStats
 * @property {(...args: unknown[]) => unknown} calculateCumulativePlayerStats
 */

/**
 * @typedef {Object} SportRankingStrategy
 * @property {(teams: Array<Object>, fixtures: Array<Object>, ruleConfig?: Object) => Array<Object>} calculateStandings
 */

/**
 * @typedef {Object} SportReportStrategy
 * @property {() => string[]} listReportTypes
 * @property {(context: Object) => unknown} generateReport
 */

/**
 * @typedef {Object} SportPlugin
 * @property {string} id
 * @property {SportConfig} config
 * @property {FixtureStrategy} fixture
 * @property {SportScoringStrategy} scoring
 * @property {SportStatsStrategy} stats
 * @property {Object} predictions
 * @property {Object} narrative
 * @property {SportRankingStrategy} rankings
 * @property {SportReportStrategy} reports
 */

export {};
