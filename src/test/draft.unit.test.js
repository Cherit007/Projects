// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  applyRandomOddPlayerSwapToLeagueFixtures,
  buildRandomOddPlayerSwapRound,
  parsePlayerPool,
  runSnakeDraft,
} from '../utils/draft';

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

  it('builds a random odd-player round with one player benched after the swap', () => {
    const teams = [
      { id: 1, name: 'Falcons', player1: 'A1', player: 'A1', player2: 'A2' },
      { id: 2, name: 'Tigers', player1: 'B1', player: 'B1', player2: 'B2' },
      { id: 3, name: 'Sharks', player1: 'C1', player: 'C1', player2: 'C2' },
    ];
    const result = buildRandomOddPlayerSwapRound({
      teams,
      oddPlayerName: 'Z9',
      random: () => 0,
    });

    expect(result.ok).toBe(true);
    expect(result.sittingOutPlayer).toBe('A2');
    expect(result.selectedTeamName).toBe('Falcons');
    expect(result.teams).toEqual([
      { id: 1, name: 'Falcons', player1: 'Z9', player: 'Z9', player2: 'B1' },
      { id: 2, name: 'Tigers', player1: 'B2', player: 'B2', player2: 'C1' },
      { id: 3, name: 'Sharks', player1: 'C2', player: 'C2', player2: 'A1' },
    ]);
    const activePlayers = result.teams.flatMap((team) => [team.player1, team.player2]);
    expect(new Set(activePlayers).size).toBe(6);
    expect(activePlayers).toContain('Z9');
    expect(activePlayers).not.toContain('A2');
  });

  it('applies the odd-player swap to each generated league fixture independently', () => {
    const teams = [
      { id: 1, name: 'Falcons', player1: 'A1', player: 'A1', player2: 'A2', emoji: '🦅' },
      { id: 2, name: 'Tigers', player1: 'B1', player: 'B1', player2: 'B2', emoji: '🐯' },
      { id: 3, name: 'Sharks', player1: 'C1', player: 'C1', player2: 'C2', emoji: '🦈' },
    ];
    const fixtures = [
      { id: 1, team1: teams[0], team2: teams[2], completed: false, round: 1 },
      { id: 2, team1: teams[0], team2: teams[1], completed: false, round: 2 },
    ];
    const randomSequence = [0, 0, 0, 0, 0, 0, 0.9, 0.75, 0.8, 0.7, 0.6, 0.5, 0.34, 0.9];
    let callIndex = 0;
    const result = applyRandomOddPlayerSwapToLeagueFixtures({
      fixtures,
      teams,
      oddPlayerName: 'Z9',
      random: () => {
        const value = randomSequence[callIndex] ?? 0;
        callIndex += 1;
        return value;
      },
    });

    expect(result.ok).toBe(true);
    expect(result.fixtures).toHaveLength(2);
    expect(result.fixtures.every((fixture) => fixture.roundTeams?.length === 3)).toBe(true);
    expect(result.fixtures.every((fixture) => fixture.oddPlayerMeta?.activeOddPlayerName === 'Z9')).toBe(true);
    expect(result.fixtures.every((fixture) => fixture.oddPlayerMeta?.sittingOutPlayerName)).toBe(true);
    expect(result.fixtures.every((fixture) => (
      [fixture.team1.player1, fixture.team1.player2, fixture.team2.player1, fixture.team2.player2].includes('Z9')
    ))).toBe(true);
  });
});
