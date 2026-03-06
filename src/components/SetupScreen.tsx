import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Calendar,
  History,
  TrendingUp,
  Trophy,
  X,
  Sparkles,
  Clock3,
  Play,
  PencilLine,
  MessageCircle,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
} from 'lucide-react';
import TournamentViewer from './TournamentViewer';
import PlayerProfileModal from './PlayerProfileModal';
import { buildPlayerAdvancedProfile } from '../utils/playerProfileAnalytics';
import { buildPlayerAchievements } from '../utils/playerAchievements';
import { buildPlayerGamification } from '../utils/playerGamification';
import PairingAnalyticsModal from './pairing/PairingAnalyticsModal';
import FormPowerRankingsModal from './rankings/FormPowerRankingsModal';
import PlayerAvatar from './PlayerAvatar';
import MobileBottomSheet from './common/MobileBottomSheet';
import StartTournamentLane from './home/StartTournamentLane';
import ExploreDataLane from './home/ExploreDataLane';
import { buildHomeNarratives } from '../utils/homeNarratives';

const LoadingRows = ({ rows = 4 }) => (
  <div className="space-y-3 animate-pulse">
    {Array.from({ length: rows }, (_, index) => (
      <div
        key={`skeleton-row-${index}`}
        className="h-20 rounded-xl border border-slate-200 bg-gradient-to-r from-slate-100 via-slate-50 to-slate-100"
      />
    ))}
  </div>
);

const SyncStatusChip = ({ syncStatus = null, freshnessText = '' }) => {
  if (!syncStatus) return null;
  const secondaryText = syncStatus?.busy
    ? String(syncStatus?.detail || '').trim()
    : String(freshnessText || syncStatus?.detail || '').trim();
  return (
    <div className={`setup-sync-chip sync-feedback-chip setup-sync-${syncStatus.tone || 'saved'}`}>
      <span className="setup-sync-chip-dot" />
      <span className="setup-sync-chip-label">
        {syncStatus.label || 'Ready'}
        {secondaryText ? ` · ${secondaryText}` : ''}
      </span>
      {syncStatus.busy && <RefreshCw size={12} className="animate-spin" />}
    </div>
  );
};

const buildFormSummary = (rawSeries = []) => {
  const series = (Array.isArray(rawSeries) ? rawSeries : [])
    .filter((value) => value === 'W' || value === 'L' || value === 'D')
    .slice(-4);
  if (series.length === 0) {
    return { label: 'No form', tone: 'neutral' };
  }
  const wins = series.filter((token) => token === 'W').length;
  const losses = series.filter((token) => token === 'L').length;
  const points = wins - losses;
  return {
    label: series.join(''),
    tone: points > 0 ? 'up' : points < 0 ? 'down' : 'neutral',
  };
};

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
  tournamentHistory,
  scheduledTournaments = [],
  activeLiveTournaments = [],
  onEditScheduledTournament,
  onStartScheduledTournament,
  onShareScheduledTournament,
  onResumeActiveTournament,
  onDeleteActiveTournament,
  canDeleteLiveTournament = false,
  canDeleteActions = false,
  casualMatches,
  playerDatabase,
  teamNameDatabase,
  members,
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
  onDeleteTournament,
  onDeleteCasualMatch,
  allTimeStats,
  eloLeaderboard,
  playerRatings,
  canEditPlayerPhoto = () => false,
  pairingAnalytics,
  formPowerRankings,
  playerPhotos = {},
  onUpdatePlayerPhoto,
  isAppwriteEnabled = false,
  historyHydrated = true,
  casualHydrated = true,
  historyHydrationPending = false,
  casualHydrationPending = false,
  getActionPending = () => false,
  syncStatus = null,
  lastDataUpdatedAt = 0,
  realtimeConnected = false,
  isMobileViewport = false,
}) => {
  const [selectedTournament, setSelectedTournament] = useState(null);
  const [numTeamsInput, setNumTeamsInput] = useState(String(numTeams));
  const [selectedPlayerName, setSelectedPlayerName] = useState(null);
  const [showPairingAnalytics, setShowPairingAnalytics] = useState(false);
  const [showPowerRankings, setShowPowerRankings] = useState(false);
  const [showAdvancedActions, setShowAdvancedActions] = useState(false);
  const [freshnessNow, setFreshnessNow] = useState(() => Date.now());
  const historyCacheRef = useRef(Array.isArray(tournamentHistory) ? tournamentHistory : []);
  const casualCacheRef = useRef(Array.isArray(casualMatches) ? casualMatches : []);
  const allTimeStatsCacheRef = useRef(Array.isArray(allTimeStats) ? allTimeStats : []);
  const eloCacheRef = useRef(Array.isArray(eloLeaderboard) ? eloLeaderboard : []);

  useEffect(() => {
    setNumTeamsInput(String(numTeams));
  }, [numTeams]);

  const historyLoading = Boolean(isAppwriteEnabled && (historyHydrationPending || !historyHydrated));
  const casualLoading = Boolean(isAppwriteEnabled && (casualHydrationPending || !casualHydrated));
  const statsLoading = Boolean(isAppwriteEnabled && (
    historyHydrationPending
    || casualHydrationPending
    || !historyHydrated
    || !casualHydrated
  ));
  const isPendingAction = (actionKey) => Boolean(getActionPending?.(actionKey));
  const startTournamentPending = isPendingAction('setup.start-tournament');

  useEffect(() => {
    if (!isAppwriteEnabled || !lastDataUpdatedAt) return undefined;
    const timerId = setInterval(() => {
      setFreshnessNow(Date.now());
    }, 15 * 1000);
    return () => clearInterval(timerId);
  }, [isAppwriteEnabled, lastDataUpdatedAt]);

  const freshnessText = useMemo(() => {
    if (!isAppwriteEnabled) return 'Device local';
    const updatedAt = Number(lastDataUpdatedAt || 0);
    if (!Number.isFinite(updatedAt) || updatedAt <= 0) {
      return realtimeConnected ? 'Sync warming up' : 'Waiting for cloud sync';
    }
    const elapsedMinutes = Math.max(0, Math.floor((freshnessNow - updatedAt) / (60 * 1000)));
    if (elapsedMinutes < 1) return 'Synced just now';
    if (elapsedMinutes < 60) {
      return `Synced ${elapsedMinutes} min${elapsedMinutes === 1 ? '' : 's'} ago`;
    }

    const updatedDate = new Date(updatedAt);
    const nowDate = new Date(freshnessNow);
    const sameDay = updatedDate.toDateString() === nowDate.toDateString();
    const timeLabel = updatedDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    if (sameDay) return `Synced at ${timeLabel}`;

    const dateLabel = updatedDate.toLocaleDateString([], { month: 'short', day: 'numeric' });
    return `Synced ${dateLabel}, ${timeLabel}`;
  }, [isAppwriteEnabled, lastDataUpdatedAt, realtimeConnected, freshnessNow]);

  useEffect(() => {
    if (!historyLoading) {
      historyCacheRef.current = Array.isArray(tournamentHistory) ? tournamentHistory : [];
    }
  }, [historyLoading, tournamentHistory]);

  useEffect(() => {
    if (!casualLoading) {
      casualCacheRef.current = Array.isArray(casualMatches) ? casualMatches : [];
    }
  }, [casualLoading, casualMatches]);

  useEffect(() => {
    if (!statsLoading) {
      allTimeStatsCacheRef.current = Array.isArray(allTimeStats) ? allTimeStats : [];
      eloCacheRef.current = Array.isArray(eloLeaderboard) ? eloLeaderboard : [];
    }
  }, [statsLoading, allTimeStats, eloLeaderboard]);

  const formatCasualTeam = (team) => {
    if (!team) return 'Unknown';
    if (team.player) return team.player;
    return [team.player1, team.player2].filter(Boolean).join(' & ');
  };

  const selectedPlayerProfile = selectedPlayerName ? playerRatings?.[selectedPlayerName] : null;
  const selectedPlayerLeaderboardRank = useMemo(() => {
    if (!selectedPlayerName) return null;
    const target = selectedPlayerName.trim().toLowerCase();
    const index = (eloLeaderboard || []).findIndex((entry) => (
      String(entry?.name || '').trim().toLowerCase() === target
    ));
    return index >= 0 ? index + 1 : null;
  }, [selectedPlayerName, eloLeaderboard]);
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
  const displayTournamentHistory = historyLoading && (tournamentHistory || []).length === 0
    ? historyCacheRef.current
    : (tournamentHistory || []);
  const displayCasualMatches = casualLoading && (casualMatches || []).length === 0
    ? casualCacheRef.current
    : (casualMatches || []);
  const displayAllTimeStats = statsLoading && (allTimeStats || []).length === 0
    ? allTimeStatsCacheRef.current
    : (allTimeStats || []);
  const displayEloLeaderboard = statsLoading && (eloLeaderboard || []).length === 0
    ? eloCacheRef.current
    : (eloLeaderboard || []);
  const eloFormMetaByPlayer = useMemo(() => {
    const map = new Map();
    (displayEloLeaderboard || []).forEach((player) => {
      const history = Array.isArray(player?.history) ? player.history : [];
      const trendSeries = history
        .slice(-4)
        .map((entry) => Number(entry?.change))
        .map((value) => (value > 0 ? 'W' : value < 0 ? 'L' : 'D'));
      map.set(player.name, buildFormSummary(trendSeries));
    });
    return map;
  }, [displayEloLeaderboard]);
  const historyCountLabel = String(displayTournamentHistory.length);
  const casualCountLabel = String(displayCasualMatches.length);
  const showHistorySkeleton = historyLoading && displayTournamentHistory.length === 0;
  const showCasualSkeleton = casualLoading && displayCasualMatches.length === 0;
  const showStatsSkeleton = statsLoading && displayAllTimeStats.length === 0;
  const showEloSkeleton = statsLoading && displayEloLeaderboard.length === 0;
  const completedTournamentsCount = useMemo(
    () => displayTournamentHistory.filter((entry) => entry?.champion || entry?.status === 'completed').length,
    [displayTournamentHistory]
  );
  const totalTournamentMatchesPlayed = useMemo(
    () => displayTournamentHistory.reduce((total, entry) => {
      const fixtureCount = (Array.isArray(entry?.fixtures) ? entry.fixtures : []).filter((match) => match?.completed).length;
      const bracketCount = (Array.isArray(entry?.bracket) ? entry.bracket : [])
        .flatMap((round) => (Array.isArray(round) ? round : []))
        .filter((match) => match?.completed).length;
      const finalCount = entry?.finalMatch?.completed ? 1 : 0;
      return total + fixtureCount + bracketCount + finalCount;
    }, 0),
    [displayTournamentHistory]
  );
  const totalMatchesPlayed = totalTournamentMatchesPlayed + displayCasualMatches.length;
  const topEloPlayer = displayEloLeaderboard[0] || null;
  const narratives = useMemo(() => buildHomeNarratives({
    tournamentHistory: displayTournamentHistory,
    casualMatches: displayCasualMatches,
    eloLeaderboard: displayEloLeaderboard,
    playerRatings,
    activeLiveTournaments,
  }), [
    displayTournamentHistory,
    displayCasualMatches,
    displayEloLeaderboard,
    playerRatings,
    activeLiveTournaments,
  ]);
  const syncChip = (
    <SyncStatusChip syncStatus={syncStatus} freshnessText={freshnessText} />
  );

  return (
    <div className="theme-page py-8 px-4 app-screen-home">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">🏸</div>
          <h1 className="theme-title app-hero-title text-4xl md:text-5xl font-bold mb-2">
            Badminton Tournament
          </h1>
          <p className="text-gray-600 app-hero-subtitle">Professional tournament management</p>
        </div>

        <div className="theme-card app-surface-card app-card-tier-primary app-rhythm-panel rounded-2xl p-4 sm:p-5 md:p-6 mb-6">
          <div className="setup-home-sync-row mb-4">
            {syncChip}
          </div>

          {scheduledTournaments.length > 0 && (
            <div className="mb-4 rounded-xl p-4 setup-highlight-card setup-scheduled-card app-surface-card app-card-tier-secondary">
              <p className="text-sm font-semibold text-indigo-900 mb-3 flex items-center gap-2 setup-scheduled-title">
                <Clock3 size={16} /> Scheduled Tournaments ({scheduledTournaments.length})
              </p>
              <div className="space-y-2">
                {scheduledTournaments.slice(0, 4).map((tournament) => {
                  const tournamentId = tournament.id || tournament.appwriteId;
                  const editPending = Boolean(tournamentId && isPendingAction(`setup.edit-scheduled.${String(tournamentId)}`));
                  const startPending = Boolean(tournamentId && isPendingAction(`setup.start-scheduled.${String(tournamentId)}`));
                  const deletePending = Boolean(tournamentId && isPendingAction(`setup.delete-tournament.${String(tournamentId)}`));
                  return (
                    <div key={tournamentId} className="rounded-lg border border-indigo-200 bg-white px-3 py-2 setup-scheduled-row">
                      <div className="flex flex-col gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-800 break-words leading-snug setup-scheduled-name">{tournament.name}</p>
                          <p className="text-[11px] text-slate-500 break-words setup-scheduled-meta">
                            {tournament.date} • {(
                              Array.isArray(tournament.teams)
                                ? tournament.teams.length
                                : (typeof tournament.teamsCount === 'number' ? tournament.teamsCount : 0)
                            )} teams
                          </p>
                        </div>
                        <div className="flex items-center gap-1 flex-wrap">
                          <button
                            type="button"
                            onClick={() => onEditScheduledTournament?.(tournamentId)}
                            disabled={!tournamentId || editPending || startPending || deletePending}
                            className="px-2 py-1 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-1 setup-scheduled-edit-btn"
                          >
                            <PencilLine size={11} /> {editPending ? 'Loading...' : 'Edit'}
                          </button>
                          <button
                            type="button"
                            onClick={() => onStartScheduledTournament?.(tournamentId)}
                            disabled={!tournamentId || startPending || deletePending}
                            className="px-2 py-1 rounded-md text-[11px] font-semibold bg-indigo-100 text-indigo-700 hover:bg-indigo-200 disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-1 setup-scheduled-start-btn"
                          >
                            <Play size={11} /> {startPending ? 'Starting...' : 'Start'}
                          </button>
                          <button
                            type="button"
                            onClick={() => onShareScheduledTournament?.(tournament)}
                            disabled={startPending || deletePending}
                            className="px-2 py-1 rounded-md text-[11px] font-semibold bg-emerald-100 text-emerald-700 hover:bg-emerald-200 disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-1 setup-scheduled-share-btn"
                          >
                            <MessageCircle size={11} /> WhatsApp
                          </button>
                          {canDeleteActions && (
                            <button
                              type="button"
                              onClick={() => onDeleteTournament?.(tournamentId)}
                              disabled={!tournamentId || deletePending || startPending || editPending}
                              className="px-2 py-1 rounded-md text-[11px] font-semibold bg-red-100 text-red-700 hover:bg-red-200 disabled:opacity-60 disabled:cursor-not-allowed setup-scheduled-delete-btn"
                            >
                              {deletePending ? 'Deleting...' : 'Delete'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeLiveTournaments.length > 0 && (
            <div className="mb-4 rounded-xl p-4 setup-highlight-card setup-live-card app-surface-card app-card-tier-secondary">
              <p className="text-sm font-semibold text-emerald-900 mb-3 flex items-center gap-2 setup-live-title">
                <Play size={16} /> Live Tournament ({activeLiveTournaments.length})
              </p>
              <div className="space-y-2">
                {activeLiveTournaments.slice(0, 3).map((tournament, index) => {
                  const tournamentId = tournament.id || tournament.appwriteId;
                  const rowKey = tournamentId || `${tournament.name || 'live'}-${index}`;
                  const resumePending = Boolean(isPendingAction(`setup.resume-live.${String(tournamentId || 'active')}`));
                  const deletePending = Boolean(isPendingAction(`setup.delete-live.${String(tournamentId || 'active')}`));
                  return (
                    <div key={rowKey} className="rounded-lg border border-emerald-200 bg-white px-3 py-2 setup-live-row">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-800 break-words leading-snug">{tournament.name || 'Live tournament'}</p>
                          <p className="text-[11px] text-slate-500 break-words">
                            {tournament.date || 'Today'} • {(
                              Array.isArray(tournament.teams)
                                ? tournament.teams.length
                                : (typeof tournament.teamsCount === 'number' ? tournament.teamsCount : 0)
                            )} teams
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => onResumeActiveTournament?.(tournamentId)}
                          disabled={resumePending || deletePending}
                          className="px-2 py-1 rounded-md text-[11px] font-semibold bg-emerald-100 text-emerald-800 hover:bg-emerald-200 disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-1 whitespace-nowrap setup-live-resume-btn"
                        >
                          <Play size={11} /> {resumePending ? 'Resuming...' : 'Resume'}
                        </button>
                        {canDeleteLiveTournament && (
                          <button
                            type="button"
                            onClick={() => onDeleteActiveTournament?.(tournamentId)}
                            disabled={deletePending || resumePending}
                            className="px-2 py-1 rounded-md text-[11px] font-semibold bg-red-100 text-red-700 hover:bg-red-200 disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap setup-live-delete-btn"
                          >
                            {deletePending ? 'Deleting...' : 'Delete'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <StartTournamentLane
              gameMode={gameMode}
              setGameMode={setGameMode}
              tournamentFormat={tournamentFormat}
              setTournamentFormat={setTournamentFormat}
              format={format}
              setFormat={setFormat}
              numTeamsInput={numTeamsInput}
              setNumTeamsInput={setNumTeamsInput}
              setNumTeams={setNumTeams}
              tournamentName={tournamentName}
              setTournamentName={setTournamentName}
              onNext={onNext}
              startTournamentPending={startTournamentPending}
            />
            <ExploreDataLane
              completedTournamentsCount={completedTournamentsCount}
              casualCount={displayCasualMatches.length}
              totalMatchesPlayed={totalMatchesPlayed}
              topEloPlayer={topEloPlayer}
              showAdvancedActions={showAdvancedActions}
              setShowAdvancedActions={setShowAdvancedActions}
              isMobileViewport={isMobileViewport}
              historyCountLabel={historyCountLabel}
              casualCountLabel={casualCountLabel}
              setShowHistory={setShowHistory}
              setShowCasualHistory={setShowCasualHistory}
              setShowEloLeaderboard={setShowEloLeaderboard}
              setShowAllTimeStats={setShowAllTimeStats}
              setShowPairingAnalytics={setShowPairingAnalytics}
              setShowPowerRankings={setShowPowerRankings}
              tournamentTemplates={tournamentTemplates}
              onSaveTemplate={onSaveTemplate}
              onApplyTemplate={onApplyTemplate}
              onDeleteTemplate={onDeleteTemplate}
              canDeleteActions={canDeleteActions}
              gameMode={gameMode}
              tournamentFormat={tournamentFormat}
              format={format}
              numTeams={numTeams}
              playerDatabase={playerDatabase}
              teamNameDatabase={teamNameDatabase}
              narratives={narratives}
            />
          </div>
        </div>
      </div>

      {showHistory && (
        <>
          {isMobileViewport ? (
            <MobileBottomSheet
              open={showHistory}
              title="Tournament History"
              subtitle={`${displayTournamentHistory.length} entries`}
              onClose={() => setShowHistory(false)}
              sheetClassName="history-modal-shell"
            >
              {historyLoading && displayTournamentHistory.length > 0 && (
                <div className="mb-3 rounded-lg border border-purple-200 bg-purple-50 px-3 py-2 text-xs font-semibold text-purple-700">
                  Refreshing latest tournament history...
                </div>
              )}
              {showHistorySkeleton ? (
                <LoadingRows rows={4} />
              ) : displayTournamentHistory.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <History size={48} className="mx-auto mb-4 text-gray-300" />
                  <p>No tournament history yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {displayTournamentHistory.map((tournament, index) => {
                    const tournamentId = tournament.id || tournament.appwriteId;
                    const deletePending = Boolean(tournamentId && isPendingAction(`setup.delete-tournament.${String(tournamentId)}`));
                    return (
                      <div key={tournamentId || `${tournament.name || 'history'}-${index}`} className="border-2 border-gray-200 rounded-xl p-4 hover:border-purple-300 transition-all bg-gradient-to-r from-white to-gray-50 history-entry-card">
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-lg text-gray-800 mb-1">{tournament.name}</h4>
                            <p className="text-xs text-gray-500">{tournament.date} • {tournament.teams?.length || 0} teams</p>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setSelectedTournament(tournament)}
                              className="text-blue-600 hover:text-blue-700 text-xs px-3 py-1 rounded-lg hover:bg-blue-50 transition-all font-semibold whitespace-nowrap"
                            >
                              View
                            </button>
                            {canDeleteActions && (
                              <button
                                onClick={() => onDeleteTournament?.(tournamentId)}
                                disabled={!tournamentId || deletePending}
                                className="text-red-500 hover:text-red-700 text-xs px-3 py-1 rounded-lg hover:bg-red-50 transition-all font-semibold whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {deletePending ? 'Deleting...' : 'Delete'}
                              </button>
                            )}
                          </div>
                        </div>
                        {tournament.champion && (
                          <div className="flex items-center gap-3 bg-gradient-to-r from-yellow-50 to-orange-50 p-3 rounded-lg border-2 border-yellow-200 history-champion-card">
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
                    );
                  })}
                </div>
              )}
            </MobileBottomSheet>
          ) : (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[240] p-4 app-overlay">
              <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden history-modal-shell app-modal-shell">
                <div className="app-gradient-band p-6 flex items-center justify-between setup-modal-header setup-modal-header-history">
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
                  {historyLoading && displayTournamentHistory.length > 0 && (
                    <div className="mb-3 rounded-lg border border-purple-200 bg-purple-50 px-3 py-2 text-xs font-semibold text-purple-700">
                      Refreshing latest tournament history...
                    </div>
                  )}
                  {showHistorySkeleton ? (
                    <LoadingRows rows={4} />
                  ) : displayTournamentHistory.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      <History size={48} className="mx-auto mb-4 text-gray-300" />
                      <p>No tournament history yet</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {displayTournamentHistory.map((tournament, index) => {
                        const tournamentId = tournament.id || tournament.appwriteId;
                        const deletePending = Boolean(tournamentId && isPendingAction(`setup.delete-tournament.${String(tournamentId)}`));
                        return (
                          <div key={tournamentId || `${tournament.name || 'history'}-${index}`} className="border-2 border-gray-200 rounded-xl p-4 hover:border-purple-300 transition-all bg-gradient-to-r from-white to-gray-50 history-entry-card">
                            <div className="flex items-start justify-between gap-3 mb-3">
                              <div className="flex-1 min-w-0">
                                <h4 className="font-bold text-lg text-gray-800 mb-1">{tournament.name}</h4>
                                <p className="text-xs text-gray-500">{tournament.date} • {tournament.teams?.length || 0} teams</p>
                              </div>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => setSelectedTournament(tournament)}
                                  className="text-blue-600 hover:text-blue-700 text-xs px-3 py-1 rounded-lg hover:bg-blue-50 transition-all font-semibold whitespace-nowrap"
                                >
                                  View
                                </button>
                                {canDeleteActions && (
                                  <button
                                    onClick={() => onDeleteTournament?.(tournamentId)}
                                    disabled={!tournamentId || deletePending}
                                    className="text-red-500 hover:text-red-700 text-xs px-3 py-1 rounded-lg hover:bg-red-50 transition-all font-semibold whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    {deletePending ? 'Deleting...' : 'Delete'}
                                  </button>
                                )}
                              </div>
                            </div>
                            {tournament.champion && (
                              <div className="flex items-center gap-3 bg-gradient-to-r from-yellow-50 to-orange-50 p-3 rounded-lg border-2 border-yellow-200 history-champion-card">
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
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Casual Match History Modal */}
      {showCasualHistory && (
        <>
          {isMobileViewport ? (
            <MobileBottomSheet
              open={showCasualHistory}
              title="Casual Match History"
              subtitle={`${displayCasualMatches.length} matches`}
              onClose={() => setShowCasualHistory(false)}
              sheetClassName="casual-history-shell"
            >
              {casualLoading && displayCasualMatches.length > 0 && (
                <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
                  Refreshing latest casual matches...
                </div>
              )}
              {showCasualSkeleton ? (
                <LoadingRows rows={4} />
              ) : displayCasualMatches.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Calendar size={48} className="mx-auto mb-4 text-gray-300" />
                  <p>No casual match history yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {displayCasualMatches.map((match, index) => {
                    const team1Name = formatCasualTeam(match.team1);
                    const team2Name = formatCasualTeam(match.team2);
                    const score1 = Number(match.score1);
                    const score2 = Number(match.score2);
                    const isTeam1Winner = score1 > score2;
                    const matchId = match.id || match.appwriteId;
                    const deletePending = Boolean(matchId && isPendingAction(`setup.delete-casual.${String(matchId)}`));
                    return (
                      <div key={matchId || index} className="border-2 border-gray-200 rounded-xl p-4 bg-gradient-to-r from-white to-gray-50 casual-history-card">
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="min-w-0">
                            <p className="text-xs text-gray-500 mb-1 casual-history-meta">
                              {match.matchType === 'doubles' ? '👥 Doubles' : '🎯 Singles'} • {new Date(match.date || match.createdAt || Date.now()).toLocaleString()}
                            </p>
                            <p className="font-semibold text-gray-800 truncate">
                              <span className={isTeam1Winner ? 'text-green-700' : ''}>{team1Name}</span> vs <span className={!isTeam1Winner ? 'text-green-700' : ''}>{team2Name}</span>
                            </p>
                            <p className="text-sm text-gray-700 mt-1 casual-history-score">Score: {score1} - {score2}</p>
                          </div>
                          {canDeleteActions && (
                            <button
                              onClick={() => onDeleteCasualMatch?.(matchId)}
                              disabled={!matchId || deletePending}
                              className="text-red-500 hover:text-red-700 text-xs px-3 py-1 rounded-lg hover:bg-red-50 transition-all font-semibold whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed casual-history-delete-btn"
                            >
                              {deletePending ? 'Deleting...' : 'Delete'}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </MobileBottomSheet>
          ) : (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[240] p-4 app-overlay">
              <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden casual-history-shell app-modal-shell">
                <div className="app-gradient-band p-6 flex items-center justify-between setup-modal-header setup-modal-header-casual">
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
                  {casualLoading && displayCasualMatches.length > 0 && (
                    <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
                      Refreshing latest casual matches...
                    </div>
                  )}
                  {showCasualSkeleton ? (
                    <LoadingRows rows={4} />
                  ) : displayCasualMatches.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      <Calendar size={48} className="mx-auto mb-4 text-gray-300" />
                      <p>No casual match history yet</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {displayCasualMatches.map((match, index) => {
                        const team1Name = formatCasualTeam(match.team1);
                        const team2Name = formatCasualTeam(match.team2);
                        const score1 = Number(match.score1);
                        const score2 = Number(match.score2);
                        const isTeam1Winner = score1 > score2;
                        const matchId = match.id || match.appwriteId;
                        const deletePending = Boolean(matchId && isPendingAction(`setup.delete-casual.${String(matchId)}`));
                        return (
                          <div key={matchId || index} className="border-2 border-gray-200 rounded-xl p-4 bg-gradient-to-r from-white to-gray-50 casual-history-card">
                            <div className="flex items-start justify-between gap-3 mb-2">
                              <div className="min-w-0">
                                <p className="text-xs text-gray-500 mb-1 casual-history-meta">
                                  {match.matchType === 'doubles' ? '👥 Doubles' : '🎯 Singles'} • {new Date(match.date || match.createdAt || Date.now()).toLocaleString()}
                                </p>
                                <p className="font-semibold text-gray-800 truncate">
                                  <span className={isTeam1Winner ? 'text-green-700' : ''}>{team1Name}</span> vs <span className={!isTeam1Winner ? 'text-green-700' : ''}>{team2Name}</span>
                                </p>
                                <p className="text-sm text-gray-700 mt-1 casual-history-score">Score: {score1} - {score2}</p>
                              </div>
                              {canDeleteActions && (
                                <button
                                  onClick={() => onDeleteCasualMatch?.(matchId)}
                                  disabled={!matchId || deletePending}
                                  className="text-red-500 hover:text-red-700 text-xs px-3 py-1 rounded-lg hover:bg-red-50 transition-all font-semibold whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed casual-history-delete-btn"
                                >
                                  {deletePending ? 'Deleting...' : 'Delete'}
                                </button>
                              )}
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
        </>
      )}

      {/* All-Time Stats Modal */}
      {showAllTimeStats && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[240] p-4 app-overlay">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[80vh] overflow-hidden setup-stats-modal-shell app-modal-shell">
            <div className="app-gradient-band p-6 flex items-center justify-between setup-modal-header setup-modal-header-stats">
              <h3 className="text-2xl font-bold text-white flex items-center gap-2 app-section-heading">
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
              {statsLoading && displayAllTimeStats.length > 0 && (
                <div className="mx-4 mt-4 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-xs font-semibold text-orange-700">
                  Refreshing latest statistics...
                </div>
              )}
              {showStatsSkeleton ? (
                <div className="p-6">
                  <LoadingRows rows={5} />
                </div>
              ) : displayAllTimeStats.length === 0 ? (
                <div className="p-12 text-center text-gray-500">
                  <TrendingUp size={48} className="mx-auto mb-4 text-gray-300" />
                  <p>No player statistics available yet</p>
                </div>
              ) : (
                <>
                  <div className="mobile-leaderboard-cards p-4">
                    {displayAllTimeStats.map((player, index) => (
                      <article key={`stats-modal-card-${player.name}`} className="leaderboard-mobile-card app-surface-card app-card-tier-secondary">
                        <div className="leaderboard-mobile-top">
                          <span className={`leaderboard-rank-badge ${index < 3 ? 'leaderboard-rank-badge-podium' : ''}`}>#{index + 1}</span>
                          <span className="leaderboard-stat-chip">🏆 {player.championships}</span>
                        </div>
                        <div className="leaderboard-mobile-team">
                          <PlayerAvatar name={player.name} photoUrl={playerPhotos[player.name]} size="sm" />
                          <button
                            type="button"
                            onClick={() => setSelectedPlayerName(player.name)}
                            className="font-bold text-sm text-blue-700 hover:text-blue-900 hover:underline"
                          >
                            {player.name}
                          </button>
                        </div>
                        <div className="leaderboard-mobile-metrics">
                          <span className="leaderboard-stat-chip">Tours {player.tournamentsPlayed}</span>
                          <span className="leaderboard-stat-chip">Played {player.matchesPlayed}</span>
                          <span className="leaderboard-stat-chip leaderboard-stat-chip-up">Won {player.matchesWon}</span>
                        </div>
                        <div className="leaderboard-mobile-bottom">
                          <span className="leaderboard-form-chip leaderboard-form-chip-up">Win {player.winPercentage}%</span>
                        </div>
                      </article>
                    ))}
                  </div>

                  <div className="dense-table-shell overflow-x-auto">
                    <table className="w-full min-w-[760px]">
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
                        {displayAllTimeStats.map((player, index) => (
                          <tr key={player.name} className="border-b border-gray-200 hover:bg-gray-50">
                            <td className="px-4 py-4 text-center">
                              <span className={`leaderboard-rank-badge ${index < 3 ? 'leaderboard-rank-badge-podium' : ''}`}>#{index + 1}</span>
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
                              <span className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full font-bold text-sm stats-win-badge">
                                {player.winPercentage}%
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ELO Leaderboard Modal */}
      {showEloLeaderboard && (
        <>
          {isMobileViewport ? (
            <MobileBottomSheet
              open={showEloLeaderboard}
              title="ELO Rating Leaderboard"
              subtitle={`${displayEloLeaderboard.length} players`}
              onClose={() => setShowEloLeaderboard(false)}
              sheetClassName="setup-elo-modal-shell"
            >
              {statsLoading && displayEloLeaderboard.length > 0 && (
                <div className="mx-1 mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
                  Refreshing latest ELO rankings...
                </div>
              )}
              {showEloSkeleton ? (
                <LoadingRows rows={5} />
              ) : displayEloLeaderboard.length === 0 ? (
                <div className="p-12 text-center text-gray-500">
                  <Trophy size={48} className="mx-auto mb-4 text-gray-300" />
                  <p>No ELO ratings yet. Complete matches to build the leaderboard!</p>
                </div>
              ) : (
                <>
                  <div className="mobile-leaderboard-cards p-1">
                    {displayEloLeaderboard.map((player, index) => {
                      const lastMatch = player.history && player.history.length > 0 ? player.history[player.history.length - 1] : null;
                      const delta = Number(lastMatch?.change || 0);
                      const trendMeta = eloFormMetaByPlayer.get(player.name) || buildFormSummary([]);
                      const moveTone = delta > 0 ? 'up' : delta < 0 ? 'down' : 'neutral';
                      return (
                        <article key={`elo-modal-card-${player.name}`} className="leaderboard-mobile-card app-surface-card app-card-tier-secondary">
                          <div className="leaderboard-mobile-top">
                            <span className={`leaderboard-rank-badge ${index < 3 ? 'leaderboard-rank-badge-podium' : ''}`}>#{index + 1}</span>
                            <span className={`leaderboard-move-chip leaderboard-move-chip-${moveTone}`}>
                              {delta > 0 ? <ArrowUpRight size={13} /> : delta < 0 ? <ArrowDownRight size={13} /> : <Minus size={13} />}
                              <span>{delta > 0 ? '+' : ''}{delta}</span>
                            </span>
                          </div>
                          <div className="leaderboard-mobile-team">
                            <PlayerAvatar name={player.name} photoUrl={playerPhotos[player.name]} size="sm" />
                            <button
                              type="button"
                              onClick={() => setSelectedPlayerName(player.name)}
                              className="font-bold text-sm text-blue-700 hover:text-blue-900 hover:underline truncate"
                            >
                              {player.name}
                            </button>
                          </div>
                          <div className="leaderboard-mobile-metrics">
                            <span className={`leaderboard-stat-chip ${player.rating >= 1200 ? 'leaderboard-stat-chip-up' : ''}`}>ELO {player.rating}</span>
                            <span className="leaderboard-stat-chip">Matches {player.matchesPlayed}</span>
                          </div>
                          <div className="leaderboard-mobile-bottom">
                            <span className={`leaderboard-form-chip leaderboard-form-chip-${trendMeta.tone}`}>Form {trendMeta.label}</span>
                            {eloGamificationMap[player.name]?.level && (
                              <span className="leaderboard-tier-chip">
                                <Sparkles size={11} />
                                <span>{eloGamificationMap[player.name].level.name}</span>
                              </span>
                            )}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                  <div className="dense-table-shell overflow-x-auto mt-3">
                    <table className="w-full min-w-[760px] elo-table-polished">
                      <thead className="bg-gray-100 sticky top-0">
                        <tr>
                          <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">Rank</th>
                          <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">Player</th>
                          <th className="px-4 py-3 text-center text-sm font-bold text-gray-700">Rating</th>
                          <th className="px-4 py-3 text-center text-sm font-bold text-gray-700">Matches</th>
                          <th className="px-4 py-3 text-center text-sm font-bold text-gray-700">Move</th>
                          <th className="px-4 py-3 text-center text-sm font-bold text-gray-700">Form</th>
                          <th className="px-4 py-3 text-center text-sm font-bold text-gray-700">Δ ELO</th>
                        </tr>
                      </thead>
                      <tbody>
                        {displayEloLeaderboard.map((player, index) => {
                          const lastMatch = player.history && player.history.length > 0 ? player.history[player.history.length - 1] : null;
                          const delta = Number(lastMatch?.change || 0);
                          const trendMeta = eloFormMetaByPlayer.get(player.name) || buildFormSummary([]);
                          const moveTone = delta > 0 ? 'up' : delta < 0 ? 'down' : 'neutral';
                          return (
                            <tr key={player.name} className="border-b border-gray-200 hover:bg-gray-50">
                              <td className="px-4 py-4 text-center">
                                <span className={`leaderboard-rank-badge ${index < 3 ? 'leaderboard-rank-badge-podium' : ''}`}>#{index + 1}</span>
                              </td>
                              <td className="px-4 py-4">
                                <div className="flex items-center gap-2 min-w-0 elo-player-cell">
                                  <PlayerAvatar name={player.name} photoUrl={playerPhotos[player.name]} size="sm" />
                                  <button
                                    type="button"
                                    onClick={() => setSelectedPlayerName(player.name)}
                                    className="font-bold text-blue-700 hover:text-blue-900 hover:underline truncate min-w-0 elo-player-name"
                                  >
                                    {player.name}
                                  </button>
                                  {eloGamificationMap[player.name]?.level && (
                                    <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-100 px-1.5 py-0.5 rounded-full elo-level-badge elo-level-inline max-w-[140px] truncate">
                                      {eloGamificationMap[player.name].level.icon} {eloGamificationMap[player.name].level.name}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-4 text-center">
                                <span className={`px-3 py-1 rounded-full font-bold text-sm elo-rating-chip ${
                                  player.rating >= 1200 ? 'elo-rating-gold' :
                                  player.rating >= 1000 ? 'elo-rating-green' :
                                  'elo-rating-neutral'
                                }`}>
                                  {player.rating}
                                </span>
                              </td>
                              <td className="px-4 py-4 text-center font-semibold">{player.matchesPlayed}</td>
                              <td className="px-4 py-4 text-center">
                                <span className={`leaderboard-move-chip leaderboard-move-chip-${moveTone}`}>
                                  {delta > 0 ? <ArrowUpRight size={13} /> : delta < 0 ? <ArrowDownRight size={13} /> : <Minus size={13} />}
                                  <span>{delta > 0 ? '+' : ''}{delta}</span>
                                </span>
                              </td>
                              <td className="px-4 py-4 text-center">
                                <span className={`leaderboard-form-chip leaderboard-form-chip-${trendMeta.tone}`}>{trendMeta.label}</span>
                              </td>
                              <td className="px-4 py-4 text-center">
                                <span className={`rank-change-indicator ${delta > 0 ? 'rank-change-up text-green-600' : delta < 0 ? 'rank-change-down text-red-600' : ''}`}>
                                  {delta > 0 ? '+' : ''}{delta}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </MobileBottomSheet>
          ) : (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[240] p-4 app-overlay">
              <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[80vh] overflow-hidden setup-elo-modal-shell app-modal-shell">
                <div className="app-gradient-band p-6 flex items-center justify-between setup-modal-header setup-modal-header-elo">
                  <h3 className="text-2xl font-bold text-white flex items-center gap-2 app-section-heading">
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
                  {statsLoading && displayEloLeaderboard.length > 0 && (
                    <div className="mx-4 mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
                      Refreshing latest ELO rankings...
                    </div>
                  )}
                  {showEloSkeleton ? (
                    <div className="p-6">
                      <LoadingRows rows={5} />
                    </div>
                  ) : displayEloLeaderboard.length === 0 ? (
                    <div className="p-12 text-center text-gray-500">
                      <Trophy size={48} className="mx-auto mb-4 text-gray-300" />
                      <p>No ELO ratings yet. Complete matches to build the leaderboard!</p>
                    </div>
                  ) : (
                    <>
                      <div className="mobile-leaderboard-cards p-4">
                        {displayEloLeaderboard.map((player, index) => {
                          const lastMatch = player.history && player.history.length > 0 ? player.history[player.history.length - 1] : null;
                          const delta = Number(lastMatch?.change || 0);
                          const trendMeta = eloFormMetaByPlayer.get(player.name) || buildFormSummary([]);
                          const moveTone = delta > 0 ? 'up' : delta < 0 ? 'down' : 'neutral';
                          return (
                            <article key={`elo-modal-card-${player.name}`} className="leaderboard-mobile-card app-surface-card app-card-tier-secondary">
                              <div className="leaderboard-mobile-top">
                                <span className={`leaderboard-rank-badge ${index < 3 ? 'leaderboard-rank-badge-podium' : ''}`}>#{index + 1}</span>
                                <span className={`leaderboard-move-chip leaderboard-move-chip-${moveTone}`}>
                                  {delta > 0 ? <ArrowUpRight size={13} /> : delta < 0 ? <ArrowDownRight size={13} /> : <Minus size={13} />}
                                  <span>{delta > 0 ? '+' : ''}{delta}</span>
                                </span>
                              </div>
                              <div className="leaderboard-mobile-team">
                                <PlayerAvatar name={player.name} photoUrl={playerPhotos[player.name]} size="sm" />
                                <button
                                  type="button"
                                  onClick={() => setSelectedPlayerName(player.name)}
                                  className="font-bold text-sm text-blue-700 hover:text-blue-900 hover:underline truncate"
                                >
                                  {player.name}
                                </button>
                              </div>
                              <div className="leaderboard-mobile-metrics">
                                <span className={`leaderboard-stat-chip ${player.rating >= 1200 ? 'leaderboard-stat-chip-up' : ''}`}>ELO {player.rating}</span>
                                <span className="leaderboard-stat-chip">Matches {player.matchesPlayed}</span>
                              </div>
                              <div className="leaderboard-mobile-bottom">
                                <span className={`leaderboard-form-chip leaderboard-form-chip-${trendMeta.tone}`}>Form {trendMeta.label}</span>
                                {eloGamificationMap[player.name]?.level && (
                                  <span className="leaderboard-tier-chip">
                                    <Sparkles size={11} />
                                    <span>{eloGamificationMap[player.name].level.name}</span>
                                  </span>
                                )}
                              </div>
                            </article>
                          );
                        })}
                      </div>

                      <div className="dense-table-shell overflow-x-auto">
                        <table className="w-full min-w-[760px] elo-table-polished">
                          <thead className="bg-gray-100 sticky top-0">
                            <tr>
                              <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">Rank</th>
                              <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">Player</th>
                              <th className="px-4 py-3 text-center text-sm font-bold text-gray-700">Rating</th>
                              <th className="px-4 py-3 text-center text-sm font-bold text-gray-700">Matches</th>
                              <th className="px-4 py-3 text-center text-sm font-bold text-gray-700">Move</th>
                              <th className="px-4 py-3 text-center text-sm font-bold text-gray-700">Form</th>
                              <th className="px-4 py-3 text-center text-sm font-bold text-gray-700">Δ ELO</th>
                            </tr>
                          </thead>
                          <tbody>
                            {displayEloLeaderboard.map((player, index) => {
                              const lastMatch = player.history && player.history.length > 0 ? player.history[player.history.length - 1] : null;
                              const delta = Number(lastMatch?.change || 0);
                              const trendMeta = eloFormMetaByPlayer.get(player.name) || buildFormSummary([]);
                              const moveTone = delta > 0 ? 'up' : delta < 0 ? 'down' : 'neutral';
                              return (
                                <tr key={player.name} className="border-b border-gray-200 hover:bg-gray-50">
                                  <td className="px-4 py-4 text-center">
                                    <span className={`leaderboard-rank-badge ${index < 3 ? 'leaderboard-rank-badge-podium' : ''}`}>#{index + 1}</span>
                                  </td>
                                  <td className="px-4 py-4">
                                    <div className="flex items-center gap-2 min-w-0 elo-player-cell">
                                      <PlayerAvatar name={player.name} photoUrl={playerPhotos[player.name]} size="sm" />
                                      <button
                                        type="button"
                                        onClick={() => setSelectedPlayerName(player.name)}
                                        className="font-bold text-blue-700 hover:text-blue-900 hover:underline truncate min-w-0 elo-player-name"
                                      >
                                        {player.name}
                                      </button>
                                      {eloGamificationMap[player.name]?.level && (
                                        <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-100 px-1.5 py-0.5 rounded-full elo-level-badge elo-level-inline max-w-[140px] truncate">
                                          {eloGamificationMap[player.name].level.icon} {eloGamificationMap[player.name].level.name}
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-4 py-4 text-center">
                                    <span className={`px-3 py-1 rounded-full font-bold text-sm elo-rating-chip ${
                                      player.rating >= 1200 ? 'elo-rating-gold' :
                                      player.rating >= 1000 ? 'elo-rating-green' :
                                      'elo-rating-neutral'
                                    }`}>
                                      {player.rating}
                                    </span>
                                  </td>
                                  <td className="px-4 py-4 text-center font-semibold">{player.matchesPlayed}</td>
                                  <td className="px-4 py-4 text-center">
                                    <span className={`leaderboard-move-chip leaderboard-move-chip-${moveTone}`}>
                                      {delta > 0 ? <ArrowUpRight size={13} /> : delta < 0 ? <ArrowDownRight size={13} /> : <Minus size={13} />}
                                      <span>{delta > 0 ? '+' : ''}{delta}</span>
                                    </span>
                                  </td>
                                  <td className="px-4 py-4 text-center">
                                    <span className={`leaderboard-form-chip leaderboard-form-chip-${trendMeta.tone}`}>{trendMeta.label}</span>
                                  </td>
                                  <td className="px-4 py-4 text-center">
                                    <span className={`rank-change-indicator ${delta > 0 ? 'rank-change-up text-green-600' : delta < 0 ? 'rank-change-down text-red-600' : ''}`}>
                                      {delta > 0 ? '+' : ''}{delta}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
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
        leaderboardRank={selectedPlayerLeaderboardRank}
        photoUrl={selectedPlayerName ? playerPhotos[selectedPlayerName] : ''}
        isLinked={selectedPlayerIsLinked}
        canEditPhoto={selectedPlayerCanEditPhoto}
        tournamentHistory={displayTournamentHistory}
        casualMatches={displayCasualMatches}
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
