export { badmintonSport } from './badminton.config.js';
export { pickleballSport } from './pickleball.config.js';
export { boxCricketSport } from './boxCricket.config.js';
export { DEFAULT_SPORT_ID, resolveSportId } from './sportId.js';
export { parseRuleConfig, serializeRuleConfig } from './ruleConfig.js';
export { serializeMatchStatistics, parseMatchStatistics } from './matchStatistics.js';
export { BadmintonPlugin } from './badminton/BadmintonPlugin.js';
export { PickleballPlugin } from './pickleball/PickleballPlugin.js';
export { BoxCricketPlugin } from './boxCricket/BoxCricketPlugin.js';

import { badmintonSport } from './badminton.config.js';
import { pickleballSport } from './pickleball.config.js';
import { boxCricketSport } from './boxCricket.config.js';
import { BadmintonPlugin } from './badminton/BadmintonPlugin.js';
import { PickleballPlugin } from './pickleball/PickleballPlugin.js';
import { BoxCricketPlugin } from './boxCricket/BoxCricketPlugin.js';
import { resolveSportId } from './sportId.js';

/** @type {Record<string, import('./types.js').SportConfig>} */
const SPORTS_BY_ID = {
  [badmintonSport.id]: badmintonSport,
  [pickleballSport.id]: pickleballSport,
  [boxCricketSport.id]: boxCricketSport,
};

/** @type {Record<string, import('./types.js').SportPlugin>} */
const PLUGINS_BY_ID = {
  [badmintonSport.id]: BadmintonPlugin,
  [pickleballSport.id]: PickleballPlugin,
  [boxCricketSport.id]: BoxCricketPlugin,
};

/** @param {string} [sportId] @returns {import('./types.js').SportConfig} */
export const getSport = (sportId) => (
  SPORTS_BY_ID[resolveSportId(sportId)] || badmintonSport
);

/** @returns {import('./types.js').SportConfig[]} */
export const listSports = () => Object.values(SPORTS_BY_ID);

/** @param {string} [sportId] @returns {import('./types.js').SportScoringConfig} */
export const getSportScoringConfig = (sportId) => getSport(sportId).scoring;

/** @returns {import('./types.js').SportPlugin[]} */
export const listSportPlugins = () => Object.values(PLUGINS_BY_ID);

/** @returns {Array<{ sportId: string, name: string, icon: string, available: boolean, participantModel: string, reportTypes: string[] }>} */
export const listSportPluginManifest = () => (
  listSports().map((sport) => ({
    sportId: sport.id,
    name: sport.name,
    icon: sport.icon,
    available: Boolean(sport.available),
    participantModel: sport.participantModel || 'pair',
    reportTypes: getSportPlugin(sport.id).reports.listReportTypes(),
  }))
);

/** @param {string} [sportId] @returns {import('./types.js').SportPlugin} */
export const getSportPlugin = (sportId) => (
  PLUGINS_BY_ID[resolveSportId(sportId)] || BadmintonPlugin
);
