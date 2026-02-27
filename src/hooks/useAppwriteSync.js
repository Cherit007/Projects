import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { isAppwriteConfigured } from '../appwrite.config';
import { tournamentService } from '../services/tournamentService';
import { playerService } from '../services/playerService';
import { appDataService } from '../services/appDataService';

const APPWRITE_BOOTSTRAP_KEY = ['appwrite', 'bootstrap'];

/**
 * Custom hook to manage Appwrite sync via React Query.
 */
export const useAppwriteSync = (showToast) => {
  const queryClient = useQueryClient();
  const [isAppwriteEnabled, setIsAppwriteEnabled] = useState(false);
  const [isConfigChecked, setIsConfigChecked] = useState(false);
  const [currentTournamentId, setCurrentTournamentId] = useState(null);

  useEffect(() => {
    const enabled = isAppwriteConfigured();
    setIsAppwriteEnabled(enabled);
    if (enabled) {
      console.log('✅ Appwrite integration enabled');
    } else {
      console.log('⚠️ Appwrite not configured - check .env file');
    }
    setIsConfigChecked(true);
  }, []);

  const invalidateBootstrap = () => queryClient.invalidateQueries({ queryKey: APPWRITE_BOOTSTRAP_KEY });

  const loadFromAppwrite = async () => {
    if (!isAppwriteEnabled) return null;
    try {
      return await queryClient.fetchQuery({
        queryKey: APPWRITE_BOOTSTRAP_KEY,
        queryFn: async () => {
          const [tournaments, playerDb, ratings, meta] = await Promise.all([
            tournamentService.getAllTournaments(),
            playerService.getPlayerDatabase(),
            playerService.getPlayerRatings(),
            appDataService.getAppMeta().catch(() => null),
          ]);

          return {
            tournaments: tournaments || [],
            playerDatabase: playerDb?.players || [],
            playerRatings: ratings?.ratings || {},
            members: meta?.members || [],
            templates: meta?.templates || [],
            playerPhotos: meta?.playerPhotos || {},
          };
        },
        staleTime: 15 * 1000,
      });
    } catch (error) {
      console.error('Error loading from Appwrite:', error);
      showToast?.('Failed to load from cloud', 'error');
      return null;
    }
  };

  const saveTournamentMutation = useMutation({
    mutationFn: async (tournament) => {
      if (!isAppwriteEnabled) return tournament;
      if (tournament.appwriteId) {
        return tournamentService.updateTournament(tournament.appwriteId, tournament);
      }
      return tournamentService.createTournament(tournament);
    },
    onSuccess: async (savedTournament) => {
      if (savedTournament?.id) setCurrentTournamentId(savedTournament.id);
      await invalidateBootstrap();
    },
    onError: (error) => {
      console.error('Error saving tournament to Appwrite:', error);
      showToast?.('Failed to sync to cloud', 'error');
    },
  });

  const deleteTournamentMutation = useMutation({
    mutationFn: async (tournamentId) => {
      if (!isAppwriteEnabled) return true;
      await tournamentService.deleteTournament(tournamentId);
      return true;
    },
    onSuccess: invalidateBootstrap,
    onError: (error) => {
      console.error('Error deleting tournament from Appwrite:', error);
      showToast?.('Failed to delete from cloud', 'error');
    },
  });

  const saveRatingsMutation = useMutation({
    mutationFn: async (ratings) => {
      if (!isAppwriteEnabled) return ratings;
      await playerService.savePlayerRatings(ratings);
      return ratings;
    },
    onSuccess: invalidateBootstrap,
    onError: (error) => {
      console.error('Error saving ratings to Appwrite:', error);
    },
  });

  const savePlayerDatabaseMutation = useMutation({
    mutationFn: async (players) => {
      if (!isAppwriteEnabled) return players;
      await playerService.savePlayerDatabase(players);
      return players;
    },
    onSuccess: invalidateBootstrap,
    onError: (error) => {
      console.error('Error saving player database to Appwrite:', error);
    },
  });

  const saveMetaMutation = useMutation({
    mutationFn: async (updates) => {
      if (!isAppwriteEnabled) return updates;
      return appDataService.saveAppMeta(updates);
    },
    onSuccess: invalidateBootstrap,
    onError: (error) => {
      console.error('Error saving app meta to Appwrite:', error);
    },
  });

  const syncTournamentMutation = useMutation({
    mutationFn: async ({ tournamentId, tournamentData }) => {
      if (!isAppwriteEnabled || !tournamentId) return null;
      return tournamentService.updateTournament(tournamentId, {
        fixtures: tournamentData.fixtures,
        bracket: tournamentData.bracket,
        champion: tournamentData.champion,
        finalMatch: tournamentData.finalMatch,
        aiSummaries: tournamentData.aiSummaries,
        status: tournamentData.champion ? 'completed' : 'active',
      });
    },
    onError: (error) => {
      console.error('Error syncing tournament:', error);
    },
  });

  const saveTournamentToAppwrite = async (tournament) => {
    try {
      return await saveTournamentMutation.mutateAsync(tournament);
    } catch (_error) {
      return tournament;
    }
  };

  const deleteTournamentFromAppwrite = async (tournamentId) => {
    try {
      return await deleteTournamentMutation.mutateAsync(tournamentId);
    } catch (_error) {
      return false;
    }
  };

  const saveRatingsToAppwrite = async (ratings) => {
    try {
      return await saveRatingsMutation.mutateAsync(ratings);
    } catch (_error) {
      return ratings;
    }
  };

  const savePlayerDatabaseToAppwrite = async (players) => {
    try {
      return await savePlayerDatabaseMutation.mutateAsync(players);
    } catch (_error) {
      return players;
    }
  };

  const saveMembersToAppwrite = async (members) => {
    await saveMetaMutation.mutateAsync({ members });
    return members;
  };

  const saveTemplatesToAppwrite = async (templates) => {
    await saveMetaMutation.mutateAsync({ templates });
    return templates;
  };

  const savePlayerPhotosToAppwrite = async (playerPhotos) => {
    await saveMetaMutation.mutateAsync({ playerPhotos });
    return playerPhotos;
  };

  const syncCurrentTournament = async (tournamentData) => {
    if (!currentTournamentId) return null;
    return syncTournamentMutation.mutateAsync({
      tournamentId: currentTournamentId,
      tournamentData,
    });
  };

  const isSyncing = saveTournamentMutation.isPending
    || deleteTournamentMutation.isPending
    || saveRatingsMutation.isPending
    || savePlayerDatabaseMutation.isPending
    || saveMetaMutation.isPending
    || syncTournamentMutation.isPending;

  return {
    isAppwriteEnabled,
    isConfigChecked,
    isSyncing,
    currentTournamentId,
    setCurrentTournamentId,
    loadFromAppwrite,
    saveTournamentToAppwrite,
    deleteTournamentFromAppwrite,
    saveRatingsToAppwrite,
    savePlayerDatabaseToAppwrite,
    saveMembersToAppwrite,
    saveTemplatesToAppwrite,
    savePlayerPhotosToAppwrite,
    syncCurrentTournament,
  };
};
