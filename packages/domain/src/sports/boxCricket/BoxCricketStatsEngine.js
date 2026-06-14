import { calculatePointsTable } from '../../scoring/index.js';
import { boxCricketSport } from '../boxCricket.config.js';

export const calculateBoxCricketTeamStats = (teams, fixtures) => (
  calculatePointsTable(teams, fixtures, boxCricketSport.scoring).map((team) => ({
    name: team.name,
    team: team.name,
    teamEmoji: team.emoji,
    matchesPlayed: team.played,
    matchesWon: team.won,
    totalScored: team.scoreFor,
    totalConceded: team.scoreAgainst,
    winPercentage: team.played > 0 ? ((team.won / team.played) * 100).toFixed(1) : '0.0',
    netRunRate: team.netRunRate ?? 0,
  }))
);
