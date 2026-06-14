import { generateFixtures } from './RoundRobinScheduler.js';
import { generateKnockoutBracket } from './KnockoutScheduler.js';

const KNOCKOUT_FORMATS = new Set([
  'knockoutByes',
  'playInFinal',
  'semiFinal',
  'fullKnockout',
]);

const isLeagueFormat = (tournamentFormat, format) => {
  if (tournamentFormat === 'league') return true;
  if (tournamentFormat === 'knockout' || KNOCKOUT_FORMATS.has(tournamentFormat)) return false;
  const resolved = format ?? tournamentFormat ?? '';
  return /^\d+$/.test(String(resolved));
};

/**
 * @typedef {Object} FixtureGenerationResult
 * @property {'league' | 'knockout'} kind
 * @property {Array<Object>|undefined} fixtures
 * @property {Array<Array<Object>>|undefined} bracket
 */

/**
 * Dispatch fixture generation by tournament format.
 * @param {Array<Object>} teams
 * @param {{ tournamentFormat?: string, format?: string }} options
 * @returns {FixtureGenerationResult}
 */
export const generateFixturesByFormat = (teams, { tournamentFormat, format } = {}) => {
  const resolvedFormat = format ?? tournamentFormat ?? '1';

  if (isLeagueFormat(tournamentFormat, resolvedFormat)) {
    return {
      kind: 'league',
      fixtures: generateFixtures(teams, resolvedFormat),
    };
  }

  return {
    kind: 'knockout',
    bracket: generateKnockoutBracket(teams, resolvedFormat),
  };
};

export const FixtureEngine = {
  generateLeagueFixtures: generateFixtures,
  generateKnockoutBracket,
  generateFixturesByFormat,
};
