import { useEffect, useRef, useState } from 'react';
import { calculateCumulativePlayerStats, getPlayerLeaderboard } from '../utils/calculations';
import { analyticsWorkerService } from '../services/analyticsWorkerService';

const emptyResult = {
  cumulativeAllTimeStats: [],
  eloLeaderboard: [],
};

export const useDashboardDerivedData = ({
  tournamentHistory = [],
  playerRatings = {},
}) => {
  const [derivedData, setDerivedData] = useState(() => ({
    cumulativeAllTimeStats: calculateCumulativePlayerStats(tournamentHistory),
    eloLeaderboard: getPlayerLeaderboard(playerRatings),
  }));
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!analyticsWorkerService.isSupported()) {
      setDerivedData({
        cumulativeAllTimeStats: calculateCumulativePlayerStats(tournamentHistory),
        eloLeaderboard: getPlayerLeaderboard(playerRatings),
      });
      return undefined;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    let cancelled = false;

    void analyticsWorkerService.computeDashboardDerived({
      tournamentHistory,
      playerRatings,
    }).then((result) => {
      if (cancelled || requestIdRef.current !== requestId) return;
      setDerivedData({
        cumulativeAllTimeStats: Array.isArray(result?.cumulativeAllTimeStats)
          ? result.cumulativeAllTimeStats
          : emptyResult.cumulativeAllTimeStats,
        eloLeaderboard: Array.isArray(result?.eloLeaderboard)
          ? result.eloLeaderboard
          : emptyResult.eloLeaderboard,
      });
    }).catch((error) => {
      if (cancelled || requestIdRef.current !== requestId) return;
      console.error('Failed to compute dashboard analytics in worker:', error);
      setDerivedData({
        cumulativeAllTimeStats: calculateCumulativePlayerStats(tournamentHistory),
        eloLeaderboard: getPlayerLeaderboard(playerRatings),
      });
    });

    return () => {
      cancelled = true;
    };
  }, [tournamentHistory, playerRatings]);

  return derivedData;
};

