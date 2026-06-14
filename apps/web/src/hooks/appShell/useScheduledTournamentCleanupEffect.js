import { useEffect, useRef } from 'react';
import {
  isScheduledTournamentAlreadyStarted,
  normalizeTournamentName,
  parseTournamentDateMs,
} from '../../utils/appHelpers';

export const useScheduledTournamentCleanupEffect = ({
  canDelete = false,
  scheduledTournaments = [],
  activeLiveTournaments = [],
  isAppwriteEnabled = false,
  handleDeleteTournamentFromSetup,
  pruneTournamentQueryCacheAfterDelete,
  showToast,
}) => {
  const autoDeleteScheduledInFlightRef = useRef(new Set());

  useEffect(() => {
    if (!canDelete || !Array.isArray(scheduledTournaments) || scheduledTournaments.length === 0) return undefined;

    let disposed = false;
    const graceMs = 10 * 60 * 1000;
    const runCleanup = async () => {
      if (disposed) return;
      const now = Date.now();
      const candidates = scheduledTournaments
        .filter((tournament) => {
          if (!tournament) return false;
          if (isScheduledTournamentAlreadyStarted(tournament, activeLiveTournaments)) return false;
          const tournamentId = String(tournament?.appwriteId || tournament?.id || '').trim();
          if (!tournamentId) return false;
          if (autoDeleteScheduledInFlightRef.current.has(tournamentId)) return false;
          const scheduledAtMs = parseTournamentDateMs(tournament?.date);
          if (!Number.isFinite(scheduledAtMs)) return false;
          return now >= (scheduledAtMs + graceMs);
        });

      for (const tournament of candidates) {
        const tournamentId = String(tournament?.appwriteId || tournament?.id || '').trim();
        if (!tournamentId) continue;
        autoDeleteScheduledInFlightRef.current.add(tournamentId);
        try {
          const deleted = await handleDeleteTournamentFromSetup(tournamentId, {
            skipConfirm: true,
            skipProgressToast: true,
            awaitCloudSync: true,
            silent: true,
          });
          if (!deleted) continue;
          if (isAppwriteEnabled) {
            pruneTournamentQueryCacheAfterDelete({
              targetIds: [tournamentId],
              targetName: normalizeTournamentName(tournament?.name),
              removeActiveByName: false,
            });
          }
          const label = String(tournament?.name || '').trim() || 'Scheduled tournament';
          showToast(`Auto-removed expired schedule: ${label}`);
        } finally {
          autoDeleteScheduledInFlightRef.current.delete(tournamentId);
        }
      }
    };

    void runCleanup();
    const timerId = setInterval(() => {
      void runCleanup();
    }, 60 * 1000);

    return () => {
      disposed = true;
      clearInterval(timerId);
    };
  }, [
    canDelete,
    scheduledTournaments,
    activeLiveTournaments,
    isAppwriteEnabled,
    handleDeleteTournamentFromSetup,
    pruneTournamentQueryCacheAfterDelete,
    showToast,
  ]);
};
