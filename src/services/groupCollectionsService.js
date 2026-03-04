import { databases, DATABASE_ID, COLLECTIONS, ID, Query } from '../appwrite.config';

const INVITE_TTL_MS = 1000 * 60 * 60 * 24 * 30;
const PAGE_SIZE = 100;
const IN_QUERY_LIMIT = 100;

const toNonEmptyString = (value) => String(value || '').trim();
const normalizeCode = (value) => toNonEmptyString(value).toUpperCase();
const parseBoolean = (value) => {
  if (typeof value === 'boolean') return value;
  const normalized = toNonEmptyString(value).toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes';
};

const isNormalizedGroupCollectionsEnabled = () => Boolean(
  DATABASE_ID
  && COLLECTIONS.GROUPS
  && COLLECTIONS.GROUP_MEMBERS
  && COLLECTIONS.GROUP_INVITES
  && COLLECTIONS.GROUP_JOIN_REQUESTS
);

const randomInviteCode = () => Math.random().toString(36).slice(2, 10).toUpperCase();

const chunk = (items, size = IN_QUERY_LIMIT) => {
  const source = Array.isArray(items) ? items : [];
  const result = [];
  for (let i = 0; i < source.length; i += size) {
    result.push(source.slice(i, i + size));
  }
  return result;
};

const listDocumentsPaged = async (collectionId, baseQueries = []) => {
  const docs = [];
  let cursor = null;

  while (true) {
    const queries = [
      ...baseQueries,
      Query.orderAsc('$id'),
      Query.limit(PAGE_SIZE),
      ...(cursor ? [Query.cursorAfter(cursor)] : []),
    ];
    const response = await databases.listDocuments(DATABASE_ID, collectionId, queries);
    const page = response?.documents || [];

    if (page.length === 0) break;
    docs.push(...page);
    if (page.length < PAGE_SIZE) break;
    cursor = page[page.length - 1].$id;
  }

  return docs;
};

const uniqueDocuments = (docs = []) => {
  const byId = new Map();
  (Array.isArray(docs) ? docs : []).forEach((doc) => {
    const id = toNonEmptyString(doc?.$id);
    if (!id) return;
    byId.set(id, doc);
  });
  return Array.from(byId.values());
};

const listByField = (collectionId, field, value) => (
  listDocumentsPaged(collectionId, [Query.equal(field, toNonEmptyString(value))])
);

const listByDocumentIds = async (collectionId, ids = []) => {
  const normalizedIds = Array.from(new Set((Array.isArray(ids) ? ids : []).map((value) => toNonEmptyString(value)).filter(Boolean)));
  if (normalizedIds.length === 0) return [];

  const chunks = chunk(normalizedIds, IN_QUERY_LIMIT);
  const docs = [];
  for (const idSet of chunks) {
    // eslint-disable-next-line no-await-in-loop
    const page = await listDocumentsPaged(collectionId, [Query.equal('$id', idSet)]);
    docs.push(...page);
  }
  return uniqueDocuments(docs);
};

const mapGroupDoc = (doc) => ({
  id: toNonEmptyString(doc?.$id),
  name: toNonEmptyString(doc?.name),
  creatorId: toNonEmptyString(doc?.creatorId),
  createdAt: toNonEmptyString(doc?.createdAt || doc?.$createdAt),
});

const mapMemberDoc = (doc) => ({
  id: toNonEmptyString(doc?.$id),
  groupId: toNonEmptyString(doc?.groupId),
  userId: toNonEmptyString(doc?.userId),
  role: toNonEmptyString(doc?.role) || 'member',
  email: toNonEmptyString(doc?.email),
  name: toNonEmptyString(doc?.name),
  joinedAt: toNonEmptyString(doc?.joinedAt || doc?.$createdAt),
  invitedBy: toNonEmptyString(doc?.invitedBy),
});

const mapInviteDoc = (doc) => ({
  id: toNonEmptyString(doc?.$id),
  code: normalizeCode(doc?.code),
  groupId: toNonEmptyString(doc?.groupId),
  role: toNonEmptyString(doc?.role) || 'member',
  createdBy: toNonEmptyString(doc?.createdBy),
  createdAt: toNonEmptyString(doc?.createdAt || doc?.$createdAt),
  expiresAt: toNonEmptyString(doc?.expiresAt),
  revoked: parseBoolean(doc?.revoked),
});

const mapRequestDoc = (doc) => ({
  id: toNonEmptyString(doc?.$id),
  groupId: toNonEmptyString(doc?.groupId),
  userId: toNonEmptyString(doc?.userId),
  name: toNonEmptyString(doc?.name),
  email: toNonEmptyString(doc?.email),
  status: toNonEmptyString(doc?.status) || 'pending',
  createdAt: toNonEmptyString(doc?.createdAt || doc?.$createdAt),
  reviewedAt: toNonEmptyString(doc?.reviewedAt),
  reviewedBy: toNonEmptyString(doc?.reviewedBy),
});

const getGroupById = async (groupId) => {
  const normalizedGroupId = toNonEmptyString(groupId);
  if (!normalizedGroupId) return null;
  try {
    const doc = await databases.getDocument(DATABASE_ID, COLLECTIONS.GROUPS, normalizedGroupId);
    return mapGroupDoc(doc);
  } catch (error) {
    if (error?.code === 404) return null;
    throw error;
  }
};

const getMembershipByGroupAndUser = async ({ groupId, userId }) => {
  const normalizedGroupId = toNonEmptyString(groupId);
  const normalizedUserId = toNonEmptyString(userId);
  if (!normalizedGroupId || !normalizedUserId) return null;
  const docs = await listDocumentsPaged(COLLECTIONS.GROUP_MEMBERS, [
    Query.equal('groupId', normalizedGroupId),
    Query.equal('userId', normalizedUserId),
  ]);
  const first = docs[0];
  return first ? mapMemberDoc(first) : null;
};

const assertAdminMembership = async ({ groupId, userId, message = 'Only admin can perform this action' }) => {
  const membership = await getMembershipByGroupAndUser({ groupId, userId });
  if (!membership || membership.role !== 'admin') {
    throw new Error(message);
  }
  return membership;
};

export const groupCollectionsService = {
  isEnabled: isNormalizedGroupCollectionsEnabled,

  async getAllGroups() {
    const docs = await listDocumentsPaged(COLLECTIONS.GROUPS);
    return docs
      .map(mapGroupDoc)
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  },

  async getUserGroups(userId) {
    const normalizedUserId = toNonEmptyString(userId);
    if (!normalizedUserId) return [];

    const memberDocs = await listByField(COLLECTIONS.GROUP_MEMBERS, 'userId', normalizedUserId);
    const memberships = memberDocs.map(mapMemberDoc);
    const groupIds = memberships.map((membership) => membership.groupId);
    const groupDocs = await listByDocumentIds(COLLECTIONS.GROUPS, groupIds);
    const groupById = new Map(groupDocs.map((doc) => [toNonEmptyString(doc?.$id), mapGroupDoc(doc)]));

    return memberships
      .map((membership) => {
        const group = groupById.get(membership.groupId);
        if (!group) return null;
        return {
          ...group,
          role: membership.role,
          membershipId: membership.id,
        };
      })
      .filter(Boolean)
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  },

  async createGroup({ name, user }) {
    const trimmedName = toNonEmptyString(name);
    if (!trimmedName) throw new Error('Group name is required');
    const userId = toNonEmptyString(user?.$id);
    if (!userId) throw new Error('User is required');

    const now = new Date().toISOString();
    const groupId = `group-${Date.now()}`;
    await databases.createDocument(
      DATABASE_ID,
      COLLECTIONS.GROUPS,
      ID.custom(groupId),
      {
        name: trimmedName,
        creatorId: userId,
        createdAt: now,
      }
    );

    await databases.createDocument(
      DATABASE_ID,
      COLLECTIONS.GROUP_MEMBERS,
      ID.unique(),
      {
        groupId,
        userId,
        role: 'admin',
        email: toNonEmptyString(user?.email),
        name: toNonEmptyString(user?.name || user?.email),
        joinedAt: now,
        invitedBy: userId,
      }
    );

    return {
      group: {
        id: groupId,
        name: trimmedName,
        creatorId: userId,
        createdAt: now,
      },
      role: 'admin',
    };
  },

  async createInviteCode({ groupId, userId, role = 'member' }) {
    if (!['member', 'viewer'].includes(role)) {
      throw new Error('Invalid invite role');
    }
    const normalizedGroupId = toNonEmptyString(groupId);
    const normalizedUserId = toNonEmptyString(userId);
    if (!normalizedGroupId || !normalizedUserId) {
      throw new Error('Group and user are required');
    }

    await assertAdminMembership({
      groupId: normalizedGroupId,
      userId: normalizedUserId,
      message: 'Only group admin can create invites',
    });

    const code = randomInviteCode();
    const inviteDoc = await databases.createDocument(
      DATABASE_ID,
      COLLECTIONS.GROUP_INVITES,
      ID.unique(),
      {
        code,
        groupId: normalizedGroupId,
        role,
        createdBy: normalizedUserId,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + INVITE_TTL_MS).toISOString(),
        revoked: false,
      }
    );
    return mapInviteDoc(inviteDoc);
  },

  async resolveGroupByInvite(code) {
    const normalizedCode = normalizeCode(code);
    if (!normalizedCode) throw new Error('Invite code is required');

    const inviteDocs = await listByField(COLLECTIONS.GROUP_INVITES, 'code', normalizedCode);
    const invite = inviteDocs
      .map(mapInviteDoc)
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
      .find((item) => !item.revoked);

    if (!invite) throw new Error('Invalid invite code');
    if (invite.expiresAt && new Date(invite.expiresAt).getTime() < Date.now()) {
      throw new Error('Invite code expired');
    }

    const group = await getGroupById(invite.groupId);
    if (!group) throw new Error('Group no longer exists');

    return {
      group,
      role: invite.role || 'member',
      invite,
    };
  },

  async joinGroupByInvite({ code, user }) {
    const { group, role: inviteRole, invite } = await this.resolveGroupByInvite(code);
    const userId = toNonEmptyString(user?.$id);
    if (!userId) throw new Error('User is required');

    const existingMembership = await getMembershipByGroupAndUser({
      groupId: group.id,
      userId,
    });

    if (!existingMembership) {
      await databases.createDocument(
        DATABASE_ID,
        COLLECTIONS.GROUP_MEMBERS,
        ID.unique(),
        {
          groupId: group.id,
          userId,
          role: inviteRole === 'viewer' ? 'viewer' : 'member',
          email: toNonEmptyString(user?.email),
          name: toNonEmptyString(user?.name || user?.email),
          joinedAt: new Date().toISOString(),
          invitedBy: invite.createdBy,
        }
      );
    }

    return {
      group,
      role: existingMembership?.role || (inviteRole === 'viewer' ? 'viewer' : 'member'),
    };
  },

  async getMembership({ groupId, userId }) {
    return getMembershipByGroupAndUser({ groupId, userId });
  },

  async getUserPendingRequestGroupIds(userId) {
    const normalizedUserId = toNonEmptyString(userId);
    if (!normalizedUserId) return [];
    const docs = await listDocumentsPaged(COLLECTIONS.GROUP_JOIN_REQUESTS, [
      Query.equal('userId', normalizedUserId),
      Query.equal('status', 'pending'),
    ]);
    return docs
      .map(mapRequestDoc)
      .map((request) => request.groupId)
      .filter(Boolean);
  },

  async requestGroupAccess({ groupId, user }) {
    const normalizedGroupId = toNonEmptyString(groupId);
    const userId = toNonEmptyString(user?.$id);
    if (!normalizedGroupId || !userId) throw new Error('Group and user are required');

    const group = await getGroupById(normalizedGroupId);
    if (!group) throw new Error('Group not found');

    const existingMembership = await getMembershipByGroupAndUser({
      groupId: normalizedGroupId,
      userId,
    });
    if (existingMembership && existingMembership.role !== 'viewer') {
      return { status: 'already-member' };
    }

    const existingPendingDocs = await listDocumentsPaged(COLLECTIONS.GROUP_JOIN_REQUESTS, [
      Query.equal('groupId', normalizedGroupId),
      Query.equal('userId', userId),
      Query.equal('status', 'pending'),
    ]);
    const existingPending = existingPendingDocs[0] ? mapRequestDoc(existingPendingDocs[0]) : null;
    if (existingPending) {
      return { status: 'already-requested', request: existingPending };
    }

    const requestDoc = await databases.createDocument(
      DATABASE_ID,
      COLLECTIONS.GROUP_JOIN_REQUESTS,
      ID.unique(),
      {
        groupId: normalizedGroupId,
        userId,
        name: toNonEmptyString(user?.name || user?.email),
        email: toNonEmptyString(user?.email),
        status: 'pending',
        createdAt: new Date().toISOString(),
      }
    );
    return { status: 'requested', request: mapRequestDoc(requestDoc) };
  },

  async getPendingRequestsForAdmin({ groupId, adminUserId }) {
    const normalizedGroupId = toNonEmptyString(groupId);
    const normalizedAdminId = toNonEmptyString(adminUserId);
    await assertAdminMembership({
      groupId: normalizedGroupId,
      userId: normalizedAdminId,
      message: 'Only admin can view requests',
    });

    const docs = await listDocumentsPaged(COLLECTIONS.GROUP_JOIN_REQUESTS, [
      Query.equal('groupId', normalizedGroupId),
      Query.equal('status', 'pending'),
    ]);
    return docs
      .map(mapRequestDoc)
      .sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
  },

  async getRecentReviewedRequestsForAdmin({ groupId, adminUserId, limit = 8 }) {
    const normalizedGroupId = toNonEmptyString(groupId);
    const normalizedAdminId = toNonEmptyString(adminUserId);
    await assertAdminMembership({
      groupId: normalizedGroupId,
      userId: normalizedAdminId,
      message: 'Only admin can view request audit',
    });

    const docs = await listByField(COLLECTIONS.GROUP_JOIN_REQUESTS, 'groupId', normalizedGroupId);
    return docs
      .map(mapRequestDoc)
      .filter((request) => request.status === 'approved' || request.status === 'rejected')
      .sort((a, b) => {
        const left = new Date(a.reviewedAt || a.createdAt || 0).getTime();
        const right = new Date(b.reviewedAt || b.createdAt || 0).getTime();
        return right - left;
      })
      .slice(0, Math.max(1, Number(limit) || 8));
  },

  async getGroupMembersForAdmin({ groupId, adminUserId }) {
    const normalizedGroupId = toNonEmptyString(groupId);
    const normalizedAdminId = toNonEmptyString(adminUserId);
    await assertAdminMembership({
      groupId: normalizedGroupId,
      userId: normalizedAdminId,
      message: 'Only admin can view group members',
    });

    const docs = await listByField(COLLECTIONS.GROUP_MEMBERS, 'groupId', normalizedGroupId);
    return docs
      .map(mapMemberDoc)
      .sort((a, b) => new Date(a.joinedAt || 0).getTime() - new Date(b.joinedAt || 0).getTime());
  },

  async updateGroupMemberRole({ groupId, targetUserId, nextRole, adminUserId }) {
    if (!['admin', 'member', 'viewer'].includes(nextRole)) {
      throw new Error('Invalid group role');
    }

    const normalizedGroupId = toNonEmptyString(groupId);
    const normalizedAdminId = toNonEmptyString(adminUserId);
    const normalizedTargetUserId = toNonEmptyString(targetUserId);
    await assertAdminMembership({
      groupId: normalizedGroupId,
      userId: normalizedAdminId,
      message: 'Only admin can update member role',
    });

    const targetDoc = await getMembershipByGroupAndUser({
      groupId: normalizedGroupId,
      userId: normalizedTargetUserId,
    });
    if (!targetDoc) throw new Error('Group member not found');

    const allMembers = await listByField(COLLECTIONS.GROUP_MEMBERS, 'groupId', normalizedGroupId);
    const mappedMembers = allMembers.map(mapMemberDoc);
    const adminCount = mappedMembers.filter((item) => item.role === 'admin').length;
    if (targetDoc.role === 'admin' && nextRole !== 'admin' && adminCount <= 1) {
      throw new Error('Group must have at least one admin');
    }

    await databases.updateDocument(
      DATABASE_ID,
      COLLECTIONS.GROUP_MEMBERS,
      targetDoc.id,
      { role: nextRole }
    );

    return {
      status: 'updated',
      role: nextRole,
    };
  },

  async removeGroupMember({ groupId, targetUserId, adminUserId }) {
    const normalizedGroupId = toNonEmptyString(groupId);
    const normalizedAdminId = toNonEmptyString(adminUserId);
    const normalizedTargetUserId = toNonEmptyString(targetUserId);

    await assertAdminMembership({
      groupId: normalizedGroupId,
      userId: normalizedAdminId,
      message: 'Only admin can remove members',
    });

    if (normalizedTargetUserId === normalizedAdminId) {
      throw new Error('Admin cannot remove own membership');
    }

    const targetMembership = await getMembershipByGroupAndUser({
      groupId: normalizedGroupId,
      userId: normalizedTargetUserId,
    });
    if (!targetMembership) throw new Error('Group member not found');

    if (targetMembership.role === 'admin') {
      const allMembers = await listByField(COLLECTIONS.GROUP_MEMBERS, 'groupId', normalizedGroupId);
      const adminCount = allMembers
        .map(mapMemberDoc)
        .filter((item) => item.role === 'admin')
        .length;
      if (adminCount <= 1) {
        throw new Error('Cannot remove the last admin');
      }
    }

    await databases.deleteDocument(
      DATABASE_ID,
      COLLECTIONS.GROUP_MEMBERS,
      targetMembership.id
    );

    return {
      status: 'removed',
      removedUserId: normalizedTargetUserId,
    };
  },

  async approveJoinRequest({ requestId, adminUserId }) {
    const normalizedRequestId = toNonEmptyString(requestId);
    const normalizedAdminId = toNonEmptyString(adminUserId);
    const requestDoc = await databases.getDocument(
      DATABASE_ID,
      COLLECTIONS.GROUP_JOIN_REQUESTS,
      normalizedRequestId
    );
    const request = mapRequestDoc(requestDoc);
    if (!request.id) throw new Error('Request not found');
    if (request.status !== 'pending') return { status: request.status };

    await assertAdminMembership({
      groupId: request.groupId,
      userId: normalizedAdminId,
      message: 'Only admin can approve',
    });

    const existingMembership = await getMembershipByGroupAndUser({
      groupId: request.groupId,
      userId: request.userId,
    });
    if (existingMembership) {
      if (existingMembership.role !== 'member') {
        await databases.updateDocument(
          DATABASE_ID,
          COLLECTIONS.GROUP_MEMBERS,
          existingMembership.id,
          { role: 'member' }
        );
      }
    } else {
      await databases.createDocument(
        DATABASE_ID,
        COLLECTIONS.GROUP_MEMBERS,
        ID.unique(),
        {
          groupId: request.groupId,
          userId: request.userId,
          role: 'member',
          email: request.email,
          name: request.name,
          joinedAt: new Date().toISOString(),
          invitedBy: normalizedAdminId,
        }
      );
    }

    await databases.updateDocument(
      DATABASE_ID,
      COLLECTIONS.GROUP_JOIN_REQUESTS,
      request.id,
      {
        status: 'approved',
        reviewedAt: new Date().toISOString(),
        reviewedBy: normalizedAdminId,
      }
    );

    return { status: 'approved' };
  },

  async rejectJoinRequest({ requestId, adminUserId }) {
    const normalizedRequestId = toNonEmptyString(requestId);
    const normalizedAdminId = toNonEmptyString(adminUserId);
    const requestDoc = await databases.getDocument(
      DATABASE_ID,
      COLLECTIONS.GROUP_JOIN_REQUESTS,
      normalizedRequestId
    );
    const request = mapRequestDoc(requestDoc);
    if (!request.id) throw new Error('Request not found');
    if (request.status !== 'pending') return { status: request.status };

    await assertAdminMembership({
      groupId: request.groupId,
      userId: normalizedAdminId,
      message: 'Only admin can reject',
    });

    await databases.updateDocument(
      DATABASE_ID,
      COLLECTIONS.GROUP_JOIN_REQUESTS,
      request.id,
      {
        status: 'rejected',
        reviewedAt: new Date().toISOString(),
        reviewedBy: normalizedAdminId,
      }
    );

    return { status: 'rejected' };
  },
};

export { isNormalizedGroupCollectionsEnabled };
