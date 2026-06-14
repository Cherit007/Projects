import { buildPlayerAchievements } from '../../utils/playerAchievements';
import { detectNewlyUnlockedBadges } from '@fixture-maker/domain/narrative';

export const createSwapTeamMember = ({
  assertCanOperate,
  showToast,
  isAppwriteEnabled,
  teams,
  fixtures,
  bracket,
  champion,
  swapHistory,
  playerRatings,
  aiMatchSummaries,
  currentTournamentId,
  setTeams,
  setFixtures,
  setBracket,
  setPlayerRatings,
  setSwapHistory,
  setCurrentTournamentId,
  updatePlayerDatabase,
  persistActiveTournamentSnapshot,
  resolveSyncTournamentId,
  buildActiveTournamentSnapshot,
  queueTournamentSync,
  updateActiveTournamentLock,
  casualMatches,
  tournamentHistory,
}) => {
  const getPlayersFromMatch = (match) => {
    if (!match?.team1 || !match?.team2) return [];
    const players = [
      match.team1.player || match.team1.player1,
      match.team1.player2,
      match.team2.player || match.team2.player1,
      match.team2.player2,
    ].filter(Boolean);
    return [...new Set(players)];
  };

  const normalizePlayerName = (value) => String(value || '').trim().toLowerCase();

  const getTeamSlotValue = (team, slot) => {
    if (slot === 'player1') return team?.player1 || team?.player || '';
    if (slot === 'player2') return team?.player2 || '';
    return '';
  };

  const setTeamSlotValue = (team, slot, playerName) => {
    const value = String(playerName || '').trim();
    if (slot === 'player1') {
      team.player1 = value;
      if ('player' in team || !team.player) {
        team.player = value;
      }
      return;
    }
    if (slot === 'player2') {
      team.player2 = value;
    }
  };

  const findPlayerSlotInTeam = (team, playerName) => {
    const needle = normalizePlayerName(playerName);
    if (!needle) return null;
    const slots = ['player1', 'player2'];
    for (const slot of slots) {
      const value = getTeamSlotValue(team, slot);
      if (normalizePlayerName(value) === needle) return slot;
    }
    return null;
  };

  const swapTeamMember = ({ teamId, currentPlayerName, replacementPlayerName }) => {
    if (!assertCanOperate()) return false;
    const leagueCompleted = fixtures.length > 0 && fixtures.every((match) => match.completed);
    const flatBracket = (Array.isArray(bracket) ? bracket : []).flatMap((round) => (Array.isArray(round) ? round : []));
    const knockoutCompleted = flatBracket.length > 0 && flatBracket.every((match) => match?.completed);
    if (champion || leagueCompleted || knockoutCompleted) {
      showToast('Swap is blocked. Tournament or match flow is already completed.', 'error');
      return false;
    }

    const replacement = String(replacementPlayerName || '').trim();
    const currentPlayer = String(currentPlayerName || '').trim();
    const normalizedReplacement = normalizePlayerName(replacement);
    if (!replacement || !currentPlayer) {
      showToast('Please select both players', 'error');
      return false;
    }
    if (normalizedReplacement === normalizePlayerName(currentPlayer)) {
      showToast('Replacement must be different from current player', 'error');
      return false;
    }

    const targetTeamIndex = teams.findIndex(team => String(team.id) === String(teamId));
    if (targetTeamIndex === -1) {
      showToast('Team not found', 'error');
      return false;
    }

    const updatedTeams = teams.map(team => ({ ...team }));
    const targetTeam = updatedTeams[targetTeamIndex];
    const targetSlot = findPlayerSlotInTeam(targetTeam, currentPlayer);
    if (!targetSlot) {
      showToast('Player not found in selected team', 'error');
      return false;
    }
    const otherSlot = targetSlot === 'player1' ? 'player2' : 'player1';
    const otherPlayer = getTeamSlotValue(targetTeam, otherSlot);
    if (normalizedReplacement === normalizePlayerName(otherPlayer)) {
      showToast('Replacement player already exists in selected team', 'error');
      return false;
    }

    const currentLiveMatch = (Array.isArray(fixtures) ? fixtures : []).find((match) => !match?.completed) || null;
    if (currentLiveMatch) {
      const selectedTeamId = String(teamId || '');
      const team1Id = String(currentLiveMatch.team1?.id || '');
      const team2Id = String(currentLiveMatch.team2?.id || '');
      if (selectedTeamId === team1Id || selectedTeamId === team2Id) {
        const opponentTeam = selectedTeamId === team1Id ? currentLiveMatch.team2 : currentLiveMatch.team1;
        const opponentPlayers = [
          opponentTeam?.player || opponentTeam?.player1,
          opponentTeam?.player2,
        ]
          .map((name) => normalizePlayerName(name))
          .filter(Boolean);
        if (opponentPlayers.includes(normalizedReplacement)) {
          showToast('Cannot pick a player from the current live opposite team. Choose another player.', 'error');
          return false;
        }
      }
    }

    const outgoingPlayer = getTeamSlotValue(targetTeam, targetSlot);
    setTeamSlotValue(targetTeam, targetSlot, replacement);

    const teamMap = new Map(updatedTeams.map(team => [String(team.id), team]));
    const updatedFixtures = fixtures.map((match) => {
      if (!match || match.completed) return match;
      const next = { ...match };
      if (match.team1?.id && teamMap.has(String(match.team1.id))) {
        next.team1 = { ...teamMap.get(String(match.team1.id)) };
      }
      if (match.team2?.id && teamMap.has(String(match.team2.id))) {
        next.team2 = { ...teamMap.get(String(match.team2.id)) };
      }
      return next;
    });
    const updatedBracket = bracket.map((round) => (
      (Array.isArray(round) ? round : []).map((match) => {
        if (!match || match.completed) return match;
        const next = { ...match };
        if (match.team1?.id && teamMap.has(String(match.team1.id))) {
          next.team1 = { ...teamMap.get(String(match.team1.id)) };
        }
        if (match.team2?.id && teamMap.has(String(match.team2.id))) {
          next.team2 = { ...teamMap.get(String(match.team2.id)) };
        }
        return next;
      })
    ));

    setTeams(updatedTeams);
    setFixtures(updatedFixtures);
    setBracket(updatedBracket);
    updatePlayerDatabase(replacement);

    if (!playerRatings[replacement]) {
      setPlayerRatings({
        ...playerRatings,
        [replacement]: { rating: 1000, matchesPlayed: 0, history: [] },
      });
    }

    const swapEntry = {
      id: `swap-${Date.now()}`,
      at: new Date().toISOString(),
      teamId: targetTeam.id,
      teamName: targetTeam.name,
      fromPlayer: outgoingPlayer,
      toPlayer: replacement,
    };
    const updatedSwapHistory = [...swapHistory, swapEntry];
    setSwapHistory(updatedSwapHistory);
    persistActiveTournamentSnapshot({
      teamsSnapshot: updatedTeams,
      fixturesSnapshot: updatedFixtures,
      bracketSnapshot: updatedBracket,
      swapHistorySnapshot: updatedSwapHistory,
    });

    const syncTournamentId = resolveSyncTournamentId();
    const swapLockSnapshot = buildActiveTournamentSnapshot({
      id: syncTournamentId || null,
      teamsSnapshot: updatedTeams,
      fixturesSnapshot: updatedFixtures,
      bracketSnapshot: updatedBracket,
      championSnapshot: champion,
      aiSummariesSnapshot: aiMatchSummaries,
      swapHistorySnapshot: updatedSwapHistory,
    });
    if (isAppwriteEnabled && syncTournamentId) {
      if (!currentTournamentId) setCurrentTournamentId(syncTournamentId);
      queueTournamentSync({
        tournamentId: syncTournamentId,
        delayMs: 900,
        tournamentData: {
        teams: updatedTeams,
        fixtures: updatedFixtures,
        bracket: updatedBracket,
        champion,
        finalMatch: null,
        aiSummaries: aiMatchSummaries,
        swapHistory: updatedSwapHistory,
        },
      });
    }
    if (isAppwriteEnabled) {
      void updateActiveTournamentLock(swapLockSnapshot, { immediate: true });
    }

    showToast(`Updated ${targetTeam.name}: ${outgoingPlayer} → ${replacement}`);
    return true;
  };

  return swapTeamMember;
};
