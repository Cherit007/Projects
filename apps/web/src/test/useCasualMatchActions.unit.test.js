import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useCasualMatchActions } from '../hooks/tournament/useCasualMatchActions';

describe('useCasualMatchActions', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('records a casual match locally and updates ratings', async () => {
    const casualMatches = [];
    const playerRatings = {
      A1: { rating: 1000, matchesPlayed: 0, history: [] },
      A2: { rating: 1000, matchesPlayed: 0, history: [] },
      B1: { rating: 1000, matchesPlayed: 0, history: [] },
      B2: { rating: 1000, matchesPlayed: 0, history: [] },
    };

    const setCasualMatches = vi.fn((updater) => {
      const next = typeof updater === 'function' ? updater(casualMatches) : updater;
      casualMatches.splice(0, casualMatches.length, ...next);
      return next;
    });
    const setPlayerRatings = vi.fn();
    const showToast = vi.fn();
    const setShowCasualMatch = vi.fn();

    const { result } = renderHook(() => useCasualMatchActions({
      assertCanOperate: () => true,
      assertCanDelete: () => true,
      confirmAction: vi.fn(async () => true),
      showToast,
      isAppwriteEnabled: false,
      playerRatings,
      setPlayerRatings,
      tournamentHistory: [],
      casualMatches,
      setCasualMatches,
      setShowCasualMatch,
      createCasualMatchMutation: { mutateAsync: vi.fn() },
      deleteCasualMatchMutation: { mutateAsync: vi.fn() },
      rebuildPlayerDatabase: vi.fn(async () => {}),
      recalculateEloFromHistory: vi.fn(() => playerRatings),
    }));

    await act(async () => {
      const outcome = await result.current.saveCasualMatch({
        team1: { player1: 'A1', player2: 'A2' },
        team2: { player1: 'B1', player2: 'B2' },
        score1: 21,
        score2: 15,
      });
      expect(outcome.success).toBe(true);
    });

    expect(setPlayerRatings).toHaveBeenCalled();
    expect(setCasualMatches).toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith('✅ Match recorded & ELO updated!');
    expect(setShowCasualMatch).toHaveBeenCalledWith(false);
  });

  it('deletes a casual match after confirmation', async () => {
    const casualMatches = [{ id: 'casual-1', team1: {}, team2: {} }];
    const setCasualMatches = vi.fn();
    const setPlayerRatings = vi.fn();
    const confirmAction = vi.fn(async () => true);
    const rebuildPlayerDatabase = vi.fn(async () => {});

    const { result } = renderHook(() => useCasualMatchActions({
      assertCanOperate: () => true,
      assertCanDelete: () => true,
      confirmAction,
      showToast: vi.fn(),
      isAppwriteEnabled: false,
      playerRatings: {},
      setPlayerRatings,
      tournamentHistory: [],
      casualMatches,
      setCasualMatches,
      setShowCasualMatch: vi.fn(),
      createCasualMatchMutation: { mutateAsync: vi.fn() },
      deleteCasualMatchMutation: { mutateAsync: vi.fn() },
      rebuildPlayerDatabase,
      recalculateEloFromHistory: vi.fn(() => ({})),
    }));

    let deleted = false;
    await act(async () => {
      deleted = await result.current.handleDeleteCasualMatchFromSetup('casual-1');
    });

    expect(deleted).toBe(true);
    expect(confirmAction).toHaveBeenCalled();
    expect(setCasualMatches).toHaveBeenCalledWith([]);
    expect(rebuildPlayerDatabase).toHaveBeenCalled();
  });
});
