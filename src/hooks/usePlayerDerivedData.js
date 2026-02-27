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
}) => {
  const teamNameDatabase = useMemo(() => {
    const names = tournamentHistory
      .flatMap(tournament => tournament?.teams || [])
      .map(team => team?.name?.trim())
      .filter(Boolean);

    return [...new Set(names)];
  }, [tournamentHistory]);

  const pairingAnalytics = useMemo(() => buildPairingAnalytics({
    tournamentHistory,
    casualMatches,
    playerRatings,
  }), [tournamentHistory, casualMatches, playerRatings]);

  const formPowerRankings = useMemo(() => buildFormPowerRankings(playerRatings), [playerRatings]);

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
    if (!currentUserPlayerName) return null;
    const inCurrentTeams = teams.find(team => [team.player, team.player1, team.player2].filter(Boolean).includes(currentUserPlayerName));
    if (inCurrentTeams) return inCurrentTeams;
    const fromHistory = [...(tournamentHistory || [])]
      .reverse()
      .flatMap(tournament => tournament?.teams || [])
      .find(team => [team.player, team.player1, team.player2].filter(Boolean).includes(currentUserPlayerName));
    return fromHistory || null;
  }, [currentUserPlayerName, teams, tournamentHistory]);

  const currentUserAdvancedStats = useMemo(() => buildPlayerAdvancedProfile({
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
  }), [currentUserPlayerName, tournamentHistory, casualMatches, tournamentName, tournamentFormat, gameMode, fixtures, bracket]);

  const currentUserAchievements = useMemo(() => buildPlayerAchievements({
    playerName: currentUserPlayerName,
    playerRatings,
    tournamentHistory,
    casualMatches,
  }), [currentUserPlayerName, playerRatings, tournamentHistory, casualMatches]);

  const currentUserGamification = useMemo(() => buildPlayerGamification({
    playerName: currentUserPlayerName,
    tournamentHistory,
    casualMatches,
  }), [currentUserPlayerName, tournamentHistory, casualMatches]);

  const unlinkedPlayerNames = useMemo(() => {
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
  }, [playerDatabase, playerRatings, teams, tournamentHistory, casualMatches, members]);

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
