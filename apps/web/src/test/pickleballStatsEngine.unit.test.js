// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  calculatePickleballPlayerStats,
  normalizePickleballMatchStatistics,
} from '@fixture-maker/domain/sports/pickleball/PickleballStatsEngine';

const createTeams = () => ([
  {
    id: 1,
    name: 'Team 1',
    emoji: '🏓',
    player1: 'Alex',
    player2: 'Blair',
  },
  {
    id: 2,
    name: 'Team 2',
    emoji: '🏓',
    player1: 'Casey',
    player2: 'Dana',
  },
]);

describe('PickleballStatsEngine', () => {
  it('normalizes team stat payloads', () => {
    expect(normalizePickleballMatchStatistics({
      team1: { aces: 2, serviceWins: -1 },
      team2: { aces: '3' },
    })).toEqual({
      team1: {
        aces: 2,
        serviceWins: 0,
        serviceFaults: 0,
        unforcedErrors: 0,
        forcedErrors: 0,
        longRalliesWon: 0,
      },
      team2: {
        aces: 3,
        serviceWins: 0,
        serviceFaults: 0,
        unforcedErrors: 0,
        forcedErrors: 0,
        longRalliesWon: 0,
      },
    });
  });

  it('aggregates optional match statistics into player stats', () => {
    const teams = createTeams();
    const fixtures = [{
      completed: true,
      team1: teams[0],
      team2: teams[1],
      score1: 11,
      score2: 8,
      statistics: {
        team1: { aces: 2, serviceWins: 4 },
        team2: { aces: 1, serviceWins: 2 },
      },
    }];

    const stats = calculatePickleballPlayerStats(teams, fixtures);
    const alex = stats.find((entry) => entry.name === 'Alex');
    const casey = stats.find((entry) => entry.name === 'Casey');
    expect(alex?.aces).toBe(2);
    expect(alex?.serviceWins).toBe(4);
    expect(casey?.aces).toBe(1);
    expect(alex?.totalScored).toBe(11);
  });
});
