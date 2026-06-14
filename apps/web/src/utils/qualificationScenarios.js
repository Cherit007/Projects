import { BADMINTON_SCORING_CONFIG } from '@fixture-maker/domain/scoring/scoringConfig.js';

const POINTS_PER_WIN = BADMINTON_SCORING_CONFIG.pointsPerWin;
const DEFAULT_MAX_MARGIN = 99;

const sameId = (left, right) => String(left ?? '') === String(right ?? '');

const asNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const plural = (value, singular, pluralLabel = `${singular}s`) => (
  Math.abs(Number(value)) === 1 ? singular : pluralLabel
);

export const sortStandingsRows = (rows = []) => rows.slice().sort((a, b) => {
  if (asNumber(b.points) !== asNumber(a.points)) return asNumber(b.points) - asNumber(a.points);
  if (asNumber(b.netMatchRate) !== asNumber(a.netMatchRate)) return asNumber(b.netMatchRate) - asNumber(a.netMatchRate);
  if (asNumber(b.scoreDiff) !== asNumber(a.scoreDiff)) return asNumber(b.scoreDiff) - asNumber(a.scoreDiff);
  return String(a.name || '').localeCompare(String(b.name || ''));
});

const getTeamRank = (teamId, standings = []) => (
  standings.findIndex((team) => sameId(team?.id, teamId)) + 1
);

const matchHasTeam = (match, teamId) => (
  sameId(match?.team1?.id, teamId) || sameId(match?.team2?.id, teamId)
);

const getRemainingMatchesForTeam = (teamId, matches = []) => (
  matches.filter((match) => !match?.completed && matchHasTeam(match, teamId))
);

const getTeamMaxPoints = (team, remainingMatches = []) => (
  asNumber(team?.points) + (getRemainingMatchesForTeam(team?.id, remainingMatches).length * POINTS_PER_WIN)
);

export const getTeamQualificationStatus = ({
  team,
  standings = [],
  remainingMatches = [],
  rank = getTeamRank(team?.id, standings),
}) => {
  if (!team || standings.length < 2) {
    return {
      label: 'Waiting',
      tone: 'pending',
      detail: 'Table will settle after results',
      rank,
    };
  }

  const teamId = team.id;
  const teamPoints = asNumber(team.points);
  const maxPoints = getTeamMaxPoints(team, remainingMatches);
  const teamsAboveMax = standings.filter((otherTeam) => (
    !sameId(otherTeam?.id, teamId) && asNumber(otherTeam?.points) > maxPoints
  ));
  const teamsThatCanStillCatch = standings.filter((otherTeam) => (
    !sameId(otherTeam?.id, teamId)
    && getTeamMaxPoints(otherTeam, remainingMatches) >= teamPoints
  ));

  if (teamsAboveMax.length >= 2) {
    return {
      label: 'Out',
      tone: 'out',
      detail: 'Cannot reach Top 2 on league points',
      rank,
      maxPoints,
    };
  }

  if (teamsThatCanStillCatch.length <= 1) {
    return {
      label: 'Qualified',
      tone: 'qualified',
      detail: 'Top 2 locked on league points',
      rank,
      maxPoints,
    };
  }

  if (rank > 0 && rank <= 2) {
    return {
      label: 'Not safe yet',
      tone: 'watch',
      detail: 'Currently Top 2, not qualified yet',
      rank,
      maxPoints,
    };
  }

  return {
    label: 'Not qualified',
    tone: 'pending',
    detail: 'Needs points or tie-break help',
    rank,
    maxPoints,
  };
};

const applyMatchScore = (standings, currentMatch, score1, score2) => {
  const parsedScore1 = asNumber(score1, Number.NaN);
  const parsedScore2 = asNumber(score2, Number.NaN);
  if (!Number.isFinite(parsedScore1) || !Number.isFinite(parsedScore2) || parsedScore1 === parsedScore2) {
    return [];
  }

  const table = standings.map((team) => ({ ...team }));
  const team1 = table.find((team) => sameId(team?.id, currentMatch?.team1?.id));
  const team2 = table.find((team) => sameId(team?.id, currentMatch?.team2?.id));
  if (!team1 || !team2) return [];

  team1.played = asNumber(team1.played) + 1;
  team2.played = asNumber(team2.played) + 1;
  team1.scoreFor = asNumber(team1.scoreFor) + parsedScore1;
  team1.scoreAgainst = asNumber(team1.scoreAgainst) + parsedScore2;
  team2.scoreFor = asNumber(team2.scoreFor) + parsedScore2;
  team2.scoreAgainst = asNumber(team2.scoreAgainst) + parsedScore1;

  const winner = parsedScore1 > parsedScore2 ? team1 : team2;
  const loser = parsedScore1 > parsedScore2 ? team2 : team1;
  winner.won = asNumber(winner.won) + 1;
  winner.points = asNumber(winner.points) + POINTS_PER_WIN;
  loser.lost = asNumber(loser.lost) + 1;

  [team1, team2].forEach((team) => {
    team.scoreDiff = asNumber(team.scoreFor) - asNumber(team.scoreAgainst);
    team.netMatchRate = team.played > 0 ? team.scoreDiff / team.played : 0;
  });

  return sortStandingsRows(table);
};

export const projectCurrentMatchWithMargin = ({
  standings = [],
  currentMatch,
  winnerId,
  margin,
}) => {
  const safeMargin = Math.abs(asNumber(margin));
  if (!currentMatch || safeMargin <= 0) return [];
  if (sameId(winnerId, currentMatch?.team1?.id)) {
    return applyMatchScore(standings, currentMatch, safeMargin, 0);
  }
  if (sameId(winnerId, currentMatch?.team2?.id)) {
    return applyMatchScore(standings, currentMatch, 0, safeMargin);
  }
  return [];
};

export const getMinWinningMarginForTopTwo = ({
  standings = [],
  currentMatch,
  teamId,
  maxMargin = DEFAULT_MAX_MARGIN,
}) => {
  for (let margin = 1; margin <= maxMargin; margin += 1) {
    const projected = projectCurrentMatchWithMargin({
      standings,
      currentMatch,
      winnerId: teamId,
      margin,
    });
    const projectedRank = getTeamRank(teamId, projected);
    if (projectedRank > 0 && projectedRank <= 2) return margin;
  }
  return null;
};

const buildIdleScenarioLine = ({
  team,
  standings,
  currentAndFutureMatches,
  minMargin,
  status,
}) => {
  const rank = getTeamRank(team?.id, standings);
  const secondPlacePoints = asNumber(standings[1]?.points, null);
  const leaguePointGap = secondPlacePoints === null
    ? 0
    : Math.max(0, secondPlacePoints - asNumber(team?.points));
  const rankCopy = rank > 0 ? `#${rank}` : 'unranked';
  const pointsCopy = `${asNumber(team?.points)} ${plural(team?.points, 'pt')}`;
  const futureMatchesForTeam = getRemainingMatchesForTeam(team?.id, currentAndFutureMatches).length;

  if (status.tone === 'out') {
    return `${team.name}: out of Top 2 reach on league points.`;
  }

  if (status.tone === 'qualified') {
    return `${team.name}: qualified; Top 2 is locked on league points.`;
  }

  if (rank > 0 && rank <= 2) {
    return `${team.name}: currently ${rankCopy} with ${pointsCopy}, not qualified yet; a win adds ${POINTS_PER_WIN} league ${plural(POINTS_PER_WIN, 'pt')}.`;
  }

  if (minMargin !== null) {
    const gapCopy = leaguePointGap > 0
      ? `needs ${leaguePointGap} league ${plural(leaguePointGap, 'pt')} and `
      : 'needs ';
    return `${team.name}: ${rankCopy} with ${pointsCopy}; ${gapCopy}a win by ${minMargin}+ to reach Top 2 now.`;
  }

  if (futureMatchesForTeam > 1) {
    return `${team.name}: ${rankCopy} with ${pointsCopy}; a win adds ${POINTS_PER_WIN} league ${plural(POINTS_PER_WIN, 'pt')}, but Top 2 needs later results too.`;
  }

  return `${team.name}: cannot reach Top 2 from this match.`;
};

const buildProjectedScenarioLine = ({
  team,
  projectedTable,
  nextMatches,
  projectedWinnerId,
  projectedMargin,
  minMargin,
}) => {
  const projectedRank = getTeamRank(team?.id, projectedTable);
  const projectedTeam = projectedTable.find((row) => sameId(row?.id, team?.id));
  const statusAfterMatch = getTeamQualificationStatus({
    team: projectedTeam,
    standings: projectedTable,
    remainingMatches: nextMatches,
    rank: projectedRank,
  });
  const wonProjection = sameId(projectedWinnerId, team?.id);

  if (statusAfterMatch.tone === 'out') {
    return `${team.name}: projected out of Top 2 reach on league points.`;
  }

  if (statusAfterMatch.tone === 'qualified') {
    return `${team.name}: projected qualified at #${projectedRank}.`;
  }

  if (projectedRank > 0 && projectedRank <= 2) {
    return `${team.name}: projected Top 2 (#${projectedRank}), not qualified yet.`;
  }

  if (wonProjection && minMargin !== null && projectedMargin < minMargin) {
    return `${team.name}: projected #${projectedRank}; needs a win by ${minMargin}+ to reach Top 2.`;
  }

  if (wonProjection) {
    return `${team.name}: win adds 2 league pts, but Top 2 needs later results too.`;
  }

  if (getRemainingMatchesForTeam(team?.id, nextMatches).length > 0) {
    return `${team.name}: projected #${projectedRank}; not qualified yet, needs later results.`;
  }

  return `${team.name}: projected #${projectedRank}; not qualified.`;
};

export const buildLiveTopTwoWatch = ({
  standings = [],
  currentMatch,
  nextMatches = [],
  score1 = '',
  score2 = '',
}) => {
  const currentAndFutureMatches = [currentMatch, ...nextMatches].filter(Boolean);
  const teams = [currentMatch?.team1, currentMatch?.team2].filter(Boolean);

  if (!currentMatch || teams.length < 2 || standings.length < 2) {
    return {
      headline: 'Enter scores to preview Top 2 movement',
      lines: ['Standings will update once the league table is available.'],
    };
  }

  const minMarginByTeamId = new Map(
    teams.map((team) => [
      String(team.id),
      getMinWinningMarginForTopTwo({
        standings,
        currentMatch,
        teamId: team.id,
      }),
    ])
  );

  const parsedScore1 = asNumber(score1, Number.NaN);
  const parsedScore2 = asNumber(score2, Number.NaN);
  const hasValidProjection = Number.isFinite(parsedScore1)
    && Number.isFinite(parsedScore2)
    && parsedScore1 !== parsedScore2;

  if (hasValidProjection) {
    const projectedTable = applyMatchScore(standings, currentMatch, parsedScore1, parsedScore2);
    const projectedWinnerId = parsedScore1 > parsedScore2 ? currentMatch.team1.id : currentMatch.team2.id;
    const projectedWinner = parsedScore1 > parsedScore2 ? currentMatch.team1 : currentMatch.team2;
    const projectedMargin = Math.abs(parsedScore1 - parsedScore2);
    const projectedWinnerRank = getTeamRank(projectedWinnerId, projectedTable);

    return {
      headline: projectedWinnerRank > 0
        ? `${projectedWinner.name} by ${projectedMargin} -> projected #${projectedWinnerRank}`
        : `${projectedWinner.name} by ${projectedMargin} -> standings update`,
      lines: teams.map((team) => buildProjectedScenarioLine({
        team,
        projectedTable,
        nextMatches,
        projectedWinnerId,
        projectedMargin,
        minMargin: minMarginByTeamId.get(String(team.id)),
      })),
    };
  }

  const statusesByTeamId = new Map(
    teams.map((team) => {
      const rank = getTeamRank(team.id, standings);
      return [String(team.id), getTeamQualificationStatus({
        team: standings.find((row) => sameId(row?.id, team.id)) || team,
        standings,
        remainingMatches: currentAndFutureMatches,
        rank,
      })];
    })
  );

  const allOut = teams.every((team) => statusesByTeamId.get(String(team.id))?.tone === 'out');

  return {
    headline: allOut
      ? 'Top 2 is out of reach on league points'
      : 'Win = 2 league pts; margin decides tie-breaks',
    lines: teams.map((team) => {
      const standingsTeam = standings.find((row) => sameId(row?.id, team.id)) || team;
      return buildIdleScenarioLine({
        team: standingsTeam,
        standings,
        currentAndFutureMatches,
        minMargin: minMarginByTeamId.get(String(team.id)),
        status: statusesByTeamId.get(String(team.id)),
      });
    }),
  };
};
