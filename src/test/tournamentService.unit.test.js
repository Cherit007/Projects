import { beforeEach, describe, expect, it, vi } from 'vitest';

const { databasesMock } = vi.hoisted(() => ({
  databasesMock: {
    listDocuments: vi.fn(),
    getDocument: vi.fn(),
    upsertDocument: vi.fn(),
    deleteDocument: vi.fn(),
  },
}));

vi.mock('../appwrite.config', () => ({
  databases: databasesMock,
  DATABASE_ID: 'db1',
  COLLECTIONS: {
    TOURNAMENTS: 'legacy_tournaments',
    TOURNAMENTS_V2: 'v2_tournaments',
    TOURNAMENT_TEAMS_V2: 'v2_tournament_teams',
    MATCHES_V2: 'v2_matches',
    MATCH_PLAYERS_V2: 'v2_match_players',
    PLAYERS_V2: 'v2_players',
  },
  ID: { unique: vi.fn(() => 'id-1') },
  Query: {
    equal: vi.fn((...args) => ({ op: 'equal', args })),
    orderDesc: vi.fn((...args) => ({ op: 'orderDesc', args })),
    orderAsc: vi.fn((...args) => ({ op: 'orderAsc', args })),
    limit: vi.fn((...args) => ({ op: 'limit', args })),
    cursorAfter: vi.fn((...args) => ({ op: 'cursorAfter', args })),
  },
}));

import { tournamentService } from '../services/tournamentService';

describe('tournamentService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('maps v2 tournament summaries', async () => {
    databasesMock.listDocuments.mockResolvedValueOnce({
      documents: [{
        $id: 't1',
        groupId: 'default-group',
        legacyTournamentId: 'legacy-1',
        name: 'Club Open',
        dateLabel: '2026-03-03',
        status: 'active',
        gameMode: 'doubles',
        tournamentFormat: 'league',
        format: '1',
        oddPlayerEnabled: 'false',
        oddPlayerName: '',
        sourceCreatedAt: '2026-03-03T10:00:00.000Z',
        sourceUpdatedAt: '2026-03-03T10:05:00.000Z',
        $createdAt: '2026-03-03T10:00:00.000Z',
        $updatedAt: '2026-03-03T10:05:00.000Z',
      }],
    });

    const result = await tournamentService.getTournamentSummaries(20, null, ['active']);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 't1',
      appwriteId: 't1',
      name: 'Club Open',
      status: 'active',
      isSummary: true,
    });
  });

  it('returns false when deleting a missing tournament', async () => {
    databasesMock.getDocument.mockRejectedValueOnce({ code: 404 });

    const result = await tournamentService.deleteTournament('missing-id', null);

    expect(result).toBe(false);
  });
});
