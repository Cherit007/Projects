import { useCallback, useEffect, useRef } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { useQueryClient } from '@tanstack/react-query';
import { tournamentService } from '@fixture-maker/api/tournamentService';
import { isAppwriteConfigured } from '@fixture-maker/config/appwrite/env';
import { queryKeys } from '@fixture-maker/config/queryKeys';
import { useAppSession } from '../context/AppSessionContext';
import { offlineOutboxService } from '../services/offlineOutboxService';

type TournamentServiceWithGroup = {
  getAllTournaments: (limit?: number, groupId?: string | null) => Promise<unknown[]>;
  updateTournament: (
    tournamentId: string,
    updates: Record<string, unknown>,
    groupId?: string | null,
    options?: Record<string, unknown>,
  ) => Promise<unknown>;
  createTournament: (
    tournamentData: Record<string, unknown>,
    groupId?: string | null,
  ) => Promise<{ appwriteId?: string; id?: string }>;
};

const tournamentApi = tournamentService as TournamentServiceWithGroup;

type OutboxEntry = {
  action?: string;
  payload?: Record<string, unknown>;
};

const RECONNECT_DEBOUNCE_MS = 1500;

export const useMobileOutboxSync = () => {
  const queryClient = useQueryClient();
  const { activeGroup } = useAppSession();
  const groupId = activeGroup?.id || null;
  const groupIdRef = useRef(groupId);
  const wasConnectedRef = useRef<boolean | null>(null);
  const flushInFlightRef = useRef(false);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    groupIdRef.current = groupId;
  }, [groupId]);

  const executeOutboxEntry = useCallback(async (entry: OutboxEntry) => {
    const action = String(entry?.action || '').trim();
    const payload = entry?.payload || {};
    const entryGroupId = String(payload.groupId || groupIdRef.current || '').trim() || undefined;

    switch (action) {
      case 'tournament.save': {
        const tournament = payload.tournament as Record<string, unknown> | undefined;
        if (!tournament || typeof tournament !== 'object') return;
        if (tournament.appwriteId) {
          await tournamentApi.updateTournament(String(tournament.appwriteId), tournament, entryGroupId);
        } else {
          await tournamentApi.createTournament(tournament, entryGroupId);
        }
        return;
      }
      case 'tournament.sync': {
        const tournamentId = String(payload.tournamentId || '').trim();
        const tournamentData = payload.tournamentData as Record<string, unknown> | undefined;
        if (!tournamentId || !tournamentData) return;
        await tournamentApi.updateTournament(tournamentId, {
          teams: tournamentData.teams,
          fixtures: tournamentData.fixtures,
          bracket: tournamentData.bracket,
          champion: tournamentData.champion,
          finalMatch: tournamentData.finalMatch,
          status: tournamentData.champion ? 'completed' : 'active',
        }, entryGroupId, { skipExistingHydration: true });
        return;
      }
      default:
        return;
    }
  }, []);

  const flushOfflineOutbox = useCallback(async () => {
    if (flushInFlightRef.current) return null;
    flushInFlightRef.current = true;
    try {
      if (!isAppwriteConfigured()) {
        return offlineOutboxService.flush(async () => {});
      }
      const summary = await offlineOutboxService.flush(executeOutboxEntry);
      const activeGroupId = groupIdRef.current;
      if (summary.flushedCount > 0 && activeGroupId) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.tournamentHistory(activeGroupId) });
      }
      return summary;
    } finally {
      flushInFlightRef.current = false;
    }
  }, [executeOutboxEntry, queryClient]);

  useEffect(() => {
    if (!isAppwriteConfigured()) return undefined;

    void flushOfflineOutbox();

    const unsubscribe = NetInfo.addEventListener((state) => {
      const connected = Boolean(state.isConnected);
      const wasConnected = wasConnectedRef.current;
      wasConnectedRef.current = connected;

      if (!connected || wasConnected === connected) return;

      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      reconnectTimerRef.current = setTimeout(() => {
        void flushOfflineOutbox();
      }, RECONNECT_DEBOUNCE_MS);
    });

    return () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      unsubscribe();
    };
  }, [flushOfflineOutbox]);

  return { flushOfflineOutbox };
};
