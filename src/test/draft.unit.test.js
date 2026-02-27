// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { parsePlayerPool, runSnakeDraft } from '../utils/draft';

describe('draft utilities', () => {
  it('parses player pool and removes duplicates', () => {
    expect(parsePlayerPool('A, B\nc, a,  ,B')).toEqual(['A', 'B', 'c']);
  });

  it('runs snake draft for doubles with captains', () => {
    const teams = [
      { id: 1, name: 'T1' },
      { id: 2, name: 'T2' },
      { id: 3, name: 'T3' },
    ];
    const result = runSnakeDraft({
      teams,
      gameMode: 'doubles',
      playerPool: ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'],
      captains: ['P1', 'P2', 'P3'],
    });

    expect(result.ok).toBe(true);
    expect(result.teams).toHaveLength(3);
    const allPlayers = result.teams.flatMap((team) => [team.player1, team.player2]);
    expect(new Set(allPlayers).size).toBe(6);
  });
});

