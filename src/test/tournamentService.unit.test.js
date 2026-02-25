import { beforeEach, describe, expect, it, vi } from 'vitest';

const databasesMock = {
  updateDocument: vi.fn(),
};

vi.mock('../appwrite.config', () => ({
  databases: databasesMock,
  DATABASE_ID: 'db1',
  COLLECTIONS: { TOURNAMENTS: 'tournaments' },
  ID: { unique: vi.fn(() => 'id-1') },
  Query: { orderDesc: vi.fn(), limit: vi.fn() },
}));

import { tournamentService } from '../services/tournamentService';

describe('tournamentService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('builds update payload with nullable fields and tournamentFormat', async () => {
    databasesMock.updateDocument.mockResolvedValueOnce({
      $id: 't1',
      name: 'Cup',
      date: '2026-02-25',
      teams: '[]',
      fixtures: '[]',
      bracket: null,
      finalMatch: null,
      champion: null,
      aiSummaries: '[]',
      format: '1',
      gameMode: 'doubles',
      tournamentFormat: 'league',
      status: 'active',
      createdAt: '2026-02-25T10:00:00.000Z',
    });

    await tournamentService.updateTournament('t1', {
      bracket: null,
      finalMatch: null,
      champion: null,
      aiSummaries: [],
      tournamentFormat: 'fullKnockout',
      status: 'completed',
    });

    const payload = databasesMock.updateDocument.mock.calls[0][3];
    expect(payload.bracket).toBeNull();
    expect(payload.finalMatch).toBeNull();
    expect(payload.champion).toBeNull();
    expect(payload.aiSummaries).toBe('[]');
    expect(payload.tournamentFormat).toBe('fullKnockout');
    expect(payload.status).toBe('completed');
  });

  it('parses tournament document including ai summaries', () => {
    const result = tournamentService.parseTournament({
      $id: 't2',
      name: 'Open',
      date: '2026-02-25',
      teams: '[{"id":1}]',
      fixtures: '[{"id":"m1"}]',
      bracket: null,
      finalMatch: null,
      champion: null,
      aiSummaries: '[{"id":"s1","title":"Summary"}]',
      format: '2',
      gameMode: 'singles',
      tournamentFormat: 'league',
      status: 'completed',
      createdAt: '2026-02-25T10:00:00.000Z',
    });

    expect(result.id).toBe('t2');
    expect(result.teams).toHaveLength(1);
    expect(result.aiSummaries[0].id).toBe('s1');
    expect(result.appwriteId).toBe('t2');
  });
});
