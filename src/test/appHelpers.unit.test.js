// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  dedupeLiveTournaments,
  dedupeTournamentHistory,
  formatTournamentDateLabel,
  getTournamentProgressScore,
  parseTournamentDateMs,
  pickPreferredTournament,
  sortCasualMatchesByRecent,
  sortTournamentHistoryByRecent,
  upsertTournamentInHistory,
} from '../utils/appHelpers';

describe('pickPreferredTournament', () => {
  it('prefers richer payload over summary when no matches are completed yet', () => {
    const summary = {
      id: 'tour-1',
      name: 'Club Night',
      status: 'active',
      isSummary: true,
      teams: [],
      fixtures: [],
      bracket: [],
    };
    const detailedFromLock = {
      id: 'tour-1',
      name: 'Club Night',
      status: 'active',
      teams: [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }],
      fixtures: [
        { id: 'm1', completed: false },
        { id: 'm2', completed: false },
      ],
      bracket: [],
    };

    expect(getTournamentProgressScore(detailedFromLock)).toBeGreaterThan(getTournamentProgressScore(summary));
    expect(pickPreferredTournament(summary, detailedFromLock)).toEqual(detailedFromLock);
  });

  it('still prefers more completed progress when both payloads are detailed', () => {
    const earlier = {
      id: 'tour-2',
      teams: [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }],
      fixtures: [
        { id: 'm1', completed: true },
        { id: 'm2', completed: false },
      ],
      bracket: [],
    };
    const later = {
      ...earlier,
      fixtures: [
        { id: 'm1', completed: true },
        { id: 'm2', completed: true },
      ],
    };

    expect(pickPreferredTournament(earlier, later)).toEqual(later);
  });

  it('prefers stable cloud id when scores are tied', () => {
    const localDraft = {
      id: '1711111111111',
      appwriteId: '',
      name: 'Tie Break Cup',
      status: 'active',
      teams: [{ id: 1 }, { id: 2 }],
      fixtures: [{ id: 'm1', completed: false }],
      bracket: [],
    };
    const cloud = {
      id: 'cloud-123',
      appwriteId: 'cloud-123',
      name: 'Tie Break Cup',
      status: 'active',
      teams: [{ id: 1 }, { id: 2 }],
      fixtures: [{ id: 'm1', completed: false }],
      bracket: [],
    };

    expect(pickPreferredTournament(localDraft, cloud)).toEqual(cloud);
  });
});

describe('dedupeLiveTournaments', () => {
  it('collapses duplicate live entries for same tournament when one is summary/lock data', () => {
    const summary = {
      id: 'tour-dup',
      appwriteId: 'tour-dup',
      name: 'Club Night',
      status: 'active',
      teams: [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }],
      fixtures: [],
      bracket: [],
      isSummary: true,
      tournamentFormat: 'league',
      date: '2026-03-09T10:00:00.000Z',
    };
    const detailedLock = {
      id: '',
      appwriteId: '',
      name: 'Club Night',
      status: 'active',
      teams: [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }],
      fixtures: [{ id: 'm1', completed: false }],
      bracket: [],
      _fromLock: true,
      tournamentFormat: 'league',
      date: '2026-03-09T16:20:00.000Z',
    };

    const deduped = dedupeLiveTournaments([summary, detailedLock]);
    expect(deduped).toHaveLength(1);
    expect(deduped[0].name).toBe('Club Night');
    expect(deduped[0].fixtures).toEqual(detailedLock.fixtures);
    expect(deduped[0].status).toBe('active');
  });

  it('keeps distinct live tournaments separate', () => {
    const first = {
      id: 'tour-a',
      appwriteId: 'tour-a',
      name: 'Morning League',
      status: 'active',
      teams: [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }],
      fixtures: [],
      bracket: [],
      tournamentFormat: 'league',
      date: '2026-03-09T09:00:00.000Z',
    };
    const second = {
      id: 'tour-b',
      appwriteId: 'tour-b',
      name: 'Evening League',
      status: 'active',
      teams: [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }],
      fixtures: [],
      bracket: [],
      tournamentFormat: 'league',
      date: '2026-03-09T18:00:00.000Z',
    };

    const deduped = dedupeLiveTournaments([first, second]);
    expect(deduped).toHaveLength(2);
  });

  it('collapses cloud + local draft when team signatures match', () => {
    const localDraft = {
      id: '1711111111111',
      appwriteId: '',
      name: 'Night League',
      status: 'active',
      tournamentFormat: 'league',
      date: '2026-03-09T20:00:00.000Z',
      teams: [
        { id: 1, name: 'Falcons', player1: 'A1', player2: 'A2' },
        { id: 2, name: 'Tigers', player1: 'B1', player2: 'B2' },
      ],
      fixtures: [{ id: 'm1', completed: true }, { id: 'm2', completed: false }],
      bracket: [],
    };
    const cloud = {
      id: 'cloud-night-1',
      appwriteId: 'cloud-night-1',
      name: 'Night League',
      status: 'active',
      tournamentFormat: 'league',
      date: '2026-03-09T20:15:00.000Z',
      teams: [
        { id: 1, name: 'Falcons', player1: 'A1', player2: 'A2' },
        { id: 2, name: 'Tigers', player1: 'B1', player2: 'B2' },
      ],
      fixtures: [{ id: 'm1', completed: true }, { id: 'm2', completed: false }],
      bracket: [],
    };

    const deduped = dedupeLiveTournaments([localDraft, cloud]);
    expect(deduped).toHaveLength(1);
    expect(deduped[0].appwriteId).toBe('cloud-night-1');
  });

  it('ignores stale active copy when completed version exists', () => {
    const staleActive = {
      id: '',
      appwriteId: '',
      name: 'Weekend Cup',
      status: 'active',
      tournamentFormat: 'league',
      date: '2026-03-09T12:00:00.000Z',
      teams: [
        { id: 1, name: 'Falcons', player1: 'A1', player2: 'A2' },
        { id: 2, name: 'Tigers', player1: 'B1', player2: 'B2' },
      ],
      fixtures: [{ id: 'm1', completed: false }],
      bracket: [],
    };
    const completed = {
      id: 'cloud-weekend-1',
      appwriteId: 'cloud-weekend-1',
      name: 'Weekend Cup',
      status: 'completed',
      champion: { id: 1, name: 'Falcons' },
      tournamentFormat: 'league',
      date: '2026-03-09T16:00:00.000Z',
      teams: [
        { id: 1, name: 'Falcons', player1: 'A1', player2: 'A2' },
        { id: 2, name: 'Tigers', player1: 'B1', player2: 'B2' },
      ],
      fixtures: [{ id: 'm1', completed: true }],
      bracket: [],
    };

    const deduped = dedupeLiveTournaments([staleActive, completed]);
    expect(deduped).toHaveLength(0);
  });
});

describe('dedupeTournamentHistory', () => {
  it('keeps cloud active + completed separate when payloads differ', () => {
    const active = {
      id: 'cloud-grand-live',
      appwriteId: 'cloud-grand-live',
      name: 'Grand Slam',
      status: 'active',
      tournamentFormat: 'league',
      date: '2026-03-09T10:00:00.000Z',
      teams: [
        { id: 1, name: 'Falcons', player1: 'A1', player2: 'A2' },
        { id: 2, name: 'Tigers', player1: 'B1', player2: 'B2' },
      ],
      fixtures: [{ id: 'm1', completed: false }],
      bracket: [],
      champion: null,
    };
    const completed = {
      id: 'cloud-grand-1',
      appwriteId: 'cloud-grand-1',
      name: 'Grand Slam',
      status: 'completed',
      tournamentFormat: 'league',
      date: '2026-03-09T18:00:00.000Z',
      teams: active.teams,
      fixtures: [{ id: 'm1', completed: true }],
      bracket: [],
      champion: { id: 1, name: 'Falcons' },
    };

    const deduped = dedupeTournamentHistory([active, completed]);
    expect(deduped).toHaveLength(2);
    expect(deduped.some((item) => item?.status === 'completed')).toBe(true);
  });

  it('keeps stable-id tournaments separate even with same name/date', () => {
    const first = {
      id: 'cloud-1',
      appwriteId: 'cloud-1',
      name: 'Club Night',
      status: 'active',
      tournamentFormat: 'league',
      date: '2026-03-09T20:00:00.000Z',
      teams: [{ id: 1 }, { id: 2 }],
    };
    const second = {
      id: 'cloud-2',
      appwriteId: 'cloud-2',
      name: 'Club Night',
      status: 'active',
      tournamentFormat: 'league',
      date: '2026-03-09T20:20:00.000Z',
      teams: [{ id: 1 }, { id: 2 }],
    };

    const deduped = dedupeTournamentHistory([first, second]);
    expect(deduped).toHaveLength(2);
  });

  it('returns cloned tournament payloads to prevent shared-state overlap', () => {
    const source = [{
      id: 'local-1',
      name: 'Clone Check',
      status: 'active',
      tournamentFormat: 'league',
      teams: [{ id: 1, name: 'Falcons' }],
      fixtures: [{ id: 'm1', completed: false }],
    }];

    const deduped = dedupeTournamentHistory(source);
    source[0].teams[0].name = 'Renamed';
    source[0].fixtures[0].completed = true;

    expect(deduped[0].teams[0].name).toBe('Falcons');
    expect(deduped[0].fixtures[0].completed).toBe(false);
  });

  it('collapses triple duplicate records from summary/lock/completed into one completed row', () => {
    const summary = {
      id: 'cloud-tour-1',
      appwriteId: 'cloud-tour-1',
      name: 'City Cup',
      status: 'active',
      isSummary: true,
      tournamentFormat: 'league',
      date: '2026-03-09T10:00:00.000Z',
      teams: [{ id: 1 }, { id: 2 }],
      fixtures: [],
    };
    const lockCopy = {
      id: '',
      appwriteId: '',
      name: 'City Cup',
      status: 'active',
      _fromLock: true,
      tournamentFormat: 'league',
      date: '2026-03-09T10:30:00.000Z',
      teams: [{ id: 1 }, { id: 2 }],
      fixtures: [{ id: 'm1', completed: false }],
    };
    const completed = {
      id: 'cloud-tour-1',
      appwriteId: 'cloud-tour-1',
      name: 'City Cup',
      status: 'completed',
      tournamentFormat: 'league',
      date: '2026-03-09T18:00:00.000Z',
      teams: [{ id: 1 }, { id: 2 }],
      fixtures: [{ id: 'm1', completed: true }],
      champion: { id: 1, name: 'Falcons' },
    };

    const deduped = dedupeTournamentHistory([summary, lockCopy, completed]);
    expect(deduped).toHaveLength(1);
    expect(deduped[0].status).toBe('completed');
    expect(deduped[0].champion?.name).toBe('Falcons');
  });

  it('collapses identical cloud duplicates with different ids when payload matches', () => {
    const first = {
      id: 'cloud-city-1',
      appwriteId: 'cloud-city-1',
      name: 'City Cup',
      status: 'completed',
      tournamentFormat: 'league',
      date: '2026-03-09T10:00:00.000Z',
      teams: [
        { id: 1, name: 'Falcons', player1: 'A1', player2: 'A2' },
        { id: 2, name: 'Tigers', player1: 'B1', player2: 'B2' },
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
    };
    const second = {
      id: 'cloud-city-2',
      appwriteId: 'cloud-city-2',
      name: 'City Cup',
      status: 'completed',
      tournamentFormat: 'league',
      date: '2026-03-09T10:20:00.000Z',
      teams: [
        { id: 11, name: 'Falcons', player1: 'A1', player2: 'A2' },
        { id: 22, name: 'Tigers', player1: 'B1', player2: 'B2' },
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
    };

    const deduped = dedupeTournamentHistory([first, second]);
    expect(deduped).toHaveLength(1);
    expect(deduped[0].status).toBe('completed');
    expect(deduped[0].champion?.name).toBe('Falcons');
  });
});

describe('upsertTournamentInHistory', () => {
  it('keeps cloud identity records separate when payloads differ', () => {
    const history = [
      {
        id: 'cloud-spring-live',
        appwriteId: 'cloud-spring-live',
        name: 'Spring Open',
        status: 'active',
        tournamentFormat: 'league',
        date: '2026-03-09T10:00:00.000Z',
        teams: [{ id: 1 }, { id: 2 }],
      },
      {
        id: 'old-2',
        appwriteId: 'old-2',
        name: 'Other Tournament',
        status: 'completed',
      },
    ];
    const incoming = {
      id: 'cloud-spring-1',
      appwriteId: 'cloud-spring-1',
      name: 'Spring Open',
      status: 'completed',
      tournamentFormat: 'league',
      date: '2026-03-09T18:00:00.000Z',
      teams: [{ id: 1 }, { id: 2 }],
      champion: { id: 1, name: 'Team 1' },
    };

    const next = upsertTournamentInHistory(history, incoming);
    const springRows = next.filter((item) => item?.name === 'Spring Open');
    expect(springRows).toHaveLength(2);
    expect(springRows.some((item) => item?.status === 'completed')).toBe(true);
    expect(next).toHaveLength(3);
  });

  it('stores a cloned snapshot of incoming tournament', () => {
    const incoming = {
      id: 'cloud-snapshot-1',
      appwriteId: 'cloud-snapshot-1',
      name: 'Snapshot Cup',
      status: 'active',
      teams: [{ id: 1, name: 'Original Team' }],
      fixtures: [{ id: 'm1', completed: false }],
    };

    const next = upsertTournamentInHistory([], incoming);
    incoming.teams[0].name = 'Mutated Team';
    incoming.fixtures[0].completed = true;

    expect(next[0].teams[0].name).toBe('Original Team');
    expect(next[0].fixtures[0].completed).toBe(false);
  });
});

describe('sortTournamentHistoryByRecent', () => {
  it('sorts latest to oldest using updatedAt when date is same-day locale text', () => {
    const sorted = sortTournamentHistoryByRecent([
      {
        id: 'older',
        name: 'Morning Cup',
        date: '2/10/2026',
        updatedAt: '2026-10-02T09:00:00.000Z',
      },
      {
        id: 'newer',
        name: 'Evening Cup',
        date: '2/10/2026',
        updatedAt: '2026-10-02T20:00:00.000Z',
      },
      {
        id: 'mid',
        name: 'Afternoon Cup',
        date: '2/10/2026',
        createdAt: '2026-10-02T14:00:00.000Z',
      },
    ]);

    expect(sorted.map((item) => item.id)).toEqual(['newer', 'mid', 'older']);
  });

  it('keeps played date order even when an older tournament was edited or migrated later', () => {
    const sorted = sortTournamentHistoryByRecent([
      {
        id: 'played-sep',
        date: '2026-09-01T12:00:00.000Z',
        createdAt: '2026-09-01T12:00:00.000Z',
      },
      {
        id: 'played-aug-edited-oct',
        date: '2026-08-01T12:00:00.000Z',
        updatedAt: '2026-10-01T12:00:00.000Z',
        sourceCreatedAt: '2026-10-01T12:00:00.000Z',
        migratedAt: '2026-10-01T12:00:00.000Z',
      },
    ]);

    expect(sorted.map((item) => item.id)).toEqual(['played-sep', 'played-aug-edited-oct']);
  });

  it('reads d/m/yyyy locale dates day-first so October sorts above September', () => {
    const sorted = sortTournamentHistoryByRecent([
      { id: 'sep-26', name: 'Sep 26 3rd', date: '26/9/2026' },
      { id: 'oct-4', name: 'Oct 4 2nd', date: '4/10/2026' },
      { id: 'sep-5', name: 'Sep 5', date: '5/9/2026' },
      { id: 'oct-10', name: 'Oct 10', date: '10/10/2026' },
    ]);

    expect(sorted.map((item) => item.id)).toEqual(['oct-10', 'oct-4', 'sep-26', 'sep-5']);
  });

  it('orders same-day tournaments by their own timestamps', () => {
    const sorted = sortTournamentHistoryByRecent([
      { id: 'oct-4-1st', date: '4/10/2026', createdAt: '2026-10-04T10:00:00.000Z' },
      { id: 'oct-4-3rd', date: '4/10/2026', completedAt: '2026-10-04T15:00:00.000Z' },
      { id: 'oct-4-2nd', date: '4/10/2026', createdAt: '2026-10-04T12:00:00.000Z' },
      { id: 'sep-26', date: '26/9/2026', updatedAt: '2026-10-09T12:00:00.000Z' },
    ]);

    expect(sorted.map((item) => item.id)).toEqual(['oct-4-3rd', 'oct-4-2nd', 'oct-4-1st', 'sep-26']);
  });
});

describe('parseTournamentDateMs', () => {
  it('parses d/m/yyyy and locale date-times day-first', () => {
    expect(new Date(parseTournamentDateMs('4/10/2026')).toDateString())
      .toBe(new Date(2026, 9, 4).toDateString());
    expect(new Date(parseTournamentDateMs('26/9/2026')).toDateString())
      .toBe(new Date(2026, 8, 26).toDateString());
    expect(parseTournamentDateMs('4/10/2026, 6:30:00 pm'))
      .toBe(new Date(2026, 9, 4, 18, 30, 0).getTime());
  });

  it('falls back to month-first only when the day-first reading is impossible', () => {
    expect(parseTournamentDateMs('9/26/2026')).toBe(new Date(2026, 8, 26).getTime());
  });

  it('still parses ISO strings', () => {
    expect(parseTournamentDateMs('2026-10-04T10:00:00.000Z')).toBe(Date.parse('2026-10-04T10:00:00.000Z'));
  });
});

describe('formatTournamentDateLabel', () => {
  it('omits a fake midnight time for date-only values', () => {
    expect(formatTournamentDateLabel('4/10/2026')).toBe(new Date(2026, 9, 4).toLocaleDateString());
  });
});

describe('sortCasualMatchesByRecent', () => {
  it('sorts casual matches latest to oldest using completedAt/createdAt', () => {
    const sorted = sortCasualMatchesByRecent([
      {
        id: 'older',
        date: '2/10/2026',
        createdAt: '2026-10-02T09:00:00.000Z',
      },
      {
        id: 'newer',
        date: '2/10/2026',
        completedAt: '2026-10-02T20:00:00.000Z',
      },
      {
        id: 'mid',
        date: '2/10/2026',
        createdAt: '2026-10-02T14:00:00.000Z',
      },
    ]);

    expect(sorted.map((item) => item.id)).toEqual(['newer', 'mid', 'older']);
  });
});
