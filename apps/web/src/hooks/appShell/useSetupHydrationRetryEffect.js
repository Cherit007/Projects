import { useEffect } from 'react';

export const useSetupHydrationRetryEffect = ({
  isAppwriteEnabled = false,
  step = 'setup',
  requiresAuth = false,
  activeGroupId = null,
  historyHydrated = false,
  casualHydrated = false,
  historyHydrationPending = false,
  casualHydrationPending = false,
  setupHydrationRetryAtRef,
  ensureTournamentHistoryHydrated,
  ensureCasualMatchesHydrated,
}) => {
  useEffect(() => {
    if (!isAppwriteEnabled) return;
    if (step !== 'setup') return;
    if (requiresAuth && !activeGroupId) return;
    if (historyHydrated && casualHydrated) return;
    if (historyHydrationPending || casualHydrationPending) return;
    const now = Date.now();
    if (now < setupHydrationRetryAtRef.current) return;
    setupHydrationRetryAtRef.current = now + 2500;

    const tasks = [];
    if (!historyHydrated) {
      tasks.push(ensureTournamentHistoryHydrated({ silent: true }));
    }
    if (!casualHydrated) {
      tasks.push(ensureCasualMatchesHydrated({ silent: true }));
    }
    if (tasks.length > 0) {
      void Promise.allSettled(tasks);
    }
    return undefined;
  }, [
    isAppwriteEnabled,
    step,
    requiresAuth,
    activeGroupId,
    historyHydrated,
    casualHydrated,
    historyHydrationPending,
    casualHydrationPending,
    ensureTournamentHistoryHydrated,
    ensureCasualMatchesHydrated,
    setupHydrationRetryAtRef,
  ]);
};
