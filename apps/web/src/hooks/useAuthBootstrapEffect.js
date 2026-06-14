import { useEffect } from 'react';
import { groupService } from '../services/groupService';
import { areGroupsEnabled } from '../utils/groupFeatures';

export const useAuthBootstrapEffect = ({
  isConfigChecked,
  requiresAuth,
  refreshPublicGroups,
  fetchCurrentUser,
  setCurrentUser,
  setAuthResolved,
  setGroupResolved,
  setAuthLoading,
  setAvailableGroups,
  setActiveGroup,
  setGroupRole,
  refreshGroups,
  queryClient,
  queryKeys,
  setRequestedGroupIds,
}) => {
  useEffect(() => {
    if (!isConfigChecked) return;

    let mounted = true;
    const loadAuth = async () => {
      if (!requiresAuth) {
        if (!mounted) return;
        setAuthResolved(true);
        setGroupResolved(true);
        return;
      }

      setAuthLoading(true);
      try {
        await refreshPublicGroups();
        const user = await fetchCurrentUser();
        if (!mounted) return;
        setCurrentUser(user);
        setAuthResolved(true);

        if (!user) {
          setGroupResolved(true);
          setAvailableGroups([]);
          setActiveGroup(null);
          setGroupRole(null);
          return;
        }

        const groups = await refreshGroups(user);
        if (!mounted) return;
        const pendingRequested = await queryClient.fetchQuery({
          queryKey: queryKeys.userPendingGroupIds(user.$id),
          queryFn: () => groupService.getUserPendingRequestGroupIds(user.$id),
          staleTime: 15 * 1000,
        });
        if (!mounted) return;
        setRequestedGroupIds(pendingRequested);

        const groupsEnabled = areGroupsEnabled();
        const playableGroups = groups.filter((group) => group.role !== 'viewer');
        const autoGroup = playableGroups[0] || groups[0] || null;

        if (!groupsEnabled) {
          if (autoGroup) {
            setActiveGroup(autoGroup);
            setGroupRole(autoGroup.role || 'member');
          } else {
            setActiveGroup(null);
            setGroupRole('member');
          }
        } else if (groups.length === 1 && groups[0].role !== 'viewer') {
          setActiveGroup(groups[0]);
          setGroupRole(groups[0].role);
        } else {
          setActiveGroup(null);
          setGroupRole(null);
        }
        setGroupResolved(true);
      } catch (error) {
        console.error('Failed to load auth state:', error);
        if (!mounted) return;
        setAuthResolved(true);
        setGroupResolved(true);
      } finally {
        if (mounted) setAuthLoading(false);
      }
    };

    loadAuth();
    return () => {
      mounted = false;
    };
  }, [isConfigChecked, requiresAuth]);
};

