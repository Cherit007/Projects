import { DEFAULT_SPORT_ID, resolveSportId } from './sportId.js';

const squadSize = (team) => (
  Array.isArray(team?.squad) ? team.squad.filter((player) => player?.id || player?.name).length : 0
);

/** Infer sport from casual match payload when top-level sportId is missing (legacy saves). */
export const inferCasualMatchSportId = (match) => {
  const statistics = match?.statistics;
  if (statistics?.sportId === 'boxCricket') return 'boxCricket';
  if (match?.matchType === 'team') return 'boxCricket';

  const explicit = String(match?.sportId || '').trim();
  if (explicit) return resolveSportId(explicit);

  if (statistics?.format === 'casualSeries' || statistics?.series?.games?.length) {
    return 'boxCricket';
  }

  if (Array.isArray(statistics?.innings) && statistics.innings.length > 0) {
    if (squadSize(match?.team1) > 0 || squadSize(match?.team2) > 0) return 'boxCricket';
  }

  return DEFAULT_SPORT_ID;
};

export const isBoxCricketCasualMatch = (match) => (
  inferCasualMatchSportId(match) === 'boxCricket'
);
