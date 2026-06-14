import { describe, expect, it } from 'vitest';
import { injectRotatingOddPlayer } from '../utils/oddPlayerInjection';

const buildTeams = () => ([
  { id: 1, name: 'A', player1: 'P1', player2: 'P2' },
  { id: 2, name: 'B', player1: 'P3', player2: 'P4' },
  { id: 3, name: 'C', player1: 'P5', player2: 'P6' },
]);

describe('injectRotatingOddPlayer', () => {
  it('returns fixtures unchanged when odd player name is empty', () => {
    const fixtures = [{ id: 1, team1: {}, team2: {} }];
    expect(injectRotatingOddPlayer({ fixtures, oddPlayerName: '  ' })).toBe(fixtures);
  });

  it('injects the odd player into league fixtures', () => {
    const teams = buildTeams();
    const fixtures = [
      {
        id: 1,
        team1: { ...teams[0] },
        team2: { ...teams[1] },
      },
      {
        id: 2,
        team1: { ...teams[0] },
        team2: { ...teams[2] },
      },
    ];

    const updated = injectRotatingOddPlayer({
      fixtures,
      teams,
      oddPlayerName: 'Bench',
    });

    expect(updated).toHaveLength(2);
    const players = updated.flatMap((fixture) => [
      fixture.team1.player1,
      fixture.team1.player2,
      fixture.team2.player1,
      fixture.team2.player2,
    ]);
    expect(players).toContain('Bench');
  });
});
