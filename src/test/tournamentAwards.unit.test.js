// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { computeTournamentAwards } from '../utils/tournamentAwards';

const teams = [
  { id: 1, name: 'Team A', player1: 'P1', player2: 'P2' },
  { id: 2, name: 'Team B', player1: 'P3', player2: 'P4' },
  { id: 3, name: 'Team C', player1: 'P5', player2: 'P6' },
];

describe('computeTournamentAwards', () => {
  it('builds MVP ranking and award cards from completed matches', () => {
    const fixtures = [
      { completed: true, team1: teams[0], team2: teams[1], score1: 21, score2: 15 },
      { completed: true, team1: teams[0], team2: teams[2], score1: 21, score2: 19 },
      { completed: true, team1: teams[1], team2: teams[2], score1: 18, score2: 21 },
    ];
    const finalMatch = { completed: true, team1: teams[0], team2: teams[2], score1: 21, score2: 17 };
    const champion = teams[0];

    const result = computeTournamentAwards({
      teams,
      fixtures,
      bracket: [],
      finalMatch,
      champion,
    });

    expect(result).toBeTruthy();
    expect(result.mvpRanking.length).toBeGreaterThan(0);
    expect(result.mvpRanking[0].name).toBe('P1');
    expect(result.awards.some((award) => award.id === 'top-scorer')).toBe(true);
    expect(result.awards.some((award) => award.id === 'best-pair')).toBe(true);
  });

  it('returns null when no completed matches are available', () => {
    const result = computeTournamentAwards({
      teams,
      fixtures: [{ completed: false, team1: teams[0], team2: teams[1], score1: null, score2: null }],
      bracket: [],
      champion: null,
    });

    expect(result).toBeNull();
  });
});

