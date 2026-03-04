import { useRef } from 'react';
import { casualMatchService } from '../../services/casualmatchservice';
import { tournamentService } from '../../services/tournamentService';
import { queryKeys } from '../../config/queryKeys';
import { removeTournamentFromList } from '../../utils/appHelpers';
import { useSetupPrefetchEffect } from '../useSetupPrefetchEffect';

export const useHomeData = ({
  activeGroupId,
  isAppwriteEnabled,
  queryClient,
  tournamentHistory,
  setTournamentHistory,
  casualMatches,
  setCasualMatches,
  showToast,
  recoverRatingsIfMissing,
  historyHydrated,
  setHistoryHydrated,
  casualHydrated,
  setCasualHydrated,
  setHistoryHydrationPending,
  setCasualHydrationPending,
  historyHydrationPromiseRef,
  casualHydrationPromiseRef,
}) => {
  const historyHydrationVersionRef = useRef(0);
  const casualHydrationVersionRef = useRef(0);
  const normalizeName = (value) => String(value || '').trim().toLowerCase();
  const getTournamentIds = (item) => Array.from(new Set(
    [item?.id, item?.appwriteId]
      .map((value) => String(value || '').trim())
      .filter(Boolean)
  ));
  const hasIdOverlap = (left, right) => {
    const leftIds = getTournamentIds(left);
    const rightIds = getTournamentIds(right);
    if (leftIds.length === 0 || rightIds.length === 0) return false;
    return leftIds.some((id) => rightIds.includes(id));
  };
  const isActiveLiveTournament = (item) => item?.status === 'active' && !item?.champion;
  const mergeHydratedHistoryWithLocalLive = (remoteHistory = [], localHistory = []) => {
    const remote = Array.isArray(remoteHistory) ? remoteHistory : [];
    const local = Array.isArray(localHistory) ? localHistory : [];
    const localActive = local.filter((item) => isActiveLiveTournament(item));
    if (localActive.length === 0) return remote;

    const preservedLocalActive = localActive.filter((localItem) => {
      const localName = normalizeName(localItem?.name);
      return !remote.some((remoteItem) => {
        if (hasIdOverlap(localItem, remoteItem)) return true;
        if (!isActiveLiveTournament(remoteItem)) return false;
        const remoteName = normalizeName(remoteItem?.name);
        return Boolean(localName && remoteName && localName === remoteName);
      });
    });

    if (preservedLocalActive.length === 0) return remote;
    return [...preservedLocalActive, ...remote];
  };

  const invalidateHydrationRequests = () => {
    historyHydrationVersionRef.current += 1;
    casualHydrationVersionRef.current += 1;
    historyHydrationPromiseRef.current = null;
    casualHydrationPromiseRef.current = null;
    setHistoryHydrationPending(false);
    setCasualHydrationPending(false);
  };

  const pruneTournamentQueryCacheAfterDelete = ({
    targetIds = [],
    targetName = '',
    removeActiveByName = false,
  } = {}) => {
    const normalizedIds = Array.from(new Set(
      (Array.isArray(targetIds) ? targetIds : [])
        .map((value) => String(value || '').trim())
        .filter(Boolean)
    ));

    queryClient.setQueryData(
      queryKeys.tournamentSummaries(activeGroupId),
      (cached) => removeTournamentFromList(cached, {
        targetIds: normalizedIds,
        targetName,
        removeActiveByName,
      })
    );
    queryClient.setQueryData(
      queryKeys.tournamentHistory(activeGroupId),
      (cached) => removeTournamentFromList(cached, {
        targetIds: normalizedIds,
        targetName,
        removeActiveByName,
      })
    );

    normalizedIds.forEach((id) => {
      queryClient.removeQueries({
        queryKey: queryKeys.tournamentDetail(activeGroupId, id),
        exact: true,
      });
    });
  };

  const ensureTournamentHistoryHydrated = async ({ force = false, silent = false } = {}) => {
    if (!isAppwriteEnabled) {
      setHistoryHydrated(true);
      return tournamentHistory || [];
    }
    if (!force && historyHydrated) {
      return tournamentHistory || [];
    }
    if (!force && historyHydrationPromiseRef.current) {
      return historyHydrationPromiseRef.current;
    }

    const requestVersion = historyHydrationVersionRef.current + 1;
    historyHydrationVersionRef.current = requestVersion;
    setHistoryHydrationPending(true);
    const promise = (async () => {
      try {
        const history = await queryClient.fetchQuery({
          queryKey: queryKeys.tournamentHistory(activeGroupId),
          queryFn: () => tournamentService.getAllTournaments(100, activeGroupId),
          staleTime: 5 * 60 * 1000,
        });
        const mergedHistory = mergeHydratedHistoryWithLocalLive(
          history || [],
          tournamentHistory || []
        );
        if (historyHydrationVersionRef.current !== requestVersion) {
          return tournamentHistory || [];
        }
        setTournamentHistory(mergedHistory);
        recoverRatingsIfMissing({
          history: mergedHistory,
          casual: casualMatches || [],
        });
        setHistoryHydrated(true);
        return mergedHistory;
      } catch (error) {
        console.error('Failed to load tournament history:', error);
        if (!silent) {
          showToast('Failed to load tournament history', 'error');
        }
        return tournamentHistory || [];
      } finally {
        if (historyHydrationVersionRef.current === requestVersion) {
          setHistoryHydrationPending(false);
          historyHydrationPromiseRef.current = null;
        }
      }
    })();

    historyHydrationPromiseRef.current = promise;
    return promise;
  };

  const ensureCasualMatchesHydrated = async ({ force = false, silent = false } = {}) => {
    if (!isAppwriteEnabled) {
      setCasualHydrated(true);
      return casualMatches || [];
    }
    if (!force && casualHydrated) {
      return casualMatches || [];
    }
    if (!force && casualHydrationPromiseRef.current) {
      return casualHydrationPromiseRef.current;
    }

    const requestVersion = casualHydrationVersionRef.current + 1;
    casualHydrationVersionRef.current = requestVersion;
    setCasualHydrationPending(true);
    const promise = (async () => {
      try {
        const matches = await queryClient.fetchQuery({
          queryKey: queryKeys.casualMatches(activeGroupId),
          queryFn: () => casualMatchService.getAllCasualMatches(100, activeGroupId),
          staleTime: 5 * 60 * 1000,
        });
        if (casualHydrationVersionRef.current !== requestVersion) {
          return casualMatches || [];
        }
        setCasualMatches(matches || []);
        recoverRatingsIfMissing({
          history: tournamentHistory || [],
          casual: matches || [],
        });
        setCasualHydrated(true);
        return matches || [];
      } catch (error) {
        console.error('Failed to load casual match history:', error);
        if (!silent) {
          showToast('Failed to load casual match history', 'error');
        }
        return casualMatches || [];
      } finally {
        if (casualHydrationVersionRef.current === requestVersion) {
          setCasualHydrationPending(false);
          casualHydrationPromiseRef.current = null;
        }
      }
    })();

    casualHydrationPromiseRef.current = promise;
    return promise;
  };

  useSetupPrefetchEffect({
    activeGroupId,
    isAppwriteEnabled,
    setHistoryHydrated,
    setCasualHydrated,
    historyHydrationPromiseRef,
    casualHydrationPromiseRef,
  });

  return {
    invalidateHydrationRequests,
    pruneTournamentQueryCacheAfterDelete,
    ensureTournamentHistoryHydrated,
    ensureCasualMatchesHydrated,
  };
};
