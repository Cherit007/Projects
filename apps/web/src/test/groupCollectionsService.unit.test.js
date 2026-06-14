import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  databasesMock,
  state,
  collectionById,
  resetState,
} = vi.hoisted(() => {
  const initialState = {
    groups: [],
    members: [],
    invites: [],
    requests: [],
  };
  const store = structuredClone(initialState);
  let uniqueCounter = 1;

  const collectionMap = {
    groups: 'groups',
    group_members: 'members',
    group_invites: 'invites',
    group_join_requests: 'requests',
  };

  const getDocs = (collectionId) => {
    const key = collectionMap[collectionId];
    if (!key) return [];
    return store[key];
  };

  const cloneDocs = (docs) => docs.map((doc) => ({ ...doc }));

  const applyFilters = (docs, queries = []) => (
    docs.filter((doc) => (
      (queries || []).every((query) => {
        if (!query || query.op !== 'equal') return true;
        const [field, expected] = query.args || [];
        const left = field === '$id' ? doc.$id : doc?.[field];
        if (Array.isArray(expected)) {
          return expected.map((item) => String(item ?? '')).includes(String(left ?? ''));
        }
        return String(left ?? '') === String(expected ?? '');
      })
    ))
  );

  const databases = {
    listDocuments: vi.fn(async (_databaseId, collectionId, queries = []) => ({
      documents: cloneDocs(applyFilters(getDocs(collectionId), queries)),
    })),
    getDocument: vi.fn(async (_databaseId, collectionId, documentId) => {
      const doc = getDocs(collectionId).find((item) => item.$id === documentId);
      if (!doc) {
        throw { code: 404, message: 'Not found' };
      }
      return { ...doc };
    }),
    createDocument: vi.fn(async (_databaseId, collectionId, documentId, payload) => {
      const id = String(documentId || `unique-${uniqueCounter++}`);
      const row = { $id: id, ...payload };
      getDocs(collectionId).push(row);
      return { ...row };
    }),
    updateDocument: vi.fn(async (_databaseId, collectionId, documentId, payload) => {
      const docs = getDocs(collectionId);
      const index = docs.findIndex((item) => item.$id === documentId);
      if (index < 0) {
        throw { code: 404, message: 'Not found' };
      }
      docs[index] = { ...docs[index], ...payload };
      return { ...docs[index] };
    }),
    deleteDocument: vi.fn(async (_databaseId, collectionId, documentId) => {
      const docs = getDocs(collectionId);
      const next = docs.filter((item) => item.$id !== documentId);
      docs.splice(0, docs.length, ...next);
    }),
  };

  const reset = () => {
    store.groups = [];
    store.members = [];
    store.invites = [];
    store.requests = [];
    uniqueCounter = 1;
    Object.values(databases).forEach((fn) => fn.mockClear());
  };

  return {
    databasesMock: databases,
    state: store,
    collectionById: collectionMap,
    resetState: reset,
  };
});

vi.mock('@fixture-maker/api/appwrite/client', () => ({
  databases: databasesMock,
  DATABASE_ID: 'db1',
  COLLECTIONS: {
    GROUPS: 'groups',
    GROUP_MEMBERS: 'group_members',
    GROUP_INVITES: 'group_invites',
    GROUP_JOIN_REQUESTS: 'group_join_requests',
  },
  ID: {
    unique: vi.fn(() => ''),
    custom: vi.fn((value) => value),
  },
  Query: {
    equal: vi.fn((...args) => ({ op: 'equal', args })),
    orderAsc: vi.fn((...args) => ({ op: 'orderAsc', args })),
    limit: vi.fn((...args) => ({ op: 'limit', args })),
    cursorAfter: vi.fn((...args) => ({ op: 'cursorAfter', args })),
  },
}));

import { groupCollectionsService } from '../services/groupCollectionsService';

describe('groupCollectionsService', () => {
  beforeEach(() => {
    resetState();
  });

  it('resolves invite by code and ignores revoked entries', async () => {
    state.groups.push({
      $id: 'g-1',
      name: 'Night Smashers',
      creatorId: 'u-admin',
      createdAt: '2026-03-01T10:00:00.000Z',
    });
    state.invites.push(
      {
        $id: 'inv-old',
        code: 'ABCD1234',
        groupId: 'g-1',
        role: 'member',
        createdBy: 'u-admin',
        createdAt: '2026-03-01T10:00:00.000Z',
        expiresAt: '2030-01-01T00:00:00.000Z',
        revoked: false,
      },
      {
        $id: 'inv-new-revoked',
        code: 'ABCD1234',
        groupId: 'g-1',
        role: 'viewer',
        createdBy: 'u-admin',
        createdAt: '2026-03-03T10:00:00.000Z',
        expiresAt: '2030-01-01T00:00:00.000Z',
        revoked: 'true',
      }
    );

    const result = await groupCollectionsService.resolveGroupByInvite('abcd1234');

    expect(result.group).toMatchObject({ id: 'g-1', name: 'Night Smashers' });
    expect(result.role).toBe('member');
    expect(result.invite.id).toBe('inv-old');
  });

  it('throws when invite exists but is expired', async () => {
    state.groups.push({
      $id: 'g-1',
      name: 'Morning Rally',
      creatorId: 'u-admin',
      createdAt: '2026-03-01T10:00:00.000Z',
    });
    state.invites.push({
      $id: 'inv-1',
      code: 'ZXCV9999',
      groupId: 'g-1',
      role: 'member',
      createdBy: 'u-admin',
      createdAt: '2026-03-02T10:00:00.000Z',
      expiresAt: '2000-01-01T00:00:00.000Z',
      revoked: false,
    });

    await expect(groupCollectionsService.resolveGroupByInvite('ZXCV9999'))
      .rejects.toThrow('Invite code expired');
  });

  it('blocks demoting the final admin', async () => {
    state.members.push({
      $id: 'm-admin',
      groupId: 'g-1',
      userId: 'u-admin',
      role: 'admin',
      email: 'admin@club.com',
      name: 'Admin',
      joinedAt: '2026-03-01T10:00:00.000Z',
    });

    await expect(groupCollectionsService.updateGroupMemberRole({
      groupId: 'g-1',
      targetUserId: 'u-admin',
      nextRole: 'member',
      adminUserId: 'u-admin',
    })).rejects.toThrow('Group must have at least one admin');

    expect(databasesMock.updateDocument).not.toHaveBeenCalled();
  });

  it('approves pending request and upgrades existing membership to member', async () => {
    state.members.push(
      {
        $id: 'm-admin',
        groupId: 'g-1',
        userId: 'u-admin',
        role: 'admin',
        email: 'admin@club.com',
        name: 'Admin',
        joinedAt: '2026-03-01T10:00:00.000Z',
      },
      {
        $id: 'm-viewer',
        groupId: 'g-1',
        userId: 'u-2',
        role: 'viewer',
        email: 'player@club.com',
        name: 'Player',
        joinedAt: '2026-03-01T10:05:00.000Z',
      }
    );
    state.requests.push({
      $id: 'req-1',
      groupId: 'g-1',
      userId: 'u-2',
      name: 'Player',
      email: 'player@club.com',
      status: 'pending',
      createdAt: '2026-03-02T10:00:00.000Z',
    });

    const result = await groupCollectionsService.approveJoinRequest({
      requestId: 'req-1',
      adminUserId: 'u-admin',
    });

    expect(result).toEqual({ status: 'approved' });
    expect(state.members.find((member) => member.$id === 'm-viewer')?.role).toBe('member');
    expect(state.requests.find((request) => request.$id === 'req-1')?.status).toBe('approved');
    expect(state.requests.find((request) => request.$id === 'req-1')?.reviewedBy).toBe('u-admin');

    const memberCreateCalls = databasesMock.createDocument.mock.calls
      .filter(([, collectionId]) => collectionId === collectionById.group_members);
    expect(memberCreateCalls).toHaveLength(0);
  });

  it('blocks admin from removing own membership', async () => {
    state.members.push({
      $id: 'm-admin',
      groupId: 'g-1',
      userId: 'u-admin',
      role: 'admin',
      email: 'admin@club.com',
      name: 'Admin',
      joinedAt: '2026-03-01T10:00:00.000Z',
    });

    await expect(groupCollectionsService.removeGroupMember({
      groupId: 'g-1',
      targetUserId: 'u-admin',
      adminUserId: 'u-admin',
    })).rejects.toThrow('Admin cannot remove own membership');

    expect(databasesMock.deleteDocument).not.toHaveBeenCalled();
  });
});
