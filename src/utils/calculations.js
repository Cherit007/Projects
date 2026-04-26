// Calculate Points Table
export const calculatePointsTable = (teams, fixtures) => {
  const table = teams.map(team => ({
    ...team,
    played: 0,
    won: 0,
    lost: 0,
    points: 0,
    scoreFor: 0,
    scoreAgainst: 0,
    scoreDiff: 0,
    netMatchRate: 0,
  }));

  fixtures.forEach(match => {
    if (match.completed) {
      const team1Index = table.findIndex(t => t.id === match.team1.id);
      const team2Index = table.findIndex(t => t.id === match.team2.id);

      if (team1Index !== -1 && team2Index !== -1) {
        table[team1Index].played++;
        table[team2Index].played++;
        table[team1Index].scoreFor += match.score1;
        table[team1Index].scoreAgainst += match.score2;
        table[team2Index].scoreFor += match.score2;
        table[team2Index].scoreAgainst += match.score1;

        const margin = match.score1 - match.score2;

        if (margin > 0) {
          table[team1Index].won++;
          table[team2Index].lost++;
          table[team1Index].points += 2;
        } else {
          table[team2Index].won++;
          table[team1Index].lost++;
          table[team2Index].points += 2;
        }
      }
    }
  });

  table.forEach(team => {
    team.scoreDiff = team.scoreFor - team.scoreAgainst;
    team.netMatchRate = team.played > 0 ? team.scoreDiff / team.played : 0;
  });

  return table.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.netMatchRate !== a.netMatchRate) return b.netMatchRate - a.netMatchRate;
    if (b.scoreDiff !== a.scoreDiff) return b.scoreDiff - a.scoreDiff;
    return String(a.name || '').localeCompare(String(b.name || ''));
  });
};

// Calculate Player Statistics
export const calculatePlayerStats = (teams, fixtures) => {
  const playerStats = {};
  const ensurePlayer = (player, fallbackTeamName = 'Rotating Player', fallbackEmoji = '🏸') => {
    if (!player) return;
    if (!playerStats[player]) {
      playerStats[player] = {
        name: player,
        team: fallbackTeamName,
        teamEmoji: fallbackEmoji,
        matchesPlayed: 0,
        matchesWon: 0,
        totalScored: 0,
        totalConceded: 0,
        winPercentage: 0,
      };
    }
  };

  teams.forEach(team => {
    [team.player1, team.player2].forEach(player => {
      ensurePlayer(player, team.name, team.emoji);
    });
  });

  fixtures.forEach(match => {
    if (match.completed) {
      const team1Won = match.score1 > match.score2;
      [match.team1.player || match.team1.player1, match.team1.player2].forEach(player => {
        ensurePlayer(player, match.team1.name, match.team1.emoji);
      });
      [match.team2.player || match.team2.player1, match.team2.player2].forEach(player => {
        ensurePlayer(player, match.team2.name, match.team2.emoji);
      });
      
      [match.team1.player || match.team1.player1, match.team1.player2].forEach(player => {
        if (player && playerStats[player]) {
          playerStats[player].matchesPlayed++;
          playerStats[player].totalScored += match.score1;
          playerStats[player].totalConceded += match.score2;
          if (team1Won) playerStats[player].matchesWon++;
        }
      });

      [match.team2.player || match.team2.player1, match.team2.player2].forEach(player => {
        if (player && playerStats[player]) {
          playerStats[player].matchesPlayed++;
          playerStats[player].totalScored += match.score2;
          playerStats[player].totalConceded += match.score1;
          if (!team1Won) playerStats[player].matchesWon++;
        }
      });
    }
  });

  Object.values(playerStats).forEach(player => {
    if (player.matchesPlayed > 0) {
      player.winPercentage = ((player.matchesWon / player.matchesPlayed) * 100).toFixed(1);
    }
  });

  return Object.values(playerStats).sort((a, b) => {
    if (b.matchesWon !== a.matchesWon) return b.matchesWon - a.matchesWon;
    const aWinRate = Number(a.winPercentage || 0);
    const bWinRate = Number(b.winPercentage || 0);
    if (bWinRate !== aWinRate) return bWinRate - aWinRate;
    if (b.matchesPlayed !== a.matchesPlayed) return b.matchesPlayed - a.matchesPlayed;
    return String(a.name || '').localeCompare(String(b.name || ''));
  });
};

const normalizeAnalyticsStatsInput = (historyOrOptions = [], maybeCasualMatches = []) => {
  if (Array.isArray(historyOrOptions)) {
    return {
      tournamentHistory: historyOrOptions,
      casualMatches: Array.isArray(maybeCasualMatches) ? maybeCasualMatches : [],
    };
  }

  if (historyOrOptions && typeof historyOrOptions === 'object') {
    return {
      tournamentHistory: Array.isArray(historyOrOptions.tournamentHistory)
        ? historyOrOptions.tournamentHistory
        : [],
      casualMatches: Array.isArray(historyOrOptions.casualMatches)
        ? historyOrOptions.casualMatches
        : [],
    };
  }

  return {
    tournamentHistory: [],
    casualMatches: Array.isArray(maybeCasualMatches) ? maybeCasualMatches : [],
  };
};

// Canonical all-time rule: include every completed tournament match plus every completed casual match.
export const calculateCumulativePlayerStats = (historyOrOptions = [], maybeCasualMatches = []) => {
  const {
    tournamentHistory,
    casualMatches,
  } = normalizeAnalyticsStatsInput(historyOrOptions, maybeCasualMatches);
  const cumulativeStats = {};
  const normalizeCompletedMatch = (match) => {
    if (!match?.team1 || !match?.team2 || !match?.completed) return null;
    const score1 = Number(match?.score1);
    const score2 = Number(match?.score2);
    if (!Number.isFinite(score1) || !Number.isFinite(score2) || score1 === score2) return null;
    return {
      ...match,
      score1,
      score2,
      completed: true,
    };
  };
  const getTeamPlayers = (team) => (
    [team?.player || team?.player1, team?.player2].filter(Boolean)
  );
  const ensurePlayer = (player) => {
    if (!player) return null;
    if (!cumulativeStats[player]) {
      cumulativeStats[player] = {
        name: player,
        tournamentsPlayed: new Set(),
        matchesPlayed: 0,
        matchesWon: 0,
        totalScored: 0,
        totalConceded: 0,
        championships: 0,
      };
    }
    return cumulativeStats[player];
  };
  const addMatchToStats = (match, tournamentKey) => {
    const team1Won = match.score1 > match.score2;
    const team1Players = getTeamPlayers(match.team1);
    const team2Players = getTeamPlayers(match.team2);

    team1Players.forEach((player) => {
      const entry = ensurePlayer(player);
      if (!entry) return;
      if (tournamentKey) entry.tournamentsPlayed.add(tournamentKey);
      entry.matchesPlayed += 1;
      entry.totalScored += match.score1;
      entry.totalConceded += match.score2;
      if (team1Won) entry.matchesWon += 1;
    });

    team2Players.forEach((player) => {
      const entry = ensurePlayer(player);
      if (!entry) return;
      if (tournamentKey) entry.tournamentsPlayed.add(tournamentKey);
      entry.matchesPlayed += 1;
      entry.totalScored += match.score2;
      entry.totalConceded += match.score1;
      if (!team1Won) entry.matchesWon += 1;
    });
  };

  (Array.isArray(tournamentHistory) ? tournamentHistory : []).forEach((tournament) => {
    const tournamentKey = String(
      tournament?.id
      || tournament?.immutableTournamentId
      || tournament?.appwriteId
      || tournament?.legacyTournamentId
      || (tournament?.name && tournament?.date ? `${tournament.name}-${tournament.date}` : tournament?.name || '')
    ).trim();

    (Array.isArray(tournament?.fixtures) ? tournament.fixtures : [])
      .map(normalizeCompletedMatch)
      .filter(Boolean)
      .forEach((match) => addMatchToStats(match, tournamentKey));

    (Array.isArray(tournament?.bracket) ? tournament.bracket : [])
      .flatMap((round) => (Array.isArray(round) ? round : []))
      .map(normalizeCompletedMatch)
      .filter(Boolean)
      .forEach((match) => addMatchToStats(match, tournamentKey));

    const finalMatch = normalizeCompletedMatch(tournament?.finalMatch);
    if (finalMatch) {
      addMatchToStats(finalMatch, tournamentKey);
    }

    if (tournament.champion) {
      const championPlayers = getTeamPlayers(tournament.champion);
      championPlayers.forEach((player) => {
        const entry = ensurePlayer(player);
        if (entry) entry.championships += 1;
      });
    }
  });

  (Array.isArray(casualMatches) ? casualMatches : [])
    .map(normalizeCompletedMatch)
    .filter(Boolean)
    .forEach((match) => addMatchToStats(match, null));

  const statsArray = Object.values(cumulativeStats).map(player => ({
    ...player,
    tournamentsPlayed: player.tournamentsPlayed.size,
    winPercentage: player.matchesPlayed > 0 
      ? ((player.matchesWon / player.matchesPlayed) * 100).toFixed(1)
      : 0,
    avgScorePerMatch: player.matchesPlayed > 0
      ? (player.totalScored / player.matchesPlayed).toFixed(1)
      : 0,
    scoreDiff: player.totalScored - player.totalConceded,
  }));

  return statsArray.sort((a, b) => {
    if (b.championships !== a.championships) return b.championships - a.championships;
    if (b.matchesWon !== a.matchesWon) return b.matchesWon - a.matchesWon;
    const winRateDelta = Number(b.winPercentage || 0) - Number(a.winPercentage || 0);
    if (winRateDelta !== 0) return winRateDelta;
    if (b.matchesPlayed !== a.matchesPlayed) return b.matchesPlayed - a.matchesPlayed;
    return String(a.name || '').localeCompare(String(b.name || ''));
  });
};

const buildRoundRobinRounds = (teams) => {
  const participants = [...teams];
  if (participants.length % 2 !== 0) {
    participants.push(null); // BYE for odd team counts
  }

  const totalRounds = participants.length - 1;
  const matchesPerRound = participants.length / 2;
  const rounds = [];

  let rotating = [...participants];
  for (let roundIndex = 0; roundIndex < totalRounds; roundIndex++) {
    const roundMatches = [];

    for (let matchIndex = 0; matchIndex < matchesPerRound; matchIndex++) {
      const teamA = rotating[matchIndex];
      const teamB = rotating[rotating.length - 1 - matchIndex];

      if (teamA && teamB) {
        roundMatches.push([teamA, teamB]);
      }
    }

    rounds.push(roundMatches);

    // Circle method: keep first team fixed, rotate the rest.
    const fixed = rotating[0];
    const rest = rotating.slice(1);
    rest.unshift(rest.pop());
    rotating = [fixed, ...rest];
  }

  return rounds;
};

// Generate fixtures in true round-robin order for league tournaments.
export const generateFixtures = (teams, format) => {
  const matchesPerPair = Math.max(1, parseInt(format, 10) || 1);
  const baseRounds = buildRoundRobinRounds(teams);
  const newFixtures = [];
  let matchId = 1;

  for (let cycle = 0; cycle < matchesPerPair; cycle++) {
    baseRounds.forEach((roundMatches, roundIndex) => {
      roundMatches.forEach(([teamA, teamB]) => {
        const isReturnLeg = cycle % 2 === 1;
        newFixtures.push({
          id: matchId++,
          team1: isReturnLeg ? teamB : teamA,
          team2: isReturnLeg ? teamA : teamB,
          score1: null,
          score2: null,
          completed: false,
          round: cycle * baseRounds.length + roundIndex + 1,
        });
      });
    });
  }

  return newFixtures;
};

// ELO Rating System
const K_FACTOR = 32;

const getExpectedScore = (ratingA, ratingB) => {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
};

export const calculateNewElo = (currentRating, opponentRating, actualScore) => {
  const expectedScore = getExpectedScore(currentRating, opponentRating);
  const newRating = currentRating + K_FACTOR * (actualScore - expectedScore);
  return Math.round(newRating);
};

export const updatePlayerRatingsAfterMatch = (playerRatings, match) => {
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
      updatedRatings[player] = { rating: 1000, matchesPlayed: 0, history: [] };
    }
  });
  
  const team1Players = [match.team1.player || match.team1.player1, match.team1.player2].filter(Boolean);
  const team2Players = [match.team2.player || match.team2.player1, match.team2.player2].filter(Boolean);
  
  const team1AvgRating = team1Players.reduce((sum, p) => sum + (updatedRatings[p]?.rating || 1000), 0) / team1Players.length;
  const team2AvgRating = team2Players.reduce((sum, p) => sum + (updatedRatings[p]?.rating || 1000), 0) / team2Players.length;
  
  const team1Score = match.score1 > match.score2 ? 1 : 0;
  const team2Score = match.score2 > match.score1 ? 1 : 0;
  
  team1Players.forEach(player => {
    if (player && updatedRatings[player]) {
      const oldRating = updatedRatings[player].rating;
      const newRating = calculateNewElo(oldRating, team2AvgRating, team1Score);
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
      const newRating = calculateNewElo(oldRating, team1AvgRating, team2Score);
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

export const getPlayerLeaderboard = (playerRatings) => {
  return Object.entries(playerRatings)
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => {
      if (b.rating !== a.rating) return b.rating - a.rating;
      if ((b.matchesPlayed || 0) !== (a.matchesPlayed || 0)) {
        return (b.matchesPlayed || 0) - (a.matchesPlayed || 0);
      }
      return String(a.name || '').localeCompare(String(b.name || ''));
    });
};

const getNextPowerOfTwo = (value) => {
  let power = 1;
  while (power < value) power *= 2;
  return power;
};

const getKnockoutRoundLabel = (roundIndex, totalRounds, isPlayInRound) => {
  if (isPlayInRound && roundIndex === 0) return 'playin';

  const roundsFromFinal = totalRounds - roundIndex;
  if (roundsFromFinal === 1) return 'final';
  if (roundsFromFinal === 2) return 'semi';
  if (roundsFromFinal === 3) return 'quarter';
  if (roundsFromFinal === 4) return 'round16';
  return `round${roundIndex + 1}`;
};

const autoAdvanceByeWinners = (bracket) => {
  let changed = true;

  while (changed) {
    changed = false;

    for (let roundIndex = 0; roundIndex < bracket.length; roundIndex++) {
      for (let matchIndex = 0; matchIndex < bracket[roundIndex].length; matchIndex++) {
        const match = bracket[roundIndex][matchIndex];
        if (!match || match.completed) continue;

        const hasTeam1 = Boolean(match.team1);
        const hasTeam2 = Boolean(match.team2);

        // Auto-advance only for non-final rounds; finals must be played.
        if (((hasTeam1 && !hasTeam2) || (!hasTeam1 && hasTeam2)) && match.nextMatchId) {
          const winner = hasTeam1 ? match.team1 : match.team2;
          match.score1 = hasTeam1 ? 1 : 0;
          match.score2 = hasTeam1 ? 0 : 1;
          match.completed = true;

          if (match.nextMatchId) {
            for (let nextRoundIndex = roundIndex + 1; nextRoundIndex < bracket.length; nextRoundIndex++) {
              const nextMatch = bracket[nextRoundIndex].find(m => m.id === match.nextMatchId);
              if (!nextMatch) continue;
              if (!nextMatch.team1) {
                nextMatch.team1 = winner;
              } else if (!nextMatch.team2) {
                nextMatch.team2 = winner;
              }
              break;
            }
          }

          changed = true;
        }
      }
    }
  }

  return bracket;
};

const generateKnockoutBracketWithByes = (teams) => {
  const shuffledTeams = [...teams].sort(() => Math.random() - 0.5);
  const bracketSize = getNextPowerOfTwo(shuffledTeams.length);
  const totalRounds = Math.log2(bracketSize);
  const firstRoundMatches = bracketSize / 2;
  const matchesToPlayInFirstRound = shuffledTeams.length - firstRoundMatches;
  const isPlayInRound = shuffledTeams.length === 3;

  let matchId = 1;
  const roundSizes = Array.from({ length: totalRounds }, (_, roundIndex) =>
    bracketSize / Math.pow(2, roundIndex + 1)
  );
  const bracket = roundSizes.map((size, roundIndex) =>
    Array.from({ length: size }, () => ({
      id: matchId++,
      team1: null,
      team2: null,
      score1: null,
      score2: null,
      completed: false,
      round: getKnockoutRoundLabel(roundIndex, totalRounds, isPlayInRound),
      nextMatchId: null,
    }))
  );

  // First round: only the required matches are played, remaining teams get byes.
  let teamCursor = 0;
  for (let i = 0; i < firstRoundMatches; i++) {
    const match = bracket[0][i];
    if (i < matchesToPlayInFirstRound) {
      match.team1 = shuffledTeams[teamCursor++] || null;
      match.team2 = shuffledTeams[teamCursor++] || null;
    } else {
      match.team1 = shuffledTeams[teamCursor++] || null;
      match.team2 = null;
    }
  }

  // Wire next match ids (binary tree progression).
  for (let roundIndex = 0; roundIndex < bracket.length - 1; roundIndex++) {
    for (let matchIndex = 0; matchIndex < bracket[roundIndex].length; matchIndex++) {
      const nextMatch = bracket[roundIndex + 1][Math.floor(matchIndex / 2)];
      bracket[roundIndex][matchIndex].nextMatchId = nextMatch?.id || null;
    }
  }

  return autoAdvanceByeWinners(bracket);
};

// Generate knockout bracket
export const generateKnockoutBracket = (teams, format) => {
  if (format === 'knockoutByes') {
    return generateKnockoutBracketWithByes(teams);
  }
  
  if (format === 'playInFinal') {
    const shuffledTeams = [...teams].sort(() => Math.random() - 0.5);
    const bracket = [
      [
        { id: 1, team1: shuffledTeams[0], team2: shuffledTeams[1], score1: null, score2: null, completed: false, round: 'playin', nextMatchId: 2 }
      ],
      [
        { id: 2, team1: shuffledTeams[2], team2: null, score1: null, score2: null, completed: false, round: 'final' }
      ]
    ];
    return autoAdvanceByeWinners(bracket);
  } else if (format === 'semiFinal') {
    return generateKnockoutBracketWithByes(teams.slice(0, 4));
  } else if (format === 'fullKnockout') {
    return generateKnockoutBracketWithByes(teams.slice(0, 8));
  }
};

export const updateBracket = (bracket, matchId, score1, score2) => {
  const updatedBracket = JSON.parse(JSON.stringify(bracket));
  let matchFound = false;
  let winner = null;

  for (let roundIndex = 0; roundIndex < updatedBracket.length; roundIndex++) {
    for (let matchIndex = 0; matchIndex < updatedBracket[roundIndex].length; matchIndex++) {
      const match = updatedBracket[roundIndex][matchIndex];
      if (match.id === matchId) {
        match.score1 = score1;
        match.score2 = score2;
        match.completed = true;
        winner = score1 > score2 ? match.team1 : match.team2;
        matchFound = true;

        if (match.nextMatchId) {
          for (let nextRoundIndex = roundIndex + 1; nextRoundIndex < updatedBracket.length; nextRoundIndex++) {
            for (let nextMatchIndex = 0; nextMatchIndex < updatedBracket[nextRoundIndex].length; nextMatchIndex++) {
              const nextMatch = updatedBracket[nextRoundIndex][nextMatchIndex];
              if (nextMatch.id === match.nextMatchId) {
                if (nextMatch.team1 === null) {
                  nextMatch.team1 = winner;
                } else if (nextMatch.team2 === null) {
                  nextMatch.team2 = winner;
                }
              }
            }
          }
        }
        break;
      }
    }
    if (matchFound) break;
  }

  return updatedBracket;
};
