import { useEffect, useMemo, useRef, useState } from 'react';
import { analyticsWorkerService } from '../services/analyticsWorkerService';
import {
  buildDashboardDerivedData,
  filterLeaderboardRowsByRecordedMatches,
} from '../utils/dashboardAnalytics';

const emptyResult = {
  cumulativeAllTimeStats: [],
  eloLeaderboard: [],
};

export const useDashboardDerivedData = ({
  tournamentHistory = [],
  casualMatches = [],
  playerRatings = {},
}) => {
  const fallbackData = useMemo(
    () => buildDashboardDerivedData({
      tournamentHistory,
      casualMatches,
      playerRatings,
    }),
    [tournamentHistory, playerRatings, casualMatches]
  );
  const workerSupported = analyticsWorkerService.isSupported();
  const [derivedData, setDerivedData] = useState(fallbackData);
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!workerSupported) return undefined;

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    let cancelled = false;

    void analyticsWorkerService.computeDashboardDerived({
      tournamentHistory,
      casualMatches,
      playerRatings,
    }).then((result) => {
      if (cancelled || requestIdRef.current !== requestId) return;
      setDerivedData({
        cumulativeAllTimeStats: Array.isArray(result?.cumulativeAllTimeStats)
          ? result.cumulativeAllTimeStats
          : emptyResult.cumulativeAllTimeStats,
        eloLeaderboard: filterLeaderboardRowsByRecordedMatches(
          Array.isArray(result?.eloLeaderboard) ? result.eloLeaderboard : [],
          { tournamentHistory, casualMatches }
        ),
      });
    }).catch((error) => {
      if (cancelled || requestIdRef.current !== requestId) return;
      console.error('Failed to compute dashboard analytics in worker:', error);
      setDerivedData(fallbackData);
    });

    return () => {
      cancelled = true;
    };
  }, [workerSupported, tournamentHistory, casualMatches, playerRatings, fallbackData]);

  return workerSupported ? derivedData : fallbackData;
};
