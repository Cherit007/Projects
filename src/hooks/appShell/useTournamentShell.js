export const useTournamentShell = ({
  step,
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
  setStep,
  teams,
  setTeams,
  loading,
  oddPlayerEnabled,
  setOddPlayerEnabled,
  oddPlayerName,
  setOddPlayerName,
  fixtures,
  bracket,
  champion,
  members,
  playerDatabase,
  playerRatings,
  tournamentHistory,
  currentTournamentId,
  casualMatches,
  aiMatchSummaries,
  playerPhotos,
  swapHistory,
  tournamentTemplates,
  scheduledTournaments,
  activeLiveTournaments,
  setupModals,
  historyHydrated,
  casualHydrated,
  historyHydrationPending,
  casualHydrationPending,
  isAppwriteEnabled,
  isSyncing,
  isMobileViewport,
  syncStatus,
  lastDataUpdatedAt,
  realtimeConnected,
  canDelete,
  cumulativeAllTimeStats,
  eloLeaderboard,
  pairingAnalytics,
  formPowerRankings,
  teamNameDatabase,
  withActionLock,
  isActionPending,
  updatePlayerPhoto,
  canEditOwnProfile,
  handleStartTournament,
  handleEditScheduledTournament,
  handleStartScheduledTournament,
  handleViewScheduledTournament,
  onShareScheduledTournament,
  handleResumeActiveTournament,
  handleDeleteActiveTournament,
  handleOpenHistoryModal,
  addMember,
  deleteMember,
  handleOpenCasualHistoryModal,
  handleOpenAllTimeStatsModal,
  handleOpenEloModal,
  saveTournamentTemplate,
  applyTournamentTemplate,
  deleteTournamentTemplate,
  handleDeleteTournamentWithHydration,
  handleDeleteCasualWithHydration,
  generateFixtures,
  scheduleTournament,
  saveMatchResult,
  prioritizeMatch,
  saveBracketMatchResult,
  saveFinalResult,
  swapTeamMember,
  handleHeaderGoHome,
  handleResetTournamentWithHydration,
  rerunTournament,
  startNextTournament,
  handleRefreshTournamentFromCloud,
  saveCasualMatch,
  updatePlayerDatabase,
  setShowCasualMatch,
  activeGroup,
}) => {
  const {
    showHistory = false,
    setShowHistory = () => {},
    showCasualHistory = false,
    setShowCasualHistory = () => {},
    showAllTimeStats = false,
    setShowAllTimeStats = () => {},
    showEloLeaderboard = false,
    setShowEloLeaderboard = () => {},
  } = setupModals || {};

  const viewerDashboardProps = {
    group: activeGroup,
    tournamentName,
    tournamentFormat,
    step,
    champion,
    fixtures,
    bracket,
    tournamentHistory,
    allTimeStats: cumulativeAllTimeStats,
    eloLeaderboard,
  };

  const setupScreenProps = {
    step,
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
    onNext: async (rawNumTeamsInput) => withActionLock(
      'setup.start-tournament',
      () => handleStartTournament(rawNumTeamsInput)
    ),
    tournamentHistory,
    scheduledTournaments,
    activeLiveTournaments,
    onEditScheduledTournament: async (tournamentId) => withActionLock(
      `setup.edit-scheduled.${String(tournamentId || '')}`,
      () => handleEditScheduledTournament(tournamentId)
    ),
    onStartScheduledTournament: async (tournamentId) => withActionLock(
      `setup.start-scheduled.${String(tournamentId || '')}`,
      () => handleStartScheduledTournament(tournamentId)
    ),
    onViewScheduledTournament: async (tournamentId, fallbackTournament) => withActionLock(
      `setup.view-scheduled.${String(tournamentId || '')}`,
      () => handleViewScheduledTournament(tournamentId, fallbackTournament)
    ),
    onShareScheduledTournament,
    onResumeActiveTournament: async (tournamentId) => withActionLock(
      `setup.resume-live.${String(tournamentId || 'active')}`,
      () => handleResumeActiveTournament(tournamentId)
    ),
    onDeleteActiveTournament: async (tournamentId) => withActionLock(
      `setup.delete-live.${String(tournamentId || 'active')}`,
      () => handleDeleteActiveTournament(tournamentId)
    ),
    canDeleteLiveTournament: canDelete,
    canDeleteActions: canDelete,
    casualMatches,
    playerDatabase,
    teamNameDatabase,
    showHistory,
    setShowHistory: (value) => {
      if (!value) {
        setShowHistory(false);
        return;
      }
      void handleOpenHistoryModal();
    },
    members,
    onAddMember: addMember,
    onDeleteMember: deleteMember,
    showCasualHistory,
    setShowCasualHistory: (value) => {
      if (!value) {
        setShowCasualHistory(false);
        return;
      }
      void handleOpenCasualHistoryModal();
    },
    showAllTimeStats,
    setShowAllTimeStats: (value) => {
      if (!value) {
        setShowAllTimeStats(false);
        return;
      }
      void handleOpenAllTimeStatsModal();
    },
    showEloLeaderboard,
    setShowEloLeaderboard: (value) => {
      if (!value) {
        setShowEloLeaderboard(false);
        return;
      }
      void handleOpenEloModal();
    },
    tournamentTemplates,
    onSaveTemplate: saveTournamentTemplate,
    onApplyTemplate: applyTournamentTemplate,
    onDeleteTemplate: deleteTournamentTemplate,
    onDeleteTournament: async (tournamentId) => withActionLock(
      `setup.delete-tournament.${String(tournamentId || '')}`,
      () => handleDeleteTournamentWithHydration(tournamentId)
    ),
    onDeleteCasualMatch: async (matchId) => withActionLock(
      `setup.delete-casual.${String(matchId || '')}`,
      () => handleDeleteCasualWithHydration(matchId)
    ),
    allTimeStats: cumulativeAllTimeStats,
    eloLeaderboard,
    playerRatings,
    pairingAnalytics,
    formPowerRankings,
    playerPhotos,
    onUpdatePlayerPhoto: updatePlayerPhoto,
    canEditPlayerPhoto: canEditOwnProfile,
    isAppwriteEnabled,
    isSyncing,
    historyHydrated,
    casualHydrated,
    historyHydrationPending,
    casualHydrationPending,
    getActionPending: isActionPending,
    syncStatus,
    lastDataUpdatedAt,
    realtimeConnected,
    isMobileViewport,
  };

  const teamEntryProps = {
    step,
    teams,
    setTeams,
    gameMode,
    playerDatabase,
    teamNameDatabase,
    onGenerate: async (params) => withActionLock(
      'teams.generate',
      () => generateFixtures(params)
    ),
    loading,
    oddPlayerEnabled,
    setOddPlayerEnabled,
    oddPlayerName,
    setOddPlayerName,
    onBack: () => setStep('setup'),
    onSchedule: async (params) => withActionLock(
      'teams.schedule',
      () => scheduleTournament(params)
    ),
    getActionPending: isActionPending,
  };

  const tournamentViewProps = {
    step,
    tournamentName,
    setTournamentName,
    format,
    tournamentFormat,
    fixtures,
    bracket,
    teams,
    champion,
    members,
    playerDatabase,
    playerRatings,
    gameMode,
    tournamentHistory,
    currentTournamentId,
    casualMatches,
    aiMatchSummaries,
    oddPlayerEnabled,
    oddPlayerName,
    playerPhotos,
    onUpdatePlayerPhoto: updatePlayerPhoto,
    canEditPlayerPhoto: canEditOwnProfile,
    onSaveMatchResult: async (matchId, score1, score2) => withActionLock(
      `tournament.score.${String(matchId || 'live')}`,
      () => Promise.resolve(saveMatchResult(matchId, score1, score2))
    ),
    onPrioritizeMatch: prioritizeMatch,
    onSaveBracketResult: async (matchId, score1, score2) => withActionLock(
      `tournament.bracket.${String(matchId || 'match')}`,
      () => Promise.resolve(saveBracketMatchResult(matchId, score1, score2))
    ),
    onSaveFinalResult: async (score1, score2, finalistsOverride) => withActionLock(
      'tournament.final',
      () => Promise.resolve(saveFinalResult(score1, score2, finalistsOverride))
    ),
    onSwapTeamMember: swapTeamMember,
    swapHistory,
    onGoHome: handleHeaderGoHome,
    onResetTournament: async () => withActionLock(
      'tournament.reset',
      () => handleResetTournamentWithHydration()
    ),
    onRerunTournament: async () => withActionLock(
      'tournament.rematch',
      () => Promise.resolve(rerunTournament())
    ),
    onStartNextTournament: async (options) => withActionLock(
      'tournament.next',
      () => Promise.resolve(startNextTournament(options))
    ),
    onRefreshTournament: handleRefreshTournamentFromCloud,
    getActionPending: isActionPending,
    syncStatus,
  };

  const casualMatchProps = {
    playerDatabase,
    playerRatings,
    onSaveMatch: saveCasualMatch,
    onAddPlayer: updatePlayerDatabase,
    onClose: () => setShowCasualMatch(false),
  };

  return {
    viewerDashboardProps,
    setupScreenProps,
    teamEntryProps,
    tournamentViewProps,
    casualMatchProps,
  };
};
