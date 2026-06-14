import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { isAppwriteConfigured } from '@fixture-maker/config/appwrite/env';
import { queryKeys } from '@fixture-maker/config/queryKeys';
import { tournamentService } from '@fixture-maker/api/tournamentService';
import { useAppSession } from '../context/AppSessionContext';

type TournamentServiceWithGroup = {
  getAllTournaments: (limit?: number, groupId?: string | null) => Promise<unknown[]>;
};

const tournamentApi = tournamentService as TournamentServiceWithGroup;

export const useMobileBootstrap = () => {
  const queryClient = useQueryClient();
  const { activeGroup } = useAppSession();
  const groupId = activeGroup?.id || null;
  const prefetchedGroupRef = useRef<string | null>(null);

  useEffect(() => {
    if (!groupId || !isAppwriteConfigured()) return;
    if (prefetchedGroupRef.current === groupId) return;

    prefetchedGroupRef.current = groupId;
    void queryClient.prefetchQuery({
      queryKey: queryKeys.tournamentHistory(groupId),
      queryFn: async () => {
        const rows = await tournamentApi.getAllTournaments(100, groupId);
        return Array.isArray(rows) ? rows : [];
      },
      staleTime: 5 * 60 * 1000,
    });
  }, [groupId, queryClient]);
};
