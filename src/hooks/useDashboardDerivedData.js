import { useEffect, useMemo, useRef, useState } from 'react';
import { calculateCumulativePlayerStats, getPlayerLeaderboard } from '../utils/calculations';
import { analyticsWorkerService } from '../services/analyticsWorkerService';
import { deriveRatingsFromHistory } from '../utils/appHelpers';

const emptyResult = {
  cumulativeAllTimeStats: [],
  eloLeaderboard: [],
};

const normalizeName = (value) => String(value || '').trim().toLowerCase();

const getRecordedPlayersSet = (history = [], casual = []) => {
  const recordedRatings = deriveRatingsFromHistory({
    history: Array.isArray(history) ? history : [],
    casual: Array.isArray(casual) ? casual : [],
  });
  return new Set(
    Object.keys(recordedRatings || {})
      .map((name) => normalizeName(name))
      .filter(Boolean)
  );
};

const filterLeaderboardRows = (rows = [], history = [], casual = []) => {
  const list = Array.isArray(rows) ? rows : [];
  const recordedPlayers = getRecordedPlayersSet(history, casual);
  if (recordedPlayers.size === 0) {
    return list.filter((entry) => Number(entry?.matchesPlayed || 0) > 0);
  }
  return list.filter((entry) => recordedPlayers.has(normalizeName(entry?.name)));
};

const buildFilteredLeaderboard = (ratings = {}, history = [], casual = []) => {
  const raw = getPlayerLeaderboard(ratings || {});
  return filterLeaderboardRows(raw, history, casual);
};

const buildFallbackData = (history = [], ratings = {}, casual = []) => ({
  cumulativeAllTimeStats: calculateCumulativePlayerStats(history),
  eloLeaderboard: buildFilteredLeaderboard(ratings, history, casual),
});

export const useDashboardDerivedData = ({
  tournamentHistory = [],
  casualMatches = [],
  playerRatings = {},
}) => {
  const fallbackData = useMemo(
    () => buildFallbackData(tournamentHistory, playerRatings, casualMatches),
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
      playerRatings,
    }).then((result) => {
      if (cancelled || requestIdRef.current !== requestId) return;
      setDerivedData({
        cumulativeAllTimeStats: Array.isArray(result?.cumulativeAllTimeStats)
          ? result.cumulativeAllTimeStats
          : emptyResult.cumulativeAllTimeStats,
        eloLeaderboard: filterLeaderboardRows(
          Array.isArray(result?.eloLeaderboard) ? result.eloLeaderboard : [],
          tournamentHistory,
          casualMatches
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
