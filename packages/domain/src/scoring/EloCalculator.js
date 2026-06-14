import { resolveScoringConfig } from './scoringConfig.js';

const getExpectedScore = (ratingA, ratingB) => (
  1 / (1 + Math.pow(10, (ratingB - ratingA) / 400))
);

export const calculateNewElo = (currentRating, opponentRating, actualScore, config) => {
  const { kFactor } = resolveScoringConfig(config);
  const expectedScore = getExpectedScore(currentRating, opponentRating);
  const newRating = currentRating + kFactor * (actualScore - expectedScore);
  return Math.round(newRating);
};

export const getPlayerLeaderboard = (playerRatings) => (
  Object.entries(playerRatings)
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => {
      if (b.rating !== a.rating) return b.rating - a.rating;
      if ((b.matchesPlayed || 0) !== (a.matchesPlayed || 0)) {
        return (b.matchesPlayed || 0) - (a.matchesPlayed || 0);
      }
      return String(a.name || '').localeCompare(String(b.name || ''));
    })
);

export const updatePlayerRatingsAfterMatch = (playerRatings, match, config) => {
  const { defaultRating } = resolveScoringConfig(config);
  const updatedRatings = { ...playerRatings };
  const prefersDayFirst = (() => {
    try {
      const sample = new Intl.DateTimeFormat().formatToParts(new Date(2000, 0, 2));
      const order = sample
        .filter((part) => part.type === 'day' || part.type === 'month')
        .map((part) => part.type);
      return order[0] === 'day';
    } catch {
      return false;
    }
  })();
  const parseLooseDate = (value) => {
    const raw = String(value || '').trim();
    if (!raw) return null;
    const matchPattern = raw.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
    if (!matchPattern) return null;
    const first = Number(matchPattern[1]);
    const second = Number(matchPattern[2]);
    const year = Number(matchPattern[3]);
    if (!Number.isFinite(first) || !Number.isFinite(second) || !Number.isFinite(year)) return null;
    let month = first;
    let day = second;
    if (first > 12 && second <= 12) {
      day = first;
      month = second;
    } else if (second > 12 && first <= 12) {
      month = first;
      day = second;
    } else if (prefersDayFirst) {
      day = first;
      month = second;
    }
    const parsed = new Date(Date.UTC(year, month - 1, day));
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toISOString();
  };
  const normalizeMatchDate = (value) => {
    if (!value) return null;
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
    return parseLooseDate(value);
  };
  const matchDate = normalizeMatchDate(match?.completedAt)
    || normalizeMatchDate(match?.date)
    || new Date().toISOString();

  const players = [
    match.team1.player || match.team1.player1,
    match.team1.player2,
    match.team2.player || match.team2.player1,
    match.team2.player2
  ].filter(Boolean);

  players.forEach(player => {
    if (player && !updatedRatings[player]) {
      updatedRatings[player] = { rating: defaultRating, matchesPlayed: 0, history: [] };
    }
  });

  const team1Players = [match.team1.player || match.team1.player1, match.team1.player2].filter(Boolean);
  const team2Players = [match.team2.player || match.team2.player1, match.team2.player2].filter(Boolean);

  const team1AvgRating = team1Players.reduce((sum, p) => sum + (updatedRatings[p]?.rating || defaultRating), 0) / team1Players.length;
  const team2AvgRating = team2Players.reduce((sum, p) => sum + (updatedRatings[p]?.rating || defaultRating), 0) / team2Players.length;

  const team1Score = match.score1 > match.score2 ? 1 : 0;
  const team2Score = match.score2 > match.score1 ? 1 : 0;

  team1Players.forEach(player => {
    if (player && updatedRatings[player]) {
      const oldRating = updatedRatings[player].rating;
      const newRating = calculateNewElo(oldRating, team2AvgRating, team1Score, config);
      const change = newRating - oldRating;

      updatedRatings[player] = {
        rating: newRating,
        matchesPlayed: updatedRatings[player].matchesPlayed + 1,
        history: [
          ...updatedRatings[player].history,
          {
            matchId: match.id,
            oldRating,
            newRating,
            change,
            opponent: team2Players.join(' & '),
            result: team1Score === 1 ? 'win' : 'loss',
            date: matchDate
          }
        ]
      };
    }
  });

  team2Players.forEach(player => {
    if (player && updatedRatings[player]) {
      const oldRating = updatedRatings[player].rating;
      const newRating = calculateNewElo(oldRating, team1AvgRating, team2Score, config);
      const change = newRating - oldRating;

      updatedRatings[player] = {
        rating: newRating,
        matchesPlayed: updatedRatings[player].matchesPlayed + 1,
        history: [
          ...updatedRatings[player].history,
          {
            matchId: match.id,
            oldRating,
            newRating,
            change,
            opponent: team1Players.join(' & '),
            result: team2Score === 1 ? 'win' : 'loss',
            date: matchDate
          }
        ]
      };
    }
  });

  return updatedRatings;
};
