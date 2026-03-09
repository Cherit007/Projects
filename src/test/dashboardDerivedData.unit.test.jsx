import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useDashboardDerivedData } from '../hooks/useDashboardDerivedData';

vi.mock('../services/analyticsWorkerService', () => ({
  analyticsWorkerService: {
    isSupported: () => false,
  },
}));

describe('useDashboardDerivedData', () => {
  it('filters ELO leaderboard names that are not present in recorded matches', () => {
    const tournamentHistory = [
      {
        id: 'tour-1',
        teams: [],
        fixtures: [
          {
            id: 'm1',
            completed: true,
            score1: 21,
            score2: 16,
            team1: { id: 1, name: 'Falcons', player1: 'Alice', player2: 'Amy' },
            team2: { id: 2, name: 'Tigers', player1: 'Bob', player2: 'Ben' },
          },
        ],
        bracket: [],
      },
    ];
    const playerRatings = {
      Alice: { rating: 1030, matchesPlayed: 1, history: [{}] },
      Bob: { rating: 1010, matchesPlayed: 1, history: [{}] },
      Ghost: { rating: 1000, matchesPlayed: 0, history: [] },
    };

    const { result } = renderHook(() => useDashboardDerivedData({
      tournamentHistory,
      casualMatches: [],
      playerRatings,
    }));

    const names = result.current.eloLeaderboard.map((entry) => entry.name);
    expect(names).toContain('Alice');
    expect(names).toContain('Bob');
    expect(names).not.toContain('Ghost');
  });

  it('keeps players that only exist in casual matches and filters stale ratings', () => {
    const playerRatings = {
      CasualA: { rating: 1020, matchesPlayed: 1, history: [{}] },
      CasualB: { rating: 1015, matchesPlayed: 1, history: [{}] },
      Ghost: { rating: 1300, matchesPlayed: 12, history: Array.from({ length: 12 }, () => ({})) },
    };

    const { result } = renderHook(() => useDashboardDerivedData({
      tournamentHistory: [],
      casualMatches: [
        {
          completed: true,
          team1: { player1: 'CasualA', player2: 'CasualA2' },
          team2: { player1: 'CasualB', player2: 'CasualB2' },
          score1: 21,
          score2: 19,
        },
      ],
      playerRatings,
    }));

    const names = result.current.eloLeaderboard.map((entry) => entry.name);
    expect(names).toContain('CasualA');
    expect(names).toContain('CasualB');
    expect(names).not.toContain('CasualA2');
    expect(names).not.toContain('CasualB2');
    expect(names).not.toContain('Ghost');
  });
});
