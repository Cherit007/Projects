import { useMemo } from 'react';
import { useMutation } from '@tanstack/react-query';
import { authService } from '../../services/authService';
import { groupService } from '../../services/groupService';
import { queryKeys } from '../../config/queryKeys';
import { useAuthGroupActions } from '../useAuthGroupActions';

export const useGroupShell = ({
  isAppwriteEnabled,
  queryClient,
  showToast,
  currentUser,
  activeGroup,
  groupRole,
  availableGroups,
  pendingJoinRequests,
  seenPendingRequestIds,
  setAvailableGroups,
  setPublicGroups,
  setAuthLoading,
  setIsGuestViewer,
  setCurrentUser,
  setActiveGroup,
  setGroupRole,
  setRequestedGroupIds,
  setAuthResolved,
  setGroupResolved,
  setPendingJoinRequests,
  setRecentJoinReviews,
  setSeenPendingRequestIds,
  setShowRequestCenter,
  setInviteLoading,
  setAdminAccounts,
  setStep,
}) => {
  const requiresAuth = isAppwriteEnabled;
  const canOperate = !requiresAuth || groupRole === 'admin' || groupRole === 'member';
  const canDelete = !requiresAuth || groupRole === 'admin';
  const canManageMembers = !requiresAuth || groupRole === 'admin';
  const isViewerMode = requiresAuth && groupRole === 'viewer';

  const unreadRequestCount = useMemo(
    () => pendingJoinRequests.filter((item) => !seenPendingRequestIds.includes(item.id)).length,
    [pendingJoinRequests, seenPendingRequestIds]
  );

  const assertCanOperate = () => {
    if (canOperate) return true;
    showToast('Read-only access: viewers can only watch', 'error');
    return false;
  };

  const assertCanDelete = () => {
    if (canDelete) return true;
    showToast('Only group admin can delete data', 'error');
    return false;
  };

  const assertCanManageMembers = () => {
    if (canManageMembers) return true;
    showToast('Only group admin can manage members', 'error');
    return false;
  };

  const loginMutation = useMutation({
    mutationFn: ({ email, password }) => authService.login(email, password),
  });
  const registerMutation = useMutation({
    mutationFn: ({ name, email, password }) => authService.register(name, email, password),
  });
  const logoutMutation = useMutation({
    mutationFn: () => authService.logout(),
  });
  const updateNameMutation = useMutation({
    mutationFn: (name) => authService.updateName(name),
  });
  const createGroupMutation = useMutation({
    mutationFn: ({ name, user }) => groupService.createGroup({ name, user }),
  });
  const requestAccessMutation = useMutation({
    mutationFn: ({ groupId, user }) => groupService.requestGroupAccess({ groupId, user }),
  });
  const approveJoinMutation = useMutation({
    mutationFn: ({ requestId, adminUserId }) => groupService.approveJoinRequest({ requestId, adminUserId }),
  });
  const rejectJoinMutation = useMutation({
    mutationFn: ({ requestId, adminUserId }) => groupService.rejectJoinRequest({ requestId, adminUserId }),
  });
  const updateGroupMemberRoleMutation = useMutation({
    mutationFn: ({ groupId, targetUserId, nextRole, adminUserId }) => groupService.updateGroupMemberRole({
      groupId,
      targetUserId,
      nextRole,
      adminUserId,
    }),
  });
  const removeGroupMemberMutation = useMutation({
    mutationFn: ({ groupId, targetUserId, adminUserId }) => groupService.removeGroupMember({
      groupId,
      targetUserId,
      adminUserId,
    }),
  });

  const fetchCurrentUser = async () => queryClient.fetchQuery({
    queryKey: queryKeys.authCurrentUser,
    queryFn: () => authService.getCurrentUser(),
    staleTime: 15 * 1000,
  });

  const refreshGroups = async (user) => {
    if (!user) {
      setAvailableGroups([]);
      return [];
    }
    const groups = await queryClient.fetchQuery({
      queryKey: queryKeys.userGroups(user.$id),
      queryFn: () => groupService.getUserGroups(user.$id),
      staleTime: 15 * 1000,
    });
    setAvailableGroups(groups);
    return groups;
  };

  const refreshPublicGroups = async () => {
    const groups = await queryClient.fetchQuery({
      queryKey: queryKeys.publicGroups,
      queryFn: () => groupService.getAllGroups(),
      staleTime: 30 * 1000,
    });
    setPublicGroups(groups);
    return groups;
  };

  const authGroupActions = useAuthGroupActions({
    currentUser,
    activeGroup,
    groupRole,
    availableGroups,
    pendingJoinRequests,
    queryClient,
    queryKeys,
    showToast,
    refreshGroups,
    refreshPublicGroups,
    loginMutation,
    registerMutation,
    logoutMutation,
    createGroupMutation,
    requestAccessMutation,
    approveJoinMutation,
    rejectJoinMutation,
    updateGroupMemberRoleMutation,
    removeGroupMemberMutation,
    setAuthLoading,
    setIsGuestViewer,
    setCurrentUser,
    setActiveGroup,
    setGroupRole,
    setRequestedGroupIds,
    setAvailableGroups,
    setAuthResolved,
    setGroupResolved,
    setPendingJoinRequests,
    setRecentJoinReviews,
    setSeenPendingRequestIds,
    setShowRequestCenter,
    setInviteLoading,
    setAdminAccounts,
    setStep,
  });

  return {
    requiresAuth,
    canOperate,
    canDelete,
    canManageMembers,
    isViewerMode,
    unreadRequestCount,
    assertCanOperate,
    assertCanDelete,
    assertCanManageMembers,
    fetchCurrentUser,
    refreshGroups,
    refreshPublicGroups,
    updateNameMutation,
    ...authGroupActions,
  };
};
