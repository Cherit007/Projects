import { useEffect } from 'react';

export const useSetupPrefetchEffect = ({
  activeGroupId,
  isAppwriteEnabled,
  setHistoryHydrated,
  setCasualHydrated,
  historyHydrationPromiseRef,
  casualHydrationPromiseRef,
  step,
  historyHydrated,
  casualHydrated,
  historyHydrationPending,
  casualHydrationPending,
  prefetchHomeSetupData,
}) => {
  useEffect(() => {
    historyHydrationPromiseRef.current = null;
    casualHydrationPromiseRef.current = null;
    if (!isAppwriteEnabled) {
      setHistoryHydrated(true);
      setCasualHydrated(true);
    }
  }, [activeGroupId, isAppwriteEnabled, historyHydrationPromiseRef, casualHydrationPromiseRef, setHistoryHydrated, setCasualHydrated]);

  useEffect(() => {
    if (!isAppwriteEnabled) return;
    if (step !== 'setup') return;
    if (historyHydrated && casualHydrated) return;
    if (historyHydrationPending || casualHydrationPending) return;
    void prefetchHomeSetupData();
  }, [
    isAppwriteEnabled,
    step,
    historyHydrated,
    casualHydrated,
    historyHydrationPending,
    casualHydrationPending,
    activeGroupId,
    prefetchHomeSetupData,
  ]);
};

