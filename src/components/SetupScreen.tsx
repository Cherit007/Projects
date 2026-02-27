import React, { useEffect, useMemo, useState } from 'react';
import { Users, Calendar, History, TrendingUp, Trophy, RefreshCw, X, Undo2, Sparkles, BarChart3, ChevronDown, ChevronUp, CheckCircle2, Clock3, Play, PencilLine } from 'lucide-react';
import TournamentViewer from './TournamentViewer';
import TemplateManager from './TemplateManager';
import PlayerProfileModal from './PlayerProfileModal';
import { buildPlayerAdvancedProfile } from '../utils/playerProfileAnalytics';
import { buildPlayerAchievements } from '../utils/playerAchievements';
import { buildPlayerGamification } from '../utils/playerGamification';
import PairingAnalyticsModal from './pairing/PairingAnalyticsModal';
import FormPowerRankingsModal from './rankings/FormPowerRankingsModal';
import PlayerAvatar from './PlayerAvatar';

const ActionButton = ({
  icon: Icon,
  title,
  subtitle,
  className,
  onClick,
  disabled = false,
}) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`w-full text-left rounded-xl px-3 py-2.5 transition-all border ${className} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
  >
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5">
        <Icon size={16} />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold leading-tight">{title}</p>
        <p className="text-xs opacity-80 mt-0.5 leading-tight">{subtitle}</p>
      </div>
    </div>
  </button>
);

const SetupScreen = ({ 
  tournamentName, 
  setTournamentName,
  numTeams,
  setNumTeams,
  format,
  setFormat,
  gameMode,
  setGameMode,
  tournamentFormat,
  setTournamentFormat,
  onNext,
  onRecordCasualMatch,
  lastTournamentConfig,
  onReuseTournament,
  tournamentHistory,
  scheduledTournaments = [],
  onEditScheduledTournament,
  onStartScheduledTournament,
  casualMatches,
  playerDatabase,
  teamNameDatabase,
  members,
  onAddMember,
  onDeleteMember,
  showHistory,
  setShowHistory,
  showCasualHistory,
  setShowCasualHistory,
  showAllTimeStats,
  setShowAllTimeStats,
  showEloLeaderboard,
  setShowEloLeaderboard,
  tournamentTemplates,
  onSaveTemplate,
  onApplyTemplate,
  onDeleteTemplate,
  canUndo,
  onUndoLastAction,
  onDeleteTournament,
  onDeleteCasualMatch,
  allTimeStats,
  eloLeaderboard,
  playerRatings,
  canEditPlayerPhoto = () => false,
  pairingAnalytics,
  formPowerRankings,
  playerPhotos = {},
  onUpdatePlayerPhoto
}) => {
  const [selectedTournament, setSelectedTournament] = useState(null);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [memberName, setMemberName] = useState('');
  const [memberPhone, setMemberPhone] = useState('');
  const [memberError, setMemberError] = useState('');
  const [numTeamsInput, setNumTeamsInput] = useState(String(numTeams));
  const [selectedPlayerName, setSelectedPlayerName] = useState(null);
  const [showPairingAnalytics, setShowPairingAnalytics] = useState(false);
  const [showPowerRankings, setShowPowerRankings] = useState(false);
  const [showAdvancedActions, setShowAdvancedActions] = useState(false);

  useEffect(() => {
    setNumTeamsInput(String(numTeams));
  }, [numTeams]);

  const formatCasualTeam = (team) => {
    if (!team) return 'Unknown';
    if (team.player) return team.player;
    return [team.player1, team.player2].filter(Boolean).join(' & ');
  };

  const selectedPlayerProfile = selectedPlayerName ? playerRatings?.[selectedPlayerName] : null;
  const selectedPlayerMember = selectedPlayerName
    ? (members || []).find(member => (member?.name || '').trim().toLowerCase() === selectedPlayerName.trim().toLowerCase())
    : null;
  const selectedPlayerIsLinked = Boolean(selectedPlayerMember?.linkedAccountId || selectedPlayerMember?.linkedEmail);
  const selectedPlayerCanEditPhoto = Boolean(selectedPlayerName && canEditPlayerPhoto(selectedPlayerName));
  const selectedPlayerTeam = selectedPlayerName
    ? [...(tournamentHistory || [])]
        .reverse()
        .flatMap(tournament => tournament?.teams || [])
        .find(team => [team.player, team.player1, team.player2].filter(Boolean).includes(selectedPlayerName))
    : null;
  const selectedPlayerAdvancedStats = useMemo(() => buildPlayerAdvancedProfile({
    playerName: selectedPlayerName,
    tournamentHistory,
    casualMatches,
  }), [selectedPlayerName, tournamentHistory, casualMatches]);
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
    (eloLeaderboard || []).map(player => [
      player.name,
      buildPlayerGamification({
        playerName: player.name,
        tournamentHistory,
        casualMatches,
      }),
    ])
  ), [eloLeaderboard, tournamentHistory, casualMatches]);

  const handleAddMember = () => {
    const result = onAddMember({
      name: memberName,
      phone: memberPhone,
    });

    if (!result?.success) {
      setMemberError(result?.reason || 'Unable to save member');
      return;
    }

    setMemberName('');
    setMemberPhone('');
    setMemberError('');
  };

  return (
    <div className="theme-page py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">🏸</div>
          <h1 className="theme-title text-4xl md:text-5xl font-bold mb-2">
            Badminton Tournament
          </h1>
          <p className="text-gray-600">Professional tournament management</p>
        </div>

        <div className="theme-card rounded-2xl p-6 md:p-8 mb-6">
          {scheduledTournaments.length > 0 && (
            <div className="mb-6 rounded-xl border-2 border-indigo-200 bg-gradient-to-r from-indigo-50 to-blue-50 p-4">
              <p className="text-sm font-semibold text-indigo-900 mb-3 flex items-center gap-2">
                <Clock3 size={16} /> Scheduled Tournaments ({scheduledTournaments.length})
              </p>
              <div className="space-y-2">
                {scheduledTournaments.slice(0, 4).map((tournament) => {
                  const tournamentId = tournament.id || tournament.appwriteId;
                  return (
                    <div key={tournamentId} className="rounded-lg border border-indigo-200 bg-white px-3 py-2">
                      <div className="flex flex-col gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-800 break-words leading-snug">{tournament.name}</p>
                          <p className="text-[11px] text-slate-500 break-words">
                            {tournament.date} • {tournament.teams?.length || 0} teams
                          </p>
                        </div>
                        <div className="flex items-center gap-1 flex-wrap">
                          <button
                            type="button"
                            onClick={() => onEditScheduledTournament?.(tournamentId)}
                            className="px-2 py-1 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 flex items-center gap-1"
                          >
                            <PencilLine size={11} /> Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => onStartScheduledTournament?.(tournamentId)}
                            className="px-2 py-1 rounded-md text-[11px] font-semibold bg-indigo-100 text-indigo-700 hover:bg-indigo-200 flex items-center gap-1"
                          >
                            <Play size={11} /> Start
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteTournament?.(tournamentId)}
                            className="px-2 py-1 rounded-md text-[11px] font-semibold bg-red-100 text-red-700 hover:bg-red-200"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {lastTournamentConfig && (
            <div className="mb-6 bg-gradient-to-r from-emerald-50 to-cyan-50 border-2 border-emerald-200 rounded-xl p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-700 mb-1">🔄 Previous Tournament Available</p>
                  <p className="text-xs text-gray-600">"{lastTournamentConfig.name}" - {lastTournamentConfig.numTeams} teams</p>
                </div>
                <button onClick={onReuseTournament} className="btn-brand-alt flex items-center gap-2 px-4 py-2 rounded-xl transition-all font-semibold text-sm whitespace-nowrap">
                  <RefreshCw size={16} /> Reuse
                </button>
              </div>
            </div>
          )}

          <TemplateManager
            templates={tournamentTemplates}
            currentConfig={{ gameMode, tournamentFormat, format, numTeams }}
            playerSuggestions={playerDatabase}
            teamNameSuggestions={teamNameDatabase}
            onSave={onSaveTemplate}
            onApply={onApplyTemplate}
            onDelete={onDeleteTemplate}
          />

          <div className="mb-6 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-700">Quick Access</p>
              <button
                type="button"
                onClick={() => setShowAdvancedActions(prev => !prev)}
                className="text-xs font-semibold text-blue-700 hover:text-blue-900 flex items-center gap-1"
              >
                {showAdvancedActions ? 'Hide advanced' : 'Show advanced'}
                {showAdvancedActions ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <ActionButton
                icon={Users}
                title={`Members (${members.length})`}
                subtitle="Add/update player contacts"
                className="bg-cyan-50 text-cyan-800 border-cyan-200 hover:bg-cyan-100"
                onClick={() => setShowMembersModal(true)}
              />
              <ActionButton
                icon={History}
                title={`Tournament History (${tournamentHistory.length})`}
                subtitle="View/delete past tournaments"
                className="bg-purple-50 text-purple-800 border-purple-200 hover:bg-purple-100"
                onClick={() => setShowHistory(true)}
              />
              <ActionButton
                icon={Calendar}
                title={`Casual Matches (${casualMatches.length})`}
                subtitle="Open casual match records"
                className="bg-green-50 text-green-800 border-green-200 hover:bg-green-100"
                onClick={() => setShowCasualHistory(true)}
              />
              <ActionButton
                icon={Trophy}
                title="ELO Leaderboard"
                subtitle="Current rating rankings"
                className="bg-yellow-50 text-yellow-800 border-yellow-200 hover:bg-yellow-100"
                onClick={() => setShowEloLeaderboard(true)}
              />
            </div>

            {showAdvancedActions && (
              <div className="pt-1">
                <p className="text-xs font-semibold text-gray-600 mb-2">Advanced Tools</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <ActionButton
                    icon={TrendingUp}
                    title="All-Time Stats"
                    subtitle="Career summary across tournaments"
                    className="bg-orange-50 text-orange-800 border-orange-200 hover:bg-orange-100"
                    onClick={() => setShowAllTimeStats(true)}
                  />
                  <ActionButton
                    icon={Sparkles}
                    title="Pairing Analytics"
                    subtitle="Best combinations and chemistry"
                    className="bg-blue-50 text-blue-800 border-blue-200 hover:bg-blue-100"
                    onClick={() => setShowPairingAnalytics(true)}
                  />
                  <ActionButton
                    icon={BarChart3}
                    title="Power Rankings"
                    subtitle="Form and momentum leaders"
                    className="bg-indigo-50 text-indigo-800 border-indigo-200 hover:bg-indigo-100"
                    onClick={() => setShowPowerRankings(true)}
                  />
                  <ActionButton
                    icon={Undo2}
                    title="Undo Last Action"
                    subtitle="Rollback your latest change"
                    className="bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100"
                    onClick={onUndoLastAction}
                    disabled={!canUndo}
                  />
                </div>
              </div>
            )}

          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Game Mode</label>
              <select value={gameMode} onChange={(e) => setGameMode(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 outline-none transition-all bg-white">
                <option value="doubles">🏸 Doubles (2 players per team)</option>
                <option value="singles">👤 Singles (1 player per team)</option>
                <option value="mixed">⚡ Mixed Doubles</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Tournament Format</label>
              <select value={tournamentFormat} onChange={(e) => {
                setTournamentFormat(e.target.value);
                if (e.target.value === 'knockoutByes') {
                  setNumTeams(4);
                  setNumTeamsInput('4');
                } else if (e.target.value === 'semiFinal') {
                  setNumTeams(4);
                  setNumTeamsInput('4');
                } else if (e.target.value === 'fullKnockout') {
                  setNumTeams(8);
                  setNumTeamsInput('8');
                } else {
                  setNumTeams(3);
                  setNumTeamsInput('3');
                }
              }}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 outline-none transition-all bg-white">
                <option value="league">📊 League + Final</option>
                <option value="knockoutByes">🏆 Knockout + Byes (3+ teams)</option>
                <option value="semiFinal">🏆 Semi Final + Final (4 teams)</option>
                <option value="fullKnockout">⚔️ Full Knockout (8 teams)</option>
              </select>
              {tournamentFormat === 'league' && (
                <select value={format} onChange={(e) => setFormat(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 outline-none transition-all bg-white mt-2">
                  <option value="1">1 match per pair</option>
                  <option value="2">2 matches per pair</option>
                </select>
              )}
              <p className="text-xs text-gray-500 mt-2">
                {tournamentFormat === 'knockoutByes' && '3+ teams: knockout bracket with automatic byes'}
                {tournamentFormat === 'semiFinal' && '4 teams: 2 semi finals → 1 final'}
                {tournamentFormat === 'fullKnockout' && '8 teams: quarters → semis → final'}
                {tournamentFormat === 'league' && 'Round-robin, top 2 advance to final'}
              </p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Tournament Name</label>
              <input type="text" value={tournamentName} onChange={(e) => setTournamentName(e.target.value)} placeholder="e.g., Summer Smash 2024"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 outline-none transition-all" />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Number of Teams</label>
              <input type="text" inputMode="numeric" pattern="[0-9]*" value={numTeamsInput}
                disabled={tournamentFormat !== 'league' && tournamentFormat !== 'knockoutByes'}
                onChange={(e) => {
                  setNumTeamsInput(e.target.value.replace(/\D/g, ''));
                }}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 outline-none transition-all disabled:bg-gray-100" />
              <p className="text-xs text-gray-500 mt-1">
                {tournamentFormat === 'league' && 'Min: 3, Max: 12 teams'}
                {tournamentFormat === 'knockoutByes' && 'Min: 3, Max: 16 teams'}
                {tournamentFormat !== 'league' && tournamentFormat !== 'knockoutByes' && 'Fixed for this format'}
              </p>
            </div>

            {/* Record Casual Match Button */}
            <button 
              onClick={onRecordCasualMatch}
              className="btn-brand-alt w-full py-4 rounded-xl font-semibold text-lg hover:shadow-xl transform hover:scale-[1.02] transition-all mb-3"
            >
              <div className="flex items-center justify-center gap-2">
                <Trophy size={20} /> Record Casual Match
              </div>
            </button>

            <button onClick={() => onNext(numTeamsInput)} disabled={!tournamentName.trim()}
              className="btn-brand w-full py-4 rounded-xl font-semibold text-lg hover:shadow-xl transform hover:scale-[1.02] transition-all disabled:opacity-50">
              <div className="flex items-center justify-center gap-2">
                <Users size={20} /> Start Tournament
              </div>
            </button>

            <p className="text-center text-xs text-gray-500 mt-3">
              💡 Record individual matches or start a full tournament
            </p>
          </div>
        </div>
      </div>

      {/* History Modal */}
      {showMembersModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full max-h-[80vh] overflow-hidden">
            <div className="bg-gradient-to-r from-cyan-600 to-blue-600 p-6 flex items-center justify-between">
              <h3 className="text-2xl font-bold text-white flex items-center gap-2">
                <Users size={24} /> Tournament Members
              </h3>
              <button
                onClick={() => setShowMembersModal(false)}
                aria-label="Close members modal"
                className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-lg transition-all"
              >
                <X size={24} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[calc(80vh-88px)]">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                <input
                  type="text"
                  value={memberName}
                  onChange={(e) => setMemberName(e.target.value)}
                  placeholder="Member name"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-cyan-500 outline-none transition-all"
                />
                <input
                  type="text"
                  inputMode="tel"
                  value={memberPhone}
                  onChange={(e) => setMemberPhone(e.target.value)}
                  placeholder="WhatsApp number (+countrycode)"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-cyan-500 outline-none transition-all"
                />
              </div>
              <button
                onClick={handleAddMember}
                className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 text-white py-3 rounded-xl font-semibold hover:shadow-lg transition-all"
              >
                Add / Update Member
              </button>
              {memberError && (
                <p className="text-sm text-red-600 mt-2">{memberError}</p>
              )}

              <div className="mt-5">
                {members.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">No members added yet</p>
                ) : (
                  <div className="space-y-2">
                    {members.map(member => (
                      <div key={member.id} className="flex items-center justify-between border border-gray-200 rounded-xl p-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 min-w-0">
                            <p className="font-semibold text-gray-800 truncate">{member.name}</p>
                            {Boolean(member.linkedAccountId || member.linkedEmail) && (
                              <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 shrink-0">
                                <CheckCircle2 size={12} />
                                Linked
                              </span>
                            )}
                            {!Boolean(member.linkedAccountId || member.linkedEmail) && (
                              <span className="inline-flex items-center text-[11px] px-2 py-0.5 rounded-full border border-slate-200 bg-slate-100 text-slate-600 shrink-0">
                                Not linked
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 truncate">{member.phone}</p>
                        </div>
                        <button
                          onClick={() => onDeleteMember(member.id)}
                          className="text-red-500 hover:text-red-700 text-xs px-3 py-1 rounded-lg hover:bg-red-50 transition-all font-semibold"
                        >
                          Delete
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {showHistory && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-6 flex items-center justify-between">
              <h3 className="text-2xl font-bold text-white flex items-center gap-2">
                <History size={24} /> Tournament History
              </h3>
              <button
                onClick={() => setShowHistory(false)}
                aria-label="Close tournament history"
                className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-lg transition-all"
              >
                <X size={24} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[calc(80vh-88px)]">
              {tournamentHistory.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <History size={48} className="mx-auto mb-4 text-gray-300" />
                  <p>No tournament history yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {tournamentHistory.map(tournament => (
                    <div key={tournament.id} className="border-2 border-gray-200 rounded-xl p-4 hover:border-purple-300 transition-all bg-gradient-to-r from-white to-gray-50">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-lg text-gray-800 mb-1">{tournament.name}</h4>
                          <p className="text-xs text-gray-500">{tournament.date} • {tournament.teams?.length || 0} teams</p>
                        </div>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => setSelectedTournament(tournament)}
                            className="text-blue-600 hover:text-blue-700 text-xs px-3 py-1 rounded-lg hover:bg-blue-50 transition-all font-semibold whitespace-nowrap">
                            View
                          </button>
                          <button onClick={() => onDeleteTournament(tournament.id)}
                            className="text-red-500 hover:text-red-700 text-xs px-3 py-1 rounded-lg hover:bg-red-50 transition-all font-semibold whitespace-nowrap">
                            Delete
                          </button>
                        </div>
                      </div>
                      {tournament.champion && (
                        <div className="flex items-center gap-3 bg-gradient-to-r from-yellow-50 to-orange-50 p-3 rounded-lg border-2 border-yellow-200">
                          <span className="text-3xl">{tournament.champion.emoji}</span>
                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-gray-800 flex items-center gap-2">
                              <Trophy size={16} className="text-yellow-600" />
                              {tournament.champion.name}
                            </p>
                            <p className="text-xs text-gray-600">
                              {tournament.champion.player || tournament.champion.player1}
                              {tournament.champion.player2 && ` & ${tournament.champion.player2}`}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Casual Match History Modal */}
      {showCasualHistory && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="bg-gradient-to-r from-green-600 to-teal-600 p-6 flex items-center justify-between">
              <h3 className="text-2xl font-bold text-white flex items-center gap-2">
                <Calendar size={24} /> Casual Match History
              </h3>
              <button
                onClick={() => setShowCasualHistory(false)}
                aria-label="Close casual history"
                className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-lg transition-all"
              >
                <X size={24} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[calc(80vh-88px)]">
              {casualMatches.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Calendar size={48} className="mx-auto mb-4 text-gray-300" />
                  <p>No casual match history yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {casualMatches.map((match, index) => {
                    const team1Name = formatCasualTeam(match.team1);
                    const team2Name = formatCasualTeam(match.team2);
                    const score1 = Number(match.score1);
                    const score2 = Number(match.score2);
                    const isTeam1Winner = score1 > score2;
                    const matchId = match.id || match.appwriteId;
                    return (
                      <div key={matchId || index} className="border-2 border-gray-200 rounded-xl p-4 bg-gradient-to-r from-white to-gray-50">
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="min-w-0">
                            <p className="text-xs text-gray-500 mb-1">
                              {match.matchType === 'doubles' ? '👥 Doubles' : '🎯 Singles'} • {new Date(match.date || match.createdAt || Date.now()).toLocaleString()}
                            </p>
                            <p className="font-semibold text-gray-800 truncate">
                              <span className={isTeam1Winner ? 'text-green-700' : ''}>{team1Name}</span> vs <span className={!isTeam1Winner ? 'text-green-700' : ''}>{team2Name}</span>
                            </p>
                            <p className="text-sm text-gray-700 mt-1">Score: {score1} - {score2}</p>
                          </div>
                          <button
                            onClick={() => onDeleteCasualMatch(matchId)}
                            disabled={!matchId}
                            className="text-red-500 hover:text-red-700 text-xs px-3 py-1 rounded-lg hover:bg-red-50 transition-all font-semibold whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* All-Time Stats Modal */}
      {showAllTimeStats && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[80vh] overflow-hidden">
            <div className="bg-gradient-to-r from-orange-600 to-red-600 p-6 flex items-center justify-between">
              <h3 className="text-2xl font-bold text-white flex items-center gap-2">
                <TrendingUp size={24} /> All-Time Player Statistics
              </h3>
              <button
                onClick={() => setShowAllTimeStats(false)}
                aria-label="Close all-time stats"
                className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-lg transition-all"
              >
                <X size={24} />
              </button>
            </div>
            <div className="overflow-y-auto max-h-[calc(80vh-88px)]">
              {allTimeStats.length === 0 ? (
                <div className="p-12 text-center text-gray-500">
                  <TrendingUp size={48} className="mx-auto mb-4 text-gray-300" />
                  <p>No player statistics available yet</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-100 sticky top-0">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">Rank</th>
                        <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">Player</th>
                        <th className="px-4 py-3 text-center text-sm font-bold text-gray-700">🏆</th>
                        <th className="px-4 py-3 text-center text-sm font-bold text-gray-700">Tournaments</th>
                        <th className="px-4 py-3 text-center text-sm font-bold text-gray-700">Played</th>
                        <th className="px-4 py-3 text-center text-sm font-bold text-gray-700">Won</th>
                        <th className="px-4 py-3 text-center text-sm font-bold text-gray-700">Win %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allTimeStats.map((player, index) => (
                        <tr key={player.name} className="border-b border-gray-200 hover:bg-gray-50">
                          <td className="px-4 py-4 text-center font-bold text-lg">
                            {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-2">
                              <PlayerAvatar name={player.name} photoUrl={playerPhotos[player.name]} size="sm" />
                              <button
                                type="button"
                                onClick={() => setSelectedPlayerName(player.name)}
                                className="font-bold text-blue-700 hover:text-blue-900 hover:underline"
                              >
                                {player.name}
                              </button>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-center">
                            <span className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full font-bold text-sm">
                              {player.championships}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-center font-semibold">{player.tournamentsPlayed}</td>
                          <td className="px-4 py-4 text-center font-semibold">{player.matchesPlayed}</td>
                          <td className="px-4 py-4 text-center font-semibold text-green-600">{player.matchesWon}</td>
                          <td className="px-4 py-4 text-center">
                            <span className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full font-bold text-sm">
                              {player.winPercentage}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ELO Leaderboard Modal */}
      {showEloLeaderboard && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[80vh] overflow-hidden">
            <div className="bg-gradient-to-r from-yellow-600 to-orange-600 p-6 flex items-center justify-between">
              <h3 className="text-2xl font-bold text-white flex items-center gap-2">
                <Trophy size={24} /> ELO Rating Leaderboard
              </h3>
              <button
                onClick={() => setShowEloLeaderboard(false)}
                aria-label="Close elo leaderboard"
                className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-lg transition-all"
              >
                <X size={24} />
              </button>
            </div>
            <div className="overflow-y-auto max-h-[calc(80vh-88px)]">
              {eloLeaderboard.length === 0 ? (
                <div className="p-12 text-center text-gray-500">
                  <Trophy size={48} className="mx-auto mb-4 text-gray-300" />
                  <p>No ELO ratings yet. Complete matches to build the leaderboard!</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-100 sticky top-0">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">Rank</th>
                        <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">Player</th>
                        <th className="px-4 py-3 text-center text-sm font-bold text-gray-700">Rating</th>
                        <th className="px-4 py-3 text-center text-sm font-bold text-gray-700">Matches</th>
                        <th className="px-4 py-3 text-center text-sm font-bold text-gray-700">Last Change</th>
                      </tr>
                    </thead>
                    <tbody>
                      {eloLeaderboard.map((player, index) => {
                        const lastMatch = player.history && player.history.length > 0 ? player.history[player.history.length - 1] : null;
                        return (
                          <tr key={player.name} className="border-b border-gray-200 hover:bg-gray-50">
                            <td className="px-4 py-4 text-center font-bold text-lg">
                              {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}
                            </td>
                            <td className="px-4 py-4">
                              <div className="flex items-center gap-2">
                                <PlayerAvatar name={player.name} photoUrl={playerPhotos[player.name]} size="sm" />
                                <button
                                  type="button"
                                  onClick={() => setSelectedPlayerName(player.name)}
                                  className="font-bold text-blue-700 hover:text-blue-900 hover:underline"
                                >
                                  {player.name}
                                </button>
                                {eloGamificationMap[player.name]?.level && (
                                  <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-100 px-1.5 py-0.5 rounded-full">
                                    {eloGamificationMap[player.name].level.icon} {eloGamificationMap[player.name].level.name}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-4 text-center">
                              <span className={`px-3 py-1 rounded-full font-bold text-sm ${
                                player.rating >= 1200 ? 'bg-yellow-100 text-yellow-700' :
                                player.rating >= 1000 ? 'bg-green-100 text-green-700' :
                                'bg-gray-100 text-gray-700'
                              }`}>
                                {player.rating}
                              </span>
                            </td>
                            <td className="px-4 py-4 text-center font-semibold">{player.matchesPlayed}</td>
                            <td className="px-4 py-4 text-center">
                              {lastMatch && (
                                <span className={`font-bold ${lastMatch.change > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {lastMatch.change > 0 ? '+' : ''}{lastMatch.change}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Tournament Viewer Modal */}
      {selectedTournament && (
        <TournamentViewer
          tournament={selectedTournament}
          onClose={() => setSelectedTournament(null)}
        />
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

      {showPairingAnalytics && (
        <PairingAnalyticsModal
          analytics={pairingAnalytics}
          onClose={() => setShowPairingAnalytics(false)}
        />
      )}

      {showPowerRankings && (
        <FormPowerRankingsModal
          rankings={formPowerRankings}
          onClose={() => setShowPowerRankings(false)}
        />
      )}
    </div>
  );
};

export default SetupScreen;
