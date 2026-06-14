import { resolveScoringConfig } from './scoringConfig.js';

export const calculatePointsTable = (teams, fixtures, config) => {
  const { pointsPerWin } = resolveScoringConfig(config);
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
          table[team1Index].points += pointsPerWin;
        } else {
          table[team2Index].won++;
          table[team1Index].lost++;
          table[team2Index].points += pointsPerWin;
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
