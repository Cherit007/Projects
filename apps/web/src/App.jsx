import React, { Suspense, lazy, useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, History, Moon, Plus, Sun, X } from 'lucide-react';
import AppViewRouter from './components/AppViewRouter';
import MobileBottomNav from './components/MobileBottomNav';
import Toast from './components/Toast';
import PwaControls from './components/PwaControls';
import PwaUpdatePrompt from './components/PwaUpdatePrompt';
import ConfirmActionModal from './components/ConfirmActionModal';
import { useAppwriteSync } from './hooks/useAppwriteSync';
import { usePlayerDerivedData } from './hooks/usePlayerDerivedData';
import { useGroupShell } from './hooks/appShell/useGroupShell';
import { useHomeData } from './hooks/appShell/useHomeData';
import { useTournamentShell } from './hooks/appShell/useTournamentShell';
import { useTournamentLifecycleActions } from './hooks/appShell/useTournamentLifecycleActions';
import { useMobileShellActions } from './hooks/appShell/useMobileShellActions';
import { useScheduledTournamentCleanupEffect } from './hooks/appShell/useScheduledTournamentCleanupEffect';
import { useSetupHydrationRetryEffect } from './hooks/appShell/useSetupHydrationRetryEffect';
import { useTournamentActions } from './hooks/useTournamentActions';
import { useAuthBootstrapEffect } from './hooks/useAuthBootstrapEffect';
import { useInitialDataLoadEffect } from './hooks/useInitialDataLoadEffect';
import { useMemberLinkEffect } from './hooks/useMemberLinkEffect';
import { useAdminRequestsEffect } from './hooks/useAdminRequestsEffect';
import { useDashboardDerivedData } from './hooks/useDashboardDerivedData';
import { useModalManager } from './hooks/useModalManager';
import { useRealtimeCacheSync } from './hooks/useRealtimeCacheSync';
import { useHashAppRoute } from './hooks/useHashAppRoute';
import { useThemeMode } from './hooks/useThemeMode';
import { useMobileViewport } from './hooks/useMobileViewport';
import { useAppKeyboardShortcuts } from './hooks/useAppKeyboardShortcuts';
import { hydratePlayerPhotos, usePlayerPhotoActions } from './hooks/usePlayerPhotoActions';
import { useTemplateActions } from './hooks/useTemplateActions';
import { useMemberAdminActions } from './hooks/useMemberAdminActions';
import { useAppStoreShallow } from './store/appStore';
import { STORAGE_KEYS } from './platform/storageKeys';
import { tournamentService } from './services/tournamentService';
import { queueLocalStorageJson } from './services/localStorageWriteService';
import {
  calculatePointsTable,
  getPlayerLeaderboard,
} from '@fixture-maker/domain/scoring';
import { calculatePlayerStats } from '@fixture-maker/domain/stats';
import { queryKeys } from './config/queryKeys';
import {
  applyMemberAccountLinks,
  buildRatingsDelta,
  buildTournamentFromLock,
  cloneRatingsSnapshot,
  dedupeLiveTournaments,
  deriveRatingsFromHistory,
  findActiveTournament,
  matchesTournamentId,
  mergeMemberLinks,
  normalizeTemplateTeams,
  normalizeTournamentFormat,
  normalizeTournamentName,
  removeTournamentFromList,
} from './utils/appHelpers';
import { clearAutoResumeSuppressedTournamentId } from './utils/autoResumePreference';
import { DEFAULT_SPORT_ID, getSport, getSportPlugin } from '@fixture-maker/domain/sports';
import { createEmptySquadTeam, syncLegacyPlayersFromSquad } from '@fixture-maker/domain/sports/boxCricket/squadUtils';

const AppModals = lazy(() => import('./components/AppModals'));

const App = () => {
  const queryClient = useQueryClient();
  const { themeMode, toggleThemeMode } = useThemeMode();
  const isMobileViewport = useMobileViewport();

  const cloneSerializable = (value) => {
    if (value === null || value === undefined) return value;
    try {
      return JSON.parse(JSON.stringify(value));
    } catch {
      return value;
    }
  };

  // State
  const {
    step,
    setStep,
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
    teams,
    setTeams,
    fixtures,
    setFixtures,
    bracket,
    setBracket,
    champion,
    setChampion,
    loading,
    setLoading,
  } = useAppStoreShallow((s) => ({
    step: s.step,
    setStep: s.setStep,
    tournamentName: s.tournamentName,
    setTournamentName: s.setTournamentName,
    numTeams: s.numTeams,
    setNumTeams: s.setNumTeams,
    format: s.format,
    setFormat: s.setFormat,
    gameMode: s.gameMode,
    setGameMode: s.setGameMode,
    sportId: s.sportId,
    setSportId: s.setSportId,
    ruleConfig: s.ruleConfig,
    setRuleConfig: s.setRuleConfig,
    tournamentFormat: s.tournamentFormat,
    setTournamentFormat: s.setTournamentFormat,
    teams: s.teams,
    setTeams: s.setTeams,
    fixtures: s.fixtures,
    setFixtures: s.setFixtures,
    bracket: s.bracket,
    setBracket: s.setBracket,
    champion: s.champion,
    setChampion: s.setChampion,
    loading: s.loading,
    setLoading: s.setLoading,
  }));
  const [toast, setToast] = useState(null);
  const {
    showCasualMatch,
    setShowCasualMatch,
    showHistory,
    setShowHistory,
    showCasualHistory,
    setShowCasualHistory,
    showAllTimeStats,
    setShowAllTimeStats,
    showEloLeaderboard,
    setShowEloLeaderboard,
    mobileSetupView,
    setMobileSetupView,
    pendingLinkPrompt,
    setPendingLinkPrompt,
    showProfileModal,
    setShowProfileModal,
    showUtilityDrawer,
    setShowUtilityDrawer,
    confirmDialog,
    requestConfirmAction,
    resolveConfirmDialog,
    setupModals,
  } = useModalManager();
  const {
    playerDatabase,
    setPlayerDatabase,
    members,
    setMembers,
    playerRatings,
    setPlayerRatings,
    tournamentHistory,
    setTournamentHistory,
    casualMatches,
    setCasualMatches,
    tournamentTemplates,
    setTournamentTemplates,
    playerPhotos,
    setPlayerPhotos,
    playerPhotoRefs,
    setPlayerPhotoRefs,
    pendingPrefilledTeams,
    setPendingPrefilledTeams,
    aiMatchSummaries,
    setAiMatchSummaries,
    swapHistory,
    setSwapHistory,
  } = useAppStoreShallow((s) => ({
    playerDatabase: s.playerDatabase,
    setPlayerDatabase: s.setPlayerDatabase,
    members: s.members,
    setMembers: s.setMembers,
    playerRatings: s.playerRatings,
    setPlayerRatings: s.setPlayerRatings,
    tournamentHistory: s.tournamentHistory,
    setTournamentHistory: s.setTournamentHistory,
    casualMatches: s.casualMatches,
    setCasualMatches: s.setCasualMatches,
    tournamentTemplates: s.tournamentTemplates,
    setTournamentTemplates: s.setTournamentTemplates,
    playerPhotos: s.playerPhotos,
    setPlayerPhotos: s.setPlayerPhotos,
    playerPhotoRefs: s.playerPhotoRefs,
    setPlayerPhotoRefs: s.setPlayerPhotoRefs,
    pendingPrefilledTeams: s.pendingPrefilledTeams,
    setPendingPrefilledTeams: s.setPendingPrefilledTeams,
    aiMatchSummaries: s.aiMatchSummaries,
    setAiMatchSummaries: s.setAiMatchSummaries,
    swapHistory: s.swapHistory,
    setSwapHistory: s.setSwapHistory,
  }));
  const [oddPlayerEnabled, setOddPlayerEnabled] = useState(false);
  const [oddPlayerName, setOddPlayerName] = useState('');
  const {
    authLoading,
    setAuthLoading,
    authResolved,
    setAuthResolved,
    currentUser,
    setCurrentUser,
    groupResolved,
    setGroupResolved,
    availableGroups,
    setAvailableGroups,
    publicGroups,
    setPublicGroups,
    requestedGroupIds,
    setRequestedGroupIds,
    pendingJoinRequests,
    setPendingJoinRequests,
    recentJoinReviews,
    setRecentJoinReviews,
    seenPendingRequestIds,
    setSeenPendingRequestIds,
    showRequestCenter,
    setShowRequestCenter,
    activeGroup,
    setActiveGroup,
    groupRole,
    setGroupRole,
    inviteLoading,
    setInviteLoading,
    isGuestViewer,
    setIsGuestViewer,
    adminAccounts,
    setAdminAccounts,
  } = useAppStoreShallow((s) => ({
    authLoading: s.authLoading,
    setAuthLoading: s.setAuthLoading,
    authResolved: s.authResolved,
    setAuthResolved: s.setAuthResolved,
    currentUser: s.currentUser,
    setCurrentUser: s.setCurrentUser,
    groupResolved: s.groupResolved,
    setGroupResolved: s.setGroupResolved,
    availableGroups: s.availableGroups,
    setAvailableGroups: s.setAvailableGroups,
    publicGroups: s.publicGroups,
    setPublicGroups: s.setPublicGroups,
    requestedGroupIds: s.requestedGroupIds,
    setRequestedGroupIds: s.setRequestedGroupIds,
    pendingJoinRequests: s.pendingJoinRequests,
    setPendingJoinRequests: s.setPendingJoinRequests,
    recentJoinReviews: s.recentJoinReviews,
    setRecentJoinReviews: s.setRecentJoinReviews,
    seenPendingRequestIds: s.seenPendingRequestIds,
    setSeenPendingRequestIds: s.setSeenPendingRequestIds,
    showRequestCenter: s.showRequestCenter,
    setShowRequestCenter: s.setShowRequestCenter,
    activeGroup: s.activeGroup,
    setActiveGroup: s.setActiveGroup,
    groupRole: s.groupRole,
    setGroupRole: s.setGroupRole,
    inviteLoading: s.inviteLoading,
    setInviteLoading: s.setInviteLoading,
    isGuestViewer: s.isGuestViewer,
    setIsGuestViewer: s.setIsGuestViewer,
    adminAccounts: s.adminAccounts,
    setAdminAccounts: s.setAdminAccounts,
  }));
  const [activeTournamentLock, setActiveTournamentLock] = useState(null);
  const linkPromptedRef = useRef(new Set());
  const previousStepRef = useRef(step);
  const toastTimerRef = useRef(null);
  const ratingsAutosaveTimerRef = useRef(null);
  const lastRatingsPersistedSignatureRef = useRef('{}');
  const lastPersistedRatingsRef = useRef({});
  const playerDbAutosaveTimerRef = useRef(null);
  const pendingPlayerDbSaveRef = useRef(null);
  const playerDbSaveInFlightRef = useRef(false);
  const [historyHydrated, setHistoryHydrated] = useState(false);
  const [casualHydrated, setCasualHydrated] = useState(false);
  const [historyHydrationPending, setHistoryHydrationPending] = useState(false);
  const [casualHydrationPending, setCasualHydrationPending] = useState(false);
  const historyHydrationPromiseRef = useRef(null);
  const casualHydrationPromiseRef = useRef(null);
  const setupHydrationRetryAtRef = useRef(0);
  const [pendingActions, setPendingActions] = useState({});
  const pendingActionsRef = useRef({});

  useAppKeyboardShortcuts({
    showUtilityDrawer,
    setShowUtilityDrawer,
    isMobileViewport,
    step,
  });

  const recoverRatingsIfMissing = ({ history = tournamentHistory, casual = casualMatches, force = false } = {}) => {
    const current = playerRatings && typeof playerRatings === 'object' ? playerRatings : {};
    const currentNames = Object.keys(current);
    const hasMeaningfulHistory = (snapshot) => (
      Array.isArray(snapshot?.history)
      && snapshot.history.some((entry) => {
        const matchId = String(entry?.matchId || '').trim();
        return matchId && matchId !== 'v2-snapshot';
      })
    );
    const playersMissingHistory = currentNames.filter((name) => !hasMeaningfulHistory(current[name]));
    const shouldRebuild = force
      || currentNames.length === 0
      || playersMissingHistory.length === currentNames.length;
    if (!shouldRebuild && playersMissingHistory.length === 0) return current;

    const rebuilt = deriveRatingsFromHistory({ history, casual });
    if (Object.keys(rebuilt).length === 0) return current;

    const merged = { ...rebuilt };
    currentNames.forEach((name) => {
      const snapshot = current[name];
      if (hasMeaningfulHistory(snapshot)) {
        merged[name] = snapshot;
        return;
      }
      if (!merged[name]) {
        merged[name] = snapshot;
      }
    });

    setPlayerRatings(merged);
    return merged;
  };

  const markRatingsPersisted = useCallback((ratings = {}) => {
    const snapshot = ratings && typeof ratings === 'object' ? ratings : {};
    if (ratingsAutosaveTimerRef.current) {
      clearTimeout(ratingsAutosaveTimerRef.current);
      ratingsAutosaveTimerRef.current = null;
    }
    lastRatingsPersistedSignatureRef.current = JSON.stringify(snapshot);
    lastPersistedRatingsRef.current = cloneRatingsSnapshot(snapshot);
  }, []);

  const showToast = useCallback((message, type = 'success') => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
    setToast({ message, type });
    toastTimerRef.current = setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, 3000);
  }, []);
  const setActionPending = useCallback((actionKey, pending) => {
    if (!actionKey) return;
    setPendingActions((prev) => {
      const next = { ...prev };
      if (pending) {
        next[actionKey] = true;
      } else {
        delete next[actionKey];
      }
      pendingActionsRef.current = next;
      return next;
    });
  }, []);

  const isActionPending = useCallback(
    (actionKey) => Boolean(actionKey && pendingActions[actionKey]),
    [pendingActions]
  );

  const withActionLock = useCallback(async (actionKey, actionFn) => {
    if (!actionKey || typeof actionFn !== 'function') return false;
    if (pendingActionsRef.current[actionKey]) return false;
    setActionPending(actionKey, true);
    try {
      const result = await actionFn();
      if (typeof result === 'undefined') return true;
      return result;
    } finally {
      setActionPending(actionKey, false);
    }
  }, [setActionPending]);
  // Appwrite Integration
  const {
    isAppwriteEnabled,
    isConfigChecked,
    isSyncing,
    queuedWritesCount,
    currentTournamentId,
    setCurrentTournamentId,
    loadFromAppwrite,
    saveTournamentToAppwrite,
    deleteTournamentFromAppwrite,
    saveRatingsToAppwrite,
    savePlayerDatabaseToAppwrite,
    saveMembersToAppwrite,
    saveTemplatesToAppwrite,
    savePlayerPhotosToAppwrite,
    saveCasualMatchToAppwrite,
    deleteCasualMatchFromAppwrite,
    syncCurrentTournament,
    patchTournamentMatches,
    saveTournamentTransactionToAppwrite = null,
    flushOfflineOutbox,
  } = useAppwriteSync(showToast, activeGroup?.id, queryClient);

  const resumeActiveTournament = useCallback((activeTournament) => {
    if (!activeTournament) return false;

    clearAutoResumeSuppressedTournamentId();
    setTournamentName(activeTournament.name || '');
    setFormat(activeTournament.format || '1');
    setGameMode(activeTournament.gameMode || 'doubles');
    setSportId(activeTournament.sportId || DEFAULT_SPORT_ID);
    setRuleConfig(activeTournament.ruleConfig || {});
    setTournamentFormat(normalizeTournamentFormat(activeTournament.tournamentFormat || activeTournament.format || 'league'));
    setTeams(cloneSerializable(activeTournament.teams || []));
    setFixtures(cloneSerializable(activeTournament.fixtures || []));
    setBracket(cloneSerializable(activeTournament.bracket || []));
    setChampion(cloneSerializable(activeTournament.champion || null));
    setAiMatchSummaries(cloneSerializable(activeTournament.aiSummaries || []));
    setSwapHistory(cloneSerializable(activeTournament.swapHistory || []));
    setCurrentTournamentId(
      activeTournament.appwriteId
      || activeTournament.id
      || activeTournament.legacyTournamentId
      || null
    );
    setStep('tournament');
    return true;
  }, [
    setAiMatchSummaries,
    setBracket,
    setChampion,
    setCurrentTournamentId,
    setFixtures,
    setFormat,
    setGameMode,
    setRuleConfig,
    setSportId,
    setStep,
    setSwapHistory,
    setTeams,
    setTournamentFormat,
    setTournamentName,
  ]);

  const {
    requiresAuth,
    canDelete,
    canManageMembers,
    isViewerMode,
    unreadRequestCount,
    assertCanOperate,
    assertCanDelete,
    assertCanManageMembers,
    fetchCurrentUser,
    refreshGroups,
    refreshPublicGroups,
    updateNameMutation,
    handleLogin,
    handleRegister,
    handleLogout,
    handleCreateGroup,
    handleRequestAccess,
    handleWatchGroup,
    handleApproveRequest,
    handleRejectRequest,
    handlePromoteMemberToAdmin,
    handleRemoveMember,
    handleDeleteGroup,
    handleOpenRequestCenter,
    handleContinueAsViewer,
    handleSelectGroup,
    handleBackToGroups,
  } = useGroupShell({
    isAppwriteEnabled,
    queryClient,
    showToast,
    currentUser,
    activeGroup,
    groupRole,
    availableGroups,
    pendingJoinRequests,
    seenPendingRequestIds,
    setAvailableGroups,
    setPublicGroups,
    setAuthLoading,
    setIsGuestViewer,
    setCurrentUser,
    setActiveGroup,
    setGroupRole,
    setRequestedGroupIds,
    setAuthResolved,
    setGroupResolved,
    setPendingJoinRequests,
    setRecentJoinReviews,
    setSeenPendingRequestIds,
    setShowRequestCenter,
    setInviteLoading,
    setAdminAccounts,
    setStep,
  });
  const refreshCloudAuxiliaryState = useCallback(async () => {
    if (!isAppwriteEnabled || !activeGroup?.id) return false;
    try {
      const appwriteData = await queryClient.fetchQuery({
        queryKey: queryKeys.appwriteData(activeGroup.id),
        queryFn: () => loadFromAppwrite({
          includeTournaments: false,
          includePlayerDatabase: true,
          includeRatings: true,
          includeMeta: true,
        }),
        staleTime: 0,
      });
      if (!appwriteData) return false;

      const nextPlayerDatabase = Array.isArray(appwriteData.playerDatabase)
        ? appwriteData.playerDatabase
        : [];
      const nextRatings = appwriteData.playerRatings && typeof appwriteData.playerRatings === 'object'
        ? appwriteData.playerRatings
        : {};
      const nextMembersRaw = Array.isArray(appwriteData.members) ? appwriteData.members : [];
      const nextMembers = applyMemberAccountLinks(
        mergeMemberLinks(nextMembersRaw, members),
        appwriteData.memberAccountLinks
      );
      const nextTemplates = (Array.isArray(appwriteData.templates) ? appwriteData.templates : []).map((template) => ({
        ...template,
        tournamentFormat: normalizeTournamentFormat(template.tournamentFormat || 'league'),
        teams: normalizeTemplateTeams(
          template.teams || [],
          template.gameMode || 'doubles',
          template.numTeams || 3
        ),
      }));
      const { urls, refs } = hydratePlayerPhotos(appwriteData.playerPhotos || {});

      setPlayerDatabase(nextPlayerDatabase);
      setPlayerRatings(nextRatings);
      markRatingsPersisted(nextRatings);
      setMembers(nextMembers);
      setTournamentTemplates(nextTemplates);
      setPlayerPhotos(urls);
      setPlayerPhotoRefs(refs);
      setActiveTournamentLock(appwriteData.activeTournament || null);
      return true;
    } catch (error) {
      console.error('Failed to refresh cloud auxiliary state:', error);
      return false;
    }
  }, [
    activeGroup?.id,
    hydratePlayerPhotos,
    isAppwriteEnabled,
    loadFromAppwrite,
    markRatingsPersisted,
    members,
    queryClient,
    setActiveTournamentLock,
    setMembers,
    setPlayerDatabase,
    setPlayerPhotoRefs,
    setPlayerPhotos,
    setPlayerRatings,
    setTournamentTemplates,
  ]);
  const {
    realtimeConnected,
    lastCachePatchAt,
  } = useRealtimeCacheSync({
    enabled: Boolean(
      isAppwriteEnabled
      && activeGroup?.id
      && (!requiresAuth || authResolved)
    ),
    activeGroupId: activeGroup?.id,
    queryClient,
    setTournamentHistory,
    setCasualMatches,
    reloadAuxiliaryState: refreshCloudAuxiliaryState,
  });
  const pendingActionCount = useMemo(
    () => Object.keys(pendingActions || {}).length,
    [pendingActions]
  );
  const [lastDataUpdatedAt, setLastDataUpdatedAt] = useState(0);
  const computeDashboardCacheUpdatedAt = useCallback(() => {
    if (!isAppwriteEnabled || !activeGroup?.id) return 0;
    const candidateKeys = [
      queryKeys.appwriteData(activeGroup?.id),
      queryKeys.tournamentSummaries(activeGroup?.id),
      queryKeys.tournamentHistory(activeGroup?.id),
      queryKeys.casualMatches(activeGroup?.id),
    ];
    return candidateKeys.reduce((max, key) => {
      const updatedAt = Number(queryClient.getQueryState(key)?.dataUpdatedAt || 0);
      return Number.isFinite(updatedAt) && updatedAt > max ? updatedAt : max;
    }, 0);
  }, [isAppwriteEnabled, activeGroup?.id, queryClient]);

  useEffect(() => {
    if (!isAppwriteEnabled || !activeGroup?.id) {
      setLastDataUpdatedAt(0);
      return undefined;
    }

    const recomputeUpdatedAt = () => {
      const cachedUpdatedAt = computeDashboardCacheUpdatedAt();
      const next = Math.max(cachedUpdatedAt, Number(lastCachePatchAt || 0));
      setLastDataUpdatedAt((prev) => (prev === next ? prev : next));
    };

    recomputeUpdatedAt();
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      const queryKey = event?.query?.queryKey;
      const rootKey = Array.isArray(queryKey) ? String(queryKey[0] || '') : '';
      if (!['appwrite', 'tournaments', 'casual-matches'].includes(rootKey)) return;
      recomputeUpdatedAt();
    });
    return unsubscribe;
  }, [
    isAppwriteEnabled,
    activeGroup?.id,
    queryClient,
    computeDashboardCacheUpdatedAt,
    lastCachePatchAt,
  ]);

  const syncStatus = useMemo(() => {
    if (!isAppwriteEnabled) {
      return {
        tone: 'local',
        label: 'Local mode',
        detail: 'Saved on this device',
        busy: pendingActionCount > 0,
      };
    }
    if (queuedWritesCount > 0) {
      return {
        tone: 'queued',
        label: `${queuedWritesCount} queued`,
        detail: 'Will sync when online',
        busy: true,
      };
    }
    if (isSyncing || pendingActionCount > 0) {
      const detail = pendingActionCount > 0
        ? `${pendingActionCount} action${pendingActionCount > 1 ? 's' : ''} in progress`
        : 'Syncing latest changes';
      return {
        tone: 'syncing',
        label: 'Syncing...',
        detail,
        busy: true,
      };
    }
    return {
      tone: 'saved',
      label: 'All changes saved',
      detail: 'Cloud sync is up to date',
      busy: false,
    };
  }, [isAppwriteEnabled, isSyncing, queuedWritesCount, pendingActionCount]);

  const createCasualMatchMutation = useMutation({
    mutationFn: (payload) => saveCasualMatchToAppwrite(payload),
  });
  const deleteCasualMatchMutation = useMutation({
    mutationFn: (id) => deleteCasualMatchFromAppwrite(id),
  });
  const saveTournamentMutation = useMutation({
    mutationFn: (payload) => saveTournamentToAppwrite(payload),
  });
  const deleteTournamentMutation = useMutation({
    mutationFn: (id) => deleteTournamentFromAppwrite(id),
  });
  const saveRatingsMutation = useMutation({
    mutationFn: (payload) => saveRatingsToAppwrite(payload),
  });
  const savePlayerDatabaseMutation = useMutation({
    mutationFn: (payload) => savePlayerDatabaseToAppwrite(payload),
  });
  const saveMembersMutation = useMutation({
    mutationFn: (payload) => saveMembersToAppwrite(payload),
  });
  const saveTemplatesMutation = useMutation({
    mutationFn: (payload) => saveTemplatesToAppwrite(payload),
  });
  const savePlayerPhotosMutation = useMutation({
    mutationFn: (payload) => savePlayerPhotosToAppwrite(payload),
  });

  const flushPlayerDatabaseToCloud = async () => {
    if (!isAppwriteEnabled || playerDbSaveInFlightRef.current) return;
    const payload = pendingPlayerDbSaveRef.current;
    if (!Array.isArray(payload)) return;

    pendingPlayerDbSaveRef.current = null;
    playerDbSaveInFlightRef.current = true;
    try {
      await savePlayerDatabaseMutation.mutateAsync(payload);
    } catch (error) {
      console.error('Failed to save player database to Appwrite:', error);
    } finally {
      playerDbSaveInFlightRef.current = false;
      if (pendingPlayerDbSaveRef.current) {
        void flushPlayerDatabaseToCloud();
      }
    }
  };

  const queuePlayerDatabaseSave = (players) => {
    pendingPlayerDbSaveRef.current = players;
    if (playerDbAutosaveTimerRef.current) {
      clearTimeout(playerDbAutosaveTimerRef.current);
    }
    playerDbAutosaveTimerRef.current = setTimeout(() => {
      playerDbAutosaveTimerRef.current = null;
      void flushPlayerDatabaseToCloud();
    }, 700);
  };

  const {
    invalidateHydrationRequests,
    pruneTournamentQueryCacheAfterDelete,
    ensureTournamentHistoryHydrated,
    ensureCasualMatchesHydrated,
  } = useHomeData({
    activeGroupId: activeGroup?.id,
    isAppwriteEnabled,
    queryClient,
    tournamentHistory,
    setTournamentHistory,
    casualMatches,
    setCasualMatches,
    showToast,
    recoverRatingsIfMissing,
    historyHydrated,
    setHistoryHydrated,
    casualHydrated,
    setCasualHydrated,
    setHistoryHydrationPending,
    setCasualHydrationPending,
    historyHydrationPromiseRef,
    casualHydrationPromiseRef,
  });
  const clearBootstrapActiveTournamentCache = useCallback(() => {
    if (!isAppwriteEnabled) return;
    queryClient.setQueryData(
      queryKeys.appwriteData(activeGroup?.id),
      (cached) => {
        if (!cached || typeof cached !== 'object') return cached;
        return {
          ...cached,
          activeTournament: null,
        };
      }
    );
  }, [isAppwriteEnabled, queryClient, activeGroup?.id]);
  useAuthBootstrapEffect({
    isConfigChecked,
    requiresAuth,
    refreshPublicGroups,
    fetchCurrentUser,
    setCurrentUser,
    setAuthResolved,
    setGroupResolved,
    setAuthLoading,
    setAvailableGroups,
    setActiveGroup,
    setGroupRole,
    refreshGroups,
    queryClient,
    queryKeys,
    setRequestedGroupIds,
  });

  useInitialDataLoadEffect({
    isConfigChecked,
    requiresAuth,
    authResolved,
    groupResolved,
    activeGroup,
    activeGroupId: activeGroup?.id,
    isAppwriteEnabled,
    queryClient,
    queryKeys,
    loadFromAppwrite,
    setLoading,
    setMembers,
    hydratePlayerPhotos,
    setPlayerPhotos,
    setPlayerPhotoRefs,
    setTournamentTemplates,
    normalizeTournamentFormat,
    normalizeTemplateTeams,
    setPlayerDatabase,
    setPlayerRatings,
    markRatingsPersisted,
    setTournamentHistory,
    setCasualMatches,
    setHistoryHydrated,
    setCasualHydrated,
    setActiveTournamentLock,
    findActiveTournament,
    resumeActiveTournament,
    mergeMemberLinks,
    applyMemberAccountLinks,
  });

  
  // Auto-save player ratings to Appwrite
  useEffect(() => {
    if (loading) return;
    const nextRatings = playerRatings && typeof playerRatings === 'object' ? playerRatings : {};
    const signature = JSON.stringify(nextRatings);
    if (signature === lastRatingsPersistedSignatureRef.current) return;

    if (isAppwriteEnabled) {
      if (ratingsAutosaveTimerRef.current) {
        clearTimeout(ratingsAutosaveTimerRef.current);
      }
      ratingsAutosaveTimerRef.current = setTimeout(() => {
        ratingsAutosaveTimerRef.current = null;
        if (signature === lastRatingsPersistedSignatureRef.current) return;
        const previousRatings = lastPersistedRatingsRef.current || {};
        const delta = buildRatingsDelta(previousRatings, nextRatings);
        if (
          Object.keys(delta.changedRatings).length === 0
          && delta.deletedPlayerNames.length === 0
        ) {
          markRatingsPersisted(nextRatings);
          return;
        }

        void saveRatingsMutation.mutateAsync(delta).then(() => {
          markRatingsPersisted(nextRatings);
        }).catch((error) => {
          console.error('Failed to save ratings to Appwrite:', error);
        });
      }, 700);
      return;
    }

    queueLocalStorageJson(STORAGE_KEYS.RATINGS, nextRatings);
    markRatingsPersisted(nextRatings);
  }, [playerRatings, isAppwriteEnabled, loading]);

  useEffect(() => () => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
    if (ratingsAutosaveTimerRef.current) {
      clearTimeout(ratingsAutosaveTimerRef.current);
      ratingsAutosaveTimerRef.current = null;
    }
    if (playerDbAutosaveTimerRef.current) {
      clearTimeout(playerDbAutosaveTimerRef.current);
      playerDbAutosaveTimerRef.current = null;
    }
  }, []);

  const shouldComputeTeamNameDatabase = step === 'setup' || step === 'teams';
  const shouldComputeSetupAnalytics = step === 'setup';
  const shouldComputeProfileInsights = showProfileModal || Boolean(pendingLinkPrompt);

  const {
    teamNameDatabase,
    pairingAnalytics,
    formPowerRankings,
    currentUserMember,
    currentUserPlayerProfile,
    currentUserPlayerTeam,
    currentUserAdvancedStats,
    currentUserAchievements,
    currentUserGamification,
    unlinkedPlayerNames,
  } = usePlayerDerivedData({
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
    compute: {
      teamNameDatabase: shouldComputeTeamNameDatabase,
      pairingAnalytics: shouldComputeSetupAnalytics,
      formPowerRankings: shouldComputeSetupAnalytics,
      profileInsights: shouldComputeProfileInsights,
      unlinkedPlayerNames: shouldComputeProfileInsights,
    },
  });

  const canEditOwnProfile = (playerName) => {
    if (!currentUserMember || !playerName) return false;
    const normalized = playerName.trim().toLowerCase();
    if (!normalized) return false;
    return (currentUserMember.name || '').trim().toLowerCase() === normalized;
  };

  const { updatePlayerPhoto } = usePlayerPhotoActions({
    requiresAuth,
    isAppwriteEnabled,
    playerPhotos,
    playerPhotoRefs,
    setPlayerPhotos,
    setPlayerPhotoRefs,
    canEditOwnProfile,
    showToast,
    savePlayerPhotosToCloud: (payload) => savePlayerPhotosMutation.mutateAsync(payload),
  });

  useAdminRequestsEffect({
    requiresAuth,
    currentUser,
    activeGroup,
    groupRole,
    queryClient,
    queryKeys,
    setPendingJoinRequests,
    setRecentJoinReviews,
    setSeenPendingRequestIds,
    setShowRequestCenter,
    setAdminAccounts,
  });

  // Initialize teams
  useEffect(() => {
    const enteringTeams = previousStepRef.current !== 'teams' && step === 'teams';
    const hasPrefilledTeams = Array.isArray(pendingPrefilledTeams) && pendingPrefilledTeams.length > 0;
    const hasExistingTeams = Array.isArray(teams) && teams.length > 0;

    if (step === 'teams' && (hasPrefilledTeams || (enteringTeams && !hasExistingTeams))) {
      const hasPrefilledTeams = Array.isArray(pendingPrefilledTeams) && pendingPrefilledTeams.length > 0;
      const sport = getSport(sportId);
      const isSquadSport = sport.participantModel === 'squad';
      const newTeams = hasPrefilledTeams
        ? pendingPrefilledTeams.map((team, i) => syncLegacyPlayersFromSquad({
            id: i + 1,
            emoji: team.emoji || (isSquadSport ? '🏏' : '🏸'),
            name: team.name || '',
            squad: team.squad || [],
            player1: team.player1 || team.player || '',
            player: team.player1 || team.player || '',
            player2: team.player2 || '',
          }))
        : isSquadSport
          ? Array.from({ length: numTeams }, (_, i) => createEmptySquadTeam(i + 1, sport))
          : Array.from({ length: numTeams }, (_, i) => ({
              id: i + 1,
              emoji: '🏸',
              name: '',
              player1: '',
              player2: '',
            }));
      if (hasPrefilledTeams && pendingPrefilledTeams.length !== numTeams) {
        setNumTeams(pendingPrefilledTeams.length);
      }
      setTeams(newTeams);
      setPendingPrefilledTeams(null);
    }
    previousStepRef.current = step;
  }, [step, numTeams, gameMode, sportId, pendingPrefilledTeams, teams]);

  const updatePlayerDatabase = (playerName) => {
    if (!assertCanOperate()) return;
    if (!playerName || playerName.trim() === "") return;
  
    setPlayerDatabase(prev => {
      if (prev.includes(playerName.trim())) return prev;
  
      const updated = [...prev, playerName.trim()];
  
      if (isAppwriteEnabled) {
        queuePlayerDatabaseSave(updated);
      } else {
        queueLocalStorageJson(STORAGE_KEYS.PLAYERS, updated);
      }
  
      return updated;
    });
  };

  const {
    saveMembersToLocal,
    applyAccountLink,
    handleSaveProfileName,
    handleManualLinkToMember,
    handleAdminLinkAccountToMember,
    handleCreateAndLinkOwnMember,
    addMember,
    deleteMember,
  } = useMemberAdminActions({
    isAppwriteEnabled,
    activeGroup,
    currentUser,
    currentUserMember,
    groupRole,
    members,
    adminAccounts,
    setMembers,
    setAuthLoading,
    setCurrentUser,
    canManageMembers,
    assertCanManageMembers,
    canEditOwnProfile,
    showToast,
    updatePlayerDatabase,
    saveMembersToCloud: (payload) => saveMembersMutation.mutateAsync(payload),
    updateProfileName: (name) => updateNameMutation.mutateAsync(name),
    queryClient,
  });

  useMemberLinkEffect({
    requiresAuth,
    currentUser,
    activeGroup,
    groupRole,
    isGuestViewer,
    loading,
    members,
    playerDatabase,
    teams,
    pendingLinkPrompt,
    setPendingLinkPrompt,
    setMembers,
    saveMembersToLocal,
    linkPromptedRef,
  });

  const {
    handleStartTournament,
    generateFixtures,
    scheduleTournament,
    saveMatchResult,
    prioritizeMatch,
    updateMatchSchedule,
    saveBracketMatchResult,
    saveFinalResult,
    saveCasualMatch,
    swapTeamMember,
    resetTournament,
    rerunTournament,
    startNextTournament,
    goHome,
    handleDeleteTournamentFromSetup,
    handleDeleteCasualMatchFromSetup,
  } = useTournamentActions({
    assertCanOperate,
    assertCanDelete,
    confirmAction: requestConfirmAction,
    showToast,
    isAppwriteEnabled,
    activeGroup,
    updatePlayerDatabase,
    tournamentName,
    setTournamentName,
    numTeams,
    setNumTeams,
    format,
    setFormat,
    gameMode,
    sportId,
    ruleConfig,
    tournamentFormat,
    setStep,
    setLoading,
    teams,
    setTeams,
    fixtures,
    setFixtures,
    bracket,
    setBracket,
    champion,
    setChampion,
    setPlayerDatabase,
    members,
    playerRatings,
    setPlayerRatings,
    tournamentHistory,
    setTournamentHistory,
    casualMatches,
    setCasualMatches,
    setShowCasualMatch,
    aiMatchSummaries,
    setAiMatchSummaries,
    swapHistory,
    setSwapHistory,
    currentTournamentId,
    setCurrentTournamentId,
    setActiveTournamentLock,
    syncCurrentTournament,
    patchTournamentMatches,
    saveTournamentTransactionToAppwrite,
    markRatingsPersisted,
    buildRatingsDelta,
    saveTournamentMutation,
    deleteTournamentMutation,
    saveRatingsMutation,
    savePlayerDatabaseMutation,
    createCasualMatchMutation,
    deleteCasualMatchMutation,
  });

  const {
    saveTournamentTemplate,
    applyTournamentTemplate,
    deleteTournamentTemplate,
  } = useTemplateActions({
    isAppwriteEnabled,
    tournamentTemplates,
    setTournamentTemplates,
    tournamentFormat,
    gameMode,
    sportId,
    numTeams,
    format,
    tournamentName,
    setTournamentName,
    setGameMode,
    setTournamentFormat,
    setFormat,
    setNumTeams,
    setTeams,
    setPendingPrefilledTeams,
    setStep,
    assertCanOperate,
    assertCanDelete,
    showToast,
    saveTemplatesToCloud: (payload) => saveTemplatesMutation.mutateAsync(payload),
    requestConfirmAction,
    generateFixtures,
  });

  const {
    cumulativeAllTimeStats,
    eloLeaderboard,
  } = useDashboardDerivedData({
    tournamentHistory,
    casualMatches,
    playerRatings,
  });
  const currentUserLeaderboardRank = useMemo(() => {
    const targetName = String(currentUserMember?.name || '').trim().toLowerCase();
    if (!targetName) return null;
    const index = eloLeaderboard.findIndex((entry) => (
      String(entry?.name || '').trim().toLowerCase() === targetName
    ));
    return index >= 0 ? index + 1 : null;
  }, [eloLeaderboard, currentUserMember?.name]);

  const scheduledTournaments = useMemo(
    () => (tournamentHistory || []).filter((item) => item?.status === 'scheduled'),
    [tournamentHistory]
  );

  const activeLiveTournaments = useMemo(
    () => {
      const fromHistory = dedupeLiveTournaments(tournamentHistory || []);
      const lockTournament = buildTournamentFromLock(activeTournamentLock);
      if (!lockTournament) return fromHistory;

      return dedupeLiveTournaments([...fromHistory, lockTournament]);
    },
    [tournamentHistory, activeTournamentLock]
  );

  const {
    handleResumeActiveTournament,
    handleDeleteActiveTournament,
    handleRefreshTournamentFromCloud,
    handleEditScheduledTournament,
    handleStartScheduledTournament,
    handleViewScheduledTournament,
    handleShareScheduledTournament,
    handleOpenHistoryModal,
    handleOpenCasualHistoryModal,
    handleOpenAllTimeStatsModal,
    handleOpenEloModal,
    handleDeleteTournamentWithHydration,
    handleDeleteCasualWithHydration,
    handleResetTournamentWithHydration,
  } = useTournamentLifecycleActions({
    isAppwriteEnabled,
    activeGroup,
    step,
    tournamentHistory,
    setTournamentHistory,
    activeTournamentLock,
    setActiveTournamentLock,
    currentTournamentId,
    setCurrentTournamentId,
    activeLiveTournaments,
    tournamentName,
    historyHydrated,
    casualHydrated,
    historyHydrationPending,
    casualHydrationPending,
    queryClient,
    resumeActiveTournament,
    showToast,
    requestConfirmAction,
    invalidateHydrationRequests,
    ensureTournamentHistoryHydrated,
    ensureCasualMatchesHydrated,
    pruneTournamentQueryCacheAfterDelete,
    clearBootstrapActiveTournamentCache,
    handleDeleteTournamentFromSetup,
    handleDeleteCasualMatchFromSetup,
    resetTournament,
    generateFixtures,
    setTournamentName,
    setFormat,
    setGameMode,
    setTournamentFormat,
    setNumTeams,
    setOddPlayerEnabled,
    setOddPlayerName,
    setTeams,
    setPendingPrefilledTeams,
    setStep,
    setShowHistory,
    setShowCasualHistory,
    setShowAllTimeStats,
    setShowEloLeaderboard,
    activeGroupName: activeGroup?.name,
  });

  const handleHeaderGoHome = () => {
    setShowRequestCenter(false);
    setShowCasualMatch(false);
    goHome();
  };

  useScheduledTournamentCleanupEffect({
    canDelete,
    scheduledTournaments,
    activeLiveTournaments,
    isAppwriteEnabled,
    handleDeleteTournamentFromSetup,
    pruneTournamentQueryCacheAfterDelete,
    showToast,
  });

  useSetupHydrationRetryEffect({
    isAppwriteEnabled,
    step,
    requiresAuth,
    activeGroupId: activeGroup?.id,
    historyHydrated,
    casualHydrated,
    historyHydrationPending,
    casualHydrationPending,
    setupHydrationRetryAtRef,
    ensureTournamentHistoryHydrated,
    ensureCasualMatchesHydrated,
  });

  const {
    handleMobileGoHome,
    handleMobileOpenProfile,
    handleMobileRecordCasual,
    handleMobileGoLive,
    handleMobileOpenHistory,
    handleMobileOpenStats,
    handleMobileOpenCreate,
  } = useMobileShellActions({
    step,
    showRequestCenter,
    requiresAuth,
    currentUser,
    assertCanOperate,
    handleHeaderGoHome,
    handleOpenHistoryModal,
    setMobileSetupView,
    setShowHistory,
    setShowCasualHistory,
    setShowAllTimeStats,
    setShowEloLeaderboard,
    setShowCasualMatch,
    setShowUtilityDrawer,
    setShowProfileModal,
  });

  const {
    viewerDashboardProps,
    setupScreenProps,
    teamEntryProps,
    tournamentViewProps: tournamentShellProps,
    casualMatchProps,
  } = useTournamentShell({
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
    onShareScheduledTournament: handleShareScheduledTournament,
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
  });

  const tournamentViewProps = {
    ...tournamentShellProps,
    calculatePointsTable: (teams, fixtures) => {
      const plugin = getSportPlugin(tournamentShellProps.sportId || sportId);
      if (plugin.rankings?.calculateStandings) {
        return plugin.rankings.calculateStandings(teams, fixtures, ruleConfig);
      }
      return plugin.scoring.calculatePointsTable(teams, fixtures, ruleConfig);
    },
    calculatePlayerStats: (teams, fixtures) => (
      getSportPlugin(tournamentShellProps.sportId || sportId).stats.calculatePlayerStats(teams, fixtures)
    ),
    getPlayerLeaderboard,
  };
  const enhancedSetupScreenProps = {
    ...setupScreenProps,
    mobileSetupView,
    setMobileSetupView,
    onOpenUtilityDrawer: () => setShowUtilityDrawer(true),
  };

  const hasTournamentScreenState = useMemo(() => (
    step === 'tournament'
    || (Array.isArray(fixtures) && fixtures.length > 0)
    || (Array.isArray(bracket) && bracket.some((round) => Array.isArray(round) && round.length > 0))
  ), [step, fixtures, bracket]);

  const hashRouteReady = isConfigChecked && authResolved && groupResolved;

  const { routeKey } = useHashAppRoute({
    isReady: hashRouteReady,
    requiresAuth,
    currentUser,
    isGuestViewer,
    activeGroup,
    groupRole,
    showRequestCenter,
    setShowRequestCenter,
    isViewerMode,
    step,
    setStep,
    hasTournamentScreenState,
  });

  const canRenderWorkspace = !requiresAuth || Boolean(activeGroup);
  const shouldShowMobileBottomNav = Boolean(
    isMobileViewport
    && canRenderWorkspace
    && isConfigChecked
    && authResolved
    && groupResolved
    && !isViewerMode
    && step !== 'tournament'
    && !showCasualMatch
  );
  const mobileNavActiveKey = useMemo(() => {
    if (showUtilityDrawer) return 'create';
    if (showProfileModal) return 'profile';
    if (step === 'setup') {
      if (mobileSetupView === 'create') return 'create';
      if (mobileSetupView === 'stats' || mobileSetupView === 'elo' || showAllTimeStats || showEloLeaderboard || showRequestCenter) {
        return 'stats';
      }
      if (mobileSetupView === 'live') return 'live';
    }
    if (showAllTimeStats || showEloLeaderboard || showRequestCenter) return 'stats';
    if (showHistory || showCasualHistory) return 'home';
    if (step === 'tournament') return 'live';
    return 'home';
  }, [
    mobileSetupView,
    showUtilityDrawer,
    showProfileModal,
    showHistory,
    showCasualHistory,
    showAllTimeStats,
    showEloLeaderboard,
    showRequestCenter,
    step,
  ]);

  useEffect(() => {
    if (step !== 'setup') {
      setMobileSetupView('home');
    }
  }, [step, setMobileSetupView]);

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const bodyClass = 'has-mobile-root-nav';
    if (shouldShowMobileBottomNav) {
      document.body.classList.add(bodyClass);
    } else {
      document.body.classList.remove(bodyClass);
    }
    return () => {
      document.body.classList.remove(bodyClass);
    };
  }, [shouldShowMobileBottomNav]);

  const shouldRenderAppModals = Boolean(
    requiresAuth
    && (showProfileModal || pendingLinkPrompt)
  );

  const appModals = shouldRenderAppModals ? (
    <Suspense fallback={null}>
      <AppModals
        requiresAuth={requiresAuth}
        currentUser={currentUser}
        showProfileModal={showProfileModal}
        groupRole={groupRole}
        currentUserMember={currentUserMember}
        playerPhotos={playerPhotos}
        members={members}
        unlinkedPlayerNames={unlinkedPlayerNames}
        adminAccounts={adminAccounts}
        currentUserPlayerProfile={currentUserPlayerProfile}
        currentUserPlayerTeam={currentUserPlayerTeam}
        currentUserAdvancedStats={currentUserAdvancedStats}
        currentUserAchievements={currentUserAchievements}
        currentUserGamification={currentUserGamification}
        currentUserLeaderboardRank={currentUserLeaderboardRank}
        tournamentHistory={tournamentHistory}
        casualMatches={casualMatches}
        authLoading={authLoading}
        onSaveProfileName={handleSaveProfileName}
        onUpdatePlayerPhoto={(playerName, dataUrl) => updatePlayerPhoto(playerName, dataUrl)}
        onManualLink={handleManualLinkToMember}
        onAdminLinkAccountToMember={handleAdminLinkAccountToMember}
        onCreateAndLinkOwnMember={handleCreateAndLinkOwnMember}
        onCloseProfile={() => setShowProfileModal(false)}
        pendingLinkPrompt={pendingLinkPrompt}
        onConfirmLinkPrompt={() => {
          applyAccountLink(pendingLinkPrompt);
          setPendingLinkPrompt(null);
        }}
        onSkipLinkPrompt={() => {
          setPendingLinkPrompt(null);
          showToast('Account link skipped for now', 'error');
        }}
      />
    </Suspense>
  ) : null;

  return (
    <>
      <AppViewRouter
        isConfigChecked={isConfigChecked}
        authResolved={authResolved}
        groupResolved={groupResolved}
        routeKey={routeKey}
        requiresAuth={requiresAuth}
        currentUser={currentUser}
        isGuestViewer={isGuestViewer}
        activeGroup={activeGroup}
        groupRole={groupRole}
        showRequestCenter={showRequestCenter}
        isViewerMode={isViewerMode}
        authLoading={authLoading}
        availableGroups={availableGroups}
        publicGroups={publicGroups}
        requestedGroupIds={requestedGroupIds}
        unreadRequestCount={unreadRequestCount}
        pendingJoinRequests={pendingJoinRequests}
        recentJoinReviews={recentJoinReviews}
        adminGroupMembers={adminAccounts}
        currentUserId={currentUser?.$id || ''}
        inviteLoading={inviteLoading}
        onLogin={handleLogin}
        onRegister={handleRegister}
        onContinueAsViewer={handleContinueAsViewer}
        onCreateGroup={handleCreateGroup}
        onRequestAccess={handleRequestAccess}
        onWatchGroup={handleWatchGroup}
        onSelectGroup={handleSelectGroup}
        onOpenProfile={() => setShowProfileModal(true)}
        onGoHome={handleHeaderGoHome}
        onBackToGroups={handleBackToGroups}
        onOpenRequestCenter={handleOpenRequestCenter}
        onLogout={handleLogout}
        onCloseRequestCenter={() => setShowRequestCenter(false)}
        onApproveRequest={handleApproveRequest}
        onRejectRequest={handleRejectRequest}
        onPromoteMemberToAdmin={handlePromoteMemberToAdmin}
        onRemoveGroupMember={handleRemoveMember}
        onDeleteGroup={handleDeleteGroup}
        onConfirmAction={requestConfirmAction}
        viewerDashboardProps={viewerDashboardProps}
        setupScreenProps={enhancedSetupScreenProps}
        teamEntryProps={teamEntryProps}
        tournamentViewProps={tournamentViewProps}
        casualMatchProps={casualMatchProps}
        showCasualMatch={showCasualMatch}
        appModals={appModals}
        isMobileViewport={isMobileViewport}
      />
      <ConfirmActionModal
        open={Boolean(confirmDialog)}
        title={confirmDialog?.title}
        message={confirmDialog?.message}
        confirmLabel={confirmDialog?.confirmLabel}
        cancelLabel={confirmDialog?.cancelLabel}
        tone={confirmDialog?.tone}
        onConfirm={() => resolveConfirmDialog(true)}
        onCancel={() => resolveConfirmDialog(false)}
      />
      <PwaUpdatePrompt showToast={showToast} />
      <Toast message={toast?.message} type={toast?.type} />

      {!isMobileViewport && (
        <>
          <button
            type="button"
            onClick={toggleThemeMode}
            className="theme-toggle-btn"
            aria-label={themeMode === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            title={themeMode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {themeMode === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            <span className="hidden sm:inline">{themeMode === 'dark' ? 'Light' : 'Dark'}</span>
          </button>
          <PwaControls
            queuedWritesCount={queuedWritesCount}
            flushOfflineOutbox={flushOfflineOutbox}
            showToast={showToast}
            mode="floating"
          />
        </>
      )}

      {isMobileViewport && (
        <>
          {!shouldShowMobileBottomNav && step !== 'tournament' && (
            <button
              type="button"
              onClick={() => setShowUtilityDrawer((prev) => !prev)}
              className={`utility-fab ${showUtilityDrawer ? 'is-open' : ''}`}
              aria-label={showUtilityDrawer ? 'Close quick actions' : 'Open quick actions'}
              title={showUtilityDrawer ? 'Close quick actions' : 'Open quick actions'}
            >
              {showUtilityDrawer ? <X size={18} /> : <Plus size={18} />}
              <span>Actions</span>
            </button>
          )}

          <div
            className={`utility-drawer-overlay ${showUtilityDrawer ? 'is-open' : ''}`}
            onClick={() => setShowUtilityDrawer(false)}
            aria-hidden={!showUtilityDrawer}
          >
            <div
              className="utility-drawer-sheet app-modal-shell"
              role="dialog"
              aria-modal="true"
              aria-label="Mobile quick actions"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="utility-drawer-header">
                <p className="utility-drawer-title">Quick Actions</p>
                <button
                  type="button"
                  className="utility-drawer-close"
                  onClick={() => setShowUtilityDrawer(false)}
                  aria-label="Close quick actions"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="utility-drawer-body">
                <button
                  type="button"
                  onClick={handleMobileRecordCasual}
                  className="utility-drawer-action"
                  aria-label="Record casual match"
                >
                  <Plus size={17} />
                  <span>Record Casual Match</span>
                </button>
                <button
                  type="button"
                  onClick={handleMobileOpenHistory}
                  className="utility-drawer-action"
                  aria-label="Open tournament history"
                >
                  <History size={17} />
                  <span>Tournament History</span>
                </button>
                {requiresAuth && groupRole === 'admin' && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowUtilityDrawer(false);
                      if (step !== 'setup') {
                        handleHeaderGoHome();
                      }
                      setShowRequestCenter(true);
                    }}
                    className="utility-drawer-action"
                    aria-label="Open admin hub"
                  >
                    <Bell size={17} />
                    <span>Admin Hub</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={toggleThemeMode}
                  className="utility-drawer-action"
                  aria-label={themeMode === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
                >
                  {themeMode === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
                  <span>{themeMode === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}</span>
                </button>
                <PwaControls
                  queuedWritesCount={queuedWritesCount}
                  flushOfflineOutbox={flushOfflineOutbox}
                  showToast={showToast}
                  mode="drawer"
                />
              </div>
            </div>
          </div>

          <MobileBottomNav
            isVisible={shouldShowMobileBottomNav}
            activeKey={mobileNavActiveKey}
            onHome={handleMobileGoHome}
            onLive={handleMobileGoLive}
            onStats={handleMobileOpenStats}
            onProfile={handleMobileOpenProfile}
            onPrimaryAction={handleMobileOpenCreate}
          />
        </>
      )}
    </>
  );
};

export default App;
