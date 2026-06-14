// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  buildHeadToHeadIndex,
  calculatePickleballStandings,
} from '@fixture-maker/domain/sports/pickleball/PickleballRankingEngine';

const teams = [
  { id: 1, name: 'Alpha', emoji: '🏓' },
  { id: 2, name: 'Beta', emoji: '🏓' },
  { id: 3, name: 'Gamma', emoji: '🏓' },
];

describe('PickleballRankingEngine', () => {
  it('tracks head-to-head wins between teams', () => {
    const fixtures = [
      { completed: true, team1: teams[0], team2: teams[1], score1: 11, score2: 8 },
      { completed: true, team1: teams[1], team2: teams[0], score1: 11, score2: 9 },
    ];
    const index = buildHeadToHeadIndex(fixtures);
    expect(index.get('1|2')).toEqual({ '1': 1, '2': 1 });
  });

  it('breaks ties using head-to-head when points and diff are equal', () => {
    const fixtures = [
      { completed: true, team1: teams[0], team2: teams[1], score1: 11, score2: 9 },
      { completed: true, team1: teams[0], team2: teams[2], score1: 11, score2: 9 },
      { completed: true, team1: teams[1], team2: teams[2], score1: 11, score2: 9 },
      { completed: true, team1: teams[1], team2: teams[0], score1: 11, score2: 5 },
    ];
    const table = calculatePickleballStandings(teams, fixtures, {});
    expect(table[0].name).toBe('Beta');
    expect(table[1].name).toBe('Alpha');
  });
});
