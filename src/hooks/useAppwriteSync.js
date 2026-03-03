import { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { isAppwriteConfigured } from '../appwrite.config';
import { tournamentService } from '../services/tournamentService';
import { playerService } from '../services/playerService';
import { appDataService } from '../services/appDataService';

/**
 * Custom hook to manage Appwrite sync via React Query.
 */
export const useAppwriteSync = (showToast, activeGroupId = null) => {
  const [isAppwriteEnabled, setIsAppwriteEnabled] = useState(false);
  const [isConfigChecked, setIsConfigChecked] = useState(false);
  const [currentTournamentId, setCurrentTournamentId] = useState(null);
  const resolvedGroupId = activeGroupId || null;

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

  const loadFromAppwrite = async (options = {}) => {
    if (!isAppwriteEnabled) return null;
    const {
      includeTournaments = true,
      includePlayerDatabase = true,
      includeRatings = true,
      includeMeta = true,
      tournamentLimit = 100,
      tournamentStatuses = [],
      useTournamentSummaries = false,
    } = options || {};

    try {
      const tasks = [];

      if (includeTournaments) {
        tasks.push({
          key: 'tournaments',
          promise: useTournamentSummaries
            ? tournamentService.getTournamentSummaries(tournamentLimit, resolvedGroupId, tournamentStatuses)
            : tournamentService.getAllTournaments(tournamentLimit, resolvedGroupId),
        });
      }
      if (includePlayerDatabase) {
        tasks.push({
          key: 'playerDatabase',
          promise: playerService.getPlayerDatabase(resolvedGroupId),
        });
      }
      if (includeRatings) {
        tasks.push({
          key: 'ratings',
          promise: playerService.getPlayerRatings(resolvedGroupId),
        });
      }
      if (includeMeta) {
        tasks.push({
          key: 'meta',
          promise: appDataService.getAppMeta().catch(() => null),
        });
      }

      const settled = await Promise.allSettled(tasks.map((task) => task.promise));
      const resultByKey = {};
      tasks.forEach((task, index) => {
        resultByKey[task.key] = settled[index];
      });

      if (resultByKey.tournaments?.status === 'rejected') {
        console.error('Failed to load tournaments from Appwrite:', resultByKey.tournaments.reason);
      }
      if (resultByKey.playerDatabase?.status === 'rejected') {
        console.error('Failed to load players from Appwrite:', resultByKey.playerDatabase.reason);
      }
      if (resultByKey.ratings?.status === 'rejected') {
        console.error('Failed to load ratings from Appwrite:', resultByKey.ratings.reason);
      }
      if (resultByKey.meta?.status === 'rejected') {
        console.error('Failed to load app meta from Appwrite:', resultByKey.meta.reason);
      }

      const readFailures = [resultByKey.tournaments, resultByKey.playerDatabase, resultByKey.ratings]
        .filter(Boolean)
        .filter((result) => result.status === 'rejected');
      if (readFailures.length > 0) {
        const firstFailure = readFailures[0];
        const message = String(firstFailure?.reason?.message || '').trim();
        showToast?.(
          message
            ? `Cloud read failed: ${message}`
            : 'Cloud read failed for one or more collections. Check Appwrite permissions and indexes.',
          'error'
        );
      }

      const tournaments = resultByKey.tournaments?.status === 'fulfilled'
        ? resultByKey.tournaments.value
        : [];
      const playerDb = resultByKey.playerDatabase?.status === 'fulfilled'
        ? resultByKey.playerDatabase.value
        : null;
      const ratings = resultByKey.ratings?.status === 'fulfilled'
        ? resultByKey.ratings.value
        : null;
      const meta = resultByKey.meta?.status === 'fulfilled'
        ? resultByKey.meta.value
        : null;

      return {
        tournaments: tournaments || [],
        playerDatabase: playerDb?.players || [],
        playerRatings: ratings?.ratings || {},
        members: meta?.members || [],
        memberAccountLinks: meta?.memberAccountLinks || {},
        templates: meta?.templates || [],
        playerPhotos: meta?.playerPhotos || {},
        activeTournament: meta?.activeTournament || null,
      };
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
        return tournamentService.updateTournament(tournament.appwriteId, tournament, resolvedGroupId);
      }
      return tournamentService.createTournament(tournament, resolvedGroupId);
    },
    onSuccess: async (savedTournament) => {
      if (savedTournament?.id) setCurrentTournamentId(savedTournament.id);
    },
    onError: (error) => {
      console.error('Error saving tournament to Appwrite:', error);
      showToast?.('Failed to sync to cloud', 'error');
    },
  });

  const deleteTournamentMutation = useMutation({
    mutationFn: async (tournamentId) => {
      if (!isAppwriteEnabled) return true;
      await tournamentService.deleteTournament(tournamentId, resolvedGroupId);
      return true;
    },
    onSuccess: () => {},
    onError: (error) => {
      console.error('Error deleting tournament from Appwrite:', error);
      showToast?.('Failed to delete from cloud', 'error');
    },
  });

  const saveRatingsMutation = useMutation({
    mutationFn: async (payload) => {
      if (!isAppwriteEnabled) return payload;

      const isDeltaPayload = Boolean(
        payload
        && typeof payload === 'object'
        && (
          Object.prototype.hasOwnProperty.call(payload, 'changedRatings')
          || Object.prototype.hasOwnProperty.call(payload, 'deletedPlayerNames')
        )
      );

      if (isDeltaPayload) {
        await playerService.savePlayerRatingsDelta(payload, resolvedGroupId);
        return payload;
      }

      await playerService.savePlayerRatings(payload, resolvedGroupId);
      return payload;
    },
    onSuccess: () => {},
    onError: (error) => {
      console.error('Error saving ratings to Appwrite:', error);
    },
  });

  const savePlayerDatabaseMutation = useMutation({
    mutationFn: async (payload) => {
      const players = Array.isArray(payload) ? payload : (payload?.players || []);
      const pruneMissing = Boolean(!Array.isArray(payload) && payload?.pruneMissing);
      if (!isAppwriteEnabled) return players;
      await playerService.savePlayerDatabase(players, resolvedGroupId, { pruneMissing });
      return players;
    },
    onSuccess: () => {},
    onError: (error) => {
      console.error('Error saving player database to Appwrite:', error);
    },
  });

  const saveMetaMutation = useMutation({
    mutationFn: async (updates) => {
      if (!isAppwriteEnabled) return updates;
      return appDataService.saveAppMeta(updates);
    },
    onSuccess: () => {},
    onError: (error) => {
      console.error('Error saving app meta to Appwrite:', error);
    },
  });

  const syncTournamentMutation = useMutation({
    mutationFn: async ({ tournamentId, tournamentData }) => {
      if (!isAppwriteEnabled || !tournamentId) return null;
      return tournamentService.updateTournament(tournamentId, {
        teams: tournamentData.teams,
        fixtures: tournamentData.fixtures,
        bracket: tournamentData.bracket,
        champion: tournamentData.champion,
        finalMatch: tournamentData.finalMatch,
        aiSummaries: tournamentData.aiSummaries,
        swapHistory: tournamentData.swapHistory,
        status: tournamentData.champion ? 'completed' : 'active',
      }, resolvedGroupId, { skipExistingHydration: true });
    },
    onError: (error) => {
      console.error('Error syncing tournament:', error);
    },
    onSuccess: () => {},
  });

  const patchTournamentMatchesMutation = useMutation({
    mutationFn: async ({ tournamentId, matches }) => {
      if (!isAppwriteEnabled || !tournamentId) {
        return {
          updatedMatches: 0,
          updatedParticipants: 0,
          deletedParticipants: 0,
          missingMatches: 0,
        };
      }
      return tournamentService.patchTournamentMatches(
        tournamentId,
        Array.isArray(matches) ? matches : [],
        resolvedGroupId
      );
    },
    onError: (error) => {
      console.error('Error patching tournament matches:', error);
    },
    onSuccess: () => {},
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

  const saveMembersToAppwrite = async (payload) => {
    const members = Array.isArray(payload) ? payload : (payload?.members || []);
    const memberAccountLinks = Array.isArray(payload)
      ? undefined
      : payload?.memberAccountLinks;
    await saveMetaMutation.mutateAsync({
      members,
      ...(memberAccountLinks ? { memberAccountLinks } : {}),
    });
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

  const syncCurrentTournament = async (tournamentData, tournamentIdOverride = null) => {
    const targetTournamentId = tournamentIdOverride || currentTournamentId;
    if (!targetTournamentId) return null;
    return syncTournamentMutation.mutateAsync({
      tournamentId: targetTournamentId,
      tournamentData,
    });
  };

  const patchTournamentMatches = async (matches = [], tournamentIdOverride = null) => {
    const targetTournamentId = tournamentIdOverride || currentTournamentId;
    if (!targetTournamentId) {
      return {
        updatedMatches: 0,
        updatedParticipants: 0,
        deletedParticipants: 0,
        missingMatches: 0,
      };
    }
    return patchTournamentMatchesMutation.mutateAsync({
      tournamentId: targetTournamentId,
      matches,
    });
  };

  const isSyncing = saveTournamentMutation.isPending
    || deleteTournamentMutation.isPending
    || saveRatingsMutation.isPending
    || savePlayerDatabaseMutation.isPending
    || saveMetaMutation.isPending
    || syncTournamentMutation.isPending
    || patchTournamentMatchesMutation.isPending;

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
    patchTournamentMatches,
  };
};
