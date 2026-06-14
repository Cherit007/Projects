// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { databasesMock } = vi.hoisted(() => ({
  databasesMock: {
    listDocuments: vi.fn(),
    upsertDocument: vi.fn(),
    deleteDocument: vi.fn(),
  },
}));

vi.mock('../services/appAuxiliaryConfig', () => ({
  isTournamentTemplatesCollectionEnabled: () => true,
  toAuxiliaryGroupId: (groupId) => String(groupId || 'default-group'),
}));

vi.mock('@fixture-maker/api/appwrite/client', () => ({
  databases: databasesMock,
  DATABASE_ID: 'db1',
  COLLECTIONS: {
    TOURNAMENT_TEMPLATES: 'tournament_templates',
  },
  ID: { unique: vi.fn(() => 'generated-id') },
  Query: {
    equal: vi.fn((...args) => ({ op: 'equal', args })),
    orderAsc: vi.fn((...args) => ({ op: 'orderAsc', args })),
    limit: vi.fn((...args) => ({ op: 'limit', args })),
    cursorAfter: vi.fn((...args) => ({ op: 'cursorAfter', args })),
  },
}));

import { tournamentTemplatesService } from '../services/tournamentTemplatesService';

describe('tournamentTemplatesService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    databasesMock.listDocuments.mockResolvedValue({ documents: [] });
  });

  it('lists templates for a group', async () => {
    databasesMock.listDocuments.mockResolvedValueOnce({
      documents: [{
        $id: 'doc-1',
        legacyTemplateId: 'template-1',
        name: 'Weekend League',
        gameMode: 'doubles',
        tournamentFormat: 'league',
        format: '1',
        numTeams: '4',
        teamsJson: '[]',
        sourceCreatedAt: '2026-03-01T10:00:00.000Z',
        sourceUpdatedAt: '2026-03-01T10:00:00.000Z',
      }],
    });

    const result = await tournamentTemplatesService.listTemplates('g-1');

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 'template-1',
      name: 'Weekend League',
      numTeams: 4,
    });
  });

  it('upserts templates and removes stale docs', async () => {
    databasesMock.listDocuments.mockResolvedValueOnce({
      documents: [{
        $id: 'stale-doc',
        legacyTemplateId: 'old-template',
        groupId: 'g-1',
      }],
    });
    databasesMock.listDocuments.mockResolvedValueOnce({ documents: [] });

    await tournamentTemplatesService.saveTemplates([
      {
        id: 'template-2',
        name: 'Knockout Night',
        gameMode: 'doubles',
        tournamentFormat: 'fullKnockout',
        format: '1',
        numTeams: 8,
        teams: [],
      },
    ], 'g-1');

    expect(databasesMock.upsertDocument).toHaveBeenCalled();
    expect(databasesMock.deleteDocument).toHaveBeenCalledWith(
      'db1',
      'tournament_templates',
      'stale-doc'
    );
  });
});
