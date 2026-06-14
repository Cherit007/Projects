export { default as TournamentSetupForm } from './TournamentSetupForm.jsx';
export { default as SetupSelectionGrid } from './SetupSelectionGrid.jsx';
export {
  DEFAULT_SPORT_ID,
  SPORT_CATALOG,
  getSportSetupConfig,
  getSportMeta,
  getFormatHint,
  TOURNAMENT_NAME_PLACEHOLDER,
  getGameModeLabel,
  getFormatLabel,
  getTeamCountHint,
  isTeamCountEditable,
} from './sportSetupConfig.js';
export { applyTournamentFormatChange } from './tournamentSetupUtils.js';
export {
  DEFAULT_SPORT_ID as DOMAIN_DEFAULT_SPORT_ID,
  getSport,
  listSports,
  getSportScoringConfig,
  getSportPlugin,
} from '@fixture-maker/domain/sports/index.js';
