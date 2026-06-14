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
  isGroupRosterCollectionEnabled: () => true,
  toAuxiliaryGroupId: (groupId) => String(groupId || 'default-group'),
}));

vi.mock('@fixture-maker/api/appwrite/client', () => ({
  databases: databasesMock,
  DATABASE_ID: 'db1',
  COLLECTIONS: {
    GROUP_ROSTER: 'group_roster',
  },
  ID: { unique: vi.fn(() => 'generated-id') },
  Query: {
    equal: vi.fn((...args) => ({ op: 'equal', args })),
    orderAsc: vi.fn((...args) => ({ op: 'orderAsc', args })),
    limit: vi.fn((...args) => ({ op: 'limit', args })),
    cursorAfter: vi.fn((...args) => ({ op: 'cursorAfter', args })),
  },
}));

import { groupRosterService } from '../services/groupRosterService';

describe('groupRosterService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    databasesMock.listDocuments.mockResolvedValue({ documents: [] });
  });

  it('maps roster documents to member objects', async () => {
    databasesMock.listDocuments.mockResolvedValueOnce({
      documents: [{
        $id: 'doc-1',
        legacyMemberId: 'member-1',
        name: 'Alex',
        phone: '555-0100',
        linkedAccountId: 'user-1',
        linkedEmail: 'alex@example.com',
      }],
    });

    const result = await groupRosterService.listMembers('g-1');

    expect(result).toEqual([{
      id: 'member-1',
      name: 'Alex',
      phone: '555-0100',
      linkedAccountId: 'user-1',
      linkedEmail: 'alex@example.com',
    }]);
  });

  it('saves members to roster collection', async () => {
    await groupRosterService.saveMembers([
      { id: 'member-2', name: 'Bailey', phone: '555-0101' },
    ], 'g-1');

    expect(databasesMock.upsertDocument).toHaveBeenCalledWith(
      'db1',
      'group_roster',
      expect.any(String),
      expect.objectContaining({
        groupId: 'g-1',
        legacyMemberId: 'member-2',
        name: 'Bailey',
      })
    );
  });
});
