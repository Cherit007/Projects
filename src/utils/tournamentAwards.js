const getTeamPlayers = (team) => {
  if (!team) return [];
  return [team.player || team.player1, team.player2].filter(Boolean);
};

const keyForPair = (players = []) => players.slice().sort((a, b) => a.localeCompare(b)).join('::');

export const computeTournamentAwards = ({
  teams = [],
  fixtures = [],
  bracket = [],
  finalMatch = null,
  champion = null,
}) => {
  const allMatches = [
    ...(Array.isArray(fixtures) ? fixtures : []),
    ...((Array.isArray(bracket) ? bracket : []).flatMap((round) => (Array.isArray(round) ? round : []))),
    ...(finalMatch?.completed ? [finalMatch] : []),
  ].filter((match) => match?.completed && Number.isFinite(match?.score1) && Number.isFinite(match?.score2));

  if (!allMatches.length) return null;

  const playerMap = new Map();
  const pairMap = new Map();

  const ensurePlayer = (name) => {
    if (!name) return null;
    if (!playerMap.has(name)) {
      playerMap.set(name, {
        name,
        matchesPlayed: 0,
        wins: 0,
        losses: 0,
        totalScored: 0,
        totalConceded: 0,
        pointDiff: 0,
        clutchWins: 0,
        mvpScore: 0,
      });
    }
    return playerMap.get(name);
  };

  (Array.isArray(teams) ? teams : []).forEach((team) => {
    getTeamPlayers(team).forEach(ensurePlayer);
  });

  const championPlayers = new Set(getTeamPlayers(champion));

  allMatches.forEach((match) => {
    const team1Players = getTeamPlayers(match.team1);
    const team2Players = getTeamPlayers(match.team2);
    const margin = Number(match.score1) - Number(match.score2);
    const team1Won = margin > 0;
    const isClutch = Math.abs(margin) <= 2;

    const bumpPair = (players, won) => {
      if (players.length < 2) return;
      const key = keyForPair(players);
      if (!pairMap.has(key)) {
        pairMap.set(key, { key, players: players.slice(), played: 0, wins: 0 });
      }
      const pair = pairMap.get(key);
      pair.played += 1;
      if (won) pair.wins += 1;
    };

    const applyPlayer = (name, scored, conceded, won) => {
      const player = ensurePlayer(name);
      if (!player) return;
      player.matchesPlayed += 1;
      player.totalScored += scored;
      player.totalConceded += conceded;
      player.pointDiff += scored - conceded;
      if (won) {
        player.wins += 1;
        if (isClutch) player.clutchWins += 1;
      } else {
        player.losses += 1;
      }
    };

    team1Players.forEach((name) => applyPlayer(name, Number(match.score1), Number(match.score2), team1Won));
    team2Players.forEach((name) => applyPlayer(name, Number(match.score2), Number(match.score1), !team1Won));

    bumpPair(team1Players, team1Won);
    bumpPair(team2Players, !team1Won);
  });

  const players = Array.from(playerMap.values()).map((player) => {
    const avgConceded = player.matchesPlayed > 0 ? player.totalConceded / player.matchesPlayed : 0;
    const championBonus = championPlayers.has(player.name) ? 3 : 0;
    const mvpScore = (player.wins * 5) + player.pointDiff + (player.clutchWins * 2) + championBonus;
    return {
      ...player,
      avgConceded,
      mvpScore,
      winRate: player.matchesPlayed > 0 ? (player.wins / player.matchesPlayed) * 100 : 0,
    };
  });

  const mvpRanking = players
    .slice()
    .sort((a, b) => b.mvpScore - a.mvpScore || b.wins - a.wins || b.pointDiff - a.pointDiff);

  const topScorer = players.slice().sort((a, b) => b.totalScored - a.totalScored)[0] || null;
  const ironPlayer = players.slice().sort((a, b) => b.matchesPlayed - a.matchesPlayed || b.wins - a.wins)[0] || null;
  const wallPlayer = players
    .filter((p) => p.matchesPlayed >= 2)
    .sort((a, b) => a.avgConceded - b.avgConceded || b.wins - a.wins)[0] || null;
  const clutchPlayer = players
    .filter((p) => p.clutchWins > 0)
    .sort((a, b) => b.clutchWins - a.clutchWins || b.wins - a.wins)[0] || null;

  const bestPair = Array.from(pairMap.values())
    .map((pair) => ({
      ...pair,
      winRate: pair.played > 0 ? (pair.wins / pair.played) * 100 : 0,
    }))
    .filter((pair) => pair.played >= 2)
    .sort((a, b) => b.winRate - a.winRate || b.wins - a.wins || b.played - a.played)[0] || null;

  return {
    mvpRanking,
    awards: [
      topScorer && {
        id: 'top-scorer',
        title: 'Top Scorer',
        emoji: '🎯',
        winner: topScorer.name,
        detail: `${topScorer.totalScored} points scored`,
      },
      wallPlayer && {
        id: 'the-wall',
        title: 'The Wall',
        emoji: '🛡️',
        winner: wallPlayer.name,
        detail: `${wallPlayer.avgConceded.toFixed(1)} avg conceded`,
      },
      ironPlayer && {
        id: 'iron-player',
        title: 'Iron Player',
        emoji: '💪',
        winner: ironPlayer.name,
        detail: `${ironPlayer.matchesPlayed} matches played`,
      },
      clutchPlayer && {
        id: 'clutch-master',
        title: 'Clutch Master',
        emoji: '🔥',
        winner: clutchPlayer.name,
        detail: `${clutchPlayer.clutchWins} close-match wins`,
      },
      bestPair && {
        id: 'best-pair',
        title: 'Best Pair',
        emoji: '🤝',
        winner: `${bestPair.players[0]} & ${bestPair.players[1]}`,
        detail: `${bestPair.wins}/${bestPair.played} wins (${bestPair.winRate.toFixed(1)}%)`,
      },
    ].filter(Boolean),
  };
};

