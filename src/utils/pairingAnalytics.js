const asNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const getTeamPlayers = (team) => {
  if (!team) return [];
  return [team.player || team.player1, team.player2].filter(Boolean);
};

const inferDoubles = (team1Players, team2Players, matchType) => {
  if (matchType === 'doubles' || matchType === 'mixed') return true;
  if (matchType === 'singles') return false;
  return Math.max(team1Players.length, team2Players.length) >= 2;
};

const getMatchDate = (match, fallbackDate) => match?.date || match?.completedAt || fallbackDate || null;

const collectTournamentDoublesMatches = (tournamentHistory = []) => {
  const matches = [];

  tournamentHistory.forEach((tournament) => {
    if (!tournament) return;
    const fallbackDate = tournament.updatedAt || tournament.date || tournament.createdAt || null;

    const collect = (match) => {
      if (!match?.completed || !match.team1 || !match.team2) return;
      const team1Players = getTeamPlayers(match.team1);
      const team2Players = getTeamPlayers(match.team2);
      if (!inferDoubles(team1Players, team2Players, tournament.gameMode)) return;

      const score1 = asNumber(match.score1);
      const score2 = asNumber(match.score2);
      if (score1 === null || score2 === null || score1 === score2) return;

      matches.push({
        source: 'tournament',
        id: match.id,
        date: getMatchDate(match, fallbackDate),
        team1Players,
        team2Players,
        score1,
        score2,
      });
    };

    (tournament.fixtures || []).forEach(collect);
    if (tournament.finalMatch) collect(tournament.finalMatch);
    (tournament.bracket || []).forEach(round => (round || []).forEach(collect));
  });

  return matches;
};

const collectCasualDoublesMatches = (casualMatches = []) => {
  const matches = [];

  casualMatches.forEach((match) => {
    if (!match?.team1 || !match?.team2) return;

    const team1Players = getTeamPlayers(match.team1);
    const team2Players = getTeamPlayers(match.team2);
    if (!inferDoubles(team1Players, team2Players, match.matchType)) return;

    const score1 = asNumber(match.score1);
    const score2 = asNumber(match.score2);
    if (score1 === null || score2 === null || score1 === score2) return;

    matches.push({
      source: 'casual',
      id: match.id || match.appwriteId,
      date: getMatchDate(match, match.createdAt || null),
      team1Players,
      team2Players,
      score1,
      score2,
    });
  });

  return matches;
};

const buildPairKey = (playerA, playerB) => [playerA, playerB].sort((a, b) => a.localeCompare(b)).join('::');

const computeChemistryScore = ({ played, wins, pointDiff }) => {
  if (played <= 0) return 0;

  const winRate = wins / played;
  const volumeFactor = clamp(played / 10, 0, 1);
  const pointDiffPerMatch = pointDiff / played;
  const marginFactor = clamp((pointDiffPerMatch + 8) / 16, 0, 1);

  return Math.round((winRate * 0.65 + volumeFactor * 0.2 + marginFactor * 0.15) * 100);
};

const summarizePairStats = (matches) => {
  const pairMap = {};
  const playerMap = {};

  const registerPlayerMatch = (player, won) => {
    if (!playerMap[player]) {
      playerMap[player] = { name: player, played: 0, wins: 0, losses: 0, winRate: '0.0' };
    }
    playerMap[player].played += 1;
    if (won) playerMap[player].wins += 1;
    else playerMap[player].losses += 1;
  };

  matches.forEach((match) => {
    const team1Won = match.score1 > match.score2;

    const addTeamPair = (players, won, scored, conceded) => {
      if (players.length < 2) return;
      const [playerA, playerB] = players;
      const key = buildPairKey(playerA, playerB);
      if (!pairMap[key]) {
        pairMap[key] = {
          pairKey: key,
          playerA: key.split('::')[0],
          playerB: key.split('::')[1],
          played: 0,
          wins: 0,
          losses: 0,
          pointsFor: 0,
          pointsAgainst: 0,
          pointDiff: 0,
          lastPlayedAt: null,
          chemistryScore: 0,
          sourceBreakdown: { tournament: 0, casual: 0 },
        };
      }

      const item = pairMap[key];
      item.played += 1;
      if (won) item.wins += 1;
      else item.losses += 1;
      item.pointsFor += scored;
      item.pointsAgainst += conceded;
      item.pointDiff = item.pointsFor - item.pointsAgainst;
      item.lastPlayedAt = !item.lastPlayedAt || (match.date && new Date(match.date) > new Date(item.lastPlayedAt))
        ? (match.date || item.lastPlayedAt)
        : item.lastPlayedAt;
      item.sourceBreakdown[match.source] += 1;
      item.chemistryScore = computeChemistryScore(item);

      registerPlayerMatch(playerA, won);
      registerPlayerMatch(playerB, won);
    };

    addTeamPair(match.team1Players, team1Won, match.score1, match.score2);
    addTeamPair(match.team2Players, !team1Won, match.score2, match.score1);
  });

  const pairStats = Object.values(pairMap)
    .map(pair => ({
      ...pair,
      winRate: pair.played > 0 ? ((pair.wins / pair.played) * 100).toFixed(1) : '0.0',
      pairLabel: `${pair.playerA} + ${pair.playerB}`,
    }))
    .sort((a, b) => {
      if (b.chemistryScore !== a.chemistryScore) return b.chemistryScore - a.chemistryScore;
      if (b.played !== a.played) return b.played - a.played;
      return a.pairLabel.localeCompare(b.pairLabel);
    });

  const playerStats = Object.values(playerMap)
    .map(player => ({
      ...player,
      winRate: player.played > 0 ? ((player.wins / player.played) * 100).toFixed(1) : '0.0',
    }));

  return { pairStats, playerStats };
};

const buildRecommendedPairs = ({ pairStats, playerStats, playerRatings = {} }) => {
  const players = playerStats.map(player => player.name);
  const pairByKey = Object.fromEntries(pairStats.map(pair => [pair.pairKey, pair]));

  const recs = [];
  for (let i = 0; i < players.length; i += 1) {
    for (let j = i + 1; j < players.length; j += 1) {
      const playerA = players[i];
      const playerB = players[j];
      const key = buildPairKey(playerA, playerB);
      const existing = pairByKey[key];

      const ratingA = playerRatings[playerA]?.rating || 1000;
      const ratingB = playerRatings[playerB]?.rating || 1000;
      const ratingBalance = 1 - clamp(Math.abs(ratingA - ratingB) / 400, 0, 1);

      const aPerf = playerStats.find(player => player.name === playerA);
      const bPerf = playerStats.find(player => player.name === playerB);
      const aWinRate = aPerf ? Number(aPerf.winRate) / 100 : 0.5;
      const bWinRate = bPerf ? Number(bPerf.winRate) / 100 : 0.5;
      const basePotential = Math.round((aWinRate * 0.4 + bWinRate * 0.4 + ratingBalance * 0.2) * 100);

      const recommendationScore = existing
        ? Math.round(existing.chemistryScore * 0.75 + basePotential * 0.25)
        : basePotential;

      recs.push({
        pairKey: key,
        playerA,
        playerB,
        pairLabel: `${playerA} + ${playerB}`,
        recommendationScore,
        chemistryScore: existing?.chemistryScore ?? null,
        playedTogether: existing?.played ?? 0,
        confidence: existing ? 'Proven' : 'Trial',
        reason: existing
          ? `Played ${existing.played} match(es), chemistry ${existing.chemistryScore}`
          : 'No shared history yet; suggested by individual form + rating balance',
      });
    }
  }

  return recs.sort((a, b) => {
    if (b.recommendationScore !== a.recommendationScore) return b.recommendationScore - a.recommendationScore;
    return a.pairLabel.localeCompare(b.pairLabel);
  });
};

const buildRotationSuggestions = ({ pairStats, recommendedPairs }) => {
  const suggestions = [];

  const overusedPair = pairStats
    .filter(pair => pair.played >= 5)
    .sort((a, b) => b.played - a.played)[0];

  if (overusedPair) {
    const alternatives = recommendedPairs
      .filter(rec =>
        rec.pairLabel !== overusedPair.pairLabel
        && [rec.playerA, rec.playerB].some(player => player === overusedPair.playerA || player === overusedPair.playerB)
      )
      .slice(0, 2);

    if (alternatives.length > 0) {
      suggestions.push({
        type: 'rotation',
        title: `Rotate ${overusedPair.pairLabel}`,
        detail: `${overusedPair.pairLabel} has already played ${overusedPair.played} matches. Try ${alternatives.map(item => item.pairLabel).join(' or ')} to keep rotations balanced.`,
      });
    }
  }

  const highPotentialTrial = recommendedPairs.find(rec => rec.playedTogether === 0 && rec.recommendationScore >= 60);
  if (highPotentialTrial) {
    suggestions.push({
      type: 'trial',
      title: `Trial Pair Opportunity: ${highPotentialTrial.pairLabel}`,
      detail: `${highPotentialTrial.reason}. Use this pair in a league fixture to validate chemistry.`,
    });
  }

  const lowChemPair = pairStats
    .filter(pair => pair.played >= 3)
    .sort((a, b) => a.chemistryScore - b.chemistryScore)[0];

  if (lowChemPair) {
    suggestions.push({
      type: 'optimize',
      title: `Reassess ${lowChemPair.pairLabel}`,
      detail: `${lowChemPair.pairLabel} has chemistry ${lowChemPair.chemistryScore}. Consider rotating one partner for better balance.`,
    });
  }

  return suggestions.slice(0, 4);
};

export const buildPairingAnalytics = ({
  tournamentHistory = [],
  casualMatches = [],
  playerRatings = {},
}) => {
  const matches = [
    ...collectTournamentDoublesMatches(tournamentHistory),
    ...collectCasualDoublesMatches(casualMatches),
  ];

  const uniqueMatchMap = new Map();
  matches.forEach(match => {
    const uniqueKey = `${match.source}-${match.id || ''}-${match.date || ''}-${match.team1Players.join('&')}-${match.team2Players.join('&')}-${match.score1}-${match.score2}`;
    uniqueMatchMap.set(uniqueKey, match);
  });

  const dedupedMatches = Array.from(uniqueMatchMap.values());
  const { pairStats, playerStats } = summarizePairStats(dedupedMatches);
  const recommendedPairs = buildRecommendedPairs({ pairStats, playerStats, playerRatings });
  const rotationSuggestions = buildRotationSuggestions({ pairStats, recommendedPairs });

  const bestCombinations = pairStats.slice(0, 8);
  const whoShouldPair = recommendedPairs.slice(0, 12);

  return {
    totalDoublesMatches: dedupedMatches.length,
    totalTrackedPairs: pairStats.length,
    bestCombinations,
    pairStats,
    whoShouldPair,
    rotationSuggestions,
  };
};
