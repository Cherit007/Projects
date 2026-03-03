import React, { useMemo, useState } from 'react';
import { Trophy, RotateCcw, RefreshCw, Edit2, TrendingUp, Users, House, Menu } from 'lucide-react';
import LiveMatchView from './LiveMatchView';
import MatchCard from './MatchCard';
import FinalMatchCard from './FinalMatchCard';
import BracketView from './BracketView';
import BracketMatchModal from './Bracketmatchmodal';
import PlayerProfileModal from './PlayerProfileModal';
import MatchSummaryFeed from './MatchSummaryFeed';
import TournamentAwards from './TournamentAwards';
import AutocompleteInput from './AutocompleteInput';
import { buildPlayerAdvancedProfile } from '../utils/playerProfileAnalytics';
import { buildPlayerAchievements } from '../utils/playerAchievements';
import { buildPlayerGamification } from '../utils/playerGamification';
import PlayerAvatar from './PlayerAvatar';

const TournamentView = ({
  tournamentName,
  setTournamentName,
  format,
  tournamentFormat,
  fixtures,
  bracket,
  teams,
  champion,
  members,
  playerDatabase = [],
  playerRatings,
  gameMode,
  tournamentHistory = [],
  currentTournamentId = null,
  casualMatches = [],
  aiMatchSummaries = [],
  oddPlayerEnabled = false,
  oddPlayerName = '',
  playerPhotos = {},
  onUpdatePlayerPhoto,
  canEditPlayerPhoto = () => false,
  onSaveMatchResult,
  onPrioritizeMatch,
  onSaveBracketResult,
  onSaveFinalResult,
  onSwapTeamMember,
  swapHistory = [],
  onGoHome,
  onResetTournament,
  onRerunTournament,
  onStartNextTournament,
  calculatePointsTable,
  calculatePlayerStats,
  getPlayerLeaderboard
}) => {
  const [activeTab, setActiveTab] = useState('fixtures');
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempTournamentName, setTempTournamentName] = useState(tournamentName);
  const [selectedBracketMatch, setSelectedBracketMatch] = useState(null);
  const [selectedPlayerName, setSelectedPlayerName] = useState(null);
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);
  const [showNextTournamentModal, setShowNextTournamentModal] = useState(false);
  const [nextTournamentName, setNextTournamentName] = useState('');
  const [showSwapMemberModal, setShowSwapMemberModal] = useState(false);
  const [swapTeamId, setSwapTeamId] = useState('');
  const [swapCurrentPlayer, setSwapCurrentPlayer] = useState('');
  const [swapReplacementPlayer, setSwapReplacementPlayer] = useState('');
  const [swapError, setSwapError] = useState('');
  const [showDuplicatePlayerModal, setShowDuplicatePlayerModal] = useState(false);
  const [duplicatePlayers, setDuplicatePlayers] = useState([]);
  const [showFutureClashModal, setShowFutureClashModal] = useState(false);
  const [futureClashMatches, setFutureClashMatches] = useState([]);
  const [futureClashPlayer, setFutureClashPlayer] = useState('');

  // Find current match (first incomplete)
  const currentMatch = useMemo(() => (
    tournamentFormat === 'league'
      ? fixtures.find((m) => !m.completed)
      : null
  ), [tournamentFormat, fixtures]);

  // Get next matches
  const nextMatches = useMemo(() => (
    tournamentFormat === 'league'
      ? fixtures.filter((m) => !m.completed).slice(1)
      : []
  ), [tournamentFormat, fixtures]);

  const pointsTable = useMemo(() => (
    tournamentFormat === 'league' ? calculatePointsTable(teams, fixtures) : []
  ), [tournamentFormat, teams, fixtures, calculatePointsTable]);

  const playerStats = useMemo(() => (
    tournamentFormat === 'league' ? calculatePlayerStats(teams, fixtures) : []
  ), [tournamentFormat, teams, fixtures, calculatePlayerStats]);
  
  // Filter ELO leaderboard to only show players in current tournament
  const currentTournamentPlayers = useMemo(() => {
    const players = new Set();
    teams.forEach((team) => {
      if (team.player) players.add(team.player);
      if (team.player1) players.add(team.player1);
      if (team.player2) players.add(team.player2);
    });
    fixtures.forEach((match) => {
      [match?.team1?.player || match?.team1?.player1, match?.team1?.player2, match?.team2?.player || match?.team2?.player1, match?.team2?.player2]
        .filter(Boolean)
        .forEach((name) => players.add(name));
    });
    return players;
  }, [teams, fixtures]);

  const allEloLeaderboard = useMemo(() => getPlayerLeaderboard(playerRatings), [playerRatings, getPlayerLeaderboard]);
  const eloLeaderboard = useMemo(
    () => allEloLeaderboard.filter((player) => currentTournamentPlayers.has(player.name)),
    [allEloLeaderboard, currentTournamentPlayers]
  );
  const selectedPlayerProfile = selectedPlayerName ? playerRatings[selectedPlayerName] : null;
  const selectedPlayerMember = selectedPlayerName
    ? (members || []).find(member => (member?.name || '').trim().toLowerCase() === selectedPlayerName.trim().toLowerCase())
    : null;
  const selectedPlayerIsLinked = Boolean(selectedPlayerMember?.linkedAccountId || selectedPlayerMember?.linkedEmail);
  const selectedPlayerCanEditPhoto = Boolean(selectedPlayerName && canEditPlayerPhoto(selectedPlayerName));
  const selectedPlayerTeam = selectedPlayerName
    ? teams.find(team => [team.player, team.player1, team.player2].filter(Boolean).includes(selectedPlayerName))
    : null;
  const selectedPlayerAdvancedStats = useMemo(() => buildPlayerAdvancedProfile({
    playerName: selectedPlayerName,
    tournamentHistory,
    casualMatches,
    liveTournament: {
      tournamentName,
      tournamentFormat,
      gameMode,
      fixtures,
      bracket,
    },
  }), [
    selectedPlayerName,
    tournamentHistory,
    casualMatches,
    tournamentName,
    tournamentFormat,
    gameMode,
    fixtures,
    bracket,
  ]);
  const selectedPlayerAchievements = useMemo(() => buildPlayerAchievements({
    playerName: selectedPlayerName,
    playerRatings,
    tournamentHistory,
    casualMatches,
  }), [selectedPlayerName, playerRatings, tournamentHistory, casualMatches]);
  const selectedPlayerGamification = useMemo(() => buildPlayerGamification({
    playerName: selectedPlayerName,
    tournamentHistory,
    casualMatches,
  }), [selectedPlayerName, tournamentHistory, casualMatches]);
  const swapCandidatePlayers = useMemo(() => {
    const fromDatabase = (playerDatabase || []).map((name) => String(name || '').trim());
    const fromMembers = (members || []).map((member) => (member?.name || '').trim());
    const fromTeams = (teams || []).flatMap((team) => [
      (team?.player || team?.player1 || '').trim(),
      (team?.player2 || '').trim(),
    ]);
    return [...new Set([...fromDatabase, ...fromMembers, ...fromTeams].filter(Boolean))];
  }, [playerDatabase, members, teams]);
  const eloGamificationMap = useMemo(() => Object.fromEntries(
    eloLeaderboard.map(player => [
      player.name,
      buildPlayerGamification({
        playerName: player.name,
        tournamentHistory,
        casualMatches,
      }),
    ])
  ), [eloLeaderboard, tournamentHistory, casualMatches]);
  const completedTournamentRecord = useMemo(() => {
    if (!champion || !Array.isArray(tournamentHistory) || tournamentHistory.length === 0) return null;
    return tournamentHistory.find((entry) => {
      if (!entry?.champion) return false;
      const entryId = entry.appwriteId || entry.id;
      if (entryId && currentTournamentId) return entryId === currentTournamentId;
      return (
        (entry.name || '') === (tournamentName || '') &&
        (entry.champion?.name || '') === (champion?.name || '')
      );
    }) || null;
  }, [champion, tournamentHistory, currentTournamentId, tournamentName]);

  const allLeagueMatchesComplete = () => {
    return fixtures.length > 0 && fixtures.every(match => match.completed);
  };

  const getTeamPlayers = (team) => {
    if (!team) return [];
    const players = [
      (team.player1 || team.player || '').trim(),
      (team.player2 || '').trim(),
    ].filter(Boolean);
    return [...new Set(players)];
  };

  const getTeamPlayersWithSlots = (team) => {
    if (!team) return [];
    const player1 = String(team.player1 || team.player || '').trim();
    const player2 = String(team.player2 || '').trim();
    return [
      { slot: 'player1', value: player1 },
      { slot: 'player2', value: player2 },
    ].filter(item => item.value);
  };

  const selectedSwapTeam = teams.find(team => String(team.id) === String(swapTeamId)) || null;
  const selectedSwapTeamPlayers = getTeamPlayers(selectedSwapTeam);
  const normalizedSwapCurrentPlayer = String(swapCurrentPlayer || '').trim().toLowerCase();

  const findDuplicatePlayersAcrossTeams = () => {
    const playerMap = new Map();
    teams.forEach((team) => {
      const players = getTeamPlayersWithSlots(team);
      players.forEach(({ slot, value }) => {
        const normalized = String(value || '').trim().toLowerCase();
        if (!normalized) return;
        if (!playerMap.has(normalized)) {
          playerMap.set(normalized, { player: value, teams: [] });
        }
        playerMap.get(normalized).teams.push({
          teamId: team.id,
          teamName: team.name,
          slot,
        });
      });
    });
    return Array.from(playerMap.values()).filter(item => item.teams.length > 1);
  };

  const getCurrentLiveOpponentPlayers = () => {
    if (!currentMatch || !selectedSwapTeam) return [];
    const selectedId = String(selectedSwapTeam.id);
    const team1Id = String(currentMatch.team1?.id || '');
    const team2Id = String(currentMatch.team2?.id || '');
    if (selectedId !== team1Id && selectedId !== team2Id) return [];
    const opponent = selectedId === team1Id ? currentMatch.team2 : currentMatch.team1;
    return getTeamPlayers(opponent).map(name => String(name || '').trim().toLowerCase());
  };

  const blockedOpponentPlayers = getCurrentLiveOpponentPlayers();
  const filteredSwapCandidatePlayers = swapCandidatePlayers.filter((name) => {
    const normalized = String(name || '').trim().toLowerCase();
    if (!normalized) return false;
    if (normalized === normalizedSwapCurrentPlayer) return true;
    return !blockedOpponentPlayers.includes(normalized);
  });

  const finalSelection = useMemo(() => {
    if (!allLeagueMatchesComplete()) {
      return {
        finalists: null,
        oddPlayerIncluded: false,
        oddPlayerReason: '',
      };
    }

    const table = calculatePointsTable(teams, fixtures);
    const finalists = [table[0], table[1]];

    if (!oddPlayerEnabled || !oddPlayerName.trim()) {
      return {
        finalists,
        oddPlayerIncluded: false,
        oddPlayerReason: '',
      };
    }

    const oddName = oddPlayerName.trim();
    const individualPoints = {};
    const bump = (name, delta) => {
      if (!name) return;
      individualPoints[name] = (individualPoints[name] || 0) + delta;
    };
    const allPlayers = new Set();
    fixtures.forEach((match) => {
      const players = [
        match.team1.player || match.team1.player1,
        match.team1.player2,
        match.team2.player || match.team2.player1,
        match.team2.player2,
      ].filter(Boolean);
      players.forEach((name) => allPlayers.add(name));
      if (!match.completed) return;
      const margin = Number(match.score1) - Number(match.score2);
      bump(match.team1.player || match.team1.player1, margin);
      bump(match.team1.player2, margin);
      bump(match.team2.player || match.team2.player1, -margin);
      bump(match.team2.player2, -margin);
    });

    const oddPoints = individualPoints[oddName] || 0;
    const maxPoints = Math.max(0, ...Array.from(allPlayers).map((name) => individualPoints[name] || 0));
    if (oddPoints < maxPoints) {
      return {
        finalists,
        oddPlayerIncluded: false,
        oddPlayerReason: '',
      };
    }

    const countOddInTeam = (team) => fixtures.filter((match) => {
      if (!match.completed) return false;
      const onTeam1 = match.team1.id === team.id
        && [match.team1.player || match.team1.player1, match.team1.player2].includes(oddName);
      const onTeam2 = match.team2.id === team.id
        && [match.team2.player || match.team2.player1, match.team2.player2].includes(oddName);
      return onTeam1 || onTeam2;
    }).length;

    const team1OddMatches = countOddInTeam(finalists[0]);
    const team2OddMatches = countOddInTeam(finalists[1]);
    const targetIndex = team2OddMatches > team1OddMatches ? 1 : 0;
    const targetTeam = finalists[targetIndex];
    const p1 = targetTeam.player || targetTeam.player1;
    const p2 = targetTeam.player2;
    const p1Points = individualPoints[p1] || 0;
    const p2Points = individualPoints[p2] || 0;
    const replacePlayer2 = p2 && p2Points <= p1Points;

    const updatedTargetTeam = {
      ...targetTeam,
      ...(replacePlayer2
        ? { player2: oddName }
        : { player1: oddName, player: oddName }),
    };
    const updatedFinalists = targetIndex === 0
      ? [updatedTargetTeam, finalists[1]]
      : [finalists[0], updatedTargetTeam];

    return {
      finalists: updatedFinalists,
      oddPlayerIncluded: true,
      oddPlayerReason: `${oddName} qualified with top individual points (${oddPoints}).`,
    };
  }, [fixtures, teams, oddPlayerEnabled, oddPlayerName, calculatePointsTable]);

  const getOrdinalSuffix = (value) => {
    const num = Number(value);
    const mod100 = num % 100;
    if (mod100 >= 11 && mod100 <= 13) return 'th';
    const mod10 = num % 10;
    if (mod10 === 1) return 'st';
    if (mod10 === 2) return 'nd';
    if (mod10 === 3) return 'rd';
    return 'th';
  };

  const getSuggestedNextTournamentName = (name) => {
    const source = String(name || '').trim();
    if (!source) return 'Next Tournament';

    const ordinalMatches = Array.from(source.matchAll(/(\d+)(st|nd|rd|th)\b/gi));
    const lastOrdinal = ordinalMatches[ordinalMatches.length - 1];
    if (lastOrdinal && Number.isFinite(Number(lastOrdinal[1]))) {
      const nextNumber = Number(lastOrdinal[1]) + 1;
      const replacement = `${nextNumber}${getOrdinalSuffix(nextNumber)}`;
      const matchText = lastOrdinal[0];
      const start = lastOrdinal.index ?? source.lastIndexOf(matchText);
      return `${source.slice(0, start)}${replacement}${source.slice(start + matchText.length)}`;
    }

    const numberMatches = Array.from(source.matchAll(/\d+/g));
    const lastNumber = numberMatches[numberMatches.length - 1];
    if (lastNumber && Number.isFinite(Number(lastNumber[0]))) {
      const nextNumber = Number(lastNumber[0]) + 1;
      const matchText = lastNumber[0];
      const start = lastNumber.index ?? source.lastIndexOf(matchText);
      return `${source.slice(0, start)}${nextNumber}${source.slice(start + matchText.length)}`;
    }

    if (/tournament/i.test(source)) {
      return source.replace(/tournament/i, '2nd Tournament');
    }

    return `${source} 2nd Tournament`;
  };

  const openNextTournamentModal = () => {
    setShowHeaderMenu(false);
    setNextTournamentName(getSuggestedNextTournamentName(tournamentName));
    setShowNextTournamentModal(true);
  };

  const openSwapMemberModal = () => {
    setShowHeaderMenu(false);
    if (!teams.length) return;
    const firstTeam = teams[0];
    const firstTeamPlayers = getTeamPlayers(firstTeam);
    setSwapTeamId(String(firstTeam.id));
    setSwapCurrentPlayer(firstTeamPlayers[0] || '');
    setSwapReplacementPlayer('');
    setSwapError('');
    setShowSwapMemberModal(true);
  };

  const handleNextTournamentAction = (editTeams) => {
    const normalizedName = String(nextTournamentName || '').trim();
    onStartNextTournament({
      editTeams,
      tournamentNameOverride: normalizedName || getSuggestedNextTournamentName(tournamentName),
    });
    setShowNextTournamentModal(false);
  };

  const handleSwapTeamChange = (value) => {
    setSwapTeamId(value);
    const nextTeam = teams.find(team => String(team.id) === String(value));
    const nextPlayers = getTeamPlayers(nextTeam);
    setSwapCurrentPlayer(nextPlayers[0] || '');
    setSwapError('');
  };

  const handleConfirmSwap = () => {
    const replacementNormalized = String(swapReplacementPlayer || '').trim().toLowerCase();
    if (blockedOpponentPlayers.includes(replacementNormalized)) {
      setSwapError('Cannot pick a player from the current live opposite team. Choose another player.');
      return;
    }

    const success = onSwapTeamMember({
      teamId: swapTeamId,
      currentPlayerName: swapCurrentPlayer,
      replacementPlayerName: swapReplacementPlayer,
    });
    if (success) {
      const replacementNormalized = String(swapReplacementPlayer || '').trim().toLowerCase();
      const futureLeagueMatches = (fixtures || []).filter((match) => {
        if (!match || match.completed) return false;
        const team1Id = String(match.team1?.id || '');
        const team2Id = String(match.team2?.id || '');
        const selectedTeamId = String(swapTeamId || '');
        if (team1Id !== selectedTeamId && team2Id !== selectedTeamId) return false;
        const opponentTeam = team1Id === selectedTeamId ? match.team2 : match.team1;
        const opponentPlayers = getTeamPlayers(opponentTeam).map((name) => String(name || '').trim().toLowerCase());
        return opponentPlayers.includes(replacementNormalized);
      });
      const futureBracketMatches = (Array.isArray(bracket) ? bracket : [])
        .flatMap((round) => (Array.isArray(round) ? round : []))
        .filter((match) => {
          if (!match || match.completed) return false;
          const team1Id = String(match.team1?.id || '');
          const team2Id = String(match.team2?.id || '');
          const selectedTeamId = String(swapTeamId || '');
          if (team1Id !== selectedTeamId && team2Id !== selectedTeamId) return false;
          const opponentTeam = team1Id === selectedTeamId ? match.team2 : match.team1;
          const opponentPlayers = getTeamPlayers(opponentTeam).map((name) => String(name || '').trim().toLowerCase());
          return opponentPlayers.includes(replacementNormalized);
        });
      const clashMatches = [...futureLeagueMatches, ...futureBracketMatches];

      setSwapReplacementPlayer('');
      setSwapError('');
      setShowSwapMemberModal(false);
      if (clashMatches.length > 0) {
        setFutureClashPlayer(String(swapReplacementPlayer || '').trim());
        setFutureClashMatches(clashMatches.map((match) => ({
          id: match.id,
          round: match.round,
          team1: match.team1?.name || 'Team 1',
          team2: match.team2?.name || 'Team 2',
        })));
        setShowFutureClashModal(true);
      }
    }
  };

  const handleFixDuplicatePlayers = () => {
    if (duplicatePlayers.length > 0) {
      const firstDuplicate = duplicatePlayers[0];
      const firstTeam = firstDuplicate.teams?.[0];
      if (firstTeam?.teamId) {
        setSwapTeamId(String(firstTeam.teamId));
      }
      setSwapCurrentPlayer(firstDuplicate.player || '');
    }
    setShowDuplicatePlayerModal(false);
    setShowSwapMemberModal(true);
  };

  const validateDuplicatePlayersAfterGame = () => {
    const duplicates = findDuplicatePlayersAcrossTeams();
    if (duplicates.length > 0) {
      setDuplicatePlayers(duplicates);
      setShowDuplicatePlayerModal(true);
    }
  };

  const handleSaveMatchResult = async (matchId, score1, score2) => {
    await Promise.resolve(onSaveMatchResult(matchId, score1, score2));
    setTimeout(validateDuplicatePlayersAfterGame, 0);
  };

  const handleSaveBracketResult = async (matchId, score1, score2) => {
    await Promise.resolve(onSaveBracketResult(matchId, score1, score2));
    setTimeout(validateDuplicatePlayersAfterGame, 0);
  };

  const handleSaveFinalResult = async (score1, score2, finalistsOverride = null) => {
    await Promise.resolve(onSaveFinalResult(score1, score2, finalistsOverride));
    setTimeout(validateDuplicatePlayersAfterGame, 0);
  };

  return (
    <div className="theme-page">
      {/* Header */}
      <div className="sticky top-0 theme-topbar tour-sticky-header shadow-md z-[130]">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div className="flex-1">
              {isEditingName ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={tempTournamentName}
                    onChange={(e) => setTempTournamentName(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        setTournamentName(tempTournamentName);
                        setIsEditingName(false);
                      }
                    }}
                    className="text-2xl md:text-3xl font-bold text-gray-800 border-2 border-blue-500 rounded-lg px-3 py-1 outline-none"
                    autoFocus
                  />
                  <button onClick={() => { setTournamentName(tempTournamentName); setIsEditingName(false); }}
                    className="text-green-600 hover:text-green-700 p-2 text-2xl">✓</button>
                  <button onClick={() => { setTempTournamentName(tournamentName); setIsEditingName(false); }}
                    className="text-red-600 hover:text-red-700 p-2 text-2xl">✕</button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl md:text-3xl font-bold text-gray-800">🏸 {tournamentName}</h1>
                  <button onClick={() => { setTempTournamentName(tournamentName); setIsEditingName(true); }}
                    className="text-gray-400 hover:text-gray-600 p-1">
                    <Edit2 size={18} />
                  </button>
                </div>
              )}
              <p className="text-sm text-gray-600">
                {tournamentFormat === 'league' && `${format} League Match(es) + Final`}
                {(tournamentFormat === 'knockoutByes' || tournamentFormat === 'playInFinal') && 'Knockout + Byes'}
                {tournamentFormat === 'semiFinal' && 'Semi Final + Final'}
                {tournamentFormat === 'fullKnockout' && 'Full Knockout Bracket'}
              </p>
            </div>
            <div className="hidden md:flex gap-2 flex-wrap">
              <button onClick={onGoHome}
                className="tour-action-btn tour-action-blue flex items-center gap-2 px-4 py-2 rounded-xl transition-all font-semibold">
                <House size={18} />
                <span>Home</span>
              </button>
              {champion && (
                <button onClick={onRerunTournament}
                  className="btn-brand flex items-center gap-2 px-4 py-2 rounded-xl hover:shadow-lg transition-all font-semibold">
                  <RefreshCw size={18} />
                  <span>Rematch</span>
                </button>
              )}
              {champion && (
                <button onClick={openNextTournamentModal}
                  className="tour-action-btn tour-action-indigo flex items-center gap-2 px-4 py-2 rounded-xl transition-all font-semibold">
                  <Trophy size={18} />
                  <span>Next Tournament</span>
                </button>
              )}
              <button onClick={openSwapMemberModal}
                className="tour-action-btn tour-action-cyan flex items-center gap-2 px-4 py-2 rounded-xl transition-all font-semibold">
                <Users size={18} />
                <span>Swap Team Member</span>
              </button>
              <button onClick={onResetTournament}
                className="tour-action-btn tour-action-red flex items-center gap-2 px-4 py-2 rounded-xl transition-all">
                <RotateCcw size={18} />
                <span>Delete & New</span>
              </button>
            </div>
            <div className="md:hidden relative">
              <button
                onClick={() => setShowHeaderMenu(prev => !prev)}
                className="tour-mobile-actions-btn flex items-center gap-2 px-3 py-2 rounded-xl font-semibold"
              >
                <Menu size={18} />
                <span>Actions</span>
              </button>
              {showHeaderMenu && (
                <div className="absolute right-0 mt-2 w-64 tour-actions-panel rounded-xl shadow-xl p-2 z-[140]">
                  <button
                    onClick={() => {
                      setShowHeaderMenu(false);
                      onGoHome();
                    }}
                    className="w-full text-left px-3 py-2 rounded-lg tour-actions-item"
                  >
                    Home
                  </button>
                  {champion && (
                    <button
                      onClick={() => {
                        setShowHeaderMenu(false);
                        onRerunTournament();
                      }}
                      className="w-full text-left px-3 py-2 rounded-lg tour-actions-item"
                    >
                      Rematch
                    </button>
                  )}
                  {champion && (
                    <button
                      onClick={openNextTournamentModal}
                      className="w-full text-left px-3 py-2 rounded-lg tour-actions-item"
                    >
                      Next Tournament
                    </button>
                  )}
                  <button
                    onClick={openSwapMemberModal}
                    className="w-full text-left px-3 py-2 rounded-lg tour-actions-item"
                  >
                    Swap Team Member
                  </button>
                  <button
                    onClick={() => {
                      setShowHeaderMenu(false);
                      onResetTournament();
                    }}
                    className="w-full text-left px-3 py-2 rounded-lg tour-actions-item danger"
                  >
                    Delete & New
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            <button onClick={() => setActiveTab('fixtures')}
              className={`tour-tab-btn px-3 sm:px-4 py-2 rounded-full font-semibold transition-all whitespace-nowrap text-sm sm:text-base ${
                activeTab === 'fixtures' ? 'tour-tab-active' : ''}`}>
              Fixtures
            </button>
            {tournamentFormat === 'league' && (
              <>
                <button onClick={() => setActiveTab('table')}
                  className={`tour-tab-btn px-3 sm:px-4 py-2 rounded-full font-semibold transition-all whitespace-nowrap text-sm sm:text-base ${
                    activeTab === 'table' ? 'tour-tab-active' : ''}`}>
                  Table
                </button>
                <button onClick={() => setActiveTab('stats')}
                  className={`tour-tab-btn px-3 sm:px-4 py-2 rounded-full font-semibold transition-all whitespace-nowrap text-sm sm:text-base ${
                    activeTab === 'stats' ? 'tour-tab-active' : ''}`}>
                  Stats
                </button>
              </>
            )}
            <button onClick={() => setActiveTab('elo')}
              className={`tour-tab-btn px-3 sm:px-4 py-2 rounded-full font-semibold transition-all whitespace-nowrap text-sm sm:text-base ${
                activeTab === 'elo' ? 'tour-tab-active' : ''}`}>
              ELO
            </button>
            <button onClick={() => setActiveTab('final')}
              className={`tour-tab-btn px-3 sm:px-4 py-2 rounded-full font-semibold transition-all whitespace-nowrap text-sm sm:text-base ${
                activeTab === 'final' ? 'tour-tab-active' : ''}`}>
              Final
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {activeTab === 'fixtures' && (
          <div className="space-y-6">
            <MatchSummaryFeed summaries={aiMatchSummaries} />
            {tournamentFormat === 'league' ? (
              <>
                {/* Live Match View */}
                {currentMatch && (
                  <LiveMatchView
                    currentMatch={currentMatch}
                    onSaveScore={handleSaveMatchResult}
                    nextMatches={nextMatches}
                    onSelectUpcomingMatch={onPrioritizeMatch}
                    tournamentName={tournamentName}
                    playerRatings={playerRatings}
                    playerPhotos={playerPhotos}
                    pointsTable={pointsTable}
                    tournamentHistory={tournamentHistory}
                    casualMatches={casualMatches}
                  />
                )}

                {/* Completed Matches */}
                {fixtures.filter(m => m.completed).length > 0 && (
                  <div className="completed-matches-section">
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2 completed-matches-title">
                      <Trophy size={20} className="completed-matches-icon" />
                      Completed Matches ({fixtures.filter(m => m.completed).length}/{fixtures.length})
                    </h3>
                    <div className="space-y-4">
                      {fixtures.filter(m => m.completed).map(match => (
                        <MatchCard key={match.id} match={match} onSave={handleSaveMatchResult} />
                      ))}
                    </div>
                  </div>
                )}

                {allLeagueMatchesComplete() && (
                  <div className="bg-green-50 border-2 border-green-300 rounded-2xl p-6 text-center">
                    <Trophy size={48} className="mx-auto text-green-600 mb-3" />
                    <p className="text-lg font-bold text-green-700">All league matches completed!</p>
                    <p className="text-sm text-gray-600 mt-2">Top 2 teams will play in the final</p>
                  </div>
                )}
              </>
            ) : (
              <>
                <BracketView bracket={bracket} onMatchClick={(match) => setSelectedBracketMatch(match)} />
                {selectedBracketMatch && (
                  <BracketMatchModal
                    match={selectedBracketMatch}
                    onSave={handleSaveBracketResult}
                    onClose={() => setSelectedBracketMatch(null)}
                  />
                )}
              </>
            )}
          </div>
        )}

        {activeTab === 'table' && tournamentFormat === 'league' && (
          <div className="bg-white rounded-xl sm:rounded-2xl shadow-xl overflow-hidden tour-points-card">
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-4 sm:p-6">
              <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
                <Trophy size={20} className="sm:w-6 sm:h-6" /> Points Table
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px]">
                <thead className="bg-gray-100 tour-table-head">
                  <tr>
                    <th className="px-2 sm:px-4 py-3 text-left text-xs sm:text-sm font-bold text-gray-700">Pos</th>
                    <th className="px-2 sm:px-4 py-3 text-left text-xs sm:text-sm font-bold text-gray-700">Team</th>
                    <th className="px-2 sm:px-4 py-3 text-center text-xs sm:text-sm font-bold text-gray-700">P</th>
                    <th className="px-2 sm:px-4 py-3 text-center text-xs sm:text-sm font-bold text-gray-700">W</th>
                    <th className="px-2 sm:px-4 py-3 text-center text-xs sm:text-sm font-bold text-gray-700">L</th>
                    <th className="px-2 sm:px-4 py-3 text-center text-xs sm:text-sm font-bold text-gray-700">Pts</th>
                    <th className="px-2 sm:px-4 py-3 text-center text-xs sm:text-sm font-bold text-gray-700">NMR</th>
                  </tr>
                </thead>
                <tbody>
                  {pointsTable.map((team, index) => (
                    <tr key={team.id} className={`border-b border-gray-200 hover:bg-gray-50 ${index < 2 ? 'points-top-two-row' : ''}`}>
                      <td className="px-2 sm:px-4 py-3 sm:py-4">
                        <span className="font-bold text-base sm:text-lg">
                          {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}
                        </span>
                      </td>
                      <td className="px-2 sm:px-4 py-3 sm:py-4">
                        <div className="flex items-center gap-2 sm:gap-3">
                          <span className="text-lg sm:text-2xl">{team.emoji}</span>
                          <div className="min-w-0">
                            <p className="font-bold text-sm sm:text-base text-gray-800 truncate">{team.name}</p>
                            <p className="text-xs text-gray-600 truncate">{team.player || team.player1}{team.player2 && ` & ${team.player2}`}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-2 sm:px-4 py-3 sm:py-4 text-center font-semibold text-sm">{team.played}</td>
                      <td className="px-2 sm:px-4 py-3 sm:py-4 text-center font-semibold text-green-600 text-sm">{team.won}</td>
                      <td className="px-2 sm:px-4 py-3 sm:py-4 text-center font-semibold text-red-600 text-sm">{team.lost}</td>
                      <td className="px-2 sm:px-4 py-3 sm:py-4 text-center">
                        <span className="bg-blue-100 text-blue-700 px-2 sm:px-3 py-1 rounded-full font-bold text-xs sm:text-sm points-chip">{team.points}</span>
                      </td>
                      <td className={`px-2 sm:px-4 py-3 sm:py-4 text-center font-bold text-sm ${(team.netMatchRate || 0) > 0 ? 'text-green-600' : (team.netMatchRate || 0) < 0 ? 'text-red-600' : 'text-gray-600'}`}>
                        {(team.netMatchRate || 0) > 0 ? '+' : ''}{(team.netMatchRate || 0).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-3 sm:p-4 bg-gray-50 text-xs text-gray-600">
              <p>Top 2 teams qualify for the final • Win = 2 points • Tiebreaker: NMR (average point difference per match)</p>
            </div>
          </div>
        )}

        {activeTab === 'stats' && tournamentFormat === 'league' && (
          <div className="bg-white rounded-xl sm:rounded-2xl shadow-xl overflow-hidden tour-stats-card">
            <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-4 sm:p-6">
              <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
                <TrendingUp size={20} className="sm:w-6 sm:h-6" /> Player Statistics
              </h2>
            </div>
            {playerStats.length === 0 ? (
              <div className="p-8 sm:p-12 text-center text-gray-500">
                <Users size={40} className="mx-auto mb-4 text-gray-300 sm:w-12 sm:h-12" />
                <p className="text-sm sm:text-base">No match results yet. Complete matches to see player stats.</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto scrollbar-thin">
                  <table className="w-full min-w-[600px]">
                    <thead className="bg-gray-100 sticky top-0 tour-table-head">
                      <tr>
                        <th className="px-2 sm:px-4 py-3 text-left text-xs sm:text-sm font-bold text-gray-700">Rank</th>
                        <th className="px-2 sm:px-4 py-3 text-left text-xs sm:text-sm font-bold text-gray-700">Player</th>
                        <th className="px-2 sm:px-4 py-3 text-center text-xs sm:text-sm font-bold text-gray-700">Played</th>
                        <th className="px-2 sm:px-4 py-3 text-center text-xs sm:text-sm font-bold text-gray-700">Won</th>
                        <th className="px-2 sm:px-4 py-3 text-center text-xs sm:text-sm font-bold text-gray-700">Win %</th>
                        <th className="px-2 sm:px-4 py-3 text-center text-xs sm:text-sm font-bold text-gray-700">Scored</th>
                      </tr>
                    </thead>
                    <tbody>
                      {playerStats.map((player, index) => (
                        <tr key={player.name} className="border-b border-gray-200 hover:bg-gray-50">
                          <td className="px-2 sm:px-4 py-3 sm:py-4 text-center font-bold text-base sm:text-lg">
                            {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}
                          </td>
                          <td className="px-2 sm:px-4 py-3 sm:py-4">
                            <div className="flex items-center gap-2 sm:gap-3">
                              <span className="text-lg sm:text-xl">{player.teamEmoji}</span>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <PlayerAvatar name={player.name} photoUrl={playerPhotos[player.name]} size="sm" />
                                  <button
                                    type="button"
                                    onClick={() => setSelectedPlayerName(player.name)}
                                    className="font-bold text-sm sm:text-base text-blue-700 hover:text-blue-900 hover:underline truncate text-left"
                                  >
                                    {player.name}
                                  </button>
                                </div>
                                <p className="text-xs text-gray-600 truncate">{player.team}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-2 sm:px-4 py-3 sm:py-4 text-center font-semibold text-sm">{player.matchesPlayed}</td>
                          <td className="px-2 sm:px-4 py-3 sm:py-4 text-center font-semibold text-green-600 text-sm">{player.matchesWon}</td>
                          <td className="px-2 sm:px-4 py-3 sm:py-4 text-center">
                            <span className="bg-purple-100 text-purple-700 px-2 sm:px-3 py-1 rounded-full font-bold text-xs sm:text-sm stats-win-badge">
                              {player.winPercentage}%
                            </span>
                          </td>
                          <td className="px-2 sm:px-4 py-3 sm:py-4 text-center font-semibold text-blue-600 text-sm">{player.totalScored}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="p-3 sm:p-4 bg-gray-50 text-xs text-gray-600 border-t border-gray-200 tour-stats-footnote">
                  <p>📱 Swipe left to see all columns • Sorted by win percentage</p>
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'elo' && (
          <div className="bg-white rounded-xl sm:rounded-2xl shadow-xl overflow-hidden tour-elo-card">
            <div className="bg-gradient-to-r from-yellow-600 to-orange-600 p-4 sm:p-6">
              <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
                <Trophy size={20} className="sm:w-6 sm:h-6" /> ELO Leaderboard
              </h2>
            </div>
            {eloLeaderboard.length === 0 ? (
              <div className="p-8 sm:p-12 text-center text-gray-500">
                <Trophy size={40} className="mx-auto mb-4 text-gray-300 sm:w-12 sm:h-12" />
                <p className="text-sm sm:text-base">Complete matches to build the leaderboard!</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] elo-table-polished">
                  <thead className="bg-gray-100 tour-table-head">
                    <tr>
                      <th className="px-2 sm:px-4 py-3 text-left text-xs sm:text-sm font-bold text-gray-700">Rank</th>
                      <th className="px-2 sm:px-4 py-3 text-left text-xs sm:text-sm font-bold text-gray-700">Player</th>
                      <th className="px-2 sm:px-4 py-3 text-center text-xs sm:text-sm font-bold text-gray-700">Rating</th>
                      <th className="px-2 sm:px-4 py-3 text-center text-xs sm:text-sm font-bold text-gray-700">Matches</th>
                      <th className="px-2 sm:px-4 py-3 text-center text-xs sm:text-sm font-bold text-gray-700">Change</th>
                    </tr>
                  </thead>
                  <tbody>
                    {eloLeaderboard.map((player, index) => {
                      const lastMatch = player.history?.[player.history.length - 1];
                      return (
                        <tr key={player.name} className="border-b border-gray-200 hover:bg-gray-50">
                          <td className="px-2 sm:px-4 py-3 sm:py-4 text-center font-bold text-base sm:text-lg">
                            {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}
                          </td>
                          <td className="px-2 sm:px-4 py-3 sm:py-4">
                            <div className="flex items-center gap-2 min-w-0 elo-player-cell">
                              <PlayerAvatar name={player.name} photoUrl={playerPhotos[player.name]} size="sm" />
                              <button
                                type="button"
                                onClick={() => setSelectedPlayerName(player.name)}
                                className="font-bold text-sm sm:text-base text-blue-700 hover:text-blue-900 hover:underline truncate text-left min-w-0 elo-player-name"
                              >
                                {player.name}
                              </button>
                              {eloGamificationMap[player.name]?.level && (
                                <span className="text-[10px] sm:text-[11px] font-semibold text-indigo-700 bg-indigo-100 px-1.5 py-0.5 rounded-full elo-level-badge elo-level-inline max-w-[132px] truncate">
                                  {eloGamificationMap[player.name].level.icon} {eloGamificationMap[player.name].level.name}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-2 sm:px-4 py-3 sm:py-4 text-center">
                            <span className={`px-2 sm:px-4 py-1 sm:py-2 rounded-full font-bold text-sm sm:text-base elo-rating-chip ${
                              player.rating >= 1200 ? 'elo-rating-gold' :
                              player.rating >= 1000 ? 'elo-rating-green' :
                              'elo-rating-neutral'
                            }`}>
                              {player.rating}
                            </span>
                          </td>
                          <td className="px-2 sm:px-4 py-3 sm:py-4 text-center font-semibold text-sm">{player.matchesPlayed}</td>
                          <td className="px-2 sm:px-4 py-3 sm:py-4 text-center">
                            {lastMatch && (
                              <span className={`font-bold text-sm ${lastMatch.change > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {lastMatch.change > 0 ? '+' : ''}{lastMatch.change}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div className="p-3 sm:p-4 bg-gray-50 text-xs text-gray-600 tour-elo-footnote">
                  <p>All players start at 1000 • Ratings update after each match</p>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'final' && (
          <div className="space-y-6">
            {tournamentFormat === 'league' ? (
              <>
                {champion ? (
                  <div className="space-y-4 sm:space-y-6">
                    <div className="bg-white rounded-2xl p-8 sm:p-12 text-center tour-final-panel">
                      <div className="text-5xl sm:text-6xl mb-4">🏆</div>
                      <h2 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-4">Tournament Complete!</h2>
                      <div className="bg-yellow-50 rounded-2xl p-4 sm:p-6 max-w-md mx-auto tour-final-champion-core">
                        <div className="text-4xl sm:text-5xl mb-3">{champion.emoji}</div>
                        <h3 className="text-xl sm:text-2xl font-bold text-gray-800 mb-2">{champion.name}</h3>
                        <p className="text-sm sm:text-base text-gray-600">
                          {champion.player || champion.player1}
                          {champion.player2 && ` & ${champion.player2}`}
                        </p>
                        <div className="mt-4 bg-yellow-100 rounded-lg py-2">
                          <p className="text-base sm:text-lg font-bold text-gray-800">🥇 CHAMPIONS!</p>
                        </div>
                      </div>
                    </div>
                    <TournamentAwards
                      teams={teams}
                      fixtures={fixtures}
                      bracket={[]}
                      finalMatch={completedTournamentRecord?.finalMatch || null}
                      champion={champion}
                      onSelectPlayer={(name) => setSelectedPlayerName(name)}
                    />
                  </div>
                ) : allLeagueMatchesComplete() ? (
                  <>
                    {finalSelection.oddPlayerIncluded && (
                      <div className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-emerald-800 tour-final-odd-banner">
                        <p className="text-sm font-semibold">Odd Player Eligible for Final</p>
                        <p className="text-xs mt-1">{finalSelection.oddPlayerReason}</p>
                      </div>
                    )}
                    <FinalMatchCard
                      finalists={finalSelection.finalists}
                      onSave={handleSaveFinalResult}
                      playerRatings={playerRatings}
                    />
                  </>
                ) : (
                  <div className="bg-white rounded-xl sm:rounded-2xl p-8 sm:p-12 text-center tour-final-panel">
                    <Trophy size={48} className="mx-auto text-yellow-500 mb-4 sm:w-16 sm:h-16" />
                    <p className="text-base sm:text-lg text-gray-500 mb-4">Complete all league matches first</p>
                    <p className="text-sm text-gray-400">
                      {fixtures.filter(f => f.completed).length} / {fixtures.length} matches completed
                    </p>
                  </div>
                )}
              </>
            ) : (
              <div className="bg-white rounded-2xl p-8 sm:p-12 text-center tour-final-panel">
                <Trophy size={48} className="mx-auto text-yellow-500 mb-4 sm:w-16 sm:h-16" />
                {champion ? (
                  <div className="space-y-4 sm:space-y-6">
                    <div>
                      <div className="text-5xl sm:text-6xl mb-4">🏆</div>
                      <h2 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-4">Tournament Complete!</h2>
                      <div className="bg-yellow-50 rounded-2xl p-4 sm:p-6 max-w-md mx-auto tour-final-champion-core">
                        <div className="text-4xl sm:text-5xl mb-3">{champion.emoji}</div>
                        <h3 className="text-xl sm:text-2xl font-bold text-gray-800 mb-2">{champion.name}</h3>
                        <p className="text-sm sm:text-base text-gray-600">
                          {champion.player || champion.player1}
                          {champion.player2 && ` & ${champion.player2}`}
                        </p>
                        <div className="mt-4 bg-yellow-100 rounded-lg py-2">
                          <p className="text-base sm:text-lg font-bold text-gray-800">🥇 CHAMPIONS!</p>
                        </div>
                      </div>
                    </div>
                    <TournamentAwards
                      teams={teams}
                      fixtures={fixtures}
                      bracket={bracket}
                      finalMatch={completedTournamentRecord?.finalMatch || null}
                      champion={champion}
                      onSelectPlayer={(name) => setSelectedPlayerName(name)}
                    />
                  </div>
                ) : (
                  <div>
                    <p className="text-lg sm:text-xl font-bold text-gray-800 mb-4">Bracket in Progress</p>
                    <p className="text-sm sm:text-base text-gray-600">Complete all matches to determine the champion</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {showNextTournamentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[240] p-4 app-overlay">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full app-modal-shell tour-modal-shell">
            <div className="bg-gradient-to-r from-indigo-600 to-blue-600 p-5">
              <h3 className="text-lg sm:text-xl font-bold text-white">Start Next Tournament</h3>
              <p className="text-xs sm:text-sm text-indigo-100 mt-1">
                OK starts directly with same teams. Edit opens team edit page.
              </p>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Tournament Name</label>
                <input
                  type="text"
                  value={nextTournamentName}
                  onChange={(e) => setNextTournamentName(e.target.value)}
                  className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-indigo-500"
                  placeholder="Enter tournament name"
                  autoFocus
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowNextTournamentModal(false)}
                  className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleNextTournamentAction(true)}
                  className="px-4 py-2 rounded-lg bg-amber-100 text-amber-800 hover:bg-amber-200 font-semibold"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleNextTournamentAction(false)}
                  className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 font-semibold"
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showSwapMemberModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[240] p-4 app-overlay">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full app-modal-shell tour-modal-shell">
            <div className="bg-gradient-to-r from-cyan-600 to-blue-600 p-5">
              <h3 className="text-lg sm:text-xl font-bold text-white">Swap Team Member</h3>
              <p className="text-xs sm:text-sm text-cyan-100 mt-1">
                Replace one team member for upcoming matches. Other teams remain unchanged.
              </p>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Team</label>
                <select
                  value={swapTeamId}
                  onChange={(e) => handleSwapTeamChange(e.target.value)}
                  className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-cyan-500 bg-white"
                >
                  {teams.map(team => (
                    <option key={team.id} value={String(team.id)}>
                      {team.emoji} {team.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Current Member</label>
                <select
                  value={swapCurrentPlayer}
                  onChange={(e) => setSwapCurrentPlayer(e.target.value)}
                  className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-cyan-500 bg-white"
                >
                  {selectedSwapTeamPlayers.map(player => (
                    <option key={player} value={player}>{player}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Replacement Player</label>
                <AutocompleteInput
                  value={swapReplacementPlayer}
                  onChange={(value) => {
                    setSwapReplacementPlayer(value);
                    if (swapError) setSwapError('');
                  }}
                  placeholder="Type or pick player name"
                  playerDatabase={filteredSwapCandidatePlayers}
                />
              </div>
              {swapError && (
                <p className="text-sm text-red-600">{swapError}</p>
              )}

              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 max-h-32 overflow-y-auto">
                <p className="text-xs font-semibold text-gray-700 mb-1">Swap History ({swapHistory.length})</p>
                {swapHistory.length === 0 ? (
                  <p className="text-xs text-gray-500">No swaps yet.</p>
                ) : (
                  <div className="space-y-1">
                    {swapHistory.map((entry) => (
                      <p key={entry.id} className="text-xs text-gray-700">
                        {entry.teamName}: {entry.fromPlayer}{' -> '}{entry.toPlayer}
                      </p>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => {
                    setShowSwapMemberModal(false);
                    setSwapError('');
                  }}
                  className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmSwap}
                  className="px-4 py-2 rounded-lg bg-cyan-600 text-white hover:bg-cyan-700 font-semibold"
                >
                  Swap
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showDuplicatePlayerModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[240] p-4 app-overlay">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full app-modal-shell tour-modal-shell">
            <div className="bg-gradient-to-r from-red-600 to-orange-600 p-5">
              <h3 className="text-lg sm:text-xl font-bold text-white">Duplicate Player Found</h3>
              <p className="text-xs sm:text-sm text-red-100 mt-1">
                Same player is assigned to multiple teams. Please fix before continuing.
              </p>
            </div>
            <div className="p-5 space-y-4">
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 space-y-2">
                {duplicatePlayers.map((item) => (
                  <div key={item.player} className="text-sm text-red-800">
                    <span className="font-semibold">{item.player}</span>: {item.teams.map(t => t.teamName).join(', ')}
                  </div>
                ))}
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={handleFixDuplicatePlayers}
                  className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 font-semibold"
                >
                  Fix Now
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showFutureClashModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[240] p-4 app-overlay">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full app-modal-shell tour-modal-shell">
            <div className="bg-gradient-to-r from-amber-600 to-orange-600 p-5">
              <h3 className="text-lg sm:text-xl font-bold text-white">Future Match Conflict</h3>
              <p className="text-xs sm:text-sm text-amber-100 mt-1">
                Swap completed, but {futureClashPlayer} is also on opponent side in upcoming match(es).
              </p>
            </div>
            <div className="p-5 space-y-3">
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2">
                {futureClashMatches.map((item) => (
                  <p key={`${item.id}-${item.round || 'r'}`} className="text-sm text-amber-900">
                    Match {item.id}{item.round ? ` (Round ${item.round})` : ''}: {item.team1} vs {item.team2}
                  </p>
                ))}
              </div>
              <div className="flex justify-end">
                <button
                  onClick={() => {
                    setShowFutureClashModal(false);
                    setFutureClashMatches([]);
                    setFutureClashPlayer('');
                  }}
                  className="px-4 py-2 rounded-lg bg-amber-600 text-white hover:bg-amber-700 font-semibold"
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <PlayerProfileModal
        playerName={selectedPlayerName}
        profile={selectedPlayerProfile}
        team={selectedPlayerTeam}
        advancedStats={selectedPlayerAdvancedStats}
        achievements={selectedPlayerAchievements}
        gamification={selectedPlayerGamification}
        photoUrl={selectedPlayerName ? playerPhotos[selectedPlayerName] : ''}
        isLinked={selectedPlayerIsLinked}
        canEditPhoto={selectedPlayerCanEditPhoto}
        onUpdatePhoto={onUpdatePlayerPhoto}
        onClose={() => setSelectedPlayerName(null)}
      />
    </div>
  );
};

export default TournamentView;
