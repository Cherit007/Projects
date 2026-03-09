// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { buildSuggestionPlayerDatabase } from '../hooks/appShell/useTournamentShell';

describe('buildSuggestionPlayerDatabase', () => {
  it('excludes stale names that exist only in the raw player database', () => {
    const suggestions = buildSuggestionPlayerDatabase({
      tournamentHistory: [
        {
          fixtures: [
            {
              team1: { player1: 'Alice', player2: 'Amy' },
              team2: { player1: 'Bob', player2: 'Ben' },
            },
          ],
        },
      ],
      playerDatabase: ['Alice', 'Amy', 'Bob', 'Ben', 'Ghost'],
    });

    expect(suggestions).toEqual(['Alice', 'Amy', 'Ben', 'Bob']);
    expect(suggestions).not.toContain('Ghost');
  });

  it('keeps member names and normalizes duplicate casing from persisted entries', () => {
    const suggestions = buildSuggestionPlayerDatabase({
      members: [{ name: 'zeeshan' }],
      teams: [{ player1: 'alice', player2: 'amy' }],
      playerDatabase: ['ALICE', 'AMY', 'ZEESHAN', 'Ghost'],
    });

    expect(suggestions).toEqual(['ALICE', 'AMY', 'ZEESHAN']);
    expect(suggestions).not.toContain('Ghost');
  });

  it('includes casual match players while still excluding stale raw entries', () => {
    const suggestions = buildSuggestionPlayerDatabase({
      casualMatches: [
        {
          team1: { player1: 'CasualA' },
          team2: { player1: 'CasualB' },
        },
      ],
      playerDatabase: ['CasualA', 'CasualB', 'Ghost'],
    });

    expect(suggestions).toEqual(['CasualA', 'CasualB']);
    expect(suggestions).not.toContain('Ghost');
  });
});
