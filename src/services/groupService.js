import { groupCollectionsService } from './groupCollectionsService';
import { queueLocalStorageJson } from './localStorageWriteService';

const INVITE_TTL_MS = 1000 * 60 * 60 * 24 * 30;
const LOCAL_GROUP_META_KEY = 'badminton_group_meta';

const randomInviteCode = () => Math.random().toString(36).slice(2, 10).toUpperCase();

const getMetaWithDefaults = async () => {
  const meta = JSON.parse(localStorage.getItem(LOCAL_GROUP_META_KEY) || '{}');
  return {
    ...meta,
    groups: Array.isArray(meta.groups) ? meta.groups : [],
    groupMembers: Array.isArray(meta.groupMembers) ? meta.groupMembers : [],
    groupInvites: Array.isArray(meta.groupInvites) ? meta.groupInvites : [],
    groupJoinRequests: Array.isArray(meta.groupJoinRequests) ? meta.groupJoinRequests : [],
  };
};

const saveMeta = async ({ groups, groupMembers, groupInvites, groupJoinRequests }) => {
  const payload = { groups, groupMembers, groupInvites, groupJoinRequests };
  queueLocalStorageJson(LOCAL_GROUP_META_KEY, payload);
  return payload;
};

const legacyGroupService = {
  async getAllGroups() {
    const meta = await getMetaWithDefaults();
    return [...meta.groups].sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  },

  async getUserGroups(userId) {
    const meta = await getMetaWithDefaults();
    const memberships = meta.groupMembers.filter(member => member.userId === userId);

    return memberships
      .map((membership) => {
        const group = meta.groups.find(item => item.id === membership.groupId);
        if (!group) return null;
        return {
          ...group,
          role: membership.role,
          membershipId: membership.id,
        };
      })
      .filter(Boolean);
  },

  async createGroup({ name, user }) {
    const trimmedName = name?.trim();
    if (!trimmedName) throw new Error('Group name is required');

    const meta = await getMetaWithDefaults();
    const groupId = `group-${Date.now()}`;
    const group = {
      id: groupId,
      name: trimmedName,
      creatorId: user.$id,
      createdAt: new Date().toISOString(),
    };
    const adminMembership = {
      id: `membership-${Date.now()}`,
      groupId,
      userId: user.$id,
      role: 'admin',
      email: user.email,
      name: user.name || user.email,
      joinedAt: new Date().toISOString(),
      invitedBy: user.$id,
    };

    await saveMeta({
      groups: [group, ...meta.groups],
      groupMembers: [adminMembership, ...meta.groupMembers],
      groupInvites: meta.groupInvites,
      groupJoinRequests: meta.groupJoinRequests,
    });

    return { group, role: 'admin' };
  },

  async createInviteCode({ groupId, userId, role = 'member' }) {
    if (!['member', 'viewer'].includes(role)) {
      throw new Error('Invalid invite role');
    }

    const meta = await getMetaWithDefaults();
    const membership = meta.groupMembers.find(
      item => item.groupId === groupId && item.userId === userId
    );

    if (!membership || membership.role !== 'admin') {
      throw new Error('Only group admin can create invites');
    }

    const code = randomInviteCode();
    const invite = {
      id: `invite-${Date.now()}`,
      code,
      groupId,
      role,
      createdBy: userId,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + INVITE_TTL_MS).toISOString(),
      revoked: false,
    };

    await saveMeta({
      groups: meta.groups,
      groupMembers: meta.groupMembers,
      groupInvites: [invite, ...meta.groupInvites],
      groupJoinRequests: meta.groupJoinRequests,
    });

    return invite;
  },

  async resolveGroupByInvite(code) {
    const normalizedCode = code?.trim().toUpperCase();
    if (!normalizedCode) throw new Error('Invite code is required');

    const meta = await getMetaWithDefaults();
    const invite = meta.groupInvites.find(item => item.code === normalizedCode);

    if (!invite || invite.revoked) throw new Error('Invalid invite code');
    if (invite.expiresAt && new Date(invite.expiresAt).getTime() < Date.now()) {
      throw new Error('Invite code expired');
    }

    const group = meta.groups.find(item => item.id === invite.groupId);
    if (!group) throw new Error('Group no longer exists');

    return {
      group,
      role: invite.role || 'member',
      invite,
    };
  },

  async joinGroupByInvite({ code, user }) {
    const meta = await getMetaWithDefaults();
    const { group, role: inviteRole, invite } = await this.resolveGroupByInvite(code);

    const existingMembership = meta.groupMembers.find(
      item => item.groupId === group.id && item.userId === user.$id
    );

    if (!existingMembership) {
      const membership = {
        id: `membership-${Date.now()}`,
        groupId: group.id,
        userId: user.$id,
        role: inviteRole === 'viewer' ? 'viewer' : 'member',
        email: user.email,
        name: user.name || user.email,
        joinedAt: new Date().toISOString(),
        invitedBy: invite.createdBy,
      };

      await saveMeta({
        groups: meta.groups,
        groupMembers: [membership, ...meta.groupMembers],
        groupInvites: meta.groupInvites,
        groupJoinRequests: meta.groupJoinRequests,
      });
    }

    return {
      group,
      role: existingMembership?.role || (inviteRole === 'viewer' ? 'viewer' : 'member'),
    };
  },

  async getMembership({ groupId, userId }) {
    const meta = await getMetaWithDefaults();
    return meta.groupMembers.find(item => item.groupId === groupId && item.userId === userId) || null;
  },

  async getUserPendingRequestGroupIds(userId) {
    const meta = await getMetaWithDefaults();
    return meta.groupJoinRequests
      .filter(item => item.userId === userId && item.status === 'pending')
      .map(item => item.groupId);
  },

  async requestGroupAccess({ groupId, user }) {
    const meta = await getMetaWithDefaults();
    const group = meta.groups.find(item => item.id === groupId);
    if (!group) throw new Error('Group not found');

    const existingMembership = meta.groupMembers.find(item => item.groupId === groupId && item.userId === user.$id);
    if (existingMembership && existingMembership.role !== 'viewer') {
      return { status: 'already-member' };
    }

    const existingPending = meta.groupJoinRequests.find(item =>
      item.groupId === groupId && item.userId === user.$id && item.status === 'pending'
    );
    if (existingPending) {
      return { status: 'already-requested', request: existingPending };
    }

    const request = {
      id: `join-${Date.now()}`,
      groupId,
      userId: user.$id,
      name: user.name || user.email,
      email: user.email,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    await saveMeta({
      groups: meta.groups,
      groupMembers: meta.groupMembers,
      groupInvites: meta.groupInvites,
      groupJoinRequests: [request, ...meta.groupJoinRequests],
    });

    return { status: 'requested', request };
  },

  async getPendingRequestsForAdmin({ groupId, adminUserId }) {
    const meta = await getMetaWithDefaults();
    const adminMembership = meta.groupMembers.find(
      item => item.groupId === groupId && item.userId === adminUserId && item.role === 'admin'
    );
    if (!adminMembership) throw new Error('Only admin can view requests');

    return meta.groupJoinRequests
      .filter(item => item.groupId === groupId && item.status === 'pending')
      .sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
  },

  async getRecentReviewedRequestsForAdmin({ groupId, adminUserId, limit = 8 }) {
    const meta = await getMetaWithDefaults();
    const adminMembership = meta.groupMembers.find(
      item => item.groupId === groupId && item.userId === adminUserId && item.role === 'admin'
    );
    if (!adminMembership) throw new Error('Only admin can view request audit');

    return meta.groupJoinRequests
      .filter(item => item.groupId === groupId && (item.status === 'approved' || item.status === 'rejected'))
      .sort((a, b) => new Date(b.reviewedAt || b.createdAt || 0).getTime() - new Date(a.reviewedAt || a.createdAt || 0).getTime())
      .slice(0, Math.max(1, limit));
  },

  async getGroupMembersForAdmin({ groupId, adminUserId }) {
    const meta = await getMetaWithDefaults();
    const adminMembership = meta.groupMembers.find(
      item => item.groupId === groupId && item.userId === adminUserId && item.role === 'admin'
    );
    if (!adminMembership) throw new Error('Only admin can view group members');

    return meta.groupMembers
      .filter(item => item.groupId === groupId)
      .sort((a, b) => new Date(a.joinedAt || 0).getTime() - new Date(b.joinedAt || 0).getTime());
  },

  async updateGroupMemberRole({ groupId, targetUserId, nextRole, adminUserId }) {
    if (!['admin', 'member', 'viewer'].includes(nextRole)) {
      throw new Error('Invalid group role');
    }

    const meta = await getMetaWithDefaults();
    const adminMembership = meta.groupMembers.find(
      item => item.groupId === groupId && item.userId === adminUserId && item.role === 'admin'
    );
    if (!adminMembership) throw new Error('Only admin can update member role');

    const targetMembership = meta.groupMembers.find(
      item => item.groupId === groupId && item.userId === targetUserId
    );
    if (!targetMembership) throw new Error('Group member not found');

    const nextMembers = meta.groupMembers.map((item) => {
      if (item.groupId === groupId && item.userId === targetUserId) {
        return { ...item, role: nextRole };
      }
      return item;
    });

    const adminCount = nextMembers.filter(item => item.groupId === groupId && item.role === 'admin').length;
    if (adminCount === 0) {
      throw new Error('Group must have at least one admin');
    }

    await saveMeta({
      groups: meta.groups,
      groupMembers: nextMembers,
      groupInvites: meta.groupInvites,
      groupJoinRequests: meta.groupJoinRequests,
    });

    return {
      status: 'updated',
      role: nextRole,
    };
  },

  async removeGroupMember({ groupId, targetUserId, adminUserId }) {
    const meta = await getMetaWithDefaults();
    const adminMembership = meta.groupMembers.find(
      item => item.groupId === groupId && item.userId === adminUserId && item.role === 'admin'
    );
    if (!adminMembership) throw new Error('Only admin can remove members');

    if (targetUserId === adminUserId) {
      throw new Error('Admin cannot remove own membership');
    }

    const targetMemberships = meta.groupMembers.filter(
      item => item.groupId === groupId && item.userId === targetUserId
    );
    if (targetMemberships.length === 0) throw new Error('Group member not found');

    const nextMembers = meta.groupMembers.filter(
      item => !(item.groupId === groupId && item.userId === targetUserId)
    );

    const adminCount = nextMembers.filter(item => item.groupId === groupId && item.role === 'admin').length;
    if (adminCount === 0) {
      throw new Error('Cannot remove the last admin');
    }

    await saveMeta({
      groups: meta.groups,
      groupMembers: nextMembers,
      groupInvites: meta.groupInvites,
      groupJoinRequests: meta.groupJoinRequests,
    });

    return {
      status: 'removed',
      removedUserId: targetUserId,
    };
  },

  async approveJoinRequest({ requestId, adminUserId }) {
    const meta = await getMetaWithDefaults();
    const request = meta.groupJoinRequests.find(item => item.id === requestId);
    if (!request) throw new Error('Request not found');
    if (request.status !== 'pending') return { status: request.status };

    const adminMembership = meta.groupMembers.find(
      item => item.groupId === request.groupId && item.userId === adminUserId && item.role === 'admin'
    );
    if (!adminMembership) throw new Error('Only admin can approve');

    const existingMembership = meta.groupMembers.find(
      item => item.groupId === request.groupId && item.userId === request.userId
    );
    const nextMembers = existingMembership
      ? meta.groupMembers.map(item => (
          item.groupId === request.groupId && item.userId === request.userId
            ? { ...item, role: 'member' }
            : item
        ))
      : [{
          id: `membership-${Date.now()}`,
          groupId: request.groupId,
          userId: request.userId,
          role: 'member',
          email: request.email,
          name: request.name,
          joinedAt: new Date().toISOString(),
          invitedBy: adminUserId,
        }, ...meta.groupMembers];

    const nextRequests = meta.groupJoinRequests.map(item =>
      item.id === requestId
        ? { ...item, status: 'approved', reviewedAt: new Date().toISOString(), reviewedBy: adminUserId }
        : item
    );

    await saveMeta({
      groups: meta.groups,
      groupMembers: nextMembers,
      groupInvites: meta.groupInvites,
      groupJoinRequests: nextRequests,
    });

    return { status: 'approved' };
  },

  async rejectJoinRequest({ requestId, adminUserId }) {
    const meta = await getMetaWithDefaults();
    const request = meta.groupJoinRequests.find(item => item.id === requestId);
    if (!request) throw new Error('Request not found');
    if (request.status !== 'pending') return { status: request.status };

    const adminMembership = meta.groupMembers.find(
      item => item.groupId === request.groupId && item.userId === adminUserId && item.role === 'admin'
    );
    if (!adminMembership) throw new Error('Only admin can reject');

    const nextRequests = meta.groupJoinRequests.map(item =>
      item.id === requestId
        ? { ...item, status: 'rejected', reviewedAt: new Date().toISOString(), reviewedBy: adminUserId }
        : item
    );

    await saveMeta({
      groups: meta.groups,
      groupMembers: meta.groupMembers,
      groupInvites: meta.groupInvites,
      groupJoinRequests: nextRequests,
    });

    return { status: 'rejected' };
  },
};

const GROUP_SERVICE_METHODS = [
  'getAllGroups',
  'getUserGroups',
  'createGroup',
  'createInviteCode',
  'resolveGroupByInvite',
  'joinGroupByInvite',
  'getMembership',
  'getUserPendingRequestGroupIds',
  'requestGroupAccess',
  'getPendingRequestsForAdmin',
  'getRecentReviewedRequestsForAdmin',
  'getGroupMembersForAdmin',
  'updateGroupMemberRole',
  'removeGroupMember',
  'approveJoinRequest',
  'rejectJoinRequest',
];

const buildRoutedGroupService = () => GROUP_SERVICE_METHODS.reduce((acc, methodName) => {
  acc[methodName] = async (...args) => {
    if (groupCollectionsService.isEnabled()) {
      return groupCollectionsService[methodName](...args);
    }
    return legacyGroupService[methodName](...args);
  };
  return acc;
}, {});

export const groupService = buildRoutedGroupService();
