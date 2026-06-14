// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  applyMatchScore,
  createEmptyTeams,
  validateTeamsForStart,
} from '../lib/tournamentDraft';
import type { FixtureMatch } from '../types/tournament';

describe('mobile tournamentDraft', () => {
  it('creates empty teams for doubles', () => {
    const teams = createEmptyTeams(3, 'doubles', 'badminton');
    expect(teams).toHaveLength(3);
    expect(teams[0].emoji).toBe('🏸');
  });

  it('validates team rosters before start', () => {
    const teams = createEmptyTeams(2, 'doubles', 'badminton');
    expect(validateTeamsForStart(teams, 'doubles').valid).toBe(false);

    teams[0].name = 'A';
    teams[0].player1 = 'P1';
    teams[0].player2 = 'P2';
    teams[1].name = 'B';
    teams[1].player1 = 'P3';
    teams[1].player2 = 'P4';

    expect(validateTeamsForStart(teams, 'doubles').valid).toBe(true);
  });

  it('applies match scores immutably', () => {
    const fixtures: FixtureMatch[] = [
      {
        id: 'm1',
        team1: { id: 1, name: 'A', emoji: '🏸', player1: 'P1', player2: 'P2' },
        team2: { id: 2, name: 'B', emoji: '🏸', player1: 'P3', player2: 'P4' },
      },
    ];
    const next = applyMatchScore(fixtures, 'm1', 21, 15);
    expect(next[0].score1).toBe(21);
    expect(next[0].completed).toBe(true);
    expect(fixtures[0].completed).toBeUndefined();
  });
});
