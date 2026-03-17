import { useEffect, useRef, useState } from 'react';
import { client, DATABASE_ID, COLLECTIONS } from '../appwrite.config';
import { queryKeys } from '../config/queryKeys';
import { tournamentService } from '../services/tournamentService';
import { casualMatchService } from '../services/casualmatchservice';
import {
  backfillCasualMatchesCompletedAt,
  backfillTournamentHistoryCompletedAt,
  normalizeTournamentName,
  removeTournamentFromList,
  upsertTournamentInHistory,
} from '../utils/appHelpers';

const TOURNAMENT_PATCH_DEBOUNCE_MS = 280;
const CASUAL_PATCH_DEBOUNCE_MS = 420;

const toText = (value) => String(value || '').trim();

const hasCollectionMarker = (markers = [], collectionId = '') => {
  const target = toText(collectionId);
  if (!target) return false;
  return (Array.isArray(markers) ? markers : []).some((marker) => (
    toText(marker).includes(`collections.${target}.documents`)
  ));
};

const detectOperation = (markers = []) => {
  const values = (Array.isArray(markers) ? markers : []).map((entry) => toText(entry).toLowerCase());
  if (values.some((entry) => entry.endsWith('.delete'))) return 'delete';
  if (values.some((entry) => entry.endsWith('.create'))) return 'create';
  if (values.some((entry) => entry.endsWith('.update'))) return 'update';
  return 'unknown';
};

const clearTimerMap = (timerMapRef) => {
  if (!timerMapRef?.current) return;
  Array.from(timerMapRef.current.values()).forEach((timerId) => clearTimeout(timerId));
  timerMapRef.current.clear();
};

export const useRealtimeCacheSync = ({
  enabled = false,
  activeGroupId = null,
  queryClient,
  setTournamentHistory,
  setCasualMatches,
}) => {
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [lastRealtimeEventAt, setLastRealtimeEventAt] = useState(0);
  const [lastCachePatchAt, setLastCachePatchAt] = useState(0);
  const tournamentPatchTimersRef = useRef(new Map());
  const casualPatchTimerRef = useRef(null);
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const deferConnectionState = (nextValue) => {
      queueMicrotask(() => {
        if (!mountedRef.current) return;
        setRealtimeConnected(Boolean(nextValue));
      });
    };

    clearTimerMap(tournamentPatchTimersRef);
    if (casualPatchTimerRef.current) {
      clearTimeout(casualPatchTimerRef.current);
      casualPatchTimerRef.current = null;
    }

    if (!enabled || !activeGroupId || !queryClient || !DATABASE_ID) {
      deferConnectionState(false);
      return undefined;
    }

    const tournamentCollectionId = toText(COLLECTIONS.TOURNAMENTS_V2);
    const matchesCollectionId = toText(COLLECTIONS.MATCHES_V2);
    const channels = [];
    if (tournamentCollectionId) {
      channels.push(`databases.${DATABASE_ID}.collections.${tournamentCollectionId}.documents`);
    }
    if (matchesCollectionId) {
      channels.push(`databases.${DATABASE_ID}.collections.${matchesCollectionId}.documents`);
    }
    if (channels.length === 0) {
      deferConnectionState(false);
      return undefined;
    }

    const removeTournamentFromCaches = ({ tournamentId = '', tournamentName = '' } = {}) => {
      const normalizedId = toText(tournamentId);
      const normalizedName = normalizeTournamentName(tournamentName);
      const targetIds = normalizedId ? [normalizedId] : [];
      const removeByName = Boolean(normalizedName);

      queryClient.setQueryData(
        queryKeys.tournamentSummaries(activeGroupId),
        (cached) => removeTournamentFromList(cached, {
          targetIds,
          targetName: normalizedName,
          removeActiveByName: removeByName,
        })
      );
      queryClient.setQueryData(
        queryKeys.tournamentHistory(activeGroupId),
        (cached) => removeTournamentFromList(cached, {
          targetIds,
          targetName: normalizedName,
          removeActiveByName: removeByName,
        })
      );
      if (normalizedId) {
        queryClient.removeQueries({
          queryKey: queryKeys.tournamentDetail(activeGroupId, normalizedId),
          exact: true,
        });
      }
      setTournamentHistory((prev) => removeTournamentFromList(prev, {
        targetIds,
        targetName: normalizedName,
        removeActiveByName: removeByName,
      }));
      if (mountedRef.current) {
        setLastCachePatchAt(Date.now());
      }
    };

    const patchTournamentCaches = (tournament) => {
      if (!tournament || typeof tournament !== 'object') return;
      const backfilled = backfillTournamentHistoryCompletedAt([tournament]);
      const nextTournament = backfilled.history[0] || tournament;
      const targetId = toText(tournament.appwriteId || tournament.id);
      if (!targetId) return;
      queryClient.setQueryData(queryKeys.tournamentDetail(activeGroupId, targetId), nextTournament);
      queryClient.setQueryData(
        queryKeys.tournamentSummaries(activeGroupId),
        (cached) => upsertTournamentInHistory(cached, nextTournament)
      );
      queryClient.setQueryData(
        queryKeys.tournamentHistory(activeGroupId),
        (cached) => upsertTournamentInHistory(cached, nextTournament)
      );
      setTournamentHistory((prev) => upsertTournamentInHistory(prev, nextTournament));
      if (mountedRef.current) {
        setLastCachePatchAt(Date.now());
      }
    };

    const scheduleTournamentPatch = (tournamentId) => {
      const targetId = toText(tournamentId);
      if (!targetId) return;
      const existingTimer = tournamentPatchTimersRef.current.get(targetId);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }
      const timerId = setTimeout(async () => {
        tournamentPatchTimersRef.current.delete(targetId);
        try {
          const tournament = await tournamentService.getTournamentById(targetId, activeGroupId);
          if (!mountedRef.current) return;
          if (!tournament) {
            removeTournamentFromCaches({ tournamentId: targetId });
            return;
          }
          patchTournamentCaches(tournament);
        } catch (error) {
          if (!mountedRef.current) return;
          if (Number(error?.code) === 404) {
            removeTournamentFromCaches({ tournamentId: targetId });
            return;
          }
          console.error('Realtime patch failed for tournament:', targetId, error);
        }
      }, TOURNAMENT_PATCH_DEBOUNCE_MS);
      tournamentPatchTimersRef.current.set(targetId, timerId);
    };

    const scheduleCasualPatch = () => {
      if (casualPatchTimerRef.current) {
        clearTimeout(casualPatchTimerRef.current);
      }
      casualPatchTimerRef.current = setTimeout(async () => {
        casualPatchTimerRef.current = null;
        try {
          const matches = await casualMatchService.getAllCasualMatches(100, activeGroupId);
          if (!mountedRef.current) return;
          const nextMatches = Array.isArray(matches) ? matches : [];
          const backfilled = backfillCasualMatchesCompletedAt(nextMatches);
          queryClient.setQueryData(queryKeys.casualMatches(activeGroupId), backfilled.matches);
          setCasualMatches(backfilled.matches);
          setLastCachePatchAt(Date.now());
        } catch (error) {
          if (!mountedRef.current) return;
          console.error('Realtime patch failed for casual matches:', error);
        }
      }, CASUAL_PATCH_DEBOUNCE_MS);
    };

    let unsubscribe = null;
    try {
      unsubscribe = client.subscribe(channels, (message) => {
        const events = Array.isArray(message?.events) ? message.events : [];
        const messageChannels = Array.isArray(message?.channels) ? message.channels : [];
        const markers = [...events, ...messageChannels];
        const operation = detectOperation(markers);
        const payload = message?.payload && typeof message.payload === 'object' ? message.payload : {};
        const payloadGroupId = toText(payload?.groupId);
        if (payloadGroupId && payloadGroupId !== toText(activeGroupId)) return;

        if (mountedRef.current) {
          setLastRealtimeEventAt(Date.now());
        }

        const isTournamentEvent = hasCollectionMarker(markers, tournamentCollectionId);
        if (isTournamentEvent) {
          const tournamentId = toText(payload?.$id || payload?.id);
          const status = toText(payload?.status).toLowerCase();
          if (operation === 'delete' || status === 'deleted') {
            removeTournamentFromCaches({
              tournamentId,
              tournamentName: payload?.name,
            });
          } else if (tournamentId) {
            scheduleTournamentPatch(tournamentId);
          }
        }

        const isMatchEvent = hasCollectionMarker(markers, matchesCollectionId);
        if (!isMatchEvent) return;

        const matchKind = toText(payload?.matchKind).toLowerCase();
        const matchTournamentId = toText(payload?.tournamentId);
        if (matchKind === 'casual' || (!matchKind && !matchTournamentId)) {
          scheduleCasualPatch();
        }
        if (matchTournamentId) {
          scheduleTournamentPatch(matchTournamentId);
        }
      });
      deferConnectionState(true);
    } catch (error) {
      console.error('Failed to initialize Appwrite realtime cache sync:', error);
      deferConnectionState(false);
      return undefined;
    }

    return () => {
      deferConnectionState(false);
      clearTimerMap(tournamentPatchTimersRef);
      if (casualPatchTimerRef.current) {
        clearTimeout(casualPatchTimerRef.current);
        casualPatchTimerRef.current = null;
      }
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [
    enabled,
    activeGroupId,
    queryClient,
    setTournamentHistory,
    setCasualMatches,
  ]);

  return {
    realtimeConnected,
    lastRealtimeEventAt,
    lastCachePatchAt,
  };
};
