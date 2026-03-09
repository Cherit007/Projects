// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest';
import { appStore } from '../store/appStore';

describe('appStore tournament history guard', () => {
  beforeEach(() => {
    appStore.resetState();
  });

  it('dedupes repeated records when setting tournament history', () => {
    const duplicateRows = [
      {
        id: 'cloud-city-1',
        appwriteId: 'cloud-city-1',
        name: 'City Open',
        status: 'active',
        tournamentFormat: 'league',
        date: '2026-03-09T10:00:00.000Z',
        teams: [{ id: 1 }, { id: 2 }],
        fixtures: [],
      },
      {
        id: '',
        appwriteId: '',
        name: 'City Open',
        status: 'active',
        tournamentFormat: 'league',
        _fromLock: true,
        date: '2026-03-09T10:15:00.000Z',
        teams: [{ id: 1 }, { id: 2 }],
        fixtures: [{ id: 'm1', completed: false }],
      },
      {
        id: 'cloud-city-1',
        appwriteId: 'cloud-city-1',
        name: 'City Open',
        status: 'completed',
        tournamentFormat: 'league',
        date: '2026-03-09T18:00:00.000Z',
        teams: [{ id: 1 }, { id: 2 }],
        fixtures: [{ id: 'm1', completed: true }],
        champion: { id: 1, name: 'Falcons' },
      },
    ];

    appStore.setTournamentHistory(duplicateRows);
    const history = appStore.getState().tournamentHistory;

    expect(history).toHaveLength(1);
    expect(history[0].status).toBe('completed');
    expect(history[0].champion?.name).toBe('Falcons');
  });

  it('stores cloned snapshots so later source mutation cannot overlap data', () => {
    const source = [
      {
        id: 'cloud-snapshot-1',
        appwriteId: 'cloud-snapshot-1',
        name: 'Snapshot Cup',
        status: 'active',
        tournamentFormat: 'league',
        teams: [{ id: 1, name: 'Original Team' }],
        fixtures: [{ id: 'm1', completed: false }],
      },
    ];

    appStore.setTournamentHistory(source);
    source[0].teams[0].name = 'Mutated Team';
    source[0].fixtures[0].completed = true;

    const history = appStore.getState().tournamentHistory;
    expect(history[0].teams[0].name).toBe('Original Team');
    expect(history[0].fixtures[0].completed).toBe(false);
  });
});
