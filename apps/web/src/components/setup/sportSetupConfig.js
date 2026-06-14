import {
  DEFAULT_SPORT_ID,
  getSport,
  listSports,
} from '@fixture-maker/domain/sports';

export { DEFAULT_SPORT_ID };

export const TOURNAMENT_NAME_PLACEHOLDER = 'e.g., Spring League 2026';

export const SPORT_CATALOG = listSports().map((sport) => ({
  id: sport.id,
  label: sport.name,
  icon: sport.icon,
  available: sport.available,
  badge: sport.badge,
}));

const toSetupConfig = (sport) => ({
  sportId: sport.id,
  gameModes: sport.gameModes,
  formats: sport.formats,
  matchesPerPair: sport.matchesPerPair,
  formatHints: sport.formatHints,
  gameModeLabels: sport.gameModeLabels,
  formatLabels: sport.formatLabels,
});

export const getSportSetupConfig = (sportId = DEFAULT_SPORT_ID) => (
  toSetupConfig(getSport(sportId))
);

export const getSportMeta = (sportId = DEFAULT_SPORT_ID) => {
  const sport = getSport(sportId);
  return {
    id: sport.id,
    label: sport.name,
    icon: sport.icon,
    available: sport.available,
    badge: sport.badge,
  };
};

export const getFormatHint = (sportId, tournamentFormat) => {
  const sport = getSport(sportId);
  return sport.formatHints[tournamentFormat] || sport.formatHints.league;
};

export const getGameModeLabel = (sportId, gameMode) => {
  const sport = getSport(sportId);
  return sport.gameModeLabels[gameMode] || sport.gameModeLabels.doubles || sport.gameModeLabels.team;
};

export const getFormatLabel = (sportId, tournamentFormat) => {
  const sport = getSport(sportId);
  return sport.formatLabels[tournamentFormat] || sport.formatLabels.league;
};

export const getTeamCountHint = (tournamentFormat) => {
  if (tournamentFormat === 'league') return 'Min 3 · Max 12 teams';
  if (tournamentFormat === 'knockoutByes') return 'Min 3 · Max 16 teams';
  return 'Fixed for this format';
};

export const isTeamCountEditable = (tournamentFormat) => (
  tournamentFormat === 'league' || tournamentFormat === 'knockoutByes'
);
