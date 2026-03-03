import { useMemo } from 'react';
import { buildPairingAnalytics } from '../utils/pairingAnalytics';
import { buildFormPowerRankings } from '../utils/formPowerRankings';
import { buildPlayerAdvancedProfile } from '../utils/playerProfileAnalytics';
import { buildPlayerAchievements } from '../utils/playerAchievements';
import { buildPlayerGamification } from '../utils/playerGamification';

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

  const teamNameDatabase = useMemo(() => {
    if (!computeTeamNameDatabase) return [];
    const names = tournamentHistory
      .flatMap(tournament => tournament?.teams || [])
      .map(team => team?.name?.trim())
      .filter(Boolean);

    return [...new Set(names)];
  }, [tournamentHistory, computeTeamNameDatabase]);

  const pairingAnalytics = useMemo(() => {
    if (!computePairingAnalytics) return emptyPairingAnalytics;
    return buildPairingAnalytics({
      tournamentHistory,
      casualMatches,
      playerRatings,
    });
  }, [tournamentHistory, casualMatches, playerRatings, computePairingAnalytics, emptyPairingAnalytics]);

  const formPowerRankings = useMemo(() => {
    if (!computeFormPowerRankings) return emptyFormPowerRankings;
    return buildFormPowerRankings(playerRatings);
  }, [playerRatings, computeFormPowerRankings, emptyFormPowerRankings]);

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

  const currentUserAdvancedStats = useMemo(() => {
    if (!computeProfileInsights) return null;
    return buildPlayerAdvancedProfile({
      playerName: currentUserPlayerName,
      tournamentHistory,
      casualMatches,
      liveTournament: {
        tournamentName,
        tournamentFormat,
        gameMode,
        fixtures,
        bracket,
      },
    });
  }, [currentUserPlayerName, tournamentHistory, casualMatches, tournamentName, tournamentFormat, gameMode, fixtures, bracket, computeProfileInsights]);

  const currentUserAchievements = useMemo(() => {
    if (!computeProfileInsights) return null;
    return buildPlayerAchievements({
      playerName: currentUserPlayerName,
      playerRatings,
      tournamentHistory,
      casualMatches,
    });
  }, [currentUserPlayerName, playerRatings, tournamentHistory, casualMatches, computeProfileInsights]);

  const currentUserGamification = useMemo(() => {
    if (!computeProfileInsights) return null;
    return buildPlayerGamification({
      playerName: currentUserPlayerName,
      tournamentHistory,
      casualMatches,
    });
  }, [currentUserPlayerName, tournamentHistory, casualMatches, computeProfileInsights]);

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
