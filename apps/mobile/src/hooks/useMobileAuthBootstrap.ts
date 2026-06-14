import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { authService } from '@fixture-maker/api/auth/authService';
import { groupCollectionsService } from '@fixture-maker/api/groups/groupCollectionsService';
import { areGroupsEnabled } from '@fixture-maker/config/groupFeatures';
import { queryKeys } from '@fixture-maker/config/queryKeys';
import { useAppSession } from '../context/AppSessionContext';
import type { GroupSummary } from '../navigation/types';

export const useMobileAuthBootstrap = () => {
  const queryClient = useQueryClient();
  const {
    setUser,
    setGroups,
    setActiveGroup,
    signOutLocal,
  } = useAppSession();
  const [bootstrapping, setBootstrapping] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const hasBootstrappedRef = useRef(false);
  const groupsEnabled = areGroupsEnabled();

  const bootstrap = useCallback(async ({ showLoader = !hasBootstrappedRef.current } = {}) => {
    if (showLoader) setBootstrapping(true);
    try {
      const user = await authService.getCurrentUser();
      queryClient.setQueryData(queryKeys.authCurrentUser, user);
      setIsAuthenticated(Boolean(user));
      if (!user) {
        setUser(null);
        setGroups([]);
        setActiveGroup(null);
        return;
      }

      setUser(user);
      const memberships = await groupCollectionsService.getUserGroups(user.$id);
      const mapped: GroupSummary[] = memberships
        .filter((group): group is NonNullable<typeof group> => Boolean(group))
        .map((group) => ({
          id: group.id,
          name: group.name,
          role: group.role,
        }));
      setGroups(mapped);

      const playable = mapped.filter((group) => group.role !== 'viewer');
      const autoGroup = playable[0] || mapped[0] || null;

      if (!groupsEnabled) {
        setActiveGroup(autoGroup);
      } else if (mapped.length === 1 && mapped[0].role !== 'viewer') {
        setActiveGroup(mapped[0]);
      } else {
        setActiveGroup(null);
      }
    } catch {
      setIsAuthenticated(false);
      setUser(null);
      setGroups([]);
      setActiveGroup(null);
    } finally {
      hasBootstrappedRef.current = true;
      setBootstrapping(false);
    }
  }, [groupsEnabled, queryClient, setActiveGroup, setGroups, setUser]);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  const handleSignedOut = useCallback(async () => {
    try {
      await authService.logout();
    } catch {
      // Ignore network logout errors.
    }
    signOutLocal();
    queryClient.clear();
    setIsAuthenticated(false);
    hasBootstrappedRef.current = false;
  }, [queryClient, signOutLocal]);

  return {
    bootstrapping,
    isAuthenticated,
    groupsEnabled,
    bootstrap,
    handleSignedOut,
  };
};
