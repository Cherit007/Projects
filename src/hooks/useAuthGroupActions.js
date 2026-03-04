import { groupService } from '../services/groupService';
import { clearPersistedQueryCache } from '../queryPersistence';

export const useAuthGroupActions = ({
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
}) => {
  const handleLogin = async ({ email, password }) => {
    setAuthLoading(true);
    try {
      const user = await loginMutation.mutateAsync({ email, password });
      queryClient.setQueryData(queryKeys.authCurrentUser, user);
      setIsGuestViewer(false);
      setCurrentUser(user);
      setActiveGroup(null);
      setGroupRole(null);
      const groups = await refreshGroups(user);
      const pendingRequested = await queryClient.fetchQuery({
        queryKey: queryKeys.userPendingGroupIds(user.$id),
        queryFn: () => groupService.getUserPendingRequestGroupIds(user.$id),
        staleTime: 15 * 1000,
      });
      setRequestedGroupIds(pendingRequested);
      if (groups.length === 1 && groups[0].role !== 'viewer') {
        setActiveGroup(groups[0]);
        setGroupRole(groups[0].role);
      } else {
        setActiveGroup(null);
        setGroupRole(null);
      }
      showToast('Logged in successfully');
    } catch (error) {
      console.error('Login failed:', error);
      showToast(error?.message || 'Login failed', 'error');
    } finally {
      setAuthLoading(false);
      setAuthResolved(true);
      setGroupResolved(true);
    }
  };

  const handleRegister = async ({ name, email, password }) => {
    setAuthLoading(true);
    try {
      const user = await registerMutation.mutateAsync({ name, email, password });
      queryClient.setQueryData(queryKeys.authCurrentUser, user);
      setIsGuestViewer(false);
      setCurrentUser(user);
      setAvailableGroups([]);
      await refreshPublicGroups();
      setRequestedGroupIds([]);
      setActiveGroup(null);
      setGroupRole(null);
      showToast('Account created');
    } catch (error) {
      console.error('Registration failed:', error);
      showToast(error?.message || 'Registration failed', 'error');
    } finally {
      setAuthLoading(false);
      setAuthResolved(true);
      setGroupResolved(true);
    }
  };

  const handleLogout = async () => {
    if (currentUser) {
      try {
        await logoutMutation.mutateAsync();
        queryClient.removeQueries({ queryKey: ['groups'] });
        queryClient.removeQueries({ queryKey: ['appwrite'] });
        queryClient.removeQueries({ queryKey: ['casual-matches'] });
        queryClient.setQueryData(queryKeys.authCurrentUser, null);
      } catch (error) {
        console.error('Logout failed:', error);
      }
    }

    setIsGuestViewer(false);
    setCurrentUser(null);
    setAvailableGroups([]);
    setRequestedGroupIds([]);
    setPendingJoinRequests([]);
    setRecentJoinReviews([]);
    setSeenPendingRequestIds([]);
    setShowRequestCenter(false);
    setAdminAccounts([]);
    setActiveGroup(null);
    setGroupRole(null);
    setStep('setup');
    clearPersistedQueryCache();
  };

  const handleCreateGroup = async (name) => {
    if (!currentUser) return;
    setAuthLoading(true);
    try {
      const created = await createGroupMutation.mutateAsync({ name, user: currentUser });
      await queryClient.invalidateQueries({ queryKey: queryKeys.userGroups(currentUser.$id) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.publicGroups });
      await refreshGroups(currentUser);
      await refreshPublicGroups();
      setActiveGroup(created.group);
      setGroupRole(created.role);
      showToast('Group created');
    } catch (error) {
      console.error('Create group failed:', error);
      showToast(error?.message || 'Failed to create group', 'error');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleRequestAccess = async (groupId) => {
    setAuthLoading(true);
    try {
      if (!currentUser) throw new Error('Please login to request access');
      const result = await requestAccessMutation.mutateAsync({ groupId, user: currentUser });
      await queryClient.invalidateQueries({ queryKey: queryKeys.userPendingGroupIds(currentUser.$id) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.publicGroups });
      if (result.status === 'already-member') {
        showToast('You are already a member');
        const groups = await refreshGroups(currentUser);
        const joined = groups.find(item => item.id === groupId);
        if (joined) {
          setActiveGroup(joined);
          setGroupRole(joined.role);
        }
        return;
      }
      setRequestedGroupIds(prev => (prev.includes(groupId) ? prev : [...prev, groupId]));
      showToast(result.status === 'already-requested' ? 'Request already pending' : 'Access request sent');
    } catch (error) {
      console.error('Request access failed:', error);
      showToast(error?.message || 'Failed to request access', 'error');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleWatchGroup = (group) => {
    setActiveGroup(group);
    const membership = availableGroups.find(item => item.id === group.id);
    setGroupRole(membership?.role || 'viewer');
    setIsGuestViewer(!currentUser);
  };

  const refreshAdminRequests = async () => {
    if (!currentUser || !activeGroup) return;
    const requests = await queryClient.fetchQuery({
      queryKey: queryKeys.adminPendingRequests(activeGroup.id, currentUser.$id),
      queryFn: () => groupService.getPendingRequestsForAdmin({
        groupId: activeGroup.id,
        adminUserId: currentUser.$id,
      }),
      staleTime: 5 * 1000,
    });
    const recent = await queryClient.fetchQuery({
      queryKey: queryKeys.adminRecentReviews(activeGroup.id, currentUser.$id),
      queryFn: () => groupService.getRecentReviewedRequestsForAdmin({
        groupId: activeGroup.id,
        adminUserId: currentUser.$id,
        limit: 6,
      }),
      staleTime: 5 * 1000,
    });
    setPendingJoinRequests(requests);
    setRecentJoinReviews(recent);
  };

  const refreshAdminMembers = async () => {
    if (!currentUser || !activeGroup) return [];
    const members = await queryClient.fetchQuery({
      queryKey: queryKeys.adminGroupMembers(activeGroup.id, currentUser.$id),
      queryFn: () => groupService.getGroupMembersForAdmin({
        groupId: activeGroup.id,
        adminUserId: currentUser.$id,
      }),
      staleTime: 5 * 1000,
    });
    const safeMembers = Array.isArray(members) ? members : [];
    setAdminAccounts(safeMembers);
    return safeMembers;
  };

  const handleApproveRequest = async (requestId) => {
    if (!currentUser || !activeGroup || groupRole !== 'admin') return;
    setInviteLoading(true);
    try {
      await approveJoinMutation.mutateAsync({
        requestId,
        adminUserId: currentUser.$id,
      });
      await queryClient.invalidateQueries({ queryKey: queryKeys.adminPendingRequests(activeGroup.id, currentUser.$id) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.adminRecentReviews(activeGroup.id, currentUser.$id) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.publicGroups });
      await refreshAdminRequests();
      showToast('Request approved');
    } catch (error) {
      console.error('Approve request failed:', error);
      showToast(error?.message || 'Failed to approve request', 'error');
    } finally {
      setInviteLoading(false);
    }
  };

  const handleRejectRequest = async (requestId) => {
    if (!currentUser || !activeGroup || groupRole !== 'admin') return;
    setInviteLoading(true);
    try {
      await rejectJoinMutation.mutateAsync({
        requestId,
        adminUserId: currentUser.$id,
      });
      await queryClient.invalidateQueries({ queryKey: queryKeys.adminPendingRequests(activeGroup.id, currentUser.$id) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.adminRecentReviews(activeGroup.id, currentUser.$id) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.publicGroups });
      await refreshAdminRequests();
      showToast('Request rejected');
    } catch (error) {
      console.error('Reject request failed:', error);
      showToast(error?.message || 'Failed to reject request', 'error');
    } finally {
      setInviteLoading(false);
    }
  };

  const handlePromoteMemberToAdmin = async (targetUserId) => {
    if (!currentUser || !activeGroup || groupRole !== 'admin') return;
    setInviteLoading(true);
    try {
      await updateGroupMemberRoleMutation.mutateAsync({
        groupId: activeGroup.id,
        targetUserId,
        nextRole: 'admin',
        adminUserId: currentUser.$id,
      });
      await queryClient.invalidateQueries({ queryKey: queryKeys.adminGroupMembers(activeGroup.id, currentUser.$id) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.userGroups(targetUserId) });
      await refreshAdminMembers();
      showToast('Member promoted to admin');
    } catch (error) {
      console.error('Promote member failed:', error);
      showToast(error?.message || 'Failed to promote member', 'error');
    } finally {
      setInviteLoading(false);
    }
  };

  const handleRemoveMember = async (targetUserId) => {
    if (!currentUser || !activeGroup || groupRole !== 'admin') return;
    setInviteLoading(true);
    try {
      await removeGroupMemberMutation.mutateAsync({
        groupId: activeGroup.id,
        targetUserId,
        adminUserId: currentUser.$id,
      });
      await queryClient.invalidateQueries({ queryKey: queryKeys.adminGroupMembers(activeGroup.id, currentUser.$id) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.userGroups(targetUserId) });
      await refreshAdminMembers();
      showToast('Member removed');
    } catch (error) {
      console.error('Remove member failed:', error);
      showToast(error?.message || 'Failed to remove member', 'error');
    } finally {
      setInviteLoading(false);
    }
  };

  const handleOpenRequestCenter = () => {
    setShowRequestCenter(true);
    setSeenPendingRequestIds(prev => {
      const next = new Set(prev);
      pendingJoinRequests.forEach(item => next.add(item.id));
      return Array.from(next);
    });
  };

  const handleContinueAsViewer = () => {
    setIsGuestViewer(true);
    setGroupResolved(true);
    setAuthResolved(true);
  };

  const handleSelectGroup = (group) => {
    setActiveGroup(group);
    setGroupRole(group.role);
  };

  const handleBackToGroups = () => {
    setActiveGroup(null);
    setGroupRole(null);
  };

  return {
    handleLogin,
    handleRegister,
    handleLogout,
    handleCreateGroup,
    handleRequestAccess,
    handleWatchGroup,
    handleApproveRequest,
    handleRejectRequest,
    handlePromoteMemberToAdmin,
    handleRemoveMember,
    handleOpenRequestCenter,
    handleContinueAsViewer,
    handleSelectGroup,
    handleBackToGroups,
  };
};
