import { useRef } from 'react';
import { casualMatchService } from '../../services/casualmatchservice';
import { tournamentService } from '../../services/tournamentService';
import { queryKeys } from '../../config/queryKeys';
import {
  backfillCasualMatchesCompletedAt,
  backfillTournamentHistoryCompletedAt,
  dedupeTournamentHistory,
  removeTournamentFromList,
  sortTournamentHistoryByRecent,
} from '../../utils/appHelpers';
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
  const normalizeFormat = (value) => normalizeName(value || 'league');
  const normalizeStatus = (value) => normalizeName(value);
  const parseDateKey = (value) => {
    const raw = String(value || '').trim();
    if (!raw) return '';
    const parsed = Date.parse(raw);
    if (Number.isFinite(parsed)) return new Date(parsed).toDateString();
    return raw.toLowerCase();
  };
  const getTournamentIds = (item) => Array.from(new Set(
    [item?.id, item?.appwriteId, item?.legacyTournamentId]
      .map((value) => String(value || '').trim())
      .filter(Boolean)
  ));
  const hasIdOverlap = (left, right) => {
    const leftIds = getTournamentIds(left);
    const rightIds = getTournamentIds(right);
    if (leftIds.length === 0 || rightIds.length === 0) return false;
    return leftIds.some((id) => rightIds.includes(id));
  };
  const getTeamsCount = (item) => {
    if (Array.isArray(item?.teams)) return item.teams.length;
    const count = Number(item?.teamsCount);
    return Number.isFinite(count) ? count : 0;
  };
  const getTeamSignature = (item) => {
    const teams = Array.isArray(item?.teams) ? item.teams : [];
    if (teams.length === 0) return '';
    return teams
      .map((team) => {
        const teamName = normalizeName(team?.name);
        const player1 = normalizeName(team?.player || team?.player1);
        const player2 = normalizeName(team?.player2);
        return `${teamName}|${player1}|${player2}`;
      })
      .sort()
      .join('||');
  };
  const isLocalTournamentId = (value) => {
    const normalized = String(value || '').trim();
    if (!normalized) return false;
    if (/^\d{10,}$/.test(normalized)) return true;
    return normalized.startsWith('sched-local-') || normalized.startsWith('local-');
  };
  const getStableId = (item) => {
    const appwriteId = String(item?.appwriteId || '').trim();
    if (appwriteId) return appwriteId;
    const legacyId = String(item?.legacyTournamentId || '').trim();
    if (legacyId) return legacyId;
    const localId = String(item?.id || '').trim();
    return isLocalTournamentId(localId) ? localId : '';
  };
  const hasStableId = (item) => {
    const appwriteId = String(item?.appwriteId || '').trim();
    const legacyId = String(item?.legacyTournamentId || '').trim();
    const localId = String(item?.id || '').trim();
    return Boolean(appwriteId || legacyId || (localId && isLocalTournamentId(localId)));
  };
  const isCompletedTournament = (item) => (
    Boolean(item?.champion) || normalizeStatus(item?.status) === 'completed'
  );
  const isLikelySameTournament = (localItem, remoteItem) => {
    if (!localItem || !remoteItem) return false;
    if (hasIdOverlap(localItem, remoteItem)) return true;

    const localName = normalizeName(localItem?.name);
    const remoteName = normalizeName(remoteItem?.name);
    if (!localName || !remoteName || localName !== remoteName) return false;

    const localFormat = normalizeFormat(localItem?.tournamentFormat || localItem?.format || 'league');
    const remoteFormat = normalizeFormat(remoteItem?.tournamentFormat || remoteItem?.format || 'league');
    if (localFormat !== remoteFormat) return false;

    const localTeamsCount = getTeamsCount(localItem);
    const remoteTeamsCount = getTeamsCount(remoteItem);
    if (localTeamsCount > 0 && remoteTeamsCount > 0 && localTeamsCount !== remoteTeamsCount) return false;

    const localSignature = getTeamSignature(localItem);
    const remoteSignature = getTeamSignature(remoteItem);
    if (localSignature && remoteSignature && localSignature !== remoteSignature) return false;
    if (localSignature && remoteSignature) return true;

    const localStableId = getStableId(localItem);
    const remoteStableId = getStableId(remoteItem);
    if (localStableId && remoteStableId && localStableId !== remoteStableId) return false;

    const localDate = parseDateKey(localItem?.date);
    const remoteDate = parseDateKey(remoteItem?.date);
    if (localDate && remoteDate) return localDate === remoteDate;

    if (isCompletedTournament(remoteItem)) return true;

    return !hasStableId(localItem) || !hasStableId(remoteItem);
  };
  const isActiveLiveTournament = (item) => item?.status === 'active' && !item?.champion;
  const mergeHydratedHistoryWithLocalLive = (remoteHistory = [], localHistory = []) => {
    const remote = Array.isArray(remoteHistory) ? remoteHistory : [];
    const local = Array.isArray(localHistory) ? localHistory : [];
    const localActive = local.filter((item) => isActiveLiveTournament(item));
    if (localActive.length === 0) return remote;

    const preservedLocalActive = localActive.filter(
      (localItem) => !remote.some((remoteItem) => isLikelySameTournament(localItem, remoteItem))
    );

    if (preservedLocalActive.length === 0) return dedupeTournamentHistory(remote);
    return dedupeTournamentHistory([...preservedLocalActive, ...remote]);
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
        const mergedHistory = dedupeTournamentHistory(mergeHydratedHistoryWithLocalLive(
          history || [],
          tournamentHistory || []
        ));
        const backfilledHistory = backfillTournamentHistoryCompletedAt(mergedHistory);
        if (historyHydrationVersionRef.current !== requestVersion) {
          return tournamentHistory || [];
        }
        const sortedHistory = sortTournamentHistoryByRecent(backfilledHistory.history);
        queryClient.setQueryData(
          queryKeys.tournamentHistory(activeGroupId),
          sortedHistory
        );
        setTournamentHistory(sortedHistory);
        recoverRatingsIfMissing({
          history: sortedHistory,
          casual: casualMatches || [],
        });
        setHistoryHydrated(true);
        return sortedHistory;
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
        const backfilledMatches = backfillCasualMatchesCompletedAt(matches || []);
        if (casualHydrationVersionRef.current !== requestVersion) {
          return casualMatches || [];
        }
        queryClient.setQueryData(
          queryKeys.casualMatches(activeGroupId),
          backfilledMatches.matches
        );
        setCasualMatches(backfilledMatches.matches);
        recoverRatingsIfMissing({
          history: tournamentHistory || [],
          casual: backfilledMatches.matches,
        });
        setCasualHydrated(true);
        return backfilledMatches.matches;
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
