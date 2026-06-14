const asNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const getTeamPlayers = (team) => [team?.player || team?.player1, team?.player2].filter(Boolean);

const sortByDate = (items = []) => {
  return [...items].sort((a, b) => {
    const aTime = a?.date ? new Date(a.date).getTime() : 0;
    const bTime = b?.date ? new Date(b.date).getTime() : 0;
    return aTime - bTime;
  });
};

const getLongestWinStreak = (history = []) => {
  let longest = 0;
  let current = 0;

  history.forEach(item => {
    if (item.result === 'win') {
      current += 1;
      if (current > longest) longest = current;
    } else {
      current = 0;
    }
  });

  return longest;
};

const collectPlayerMatchOutcomes = ({ playerName, tournamentHistory = [], casualMatches = [] }) => {
  const outcomes = [];

  const collectMatch = (match, context = {}) => {
    if (!match?.team1 || !match?.team2) return;

    const score1 = asNumber(match.score1, null);
    const score2 = asNumber(match.score2, null);
    if (score1 === null || score2 === null || score1 === score2) return;

    const team1Players = getTeamPlayers(match.team1);
    const team2Players = getTeamPlayers(match.team2);

    const inTeam1 = team1Players.includes(playerName);
    const inTeam2 = team2Players.includes(playerName);
    if (!inTeam1 && !inTeam2) return;

    const won = inTeam1 ? score1 > score2 : score2 > score1;
    const isFinal = context.phase === 'final';
    const upset = Boolean(match.upsetAlert);

    outcomes.push({
      date: match.completedAt || match.date || context.date || null,
      won,
      isFinal,
      upset,
      margin: Math.abs(score1 - score2),
    });
  };

  tournamentHistory.forEach((tournament) => {
    if (!tournament) return;
    const fallbackDate = tournament.date || tournament.createdAt || tournament.updatedAt || null;

    (tournament.fixtures || []).forEach(match => collectMatch(match, { phase: 'league', date: fallbackDate }));
    if (tournament.finalMatch) {
      collectMatch(tournament.finalMatch, { phase: 'final', date: fallbackDate });
    }

    const bracket = tournament.bracket || [];
    if (Array.isArray(bracket) && bracket.length > 0) {
      bracket.forEach((round, index) => {
        (round || []).forEach(match => {
          const isLastRound = index === bracket.length - 1;
          collectMatch(match, { phase: isLastRound ? 'final' : 'knockout', date: fallbackDate });
        });
      });
    }
  });

  casualMatches.forEach((match) => {
    collectMatch(match, { phase: 'casual', date: match.completedAt || match.date || match.createdAt || null });
  });

  return sortByDate(outcomes);
};

export const buildPlayerAchievements = ({
  playerName,
  playerRatings = {},
  tournamentHistory = [],
  casualMatches = [],
}) => {
  if (!playerName) {
    return {
      totalWins: 0,
      longestWinStreak: 0,
      giantKillerWins: 0,
      finalsPlayed: 0,
      finalsWins: 0,
      finalsWinRate: 0,
      badges: [],
    };
  }

  const history = sortByDate(playerRatings[playerName]?.history || []);
  const currentRating = asNumber(playerRatings[playerName]?.rating, 1000);
  const totalMatches = asNumber(playerRatings[playerName]?.matchesPlayed, history.length);
  const totalWins = history.filter(item => item.result === 'win').length;
  const longestWinStreak = getLongestWinStreak(history);

  const outcomes = collectPlayerMatchOutcomes({ playerName, tournamentHistory, casualMatches });
  const finalsPlayed = outcomes.filter(item => item.isFinal).length;
  const finalsWins = outcomes.filter(item => item.isFinal && item.won).length;
  const finalsWinRate = finalsPlayed > 0 ? finalsWins / finalsPlayed : 0;
  const clutchWins = outcomes.filter(item => item.won && item.margin > 0 && item.margin <= 2).length;
  const last20 = history.slice(-20);
  const last20Wins = last20.filter(item => item.result === 'win').length;
  const last20WinRate = last20.length > 0 ? last20Wins / last20.length : 0;

  const upsetWinsFromMatches = outcomes.filter(item => item.upset && item.won).length;
  const upsetWinsFromEloSwing = history.filter(item => item.result === 'win' && asNumber(item.change) >= 12).length;
  const giantKillerWins = Math.max(upsetWinsFromMatches, upsetWinsFromEloSwing);

  const badges = [
    {
      id: 'wins-100',
      icon: '💯',
      title: '100 Wins',
      description: 'Reach 100 career wins',
      earned: totalWins >= 100,
      progress: `${totalWins}/100 wins`,
    },
    {
      id: 'streak-10',
      icon: '🔥',
      title: '10-Match Streak',
      description: 'Achieve a 10 match winning streak',
      earned: longestWinStreak >= 10,
      progress: `Best streak: ${longestWinStreak}/10`,
    },
    {
      id: 'giant-killer',
      icon: '⚔️',
      title: 'Giant Killer',
      description: 'Win 3 upset/high-swing matches',
      earned: giantKillerWins >= 3,
      progress: `${giantKillerWins}/3 upset wins`,
    },
    {
      id: 'final-specialist',
      icon: '🏆',
      title: 'Final Specialist',
      description: 'Play 3+ finals with 60%+ win rate',
      earned: finalsPlayed >= 3 && finalsWinRate >= 0.6,
      progress: finalsPlayed === 0
        ? 'No finals played yet'
        : `${finalsWins}/${finalsPlayed} finals won (${(finalsWinRate * 100).toFixed(1)}%)`,
    },
    {
      id: 'elo-1200',
      icon: '📈',
      title: 'ELO 1200 Club',
      description: 'Reach an ELO rating of 1200',
      earned: currentRating >= 1200,
      progress: `${currentRating}/1200 rating`,
    },
    {
      id: 'consistency-pro',
      icon: '🎯',
      title: 'Consistency Pro',
      description: 'Win 70%+ of last 20 matches',
      earned: last20.length >= 20 && last20WinRate >= 0.7,
      progress: last20.length === 0
        ? 'No recent matches yet'
        : `${last20Wins}/${last20.length} wins (${(last20WinRate * 100).toFixed(1)}%)`,
    },
    {
      id: 'clutch-finisher',
      icon: '🧠',
      title: 'Clutch Finisher',
      description: 'Win 5 close matches (margin 2 or less)',
      earned: clutchWins >= 5,
      progress: `${clutchWins}/5 close wins`,
    },
    {
      id: 'marathon-player',
      icon: '🏃',
      title: 'Marathon Player',
      description: 'Play 200 career matches',
      earned: totalMatches >= 200,
      progress: `${totalMatches}/200 matches`,
    },
  ];

  return {
    totalWins,
    longestWinStreak,
    giantKillerWins,
    finalsPlayed,
    finalsWins,
    finalsWinRate,
    badges,
  };
};
