import React, { useMemo, useState } from 'react';
import { Trophy, RotateCcw, RefreshCw, Edit2, TrendingUp, Users, MessageCircle, Copy, Undo2, House } from 'lucide-react';
import LiveMatchView from './LiveMatchView';
import MatchCard from './MatchCard';
import FinalMatchCard from './FinalMatchCard';
import BracketView from './BracketView';
import BracketMatchModal from './Bracketmatchmodal';
import PlayerProfileModal from './PlayerProfileModal';
import MatchSummaryFeed from './MatchSummaryFeed';
import TournamentAwards from './TournamentAwards';
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
  inviteList = [],
  onSaveMatchResult,
  onPrioritizeMatch,
  onSaveBracketResult,
  onSaveFinalResult,
  canUndo,
  onUndoLastAction,
  onGoHome,
  onResetTournament,
  onRerunTournament,
  calculatePointsTable,
  calculatePlayerStats,
  getPlayerLeaderboard
}) => {
  const [activeTab, setActiveTab] = useState('fixtures');
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempTournamentName, setTempTournamentName] = useState(tournamentName);
  const [selectedBracketMatch, setSelectedBracketMatch] = useState(null);
  const [selectedPlayerName, setSelectedPlayerName] = useState(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [copiedInvite, setCopiedInvite] = useState('');

  // Find current match (first incomplete)
  const currentMatch = tournamentFormat === 'league' 
    ? fixtures.find(m => !m.completed)
    : null;

  // Get next matches
  const nextMatches = tournamentFormat === 'league'
    ? fixtures.filter(m => !m.completed).slice(1)
    : [];

  const pointsTable = tournamentFormat === 'league' ? calculatePointsTable(teams, fixtures) : [];
  const playerStats = tournamentFormat === 'league' ? calculatePlayerStats(teams, fixtures) : [];
  
  // Filter ELO leaderboard to only show players in current tournament
  const currentTournamentPlayers = new Set();
  teams.forEach(team => {
    if (team.player) currentTournamentPlayers.add(team.player);
    if (team.player1) currentTournamentPlayers.add(team.player1);
    if (team.player2) currentTournamentPlayers.add(team.player2);
  });
  fixtures.forEach((match) => {
    [match?.team1?.player || match?.team1?.player1, match?.team1?.player2, match?.team2?.player || match?.team2?.player1, match?.team2?.player2]
      .filter(Boolean)
      .forEach((name) => currentTournamentPlayers.add(name));
  });
  
  const allEloLeaderboard = getPlayerLeaderboard(playerRatings);
  const eloLeaderboard = allEloLeaderboard.filter(player => currentTournamentPlayers.has(player.name));
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

  const handleCopyInvite = async (invite) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(invite.message);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = invite.message;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopiedInvite(invite.name);
      setTimeout(() => setCopiedInvite(''), 1500);
    } catch (error) {
      console.error('Failed to copy invite:', error);
    }
  };

  const sendAllInvites = () => {
    inviteList
      .filter(invite => invite.whatsappLink)
      .forEach(invite => {
        window.open(invite.whatsappLink, '_blank');
      });
  };

  return (
    <div className="theme-page">
      {/* Header */}
      <div className="sticky top-0 theme-topbar shadow-md z-10">
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
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={onUndoLastAction}
                disabled={!canUndo}
                className="flex items-center gap-2 px-4 py-2 bg-amber-100 text-amber-700 rounded-xl hover:bg-amber-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Undo2 size={18} />
                <span className="hidden md:inline">Undo</span>
              </button>
              <button
                onClick={() => setShowInviteModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-green-100 text-green-700 rounded-xl hover:bg-green-200 transition-all"
              >
                <MessageCircle size={18} />
                <span className="hidden md:inline">Invite ({inviteList.filter(i => i.hasPhone).length}/{inviteList.length})</span>
              </button>
              {champion && (
                <button onClick={onGoHome}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-xl hover:bg-blue-200 transition-all font-semibold">
                  <House size={18} />
                  <span className="hidden md:inline">Home</span>
                </button>
              )}
              {champion && (
                <button onClick={onRerunTournament}
                  className="btn-brand flex items-center gap-2 px-4 py-2 rounded-xl hover:shadow-lg transition-all font-semibold">
                  <RefreshCw size={18} />
                  <span className="hidden md:inline">Rematch</span>
                </button>
              )}
              <button onClick={onResetTournament}
                className="flex items-center gap-2 px-4 py-2 bg-red-100 text-red-600 rounded-xl hover:bg-red-200 transition-all">
                <RotateCcw size={18} />
                <span className="hidden md:inline">Delete & New</span>
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            <button onClick={() => setActiveTab('fixtures')}
              className={`px-3 sm:px-4 py-2 rounded-full font-semibold transition-all whitespace-nowrap text-sm sm:text-base ${
                activeTab === 'fixtures' ? 'tab-active' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              Fixtures
            </button>
            {tournamentFormat === 'league' && (
              <>
                <button onClick={() => setActiveTab('table')}
                  className={`px-3 sm:px-4 py-2 rounded-full font-semibold transition-all whitespace-nowrap text-sm sm:text-base ${
                    activeTab === 'table' ? 'tab-active' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  Table
                </button>
                <button onClick={() => setActiveTab('stats')}
                  className={`px-3 sm:px-4 py-2 rounded-full font-semibold transition-all whitespace-nowrap text-sm sm:text-base ${
                    activeTab === 'stats' ? 'tab-active' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  Stats
                </button>
              </>
            )}
            <button onClick={() => setActiveTab('elo')}
              className={`px-3 sm:px-4 py-2 rounded-full font-semibold transition-all whitespace-nowrap text-sm sm:text-base ${
                activeTab === 'elo' ? 'tab-active' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              ELO
            </button>
            <button onClick={() => setActiveTab('final')}
              className={`px-3 sm:px-4 py-2 rounded-full font-semibold transition-all whitespace-nowrap text-sm sm:text-base ${
                activeTab === 'final' ? 'tab-active' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
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
                    onSaveScore={onSaveMatchResult}
                    nextMatches={nextMatches}
                    onSelectUpcomingMatch={onPrioritizeMatch}
                    tournamentName={tournamentName}
                    playerRatings={playerRatings}
                    pointsTable={pointsTable}
                    tournamentHistory={tournamentHistory}
                    casualMatches={casualMatches}
                  />
                )}

                {/* Completed Matches */}
                {fixtures.filter(m => m.completed).length > 0 && (
                  <div>
                    <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                      <Trophy size={20} className="text-green-600" />
                      Completed Matches ({fixtures.filter(m => m.completed).length}/{fixtures.length})
                    </h3>
                    <div className="space-y-4">
                      {fixtures.filter(m => m.completed).map(match => (
                        <MatchCard key={match.id} match={match} onSave={onSaveMatchResult} />
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
                    onSave={onSaveBracketResult}
                    onClose={() => setSelectedBracketMatch(null)}
                  />
                )}
              </>
            )}
          </div>
        )}

        {activeTab === 'table' && tournamentFormat === 'league' && (
          <div className="bg-white rounded-xl sm:rounded-2xl shadow-xl overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-4 sm:p-6">
              <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
                <Trophy size={20} className="sm:w-6 sm:h-6" /> Points Table
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px]">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-2 sm:px-4 py-3 text-left text-xs sm:text-sm font-bold text-gray-700">Pos</th>
                    <th className="px-2 sm:px-4 py-3 text-left text-xs sm:text-sm font-bold text-gray-700">Team</th>
                    <th className="px-2 sm:px-4 py-3 text-center text-xs sm:text-sm font-bold text-gray-700">P</th>
                    <th className="px-2 sm:px-4 py-3 text-center text-xs sm:text-sm font-bold text-gray-700">W</th>
                    <th className="px-2 sm:px-4 py-3 text-center text-xs sm:text-sm font-bold text-gray-700">L</th>
                    <th className="px-2 sm:px-4 py-3 text-center text-xs sm:text-sm font-bold text-gray-700">Pts</th>
                    <th className="px-2 sm:px-4 py-3 text-center text-xs sm:text-sm font-bold text-gray-700">Diff</th>
                  </tr>
                </thead>
                <tbody>
                  {pointsTable.map((team, index) => (
                    <tr key={team.id} className={`border-b border-gray-200 hover:bg-gray-50 ${index < 2 ? 'bg-green-50' : ''}`}>
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
                        <span className="bg-blue-100 text-blue-700 px-2 sm:px-3 py-1 rounded-full font-bold text-xs sm:text-sm">{team.points}</span>
                      </td>
                      <td className={`px-2 sm:px-4 py-3 sm:py-4 text-center font-bold text-sm ${team.scoreDiff > 0 ? 'text-green-600' : team.scoreDiff < 0 ? 'text-red-600' : 'text-gray-600'}`}>
                        {team.scoreDiff > 0 ? '+' : ''}{team.scoreDiff}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-3 sm:p-4 bg-gray-50 text-xs text-gray-600">
              <p>Top 2 teams qualify for the final • Points = score margin</p>
            </div>
          </div>
        )}

        {activeTab === 'stats' && tournamentFormat === 'league' && (
          <div className="bg-white rounded-xl sm:rounded-2xl shadow-xl overflow-hidden">
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
                    <thead className="bg-gray-100 sticky top-0">
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
                            <span className="bg-purple-100 text-purple-700 px-2 sm:px-3 py-1 rounded-full font-bold text-xs sm:text-sm">
                              {player.winPercentage}%
                            </span>
                          </td>
                          <td className="px-2 sm:px-4 py-3 sm:py-4 text-center font-semibold text-blue-600 text-sm">{player.totalScored}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="p-3 sm:p-4 bg-gray-50 text-xs text-gray-600 border-t border-gray-200">
                  <p>📱 Swipe left to see all columns • Sorted by win percentage</p>
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'elo' && (
          <div className="bg-white rounded-xl sm:rounded-2xl shadow-xl overflow-hidden">
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
                <table className="w-full min-w-[500px]">
                  <thead className="bg-gray-100">
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
                            <div className="flex items-center gap-2">
                              <PlayerAvatar name={player.name} photoUrl={playerPhotos[player.name]} size="sm" />
                              <button
                                type="button"
                                onClick={() => setSelectedPlayerName(player.name)}
                                className="font-bold text-sm sm:text-base text-blue-700 hover:text-blue-900 hover:underline truncate text-left"
                              >
                                {player.name}
                              </button>
                              {eloGamificationMap[player.name]?.level && (
                                <span className="text-[10px] sm:text-[11px] font-semibold text-indigo-700 bg-indigo-100 px-1.5 py-0.5 rounded-full">
                                  {eloGamificationMap[player.name].level.icon} {eloGamificationMap[player.name].level.name}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-2 sm:px-4 py-3 sm:py-4 text-center">
                            <span className={`px-2 sm:px-4 py-1 sm:py-2 rounded-full font-bold text-sm sm:text-base ${
                              player.rating >= 1200 ? 'bg-yellow-100 text-yellow-700' :
                              player.rating >= 1000 ? 'bg-green-100 text-green-700' :
                              'bg-gray-100 text-gray-700'
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
                <div className="p-3 sm:p-4 bg-gray-50 text-xs text-gray-600">
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
                    <div className="bg-white rounded-2xl p-8 sm:p-12 text-center">
                      <div className="text-5xl sm:text-6xl mb-4">🏆</div>
                      <h2 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-4">Tournament Complete!</h2>
                      <div className="bg-yellow-50 rounded-2xl p-4 sm:p-6 max-w-md mx-auto">
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
                      <div className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-emerald-800">
                        <p className="text-sm font-semibold">Odd Player Eligible for Final</p>
                        <p className="text-xs mt-1">{finalSelection.oddPlayerReason}</p>
                      </div>
                    )}
                    <FinalMatchCard
                      finalists={finalSelection.finalists}
                      onSave={onSaveFinalResult}
                      playerRatings={playerRatings}
                    />
                  </>
                ) : (
                  <div className="bg-white rounded-xl sm:rounded-2xl p-8 sm:p-12 text-center">
                    <Trophy size={48} className="mx-auto text-yellow-500 mb-4 sm:w-16 sm:h-16" />
                    <p className="text-base sm:text-lg text-gray-500 mb-4">Complete all league matches first</p>
                    <p className="text-sm text-gray-400">
                      {fixtures.filter(f => f.completed).length} / {fixtures.length} matches completed
                    </p>
                  </div>
                )}
              </>
            ) : (
              <div className="bg-white rounded-2xl p-8 sm:p-12 text-center">
                <Trophy size={48} className="mx-auto text-yellow-500 mb-4 sm:w-16 sm:h-16" />
                {champion ? (
                  <div className="space-y-4 sm:space-y-6">
                    <div>
                      <div className="text-5xl sm:text-6xl mb-4">🏆</div>
                      <h2 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-4">Tournament Complete!</h2>
                      <div className="bg-yellow-50 rounded-2xl p-4 sm:p-6 max-w-md mx-auto">
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

      {showInviteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[85vh] overflow-hidden">
            <div className="bg-gradient-to-r from-green-600 to-emerald-600 p-6 flex items-center justify-between">
              <h3 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
                <MessageCircle size={22} /> WhatsApp Invitations
              </h3>
              <button
                onClick={() => setShowInviteModal(false)}
                className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-lg transition-all"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(85vh-90px)]">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-gray-600">
                  Saved members: {members?.length || 0} • Ready invites: {inviteList.filter(i => i.hasPhone).length}
                </p>
                <button
                  onClick={sendAllInvites}
                  disabled={inviteList.filter(i => i.hasPhone).length === 0}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Send All
                </button>
              </div>

              {inviteList.length === 0 ? (
                <p className="text-gray-500 text-center py-6">No players found for invitations.</p>
              ) : (
                <div className="space-y-3">
                  {inviteList.map(invite => (
                    <div key={`${invite.name}-${invite.teamName}`} className="border border-gray-200 rounded-xl p-4">
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-800 truncate">{invite.name}</p>
                          <p className="text-xs text-gray-500 truncate">{invite.teamName} • {invite.phone || 'No WhatsApp number'}</p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleCopyInvite(invite)}
                            className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-1"
                          >
                            <Copy size={12} /> {copiedInvite === invite.name ? 'Copied' : 'Copy'}
                          </button>
                          {invite.whatsappLink ? (
                            <a
                              href={invite.whatsappLink}
                              target="_blank"
                              rel="noreferrer"
                              className="px-3 py-1 text-xs bg-green-100 text-green-700 rounded-lg hover:bg-green-200 font-semibold"
                            >
                              WhatsApp
                            </a>
                          ) : (
                            <span className="px-3 py-1 text-xs bg-red-100 text-red-600 rounded-lg font-semibold">
                              Missing Number
                            </span>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-gray-600 whitespace-pre-line">{invite.message}</p>
                    </div>
                  ))}
                </div>
              )}
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
