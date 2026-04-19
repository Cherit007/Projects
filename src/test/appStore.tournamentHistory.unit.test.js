// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest';
import { appStore } from '../store/appStore';
import { dedupeLiveTournaments } from '../utils/appHelpers';

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

  it('bridges local active and remote completed rows with different ids for the same tournament', () => {
    const rows = [
      {
        id: 'local-test-1',
        legacyTournamentId: 'local-test-1',
        appwriteId: '',
        name: 'Club Night',
        status: 'active',
        tournamentFormat: 'league',
        date: '2026-04-04T10:00:00.000Z',
        teams: [
          { id: 1, name: 'Falcons', player1: 'A1', player2: 'A2' },
          { id: 2, name: 'Tigers', player1: 'B1', player2: 'B2' },
          { id: 3, name: 'Sharks', player1: 'C1', player2: 'C2' },
        ],
        fixtures: [{ id: 'm1', completed: false }],
      },
      {
        id: 'cloud-test-1',
        appwriteId: 'cloud-test-1',
        name: 'Club Night',
        status: 'completed',
        tournamentFormat: 'league',
        date: '2026-04-04T18:00:00.000Z',
        teams: [
          { id: 1, name: 'Falcons', player1: 'A1', player2: 'A2' },
          { id: 2, name: 'Tigers', player1: 'B1', player2: 'B2' },
          { id: 3, name: 'Sharks', player1: 'C1', player2: 'C2' },
        ],
        fixtures: [{ id: 'm1', completed: true }],
        champion: { id: 1, name: 'Falcons' },
      },
    ];

    appStore.setTournamentHistory(rows);
    const history = appStore.getState().tournamentHistory;

    expect(history).toHaveLength(1);
    expect(history[0].status).toBe('completed');
    expect(history[0].champion?.name).toBe('Falcons');
  });

  it('collapses persisted cloud duplicates with different ids when payload matches', () => {
    const rows = [
      {
        id: 'cloud-test-12-a',
        appwriteId: 'cloud-test-12-a',
        name: 'test 12',
        status: 'completed',
        tournamentFormat: 'league',
        date: '2026-04-04T10:00:00.000Z',
        teams: [
          { id: 1, name: 'Falcons', player1: 'A1', player2: 'A2' },
          { id: 2, name: 'Tigers', player1: 'B1', player2: 'B2' },
          { id: 3, name: 'Sharks', player1: 'C1', player2: 'C2' },
        ],
        fixtures: [
          {
            id: 'm1-a',
            completed: true,
            team1: { name: 'Falcons', player1: 'A1', player2: 'A2' },
            team2: { name: 'Tigers', player1: 'B1', player2: 'B2' },
            team1Score: 21,
            team2Score: 18,
            winner: { name: 'Falcons', player1: 'A1', player2: 'A2' },
          },
        ],
        champion: { id: 1, name: 'Falcons', player1: 'A1', player2: 'A2' },
      },
      {
        id: 'cloud-test-12-b',
        appwriteId: 'cloud-test-12-b',
        name: 'test 12',
        status: 'completed',
        tournamentFormat: 'league',
        date: '2026-04-04T10:20:00.000Z',
        teams: [
          { id: 101, name: 'Falcons', player1: 'A1', player2: 'A2' },
          { id: 102, name: 'Tigers', player1: 'B1', player2: 'B2' },
          { id: 103, name: 'Sharks', player1: 'C1', player2: 'C2' },
        ],
        fixtures: [
          {
            id: 'm1-b',
            completed: true,
            team1: { name: 'Falcons', player1: 'A1', player2: 'A2' },
            team2: { name: 'Tigers', player1: 'B1', player2: 'B2' },
            team1Score: 21,
            team2Score: 18,
            winner: { name: 'Falcons', player1: 'A1', player2: 'A2' },
          },
        ],
        champion: { id: 99, name: 'Falcons', player1: 'A1', player2: 'A2' },
      },
    ];

    appStore.setTournamentHistory(rows);
    const history = appStore.getState().tournamentHistory;

    expect(history).toHaveLength(1);
    expect(history[0].name).toBe('test 12');
    expect(history[0].status).toBe('completed');
    expect(history[0].champion?.name).toBe('Falcons');
  });

  it('collapses stale active and completed cloud snapshots for the same tournament', () => {
    const rows = [
      {
        id: 'cloud-progress-a',
        appwriteId: 'cloud-progress-a',
        name: 'Club Night Finals',
        status: 'active',
        tournamentFormat: 'league',
        date: '2026-04-04T10:00:00.000Z',
        teams: [
          { id: 1, name: 'Falcons', player1: 'A1', player2: 'A2' },
          { id: 2, name: 'Tigers', player1: 'B1', player2: 'B2' },
          { id: 3, name: 'Sharks', player1: 'C1', player2: 'C2' },
        ],
        fixtures: [
          {
            id: 'm1-a',
            completed: true,
            team1: { name: 'Falcons', player1: 'A1', player2: 'A2' },
            team2: { name: 'Tigers', player1: 'B1', player2: 'B2' },
            score1: 21,
            score2: 18,
          },
          {
            id: 'm2-a',
            completed: false,
            team1: { name: 'Falcons', player1: 'A1', player2: 'A2' },
            team2: { name: 'Sharks', player1: 'C1', player2: 'C2' },
            score1: '',
            score2: '',
          },
        ],
      },
      {
        id: 'cloud-progress-b',
        appwriteId: 'cloud-progress-b',
        name: 'Club Night Finals',
        status: 'completed',
        tournamentFormat: 'league',
        date: '2026-04-04T18:00:00.000Z',
        teams: [
          { id: 101, name: 'Falcons', player1: 'A1', player2: 'A2' },
          { id: 102, name: 'Tigers', player1: 'B1', player2: 'B2' },
          { id: 103, name: 'Sharks', player1: 'C1', player2: 'C2' },
        ],
        fixtures: [
          {
            id: 'm1-b',
            completed: true,
            team1: { name: 'Falcons', player1: 'A1', player2: 'A2' },
            team2: { name: 'Tigers', player1: 'B1', player2: 'B2' },
            score1: 21,
            score2: 18,
          },
          {
            id: 'm2-b',
            completed: true,
            team1: { name: 'Falcons', player1: 'A1', player2: 'A2' },
            team2: { name: 'Sharks', player1: 'C1', player2: 'C2' },
            score1: 21,
            score2: 17,
          },
          {
            id: 'm3-b',
            completed: true,
            team1: { name: 'Tigers', player1: 'B1', player2: 'B2' },
            team2: { name: 'Sharks', player1: 'C1', player2: 'C2' },
            score1: 22,
            score2: 20,
          },
        ],
        finalMatch: {
          id: 'final-b',
          completed: true,
          team1: { name: 'Falcons', player1: 'A1', player2: 'A2' },
          team2: { name: 'Tigers', player1: 'B1', player2: 'B2' },
          score1: 21,
          score2: 15,
        },
        champion: { id: 99, name: 'Falcons', player1: 'A1', player2: 'A2' },
      },
    ];

    appStore.setTournamentHistory(rows);
    const history = appStore.getState().tournamentHistory;

    expect(history).toHaveLength(1);
    expect(history[0].status).toBe('completed');
    expect(history[0].champion?.name).toBe('Falcons');
    expect(dedupeLiveTournaments(history)).toHaveLength(0);
  });

  it('collapses local live rows and thin cloud summaries for the same active tournament', () => {
    const rows = [
      {
        id: 'local-test-2',
        legacyTournamentId: 'local-test-2',
        appwriteId: '',
        name: 'Club Night 2',
        status: 'active',
        tournamentFormat: 'league',
        date: '2026-04-04T10:00:00.000Z',
        teams: [
          { id: 1, name: 'Falcons', player1: 'A1', player2: 'A2' },
          { id: 2, name: 'Tigers', player1: 'B1', player2: 'B2' },
          { id: 3, name: 'Sharks', player1: 'C1', player2: 'C2' },
        ],
        fixtures: [{ id: 'm1', completed: false }],
      },
      {
        id: 'cloud-test-2',
        appwriteId: 'cloud-test-2',
        name: 'Club Night 2',
        status: 'active',
        tournamentFormat: 'league',
        date: '2026-04-04T10:05:00.000Z',
        teams: [],
        teamsCount: 0,
        fixtures: [],
        isSummary: true,
      },
    ];

    const live = dedupeLiveTournaments(rows);

    expect(live).toHaveLength(1);
    expect(live[0].name).toBe('Club Night 2');
    expect(live[0].teams).toHaveLength(3);
  });
});
