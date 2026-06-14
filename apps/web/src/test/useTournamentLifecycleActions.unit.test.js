import { describe, expect, it } from 'vitest';
import {
  buildNormalizedTeamsForScheduled,
  findScheduledTournamentInHistory,
} from '../hooks/appShell/useTournamentLifecycleActions';

describe('useTournamentLifecycleActions helpers', () => {
  it('normalizes scheduled teams for doubles', () => {
    const teams = buildNormalizedTeamsForScheduled({
      gameMode: 'doubles',
      teams: [
        { name: 'Falcons', player1: 'A1', player2: 'A2' },
        { name: 'Tigers', player: 'B1', player2: 'B2' },
      ],
    });

    expect(teams).toHaveLength(2);
    expect(teams[0]).toMatchObject({
      id: 1,
      name: 'Falcons',
      player1: 'A1',
      player: 'A1',
      player2: 'A2',
    });
    expect(teams[1].player1).toBe('B1');
  });

  it('clears player2 for singles scheduled teams', () => {
    const teams = buildNormalizedTeamsForScheduled({
      gameMode: 'singles',
      teams: [{ name: 'Solo', player1: 'P1', player2: 'ignored' }],
    });

    expect(teams[0].player2).toBe('');
  });

  it('finds a scheduled tournament by id in history', () => {
    const history = [
      { id: 'live-1', status: 'active', name: 'Live Cup' },
      { id: 'sched-9', status: 'scheduled', name: 'Future Cup' },
    ];

    expect(findScheduledTournamentInHistory(history, 'sched-9')).toMatchObject({
      name: 'Future Cup',
    });
    expect(findScheduledTournamentInHistory(history, 'live-1')).toBeNull();
    expect(findScheduledTournamentInHistory(history, '')).toBeNull();
  });
});
