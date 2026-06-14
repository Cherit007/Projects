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
