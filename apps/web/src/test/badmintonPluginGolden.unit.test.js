// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { getSportPlugin } from '@fixture-maker/domain/sports';
import { calculateNewElo } from '@fixture-maker/domain/scoring';
import { calculatePlayerStats } from '@fixture-maker/domain/stats';
import { FixtureEngine } from '@fixture-maker/domain/fixture';

const createTeams = (count) => (
  Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    name: `Team ${index + 1}`,
    emoji: '🏸',
    player1: `P${index + 1}A`,
    player2: `P${index + 1}B`,
  }))
);

describe('badminton plugin golden values', () => {
  const plugin = getSportPlugin('badminton');
  const teams = createTeams(4);

  it('generates six league fixtures for four teams', () => {
    const result = plugin.fixture.generateFixturesByFormat(teams, {
      tournamentFormat: 'league',
      format: '1',
    });
    expect(result.fixtures).toHaveLength(6);
    expect(result.fixtures.every((match) => match.team1 && match.team2)).toBe(true);
  });

  it('awards two points per win in default standings', () => {
    const fixtures = [{
      id: 'm1',
      completed: true,
      score1: 21,
      score2: 15,
      team1: teams[0],
      team2: teams[1],
    }];
    const table = plugin.rankings.calculateStandings(teams.slice(0, 2), fixtures, {});
    const winner = table.find((row) => row.id === teams[0].id);
    const loser = table.find((row) => row.id === teams[1].id);
    expect(winner?.points).toBe(2);
    expect(loser?.points).toBe(0);
    expect(winner?.won).toBe(1);
  });

  it('calculates expected ELO delta for a 21-15 win', () => {
    const nextRating = calculateNewElo(1000, 1000, 1, { kFactor: 32 });
    expect(nextRating).toBeGreaterThan(1000);
    expect(nextRating).toBe(1016);
  });

  it('aggregates player stats for completed doubles matches', () => {
    const fixtures = [{
      id: 'm1',
      completed: true,
      score1: 21,
      score2: 10,
      team1: teams[0],
      team2: teams[1],
    }];
    const stats = plugin.stats.calculatePlayerStats(teams.slice(0, 2), fixtures);
    const alice = stats.find((entry) => entry.name === 'P1A');
    expect(alice?.matchesWon).toBe(1);
    expect(alice?.totalScored).toBe(21);
  });

  it('matches legacy FixtureEngine league output shape', () => {
    const pluginResult = plugin.fixture.generateFixturesByFormat(teams, {
      tournamentFormat: 'league',
      format: '1',
    });
    const engineResult = FixtureEngine.generateFixturesByFormat(teams, {
      tournamentFormat: 'league',
      format: '1',
    });
    expect(pluginResult.fixtures?.length).toBe(engineResult.fixtures?.length);
    const stats = calculatePlayerStats(teams, pluginResult.fixtures || []);
    expect(stats.every((entry) => Number(entry.matchesPlayed || 0) === 0)).toBe(true);
  });
});
