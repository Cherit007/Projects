import { describe, expect, it } from 'vitest';
import * as tournamentHooks from '../hooks/tournament';
import { useTournamentActions } from '../hooks/useTournamentActions';

describe('tournament module exports', () => {
  it('re-exports split tournament hooks from the barrel', () => {
    expect(typeof tournamentHooks.useFixtureActions).toBe('function');
    expect(typeof tournamentHooks.useScoringActions).toBe('function');
    expect(typeof tournamentHooks.useTournamentPersistence).toBe('function');
    expect(typeof tournamentHooks.useTournamentHistory).toBe('function');
    expect(typeof tournamentHooks.useCasualMatchActions).toBe('function');
    expect(typeof tournamentHooks.createSwapTeamMember).toBe('function');
  });

  it('keeps useTournamentActions as the unified composer export', () => {
    expect(typeof useTournamentActions).toBe('function');
  });
});
