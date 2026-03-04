import { useEffect, useMemo, useRef, useState } from 'react';
import { buildPairingAnalytics } from '../utils/pairingAnalytics';
import { buildFormPowerRankings } from '../utils/formPowerRankings';
import { buildPlayerAdvancedProfile } from '../utils/playerProfileAnalytics';
import { buildPlayerAchievements } from '../utils/playerAchievements';
import { buildPlayerGamification } from '../utils/playerGamification';
import { analyticsWorkerService } from '../services/analyticsWorkerService';

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

  const emptyPairingAnalytics = useMemo(() => ({
    totalDoublesMatches: 0,
    totalTrackedPairs: 0,
    bestCombinations: [],
    whoShouldPair: [],
    rotationSuggestions: [],
  }), []);

  const emptyFormPowerRankings = useMemo(() => ({
    leaderboard: [],
    weeklyLeaderboard: [],
    monthlyLeaderboard: [],
  }), []);

  const [pairingAnalytics, setPairingAnalytics] = useState(emptyPairingAnalytics);
  const [formPowerRankings, setFormPowerRankings] = useState(emptyFormPowerRankings);
  const [profileInsights, setProfileInsights] = useState({
    advancedStats: null,
    achievements: null,
    gamification: null,
  });
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

  useEffect(() => {
    if (!computePairingAnalytics) {
      setPairingAnalytics(emptyPairingAnalytics);
      return undefined;
    }

    if (!analyticsWorkerService.isSupported()) {
      setPairingAnalytics(buildPairingAnalytics({
        tournamentHistory,
        casualMatches,
        playerRatings,
      }));
      return undefined;
    }

    const requestId = pairingRequestIdRef.current + 1;
    pairingRequestIdRef.current = requestId;
    let cancelled = false;

    void analyticsWorkerService.computePairingAnalytics({
      tournamentHistory,
      casualMatches,
      playerRatings,
    }).then((result) => {
      if (cancelled || pairingRequestIdRef.current !== requestId) return;
      setPairingAnalytics(result || emptyPairingAnalytics);
    }).catch((error) => {
      if (cancelled || pairingRequestIdRef.current !== requestId) return;
      console.error('Failed to compute pairing analytics in worker:', error);
      setPairingAnalytics(buildPairingAnalytics({
        tournamentHistory,
        casualMatches,
        playerRatings,
      }));
    });

    return () => {
      cancelled = true;
    };
  }, [
    computePairingAnalytics,
    tournamentHistory,
    casualMatches,
    playerRatings,
    emptyPairingAnalytics,
  ]);

  useEffect(() => {
    if (!computeFormPowerRankings) {
      setFormPowerRankings(emptyFormPowerRankings);
      return undefined;
    }

    if (!analyticsWorkerService.isSupported()) {
      setFormPowerRankings(buildFormPowerRankings(playerRatings));
      return undefined;
    }

    const requestId = rankingsRequestIdRef.current + 1;
    rankingsRequestIdRef.current = requestId;
    let cancelled = false;

    void analyticsWorkerService.computeFormPowerRankings({ playerRatings }).then((result) => {
      if (cancelled || rankingsRequestIdRef.current !== requestId) return;
      setFormPowerRankings(result || emptyFormPowerRankings);
    }).catch((error) => {
      if (cancelled || rankingsRequestIdRef.current !== requestId) return;
      console.error('Failed to compute form power rankings in worker:', error);
      setFormPowerRankings(buildFormPowerRankings(playerRatings));
    });

    return () => {
      cancelled = true;
    };
  }, [computeFormPowerRankings, playerRatings, emptyFormPowerRankings]);

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

  useEffect(() => {
    if (!computeProfileInsights || !currentUserPlayerName) {
      setProfileInsights({
        advancedStats: null,
        achievements: null,
        gamification: null,
      });
      return undefined;
    }

    const liveTournament = {
      tournamentName,
      tournamentFormat,
      gameMode,
      fixtures,
      bracket,
    };

    if (!analyticsWorkerService.isSupported()) {
      setProfileInsights({
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
      });
      return undefined;
    }

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
      setProfileInsights({
        advancedStats: result?.advancedStats || null,
        achievements: result?.achievements || null,
        gamification: result?.gamification || null,
      });
    }).catch((error) => {
      if (cancelled || profileRequestIdRef.current !== requestId) return;
      console.error('Failed to compute player profile insights in worker:', error);
      setProfileInsights({
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
      });
    });

    return () => {
      cancelled = true;
    };
  }, [
    computeProfileInsights,
    currentUserPlayerName,
    playerRatings,
    tournamentHistory,
    casualMatches,
    tournamentName,
    tournamentFormat,
    gameMode,
    fixtures,
    bracket,
  ]);

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
