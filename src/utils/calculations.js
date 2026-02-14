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

        if (match.score1 > match.score2) {
          table[team1Index].won++;
          table[team1Index].points += 2;
          table[team2Index].lost++;
        } else {
          table[team2Index].won++;
          table[team2Index].points += 2;
          table[team1Index].lost++;
        }
      }
    }
  });

  table.forEach(team => {
    team.scoreDiff = team.scoreFor - team.scoreAgainst;
  });

  return table.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    return b.scoreDiff - a.scoreDiff;
  });
};

// Calculate Player Statistics
export const calculatePlayerStats = (teams, fixtures) => {
  const playerStats = {};

  teams.forEach(team => {
    [team.player1, team.player2].forEach(player => {
      if (player && !playerStats[player]) {
        playerStats[player] = {
          name: player,
          team: team.name,
          teamEmoji: team.emoji,
          matchesPlayed: 0,
          matchesWon: 0,
          totalScored: 0,
          totalConceded: 0,
          winPercentage: 0,
        };
      }
    });
  });

  fixtures.forEach(match => {
    if (match.completed) {
      const team1Won = match.score1 > match.score2;
      
      [match.team1.player1, match.team1.player2].forEach(player => {
        if (player && playerStats[player]) {
          playerStats[player].matchesPlayed++;
          playerStats[player].totalScored += match.score1;
          playerStats[player].totalConceded += match.score2;
          if (team1Won) playerStats[player].matchesWon++;
        }
      });

      [match.team2.player1, match.team2.player2].forEach(player => {
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

  return Object.values(playerStats).sort((a, b) => b.matchesWon - a.matchesWon);
};

// Calculate cumulative player stats across all tournaments
export const calculateCumulativePlayerStats = (tournamentHistory) => {
  const cumulativeStats = {};

  tournamentHistory.forEach(tournament => {
    tournament.fixtures?.forEach(match => {
      if (match.completed) {
        const team1Won = match.score1 > match.score2;
        
        [match.team1.player1, match.team1.player2].forEach(player => {
          if (player) {
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
            cumulativeStats[player].tournamentsPlayed.add(tournament.id);
            cumulativeStats[player].matchesPlayed++;
            cumulativeStats[player].totalScored += match.score1;
            cumulativeStats[player].totalConceded += match.score2;
            if (team1Won) cumulativeStats[player].matchesWon++;
          }
        });

        [match.team2.player1, match.team2.player2].forEach(player => {
          if (player) {
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
            cumulativeStats[player].tournamentsPlayed.add(tournament.id);
            cumulativeStats[player].matchesPlayed++;
            cumulativeStats[player].totalScored += match.score2;
            cumulativeStats[player].totalConceded += match.score1;
            if (!team1Won) cumulativeStats[player].matchesWon++;
          }
        });
      }
    });

    if (tournament.champion) {
      [tournament.champion.player1, tournament.champion.player2].forEach(player => {
        if (player && cumulativeStats[player]) {
          cumulativeStats[player].championships++;
        }
      });
    }
  });

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
    return b.winPercentage - a.winPercentage;
  });
};

// Generate fixtures for round-robin tournament
export const generateFixtures = (teams, format) => {
  const matchesPerPair = parseInt(format);
  const newFixtures = [];
  let matchId = 1;

  for (let i = 0; i < teams.length; i++) {
    for (let j = i + 1; j < teams.length; j++) {
      for (let round = 0; round < matchesPerPair; round++) {
        newFixtures.push({
          id: matchId++,
          team1: teams[i],
          team2: teams[j],
          score1: null,
          score2: null,
          completed: false,
          round: round + 1,
        });
      }
    }
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
            date: new Date().toISOString()
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
            date: new Date().toISOString()
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
    .sort((a, b) => b.rating - a.rating);
};

// Generate knockout bracket
export const generateKnockoutBracket = (teams, format) => {
  const shuffledTeams = [...teams].sort(() => Math.random() - 0.5);
  let matchId = 1;
  
  if (format === 'semiFinal') {
    const bracket = [
      [
        { id: matchId++, team1: shuffledTeams[0], team2: shuffledTeams[1], score1: null, score2: null, completed: false, round: 'semi', nextMatchId: 3 },
        { id: matchId++, team1: shuffledTeams[2], team2: shuffledTeams[3], score1: null, score2: null, completed: false, round: 'semi', nextMatchId: 3 }
      ],
      [
        { id: matchId++, team1: null, team2: null, score1: null, score2: null, completed: false, round: 'final' }
      ]
    ];
    return bracket;
  } else if (format === 'fullKnockout') {
    const bracket = [
      [
        { id: matchId++, team1: shuffledTeams[0], team2: shuffledTeams[1], score1: null, score2: null, completed: false, round: 'quarter', nextMatchId: 5 },
        { id: matchId++, team1: shuffledTeams[2], team2: shuffledTeams[3], score1: null, score2: null, completed: false, round: 'quarter', nextMatchId: 5 },
        { id: matchId++, team1: shuffledTeams[4], team2: shuffledTeams[5], score1: null, score2: null, completed: false, round: 'quarter', nextMatchId: 6 },
        { id: matchId++, team1: shuffledTeams[6], team2: shuffledTeams[7], score1: null, score2: null, completed: false, round: 'quarter', nextMatchId: 6 }
      ],
      [
        { id: matchId++, team1: null, team2: null, score1: null, score2: null, completed: false, round: 'semi', nextMatchId: 7 },
        { id: matchId++, team1: null, team2: null, score1: null, score2: null, completed: false, round: 'semi', nextMatchId: 7 }
      ],
      [
        { id: matchId++, team1: null, team2: null, score1: null, score2: null, completed: false, round: 'final' }
      ]
    ];
    return bracket;
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