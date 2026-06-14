const normalizeName = (value) => String(value || '').trim();
const normalizeKey = (value) => normalizeName(value).toLowerCase();

export const buildSuggestionPlayerDatabase = ({
  members = [],
  teams = [],
  tournamentHistory = [],
  casualMatches = [],
  playerDatabase = [],
} = {}) => {
  const playerSuggestionsMap = new Map();

  const addPlayerSuggestion = (value) => {
    const normalized = normalizeName(value);
    const key = normalizeKey(normalized);
    if (!normalized || !key) return;
    if (!playerSuggestionsMap.has(key)) {
      playerSuggestionsMap.set(key, normalized);
    }
  };

  const addTeamPlayers = (team) => {
    addPlayerSuggestion(team?.player || team?.player1);
    addPlayerSuggestion(team?.player2);
  };

  const addMatchPlayers = (match) => {
    addTeamPlayers(match?.team1);
    addTeamPlayers(match?.team2);
  };

  (Array.isArray(members) ? members : []).forEach((member) => addPlayerSuggestion(member?.name));
  (Array.isArray(teams) ? teams : []).forEach(addTeamPlayers);
  (Array.isArray(tournamentHistory) ? tournamentHistory : []).forEach((tournament) => {
    (Array.isArray(tournament?.teams) ? tournament.teams : []).forEach(addTeamPlayers);
    (Array.isArray(tournament?.fixtures) ? tournament.fixtures : []).forEach(addMatchPlayers);
    (Array.isArray(tournament?.bracket) ? tournament.bracket : [])
      .flatMap((round) => (Array.isArray(round) ? round : []))
      .forEach(addMatchPlayers);
    if (tournament?.finalMatch) addMatchPlayers(tournament.finalMatch);
    if (tournament?.champion) addTeamPlayers(tournament.champion);
  });
  (Array.isArray(casualMatches) ? casualMatches : []).forEach(addMatchPlayers);

  // Keep original casing from the persisted database for already-recorded players only.
  (Array.isArray(playerDatabase) ? playerDatabase : []).forEach((name) => {
    const normalized = normalizeName(name);
    const key = normalizeKey(normalized);
    if (!normalized || !key) return;
    if (playerSuggestionsMap.has(key)) {
      playerSuggestionsMap.set(key, normalized);
    }
  });

  return Array.from(playerSuggestionsMap.values())
    .sort((left, right) => left.localeCompare(right));
};

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
  sportId,
  setSportId,
  ruleConfig,
  setRuleConfig,
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
  updateMatchSchedule,
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
  const suggestionPlayerDatabase = buildSuggestionPlayerDatabase({
    members,
    teams,
    tournamentHistory,
    casualMatches,
    playerDatabase,
  });

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
    sportId,
    setSportId,
    ruleConfig,
    setRuleConfig,
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
    playerDatabase: suggestionPlayerDatabase,
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
    sportId,
    ruleConfig,
    teams,
    setTeams,
    gameMode,
    playerDatabase: suggestionPlayerDatabase,
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
    sportId,
    ruleConfig,
    format,
    tournamentFormat,
    fixtures,
    bracket,
    teams,
    champion,
    members,
    playerDatabase: suggestionPlayerDatabase,
    playerRatings,
    gameMode,
    tournamentHistory,
    currentTournamentId,
    casualMatches,
    aiMatchSummaries,
    oddPlayerEnabled,
    oddPlayerName,
    playerPhotos,
    allTimeStats: cumulativeAllTimeStats,
    eloLeaderboard,
    onUpdatePlayerPhoto: updatePlayerPhoto,
    canEditPlayerPhoto: canEditOwnProfile,
    onSaveMatchResult: async (matchId, score1, score2, extras) => withActionLock(
      `tournament.score.${String(matchId || 'live')}`,
      () => Promise.resolve(saveMatchResult(matchId, score1, score2, extras))
    ),
    onPrioritizeMatch: prioritizeMatch,
    onUpdateMatchSchedule: async (matchId, schedule) => withActionLock(
      `tournament.schedule.${String(matchId || 'match')}`,
      () => Promise.resolve(updateMatchSchedule(matchId, schedule)),
    ),
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
    playerDatabase: suggestionPlayerDatabase,
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
