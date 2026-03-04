import * as Comlink from 'comlink';
import { calculateCumulativePlayerStats, getPlayerLeaderboard } from '../utils/calculations';
import { buildPairingAnalytics } from '../utils/pairingAnalytics';
import { buildFormPowerRankings } from '../utils/formPowerRankings';
import { buildPlayerAdvancedProfile } from '../utils/playerProfileAnalytics';
import { buildPlayerAchievements } from '../utils/playerAchievements';
import { buildPlayerGamification } from '../utils/playerGamification';

const computePairingAnalytics = (payload = {}) => buildPairingAnalytics({
  tournamentHistory: payload.tournamentHistory || [],
  casualMatches: payload.casualMatches || [],
  playerRatings: payload.playerRatings || {},
});

const computeFormPowerRankings = (payload = {}) => buildFormPowerRankings(
  payload.playerRatings || {}
);

const computeProfileInsights = (payload = {}) => {
  const playerName = payload.playerName || null;
  return {
    advancedStats: buildPlayerAdvancedProfile({
      playerName,
      tournamentHistory: payload.tournamentHistory || [],
      casualMatches: payload.casualMatches || [],
      liveTournament: payload.liveTournament || null,
    }),
    achievements: buildPlayerAchievements({
      playerName,
      playerRatings: payload.playerRatings || {},
      tournamentHistory: payload.tournamentHistory || [],
      casualMatches: payload.casualMatches || [],
    }),
    gamification: buildPlayerGamification({
      playerName,
      tournamentHistory: payload.tournamentHistory || [],
      casualMatches: payload.casualMatches || [],
    }),
  };
};

const computeDashboardDerived = (payload = {}) => ({
  cumulativeAllTimeStats: calculateCumulativePlayerStats(payload.tournamentHistory || []),
  eloLeaderboard: getPlayerLeaderboard(payload.playerRatings || {}),
});

Comlink.expose({
  computePairingAnalytics,
  computeFormPowerRankings,
  computeProfileInsights,
  computeDashboardDerived,
});

