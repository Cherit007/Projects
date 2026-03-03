import { useEffect } from 'react';
import { groupService } from '../services/groupService';

export const useAdminRequestsEffect = ({
  requiresAuth,
  currentUser,
  activeGroup,
  groupRole,
  queryClient,
  queryKeys,
  setPendingJoinRequests,
  setRecentJoinReviews,
  setSeenPendingRequestIds,
  setShowRequestCenter,
  setAdminAccounts,
}) => {
  useEffect(() => {
    if (!requiresAuth || !currentUser || !activeGroup || groupRole !== 'admin') {
      setPendingJoinRequests([]);
      setRecentJoinReviews([]);
      setSeenPendingRequestIds([]);
      setShowRequestCenter(false);
      return;
    }

    let mounted = true;
    const loadRequests = async () => {
      try {
        const requests = await queryClient.fetchQuery({
          queryKey: queryKeys.adminPendingRequests(activeGroup.id, currentUser.$id),
          queryFn: () => groupService.getPendingRequestsForAdmin({
            groupId: activeGroup.id,
            adminUserId: currentUser.$id,
          }),
          staleTime: 10 * 1000,
        });
        const recent = await queryClient.fetchQuery({
          queryKey: queryKeys.adminRecentReviews(activeGroup.id, currentUser.$id),
          queryFn: () => groupService.getRecentReviewedRequestsForAdmin({
            groupId: activeGroup.id,
            adminUserId: currentUser.$id,
            limit: 6,
          }),
          staleTime: 10 * 1000,
        });
        if (mounted) {
          setPendingJoinRequests(requests);
          setRecentJoinReviews(recent);
        }
      } catch {
        if (mounted) {
          setPendingJoinRequests([]);
          setRecentJoinReviews([]);
        }
      }
    };

    loadRequests();
    return () => {
      mounted = false;
    };
  }, [
    requiresAuth,
    currentUser,
    activeGroup,
    groupRole,
    queryClient,
    queryKeys,
    setPendingJoinRequests,
    setRecentJoinReviews,
    setSeenPendingRequestIds,
    setShowRequestCenter,
  ]);

  useEffect(() => {
    if (!requiresAuth || !currentUser || !activeGroup || groupRole !== 'admin') {
      setAdminAccounts([]);
      return;
    }
    let mounted = true;
    const loadAdminAccounts = async () => {
      try {
        const accounts = await queryClient.fetchQuery({
          queryKey: queryKeys.adminGroupMembers(activeGroup.id, currentUser.$id),
          queryFn: () => groupService.getGroupMembersForAdmin({
            groupId: activeGroup.id,
            adminUserId: currentUser.$id,
          }),
          staleTime: 20 * 1000,
        });
        if (mounted) setAdminAccounts(accounts || []);
      } catch {
        if (mounted) setAdminAccounts([]);
      }
    };
    loadAdminAccounts();
    return () => {
      mounted = false;
    };
  }, [
    requiresAuth,
    currentUser,
    activeGroup,
    groupRole,
    queryClient,
    queryKeys,
    setAdminAccounts,
  ]);

  useEffect(() => {
    setShowRequestCenter(false);
    setSeenPendingRequestIds([]);
  }, [activeGroup?.id, setShowRequestCenter, setSeenPendingRequestIds]);
};
