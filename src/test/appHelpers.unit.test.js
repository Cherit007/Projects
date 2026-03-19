// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  dedupeLiveTournaments,
  dedupeTournamentHistory,
  getTournamentProgressScore,
  pickPreferredTournament,
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
  it('keeps active + completed separate when stable ids differ', () => {
    const active = {
      id: '1711111111111',
      appwriteId: '',
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
});

describe('upsertTournamentInHistory', () => {
  it('keeps duplicate identity records separate when stable ids differ', () => {
    const history = [
      {
        id: '1711111111111',
        appwriteId: '',
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
