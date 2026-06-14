import { useQuery } from '@tanstack/react-query';
import { casualMatchService } from '@fixture-maker/api/casual/casualMatchService';
import { tournamentService } from '@fixture-maker/api/tournamentService';
import { isAppwriteConfigured } from '@fixture-maker/config/appwrite/env';
import { queryKeys } from '@fixture-maker/config/queryKeys';

type TournamentServiceWithGroup = {
  getAllTournaments: (limit?: number, groupId?: string | null) => Promise<unknown[]>;
};

type CasualServiceWithGroup = {
  getAllCasualMatches: (limit?: number, groupId?: string | null) => Promise<unknown[]>;
};

const tournamentApi = tournamentService as TournamentServiceWithGroup;
const casualApi = casualMatchService as CasualServiceWithGroup;

export const useMobileHomeData = (groupId: string | null | undefined) => {
  const enabled = isAppwriteConfigured();

  const historyQuery = useQuery({
    queryKey: queryKeys.tournamentHistory(groupId || 'nogroup'),
    enabled,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnMount: false,
    refetchOnReconnect: false,
    queryFn: async () => {
      if (!groupId) return [];
      const rows = await tournamentApi.getAllTournaments(100, groupId);
      return Array.isArray(rows) ? rows : [];
    },
  });

  const casualQuery = useQuery({
    queryKey: queryKeys.casualMatches(groupId || 'nogroup'),
    enabled,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnMount: false,
    refetchOnReconnect: false,
    queryFn: async () => {
      if (!groupId) return [];
      const rows = await casualApi.getAllCasualMatches(100, groupId);
      return Array.isArray(rows) ? rows : [];
    },
  });

  return {
    tournamentHistory: historyQuery.data ?? [],
    casualMatches: casualQuery.data ?? [],
    isLoading: historyQuery.isLoading || casualQuery.isLoading,
    refetchAll: async () => {
      await Promise.all([historyQuery.refetch(), casualQuery.refetch()]);
    },
  };
};
