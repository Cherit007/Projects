import { useEffect, useMemo, useRef, useState } from 'react';
import { buildPairingAnalytics } from '../utils/pairingAnalytics';
import { buildFormPowerRankings } from '../utils/formPowerRankings';
import { buildPlayerAdvancedProfile } from '../utils/playerProfileAnalytics';
import { buildPlayerAchievements } from '../utils/playerAchievements';
import { buildPlayerGamification } from '../utils/playerGamification';
import { analyticsWorkerService } from '../services/analyticsWorkerService';

const EMPTY_PAIRING_ANALYTICS = Object.freeze({
  totalDoublesMatches: 0,
  totalTrackedPairs: 0,
  bestCombinations: [],
  whoShouldPair: [],
  rotationSuggestions: [],
});

const EMPTY_FORM_POWER_RANKINGS = Object.freeze({
  leaderboard: [],
  weeklyLeaderboard: [],
  monthlyLeaderboard: [],
});

const EMPTY_PROFILE_INSIGHTS = Object.freeze({
  advancedStats: null,
  achievements: null,
  gamification: null,
});

export const usePlayerDerivedData = ({
  currentUser,
  members,
  teams,
  tournamentHistory,
  casualMatches,
  playerRatings,
  playerDatabase,
  tournamentName,
  tournamentFormat,
  gameMode,
  fixtures,
  bracket,
  compute = {},
}) => {
  const computeTeamNameDatabase = compute.teamNameDatabase !== false;
  const computePairingAnalytics = compute.pairingAnalytics !== false;
  const computeFormPowerRankings = compute.formPowerRankings !== false;
  const computeProfileInsights = compute.profileInsights !== false;
  const computeUnlinkedPlayerNames = compute.unlinkedPlayerNames !== false;
  const workerSupported = analyticsWorkerService.isSupported();

  const [workerPairingAnalytics, setWorkerPairingAnalytics] = useState(EMPTY_PAIRING_ANALYTICS);
  const [workerFormPowerRankings, setWorkerFormPowerRankings] = useState(EMPTY_FORM_POWER_RANKINGS);
  const [workerProfileInsights, setWorkerProfileInsights] = useState(EMPTY_PROFILE_INSIGHTS);
  const pairingRequestIdRef = useRef(0);
  const rankingsRequestIdRef = useRef(0);
  const profileRequestIdRef = useRef(0);

  const teamNameDatabase = useMemo(() => {
    if (!computeTeamNameDatabase) return [];
    const names = tournamentHistory
      .flatMap(tournament => tournament?.teams || [])
      .map(team => team?.name?.trim())
      .filter(Boolean);

    return [...new Set(names)];
  }, [tournamentHistory, computeTeamNameDatabase]);

  const syncPairingAnalytics = useMemo(() => {
    if (!computePairingAnalytics) return EMPTY_PAIRING_ANALYTICS;
    return buildPairingAnalytics({
      tournamentHistory,
      casualMatches,
      playerRatings,
    });
  }, [computePairingAnalytics, tournamentHistory, casualMatches, playerRatings]);

  const syncFormPowerRankings = useMemo(() => {
    if (!computeFormPowerRankings) return EMPTY_FORM_POWER_RANKINGS;
    return buildFormPowerRankings(playerRatings);
  }, [computeFormPowerRankings, playerRatings]);

  const liveTournament = useMemo(() => ({
    tournamentName,
    tournamentFormat,
    gameMode,
    fixtures,
    bracket,
  }), [tournamentName, tournamentFormat, gameMode, fixtures, bracket]);

  const currentUserMember = useMemo(() => {
    if (!currentUser || !Array.isArray(members)) return null;
    const email = (currentUser.email || '').toLowerCase();
    return members.find((member) => (
      member.linkedAccountId === currentUser.$id
      || ((member.linkedEmail || '').toLowerCase() === email)
    )) || null;
  }, [members, currentUser]);

  const currentUserPlayerName = currentUserMember?.name || null;
  const currentUserPlayerProfile = currentUserPlayerName ? (playerRatings[currentUserPlayerName] || null) : null;

  const syncProfileInsights = useMemo(() => {
    if (!computeProfileInsights || !currentUserPlayerName) return EMPTY_PROFILE_INSIGHTS;
    return {
      advancedStats: buildPlayerAdvancedProfile({
        playerName: currentUserPlayerName,
        tournamentHistory,
        casualMatches,
        liveTournament,
      }),
      achievements: buildPlayerAchievements({
        playerName: currentUserPlayerName,
        playerRatings,
        tournamentHistory,
        casualMatches,
      }),
      gamification: buildPlayerGamification({
        playerName: currentUserPlayerName,
        tournamentHistory,
        casualMatches,
      }),
    };
  }, [
    computeProfileInsights,
    currentUserPlayerName,
    playerRatings,
    tournamentHistory,
    casualMatches,
    liveTournament,
  ]);

  useEffect(() => {
    if (!workerSupported || !computePairingAnalytics) return undefined;

    const requestId = pairingRequestIdRef.current + 1;
    pairingRequestIdRef.current = requestId;
    let cancelled = false;

    void analyticsWorkerService.computePairingAnalytics({
      tournamentHistory,
      casualMatches,
      playerRatings,
    }).then((result) => {
      if (cancelled || pairingRequestIdRef.current !== requestId) return;
      setWorkerPairingAnalytics(result || EMPTY_PAIRING_ANALYTICS);
    }).catch((error) => {
      if (cancelled || pairingRequestIdRef.current !== requestId) return;
      console.error('Failed to compute pairing analytics in worker:', error);
      setWorkerPairingAnalytics(buildPairingAnalytics({
        tournamentHistory,
        casualMatches,
        playerRatings,
      }));
    });

    return () => {
      cancelled = true;
    };
  }, [workerSupported, computePairingAnalytics, tournamentHistory, casualMatches, playerRatings]);

  useEffect(() => {
    if (!workerSupported || !computeFormPowerRankings) return undefined;

    const requestId = rankingsRequestIdRef.current + 1;
    rankingsRequestIdRef.current = requestId;
    let cancelled = false;

    void analyticsWorkerService.computeFormPowerRankings({ playerRatings }).then((result) => {
      if (cancelled || rankingsRequestIdRef.current !== requestId) return;
      setWorkerFormPowerRankings(result || EMPTY_FORM_POWER_RANKINGS);
    }).catch((error) => {
      if (cancelled || rankingsRequestIdRef.current !== requestId) return;
      console.error('Failed to compute form power rankings in worker:', error);
      setWorkerFormPowerRankings(buildFormPowerRankings(playerRatings));
    });

    return () => {
      cancelled = true;
    };
  }, [workerSupported, computeFormPowerRankings, playerRatings]);

  useEffect(() => {
    if (!workerSupported || !computeProfileInsights || !currentUserPlayerName) return undefined;

    const requestId = profileRequestIdRef.current + 1;
    profileRequestIdRef.current = requestId;
    let cancelled = false;

    void analyticsWorkerService.computeProfileInsights({
      playerName: currentUserPlayerName,
      playerRatings,
      tournamentHistory,
      casualMatches,
      liveTournament,
    }).then((result) => {
      if (cancelled || profileRequestIdRef.current !== requestId) return;
      setWorkerProfileInsights({
        advancedStats: result?.advancedStats || null,
        achievements: result?.achievements || null,
        gamification: result?.gamification || null,
      });
    }).catch((error) => {
      if (cancelled || profileRequestIdRef.current !== requestId) return;
      console.error('Failed to compute player profile insights in worker:', error);
      setWorkerProfileInsights(syncProfileInsights);
    });

    return () => {
      cancelled = true;
    };
  }, [
    workerSupported,
    computeProfileInsights,
    currentUserPlayerName,
    playerRatings,
    tournamentHistory,
    casualMatches,
    liveTournament,
    syncProfileInsights,
  ]);

  const pairingAnalytics = workerSupported && computePairingAnalytics
    ? workerPairingAnalytics
    : syncPairingAnalytics;
  const formPowerRankings = workerSupported && computeFormPowerRankings
    ? workerFormPowerRankings
    : syncFormPowerRankings;
  const profileInsights = workerSupported && computeProfileInsights && currentUserPlayerName
    ? workerProfileInsights
    : syncProfileInsights;

  const currentUserPlayerTeam = useMemo(() => {
    if (!computeProfileInsights) return null;
    if (!currentUserPlayerName) return null;
    const inCurrentTeams = teams.find(team => [team.player, team.player1, team.player2].filter(Boolean).includes(currentUserPlayerName));
    if (inCurrentTeams) return inCurrentTeams;
    const fromHistory = [...(tournamentHistory || [])]
      .reverse()
      .flatMap(tournament => tournament?.teams || [])
      .find(team => [team.player, team.player1, team.player2].filter(Boolean).includes(currentUserPlayerName));
    return fromHistory || null;
  }, [currentUserPlayerName, teams, tournamentHistory, computeProfileInsights]);

  const currentUserAdvancedStats = profileInsights.advancedStats;
  const currentUserAchievements = profileInsights.achievements;
  const currentUserGamification = profileInsights.gamification;

  const unlinkedPlayerNames = useMemo(() => {
    if (!computeUnlinkedPlayerNames) return [];
    const fromCurrentTeams = (teams || [])
      .flatMap((team) => [team?.player, team?.player1, team?.player2])
      .filter(Boolean);
    const fromHistory = (tournamentHistory || [])
      .flatMap((tournament) => tournament?.teams || [])
      .flatMap((team) => [team?.player, team?.player1, team?.player2])
      .filter(Boolean);
    const fromCasual = (casualMatches || [])
      .flatMap((match) => [
        match?.team1?.player,
        match?.team1?.player1,
        match?.team1?.player2,
        match?.team2?.player,
        match?.team2?.player1,
        match?.team2?.player2,
      ])
      .filter(Boolean);
    const fromRatings = Object.keys(playerRatings || {});
    const fromDb = playerDatabase || [];
    const allNames = [...new Set([...fromDb, ...fromRatings, ...fromCurrentTeams, ...fromHistory, ...fromCasual]
      .map((name) => (name || '').trim())
      .filter(Boolean))];
    const linkedNames = new Set(
      (members || [])
        .filter((member) => member.linkedAccountId || member.linkedEmail)
        .map((member) => (member.name || '').trim().toLowerCase())
        .filter(Boolean)
    );
    return allNames.filter((name) => !linkedNames.has(name.toLowerCase()));
  }, [playerDatabase, playerRatings, teams, tournamentHistory, casualMatches, members, computeUnlinkedPlayerNames]);

  return {
    teamNameDatabase,
    pairingAnalytics,
    formPowerRankings,
    currentUserMember,
    currentUserPlayerName,
    currentUserPlayerProfile,
    currentUserPlayerTeam,
    currentUserAdvancedStats,
    currentUserAchievements,
    currentUserGamification,
    unlinkedPlayerNames,
  };
};
