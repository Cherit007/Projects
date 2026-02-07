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