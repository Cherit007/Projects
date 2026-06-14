import { useQuery } from '@tanstack/react-query';
import { tournamentService } from '@fixture-maker/api/tournamentService';
import { isAppwriteConfigured } from '@fixture-maker/config/appwrite/env';
import { queryKeys } from '@fixture-maker/config/queryKeys';

type TournamentServiceWithGroup = {
  getAllTournaments: (limit?: number, groupId?: string | null) => Promise<unknown[]>;
};

const tournamentApi = tournamentService as TournamentServiceWithGroup;

export const useGroupCloudData = (groupId: string | null | undefined) => {
  const enabled = Boolean(groupId) && isAppwriteConfigured();

  return useQuery({
    queryKey: queryKeys.tournamentHistory(groupId || 'nogroup'),
    enabled,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnMount: false,
    refetchOnReconnect: false,
    queryFn: async () => {
      if (!groupId) return [];
      const rows = await tournamentApi.getAllTournaments(100, groupId ?? undefined);
      return Array.isArray(rows) ? rows : [];
    },
  });
};
