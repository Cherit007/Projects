import { DEFAULT_SCORING_CONFIG } from '../scoring/scoringConfig.js';

const asNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const getTeamPlayers = (team) => [team?.player || team?.player1, team?.player2].filter(Boolean);

const getTeamSignature = (team) => getTeamPlayers(team).sort((a, b) => a.localeCompare(b)).join('|');

const getTeamAverageElo = (team, playerRatings = {}) => {
  const players = getTeamPlayers(team);
  const defaultRating = DEFAULT_SCORING_CONFIG.defaultRating;
  if (players.length === 0) return defaultRating;
  const total = players.reduce((sum, player) => sum + (playerRatings[player]?.rating || defaultRating), 0);
  return total / players.length;
};

const getPlayerRecentForm = (player, playerRatings = {}) => {
  const history = Array.isArray(playerRatings[player]?.history) ? playerRatings[player].history : [];
  const recent = history.slice(-5);
  if (recent.length === 0) return { winRate: 0.5, momentum: 0 };

  const wins = recent.filter(match => match.result === 'win').length;
  const momentum = recent.reduce((sum, match) => sum + asNumber(match.change), 0) / recent.length;
  return {
    winRate: wins / recent.length,
    momentum,
  };
};

const getTeamFormScore = (team, playerRatings = {}) => {
  const players = getTeamPlayers(team);
  if (players.length === 0) return 0;

  const aggregate = players.reduce((acc, player) => {
    const form = getPlayerRecentForm(player, playerRatings);
    return {
      winRate: acc.winRate + form.winRate,
      momentum: acc.momentum + form.momentum,
    };
  }, { winRate: 0, momentum: 0 });

  return {
    winRate: aggregate.winRate / players.length,
    momentum: aggregate.momentum / players.length,
  };
};

const collectHistoricalMatches = (tournamentHistory = [], casualMatches = []) => {
  const matches = [];

  tournamentHistory.forEach((tournament) => {
    if (!tournament) return;

    const collect = (match) => {
      if (!match?.completed || !match.team1 || !match.team2) return;
      const score1 = asNumber(match.score1, null);
      const score2 = asNumber(match.score2, null);
      if (score1 === null || score2 === null || score1 === score2) return;

      matches.push({
        team1Signature: getTeamSignature(match.team1),
        team2Signature: getTeamSignature(match.team2),
        score1,
        score2,
      });
    };

    (tournament.fixtures || []).forEach(collect);
    if (tournament.finalMatch) collect(tournament.finalMatch);
    (tournament.bracket || []).forEach(round => (round || []).forEach(collect));
  });

  casualMatches.forEach((match) => {
    if (!match?.team1 || !match?.team2) return;
    const score1 = asNumber(match.score1, null);
    const score2 = asNumber(match.score2, null);
    if (score1 === null || score2 === null || score1 === score2) return;

    matches.push({
      team1Signature: getTeamSignature(match.team1),
      team2Signature: getTeamSignature(match.team2),
      score1,
      score2,
    });
  });

  return matches;
};

const getHeadToHeadEdge = (team1, team2, historicalMatches = []) => {
  const sig1 = getTeamSignature(team1);
  const sig2 = getTeamSignature(team2);

  let team1Wins = 0;
  let team2Wins = 0;

  historicalMatches.forEach((match) => {
    const direct = match.team1Signature === sig1 && match.team2Signature === sig2;
    const reverse = match.team1Signature === sig2 && match.team2Signature === sig1;
    if (!direct && !reverse) return;

    const team1WonInRecord = match.score1 > match.score2;
    if (direct) {
      if (team1WonInRecord) team1Wins += 1;
      else team2Wins += 1;
    } else {
      if (team1WonInRecord) team2Wins += 1;
      else team1Wins += 1;
    }
  });

  const total = team1Wins + team2Wins;
  if (total === 0) return { edge: 0, sampleSize: 0, team1Wins: 0, team2Wins: 0 };

  const edge = (team1Wins - team2Wins) / total;
  return { edge, sampleSize: total, team1Wins, team2Wins };
};

const probabilityFromDiff = (diff) => 1 / (1 + Math.pow(10, -diff / 400));

const clampProbability = (value) => Math.max(0.05, Math.min(0.95, value));

export const predictMatchOutcome = ({
  match,
  playerRatings = {},
  tournamentHistory = [],
  casualMatches = [],
}) => {
  if (!match?.team1 || !match?.team2) {
    return {
      team1Probability: 0.5,
      team2Probability: 0.5,
      favorite: null,
      upsetThreshold: 0.4,
      factors: { eloDiff: 0, formDiff: 0, h2hDiff: 0 },
      h2h: { edge: 0, sampleSize: 0, team1Wins: 0, team2Wins: 0 },
    };
  }

  const team1Elo = getTeamAverageElo(match.team1, playerRatings);
  const team2Elo = getTeamAverageElo(match.team2, playerRatings);
  const eloDiff = team1Elo - team2Elo;

  const team1Form = getTeamFormScore(match.team1, playerRatings);
  const team2Form = getTeamFormScore(match.team2, playerRatings);
  const formDiff = (team1Form.winRate - team2Form.winRate) * 120 + (team1Form.momentum - team2Form.momentum) * 3;

  const h2h = getHeadToHeadEdge(match.team1, match.team2, collectHistoricalMatches(tournamentHistory, casualMatches));
  const h2hDiff = h2h.edge * 80;

  const combinedDiff = eloDiff * 0.65 + formDiff * 0.25 + h2hDiff * 0.1;
  const rawTeam1Probability = probabilityFromDiff(combinedDiff);
  const team1Probability = clampProbability(rawTeam1Probability);
  const team2Probability = 1 - team1Probability;

  const favorite = team1Probability >= team2Probability ? 'team1' : 'team2';

  return {
    team1Probability,
    team2Probability,
    favorite,
    upsetThreshold: 0.4,
    factors: { eloDiff, formDiff, h2hDiff },
    h2h,
  };
};

export const getUpsetAlert = ({ prediction, score1, score2, team1Name, team2Name }) => {
  if (!prediction) return null;

  const s1 = asNumber(score1, null);
  const s2 = asNumber(score2, null);
  if (s1 === null || s2 === null || s1 === s2) return null;

  const leader = s1 > s2 ? 'team1' : 'team2';
  const underdog = prediction.team1Probability < prediction.upsetThreshold ? 'team1'
    : prediction.team2Probability < prediction.upsetThreshold ? 'team2'
    : null;

  if (!underdog || leader !== underdog) return null;

  const underdogName = underdog === 'team1' ? team1Name : team2Name;
  const underdogProbability = underdog === 'team1' ? prediction.team1Probability : prediction.team2Probability;

  return {
    title: 'Upset Alert',
    message: `${underdogName} is leading despite only ${(underdogProbability * 100).toFixed(0)}% pre-match win chance.`,
  };
};
