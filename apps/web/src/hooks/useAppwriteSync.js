import { useState, useEffect, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { isAppwriteConfigured } from '../appwrite.config';
import { tournamentService } from '../services/tournamentService';
import { playerService } from '../services/playerService';
import { appDataService } from '../services/appDataService';
import { appAuxiliaryDataService } from '../services/appAuxiliaryDataService';
import { casualMatchService } from '../services/casualmatchservice';
import { queryKeys } from '../config/queryKeys';
import { ANALYTICS_EVENTS, trackEvent } from '@fixture-maker/analytics';
import {
  isLikelyOfflineError,
  offlineOutboxService,
} from '../services/offlineOutboxService';

/**
 * Custom hook to manage Appwrite sync via React Query.
 */
export const useAppwriteSync = (showToast, activeGroupId = null, queryClient = null) => {
  const [isAppwriteEnabled] = useState(() => isAppwriteConfigured());
  const [isConfigChecked] = useState(true);
  const [currentTournamentId, setCurrentTournamentId] = useState(null);
  const [queuedWritesCount, setQueuedWritesCount] = useState(() => offlineOutboxService.getCount());
  const resolvedGroupId = activeGroupId || null;

  const invalidateCloudQueries = useCallback(async ({
    tournamentId = '',
    includeCasual = false,
    includeBootstrap = true,
    includeTournaments = true,
  } = {}) => {
    if (!queryClient) return;

    const tasks = [];
    if (includeBootstrap) {
      tasks.push(queryClient.invalidateQueries({
        queryKey: queryKeys.appwriteData(resolvedGroupId),
      }));
    }
    if (includeTournaments) {
      tasks.push(queryClient.invalidateQueries({
        queryKey: queryKeys.tournamentSummaries(resolvedGroupId),
      }));
      tasks.push(queryClient.invalidateQueries({
        queryKey: queryKeys.tournamentHistory(resolvedGroupId),
      }));
    }
    const normalizedTournamentId = String(tournamentId || '').trim();
    if (normalizedTournamentId) {
      tasks.push(queryClient.invalidateQueries({
        queryKey: queryKeys.tournamentDetail(resolvedGroupId, normalizedTournamentId),
      }));
    }
    if (includeCasual) {
      tasks.push(queryClient.invalidateQueries({
        queryKey: queryKeys.casualMatches(resolvedGroupId),
      }));
    }
    if (tasks.length === 0) return;
    await Promise.allSettled(tasks);
  }, [queryClient, resolvedGroupId]);

  useEffect(() => {
    if (isAppwriteEnabled) {
      console.log('✅ Appwrite integration enabled');
    } else {
      console.log('⚠️ Appwrite not configured - check .env file');
    }
  }, [isAppwriteEnabled]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const handleOutboxChanged = (event) => {
      const countFromEvent = Number(event?.detail?.count);
      if (Number.isFinite(countFromEvent)) {
        setQueuedWritesCount(countFromEvent);
        return;
      }
      setQueuedWritesCount(offlineOutboxService.getCount());
    };

    window.addEventListener('bfm:outbox-changed', handleOutboxChanged);
    return () => {
      window.removeEventListener('bfm:outbox-changed', handleOutboxChanged);
    };
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
          promise: appDataService.getAppMeta({ groupId: resolvedGroupId }).catch(() => null),
        });
        tasks.push({
          key: 'auxiliary',
          promise: appAuxiliaryDataService.loadAuxiliaryData(resolvedGroupId).catch(() => (
            appAuxiliaryDataService.emptyAuxiliaryPayload()
          )),
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
      if (resultByKey.auxiliary?.status === 'rejected') {
        console.error('Failed to load auxiliary cloud data from Appwrite:', resultByKey.auxiliary.reason);
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
      const auxiliary = resultByKey.auxiliary?.status === 'fulfilled'
        ? resultByKey.auxiliary.value
        : appAuxiliaryDataService.emptyAuxiliaryPayload();

      return {
        tournaments: tournaments || [],
        playerDatabase: playerDb?.players || [],
        playerRatings: ratings?.ratings || {},
        members: auxiliary.members || [],
        memberAccountLinks: auxiliary.memberAccountLinks || {},
        templates: auxiliary.templates || [],
        playerPhotos: auxiliary.playerPhotos || {},
        activeTournament: meta?.activeTournament || null,
      };
    } catch (error) {
      console.error('Error loading from Appwrite:', error);
      showToast?.('Failed to load from cloud', 'error');
      return null;
    }
  };

  const queueOfflineAction = useCallback((action, payload, dedupeKey, message) => {
    offlineOutboxService.enqueue({ action, payload, dedupeKey });
    setQueuedWritesCount(offlineOutboxService.getCount());
    if (message) {
      showToast?.(message);
    }
  }, [showToast]);

  const hasRatingsDeltaChanges = (deltaPayload) => {
    const changedRatings = deltaPayload?.changedRatings;
    const deletedPlayerNames = deltaPayload?.deletedPlayerNames;
    return Boolean(
      changedRatings
      && typeof changedRatings === 'object'
      && Object.keys(changedRatings).length > 0
    ) || (Array.isArray(deletedPlayerNames) && deletedPlayerNames.length > 0);
  };

  const executeTournamentTransaction = useCallback(async (payload = {}) => {
    const entryGroupId = payload?.groupId || resolvedGroupId;
    const tournamentId = String(payload?.tournamentId || '').trim();
    const tournamentData = payload?.tournamentData && typeof payload.tournamentData === 'object'
      ? payload.tournamentData
      : null;
    const ratingsDelta = payload?.ratingsDelta && typeof payload.ratingsDelta === 'object'
      ? payload.ratingsDelta
      : null;
    const hasActiveTournamentField = Object.prototype.hasOwnProperty.call(payload, 'activeTournament');
    const activeTournament = hasActiveTournamentField ? (payload?.activeTournament ?? null) : undefined;

    let savedTournament = null;
    if (tournamentId && tournamentData) {
      savedTournament = await tournamentService.updateTournament(
        tournamentId,
        tournamentData,
        entryGroupId,
        { skipExistingHydration: true }
      );
    }

    if (hasRatingsDeltaChanges(ratingsDelta)) {
      await playerService.savePlayerRatingsDelta(ratingsDelta, entryGroupId);
    }

    if (hasActiveTournamentField) {
      await appDataService.saveActiveTournamentLock(activeTournament, { groupId: entryGroupId });
    }

    await invalidateCloudQueries({
      tournamentId: tournamentId || savedTournament?.appwriteId || savedTournament?.id || '',
      includeBootstrap: true,
      includeTournaments: true,
    });

    return {
      tournament: savedTournament,
      ratingsDelta: ratingsDelta || null,
      activeTournament: hasActiveTournamentField ? activeTournament : undefined,
    };
  }, [invalidateCloudQueries, resolvedGroupId]);

  const executeOutboxEntry = useCallback(async (entry) => {
    const action = String(entry?.action || '').trim();
    const payload = entry?.payload || {};
    const entryGroupId = payload?.groupId || resolvedGroupId;

    switch (action) {
      case 'tournament.save': {
        const tournament = payload?.tournament;
        if (!tournament || typeof tournament !== 'object') return;
        if (tournament.appwriteId) {
          await tournamentService.updateTournament(tournament.appwriteId, tournament, entryGroupId);
        } else {
          await tournamentService.createTournament(tournament, entryGroupId);
        }
        return;
      }
      case 'tournament.delete': {
        const tournamentId = String(payload?.tournamentId || '').trim();
        if (!tournamentId) return;
        await tournamentService.deleteTournament(tournamentId, entryGroupId);
        return;
      }
      case 'ratings.save': {
        const ratingsPayload = payload?.ratings;
        const isDeltaPayload = Boolean(
          ratingsPayload
          && typeof ratingsPayload === 'object'
          && (
            Object.prototype.hasOwnProperty.call(ratingsPayload, 'changedRatings')
            || Object.prototype.hasOwnProperty.call(ratingsPayload, 'deletedPlayerNames')
          )
        );
        if (isDeltaPayload) {
          await playerService.savePlayerRatingsDelta(ratingsPayload, entryGroupId);
        } else {
          await playerService.savePlayerRatings(ratingsPayload, entryGroupId);
        }
        return;
      }
      case 'players.save': {
        const playersPayload = payload?.players;
        const players = Array.isArray(playersPayload) ? playersPayload : (playersPayload?.players || []);
        const pruneMissing = Boolean(!Array.isArray(playersPayload) && playersPayload?.pruneMissing);
        await playerService.savePlayerDatabase(players, entryGroupId, { pruneMissing });
        return;
      }
      case 'meta.members': {
        const members = Array.isArray(payload?.members) ? payload.members : [];
        await appAuxiliaryDataService.saveMembers(members, entryGroupId);
        return;
      }
      case 'meta.templates': {
        await appAuxiliaryDataService.saveTemplates(payload?.templates || [], entryGroupId);
        return;
      }
      case 'meta.playerPhotos': {
        await appAuxiliaryDataService.savePlayerPhotos(payload?.playerPhotos || {}, entryGroupId);
        return;
      }
      case 'tournament.sync': {
        const tournamentId = String(payload?.tournamentId || '').trim();
        const tournamentData = payload?.tournamentData;
        if (!tournamentId || !tournamentData) return;
        await tournamentService.updateTournament(tournamentId, {
          teams: tournamentData.teams,
          fixtures: tournamentData.fixtures,
          bracket: tournamentData.bracket,
          champion: tournamentData.champion,
          finalMatch: tournamentData.finalMatch,
          aiSummaries: tournamentData.aiSummaries,
          swapHistory: tournamentData.swapHistory,
          status: tournamentData.champion ? 'completed' : 'active',
        }, entryGroupId, { skipExistingHydration: true });
        return;
      }
      case 'tournament.patchMatches': {
        const tournamentId = String(payload?.tournamentId || '').trim();
        const matches = Array.isArray(payload?.matches) ? payload.matches : [];
        if (!tournamentId || matches.length === 0) return;
        await tournamentService.patchTournamentMatches(tournamentId, matches, entryGroupId);
        return;
      }
      case 'tournament.transaction': {
        await executeTournamentTransaction(payload);
        return;
      }
      case 'casual.create': {
        const matchData = payload?.matchData;
        if (!matchData) return;
        await casualMatchService.createCasualMatch(matchData, entryGroupId);
        return;
      }
      case 'casual.delete': {
        const matchId = String(payload?.matchId || '').trim();
        if (!matchId) return;
        await casualMatchService.deleteCasualMatch(matchId, entryGroupId);
        return;
      }
      default:
        return;
    }
  }, [executeTournamentTransaction, resolvedGroupId]);

  const flushOfflineOutbox = useCallback(async ({ silent = false } = {}) => {
    if (!isAppwriteEnabled) {
      return {
        initialCount: 0,
        flushedCount: 0,
        failedCount: 0,
        remainingCount: offlineOutboxService.getCount(),
      };
    }

    const summary = await offlineOutboxService.flush(executeOutboxEntry);
    setQueuedWritesCount(summary.remainingCount);

    if (summary.flushedCount > 0) {
      trackEvent(ANALYTICS_EVENTS.OFFLINE_SYNC_FLUSHED, {
        flushedCount: summary.flushedCount,
        failedCount: summary.failedCount,
        remainingCount: summary.remainingCount,
      });
      await invalidateCloudQueries({
        includeBootstrap: true,
        includeTournaments: true,
        includeCasual: true,
      });
      if (!silent) {
        showToast?.(`Synced ${summary.flushedCount} queued cloud change${summary.flushedCount === 1 ? '' : 's'}`);
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('bfm:outbox-flushed', { detail: summary }));
      }
    }

    return summary;
  }, [executeOutboxEntry, invalidateCloudQueries, isAppwriteEnabled, showToast]);

  useEffect(() => {
    if (!isAppwriteEnabled || typeof window === 'undefined') return undefined;

    const initialFlushTimer = window.setTimeout(() => {
      void flushOfflineOutbox({ silent: true });
    }, 0);

    const handleOnline = () => {
      void flushOfflineOutbox();
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        void flushOfflineOutbox({ silent: true });
      }
    };
    const handleServiceWorkerMessage = (event) => {
      if (event?.data?.type === 'OUTBOX_SYNC') {
        void flushOfflineOutbox();
      }
    };

    window.addEventListener('online', handleOnline);
    document.addEventListener('visibilitychange', handleVisibility);
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);
    }

    return () => {
      window.clearTimeout(initialFlushTimer);
      window.removeEventListener('online', handleOnline);
      document.removeEventListener('visibilitychange', handleVisibility);
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleServiceWorkerMessage);
      }
    };
  }, [flushOfflineOutbox, isAppwriteEnabled]);

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
      if (!isLikelyOfflineError(error)) {
        showToast?.('Failed to sync to cloud', 'error');
      }
    },
  });

  const deleteTournamentMutation = useMutation({
    mutationFn: async (tournamentId) => {
      if (!isAppwriteEnabled) return true;
      const deleted = await tournamentService.deleteTournament(tournamentId, resolvedGroupId);
      return deleted !== false;
    },
    onSuccess: () => {},
    onError: (error) => {
      console.error('Error deleting tournament from Appwrite:', error);
      if (!isLikelyOfflineError(error)) {
        showToast?.('Failed to delete from cloud', 'error');
      }
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
      return appDataService.saveAppMeta(updates, { groupId: resolvedGroupId });
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

  const tournamentTransactionMutation = useMutation({
    mutationFn: async (payload) => {
      if (!isAppwriteEnabled) return payload;
      return executeTournamentTransaction(payload);
    },
    onError: (error) => {
      console.error('Error syncing tournament transaction:', error);
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
      const saved = await saveTournamentMutation.mutateAsync(tournament);
      await invalidateCloudQueries({
        tournamentId: saved?.appwriteId || saved?.id || tournament?.appwriteId || tournament?.id || '',
        includeBootstrap: true,
        includeTournaments: true,
      });
      return saved;
    } catch (error) {
      if (isLikelyOfflineError(error)) {
        const dedupeId = String(tournament?.appwriteId || tournament?.id || tournament?.name || '').trim();
        queueOfflineAction(
          'tournament.save',
          { tournament, groupId: resolvedGroupId },
          `tournament.save:${resolvedGroupId || 'nogroup'}:${dedupeId || 'new'}`,
          'Offline: tournament change queued for sync'
        );
      }
      return tournament;
    }
  };

  const deleteTournamentFromAppwrite = async (tournamentId) => {
    try {
      const deleted = await deleteTournamentMutation.mutateAsync(tournamentId);
      await invalidateCloudQueries({
        tournamentId,
        includeBootstrap: true,
        includeTournaments: true,
      });
      return deleted;
    } catch (error) {
      if (isLikelyOfflineError(error)) {
        const normalizedId = String(tournamentId || '').trim();
        queueOfflineAction(
          'tournament.delete',
          { tournamentId: normalizedId, groupId: resolvedGroupId },
          `tournament.delete:${resolvedGroupId || 'nogroup'}:${normalizedId}`,
          'Offline: tournament delete queued for sync'
        );
        return true;
      }
      return false;
    }
  };

  const saveRatingsToAppwrite = async (ratings) => {
    try {
      const saved = await saveRatingsMutation.mutateAsync(ratings);
      await invalidateCloudQueries({
        includeBootstrap: true,
        includeTournaments: false,
      });
      return saved;
    } catch (error) {
      if (isLikelyOfflineError(error)) {
        queueOfflineAction(
          'ratings.save',
          { ratings, groupId: resolvedGroupId },
          `ratings.save:${resolvedGroupId || 'nogroup'}`,
          'Offline: ratings changes queued for sync'
        );
      }
      return ratings;
    }
  };

  const savePlayerDatabaseToAppwrite = async (players) => {
    try {
      const saved = await savePlayerDatabaseMutation.mutateAsync(players);
      await invalidateCloudQueries({
        includeBootstrap: true,
        includeTournaments: false,
      });
      return saved;
    } catch (error) {
      if (isLikelyOfflineError(error)) {
        queueOfflineAction(
          'players.save',
          { players, groupId: resolvedGroupId },
          `players.save:${resolvedGroupId || 'nogroup'}`,
          'Offline: player updates queued for sync'
        );
      }
      return players;
    }
  };

  const saveMembersToAppwrite = async (payload) => {
    const members = Array.isArray(payload) ? payload : (payload?.members || []);
    try {
      await appAuxiliaryDataService.saveMembers(members, resolvedGroupId);
      await invalidateCloudQueries({
        includeBootstrap: true,
        includeTournaments: false,
      });
    } catch (error) {
      if (isLikelyOfflineError(error)) {
        queueOfflineAction(
          'meta.members',
          { members, memberAccountLinks, groupId: resolvedGroupId },
          `meta.members:${resolvedGroupId || 'nogroup'}`,
          'Offline: member updates queued for sync'
        );
      } else {
        throw error;
      }
    }
    return members;
  };

  const saveTemplatesToAppwrite = async (templates) => {
    try {
      await appAuxiliaryDataService.saveTemplates(templates, resolvedGroupId);
      await invalidateCloudQueries({
        includeBootstrap: true,
        includeTournaments: false,
      });
    } catch (error) {
      if (isLikelyOfflineError(error)) {
        queueOfflineAction(
          'meta.templates',
          { templates, groupId: resolvedGroupId },
          `meta.templates:${resolvedGroupId || 'nogroup'}`,
          'Offline: templates queued for sync'
        );
      } else {
        throw error;
      }
    }
    return templates;
  };

  const savePlayerPhotosToAppwrite = async (playerPhotos) => {
    try {
      await appAuxiliaryDataService.savePlayerPhotos(playerPhotos, resolvedGroupId);
      await invalidateCloudQueries({
        includeBootstrap: true,
        includeTournaments: false,
      });
    } catch (error) {
      if (isLikelyOfflineError(error)) {
        queueOfflineAction(
          'meta.playerPhotos',
          { playerPhotos, groupId: resolvedGroupId },
          `meta.playerPhotos:${resolvedGroupId || 'nogroup'}`,
          'Offline: photo changes queued for sync'
        );
      } else {
        throw error;
      }
    }
    return playerPhotos;
  };

  const syncCurrentTournament = async (tournamentData, tournamentIdOverride = null) => {
    const targetTournamentId = tournamentIdOverride || currentTournamentId;
    if (!targetTournamentId) return null;
    try {
      const result = await syncTournamentMutation.mutateAsync({
        tournamentId: targetTournamentId,
        tournamentData,
      });
      await invalidateCloudQueries({
        tournamentId: targetTournamentId,
        includeBootstrap: true,
        includeTournaments: true,
      });
      return result;
    } catch (error) {
      if (isLikelyOfflineError(error)) {
        queueOfflineAction(
          'tournament.sync',
          { tournamentId: targetTournamentId, tournamentData, groupId: resolvedGroupId },
          `tournament.sync:${resolvedGroupId || 'nogroup'}:${targetTournamentId}`,
          'Offline: tournament updates queued for sync'
        );
        return null;
      }
      throw error;
    }
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
    try {
      const summary = await patchTournamentMatchesMutation.mutateAsync({
        tournamentId: targetTournamentId,
        matches,
      });
      await invalidateCloudQueries({
        tournamentId: targetTournamentId,
        includeBootstrap: true,
        includeTournaments: true,
      });
      return summary;
    } catch (error) {
      if (isLikelyOfflineError(error)) {
        queueOfflineAction(
          'tournament.patchMatches',
          { tournamentId: targetTournamentId, matches, groupId: resolvedGroupId },
          `tournament.patchMatches:${resolvedGroupId || 'nogroup'}:${targetTournamentId}`,
          'Offline: score updates queued for sync'
        );
        return {
          updatedMatches: 0,
          updatedParticipants: 0,
          deletedParticipants: 0,
          missingMatches: 0,
        };
      }
      throw error;
    }
  };

  const saveCasualMatchToAppwrite = async (matchData) => {
    if (!isAppwriteEnabled) return matchData;
    try {
      const saved = await casualMatchService.createCasualMatch(matchData, resolvedGroupId);
      await invalidateCloudQueries({
        includeBootstrap: true,
        includeTournaments: false,
        includeCasual: true,
      });
      return saved;
    } catch (error) {
      if (!isLikelyOfflineError(error)) throw error;
      const tempId = `offline-casual-${Date.now()}`;
      queueOfflineAction(
        'casual.create',
        { matchData, groupId: resolvedGroupId },
        `casual.create:${resolvedGroupId || 'nogroup'}:${matchData?.id || matchData?.date || tempId}`,
        'Offline: casual match queued for sync'
      );
      return {
        ...matchData,
        id: tempId,
        appwriteId: tempId,
        createdAt: new Date().toISOString(),
        pendingSync: true,
      };
    }
  };

  const deleteCasualMatchFromAppwrite = async (matchId) => {
    if (!isAppwriteEnabled) return true;
    try {
      const deleted = await casualMatchService.deleteCasualMatch(matchId, resolvedGroupId);
      await invalidateCloudQueries({
        includeBootstrap: true,
        includeTournaments: false,
        includeCasual: true,
      });
      return deleted;
    } catch (error) {
      if (!isLikelyOfflineError(error)) throw error;
      const normalizedId = String(matchId || '').trim();
      queueOfflineAction(
        'casual.delete',
        { matchId: normalizedId, groupId: resolvedGroupId },
        `casual.delete:${resolvedGroupId || 'nogroup'}:${normalizedId}`,
        'Offline: casual match delete queued for sync'
      );
      return true;
    }
  };

  const saveTournamentTransactionToAppwrite = async (payload) => {
    try {
      return await tournamentTransactionMutation.mutateAsync(payload);
    } catch (error) {
      if (isLikelyOfflineError(error)) {
        const normalizedTournamentId = String(payload?.tournamentId || '').trim();
        queueOfflineAction(
          'tournament.transaction',
          {
            ...payload,
            groupId: payload?.groupId || resolvedGroupId,
          },
          `tournament.transaction:${resolvedGroupId || 'nogroup'}:${normalizedTournamentId || 'pending'}`,
          'Offline: tournament progress queued for sync'
        );
        return {
          queued: true,
          tournament: payload?.tournamentData || null,
        };
      }
      throw error;
    }
  };

  const isSyncing = saveTournamentMutation.isPending
    || deleteTournamentMutation.isPending
    || saveRatingsMutation.isPending
    || savePlayerDatabaseMutation.isPending
    || saveMetaMutation.isPending
    || syncTournamentMutation.isPending
    || patchTournamentMatchesMutation.isPending
    || tournamentTransactionMutation.isPending;

  return {
    isAppwriteEnabled,
    isConfigChecked,
    isSyncing,
    queuedWritesCount,
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
    saveCasualMatchToAppwrite,
    deleteCasualMatchFromAppwrite,
    syncCurrentTournament,
    patchTournamentMatches,
    saveTournamentTransactionToAppwrite,
    flushOfflineOutbox,
  };
};
