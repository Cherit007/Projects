import { useEffect } from 'react';

export const useSetupPrefetchEffect = ({
  activeGroupId,
  isAppwriteEnabled,
  setHistoryHydrated,
  setCasualHydrated,
  historyHydrationPromiseRef,
  casualHydrationPromiseRef,
}) => {
  useEffect(() => {
    historyHydrationPromiseRef.current = null;
    casualHydrationPromiseRef.current = null;
    if (!isAppwriteEnabled) {
      setHistoryHydrated(true);
      setCasualHydrated(true);
    }
  }, [activeGroupId, isAppwriteEnabled, historyHydrationPromiseRef, casualHydrationPromiseRef, setHistoryHydrated, setCasualHydrated]);
};
