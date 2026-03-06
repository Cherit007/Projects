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
import { useTournamentActions } from './hooks/useTournamentActions';
import { useAuthBootstrapEffect } from './hooks/useAuthBootstrapEffect';
import { useInitialDataLoadEffect } from './hooks/useInitialDataLoadEffect';
import { useMemberLinkEffect } from './hooks/useMemberLinkEffect';
import { useAdminRequestsEffect } from './hooks/useAdminRequestsEffect';
import { useDashboardDerivedData } from './hooks/useDashboardDerivedData';
import { useModalManager } from './hooks/useModalManager';
import { useRealtimeCacheSync } from './hooks/useRealtimeCacheSync';
import { useAppStoreShallow } from './store/appStore';
import { appDataService } from './services/appDataService';
import { tournamentService } from './services/tournamentService';
import { queueLocalStorageJson, queueLocalStorageValue } from './services/localStorageWriteService';
import {
  calculatePointsTable, 
  calculatePlayerStats, 
  getPlayerLeaderboard,
} from './utils/calculations';
import { normalizePhotoInput } from './utils/playerPhotos';
import { playerPhotoStorageService } from './services/playerPhotoStorageService';
import { queryKeys } from './config/queryKeys';
import {
  applyMemberAccountLinks,
  buildMemberAccountLinks,
  buildRatingsDelta,
  buildTournamentFromLock,
  cloneRatingsSnapshot,
  deriveRatingsFromHistory,
  findActiveTournament,
  getTournamentIdCandidates,
  matchesTournamentId,
  mergeMemberLinks,
  mergeMembersForCloudSave,
  normalizeTemplateTeams,
  normalizeTournamentFormat,
  normalizeTournamentName,
  pickPreferredTournament,
  removeTournamentFromList,
  upsertTournamentInHistory,
} from './utils/appHelpers';

const AppModals = lazy(() => import('./components/AppModals'));

const App = () => {
  const queryClient = useQueryClient();
  const [themeMode, setThemeMode] = useState(() => {
    try {
      const savedTheme = localStorage.getItem('badminton_theme_mode');
      return savedTheme === 'light' || savedTheme === 'dark' ? savedTheme : 'dark';
    } catch {
      return 'dark';
    }
  });

  useEffect(() => {
    document.body.setAttribute('data-theme', themeMode);
    try {
      queueLocalStorageValue('badminton_theme_mode', themeMode);
    } catch {
      // Ignore storage errors (private mode / quota issues).
    }
  }, [themeMode]);

  const resumeActiveTournament = (activeTournament) => {
    if (!activeTournament) return false;

    setTournamentName(activeTournament.name || '');
    setFormat(activeTournament.format || '1');
    setGameMode(activeTournament.gameMode || 'doubles');
    setTournamentFormat(normalizeTournamentFormat(activeTournament.tournamentFormat || activeTournament.format || 'league'));
    setTeams(activeTournament.teams || []);
    setFixtures(activeTournament.fixtures || []);
    setBracket(activeTournament.bracket || []);
    setChampion(activeTournament.champion || null);
    setAiMatchSummaries(activeTournament.aiSummaries || []);
    setSwapHistory(activeTournament.swapHistory || []);
    setCurrentTournamentId(activeTournament.appwriteId || activeTournament.id || null);
    setStep('tournament');
    return true;
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
  const [isMobileViewport, setIsMobileViewport] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(max-width: 767px)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const media = window.matchMedia('(max-width: 767px)');
    const updateViewport = () => {
      setIsMobileViewport(media.matches);
    };
    updateViewport();
    if (media.addEventListener) {
      media.addEventListener('change', updateViewport);
    } else {
      media.addListener(updateViewport);
    }
    return () => {
      if (media.removeEventListener) {
        media.removeEventListener('change', updateViewport);
      } else {
        media.removeListener(updateViewport);
      }
    };
  }, []);

  useEffect(() => {
    if (isMobileViewport) return;
    setShowUtilityDrawer(false);
  }, [isMobileViewport]);

  useEffect(() => {
    if (!showUtilityDrawer) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setShowUtilityDrawer(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [showUtilityDrawer]);

  useEffect(() => {
    setShowUtilityDrawer(false);
  }, [step]);

  const hydratePlayerPhotos = (rawPhotos = {}) => {
    const urls = {};
    const refs = {};
    Object.entries(rawPhotos || {}).forEach(([name, value]) => {
      if (!name) return;
      if (typeof value === 'string') {
        urls[name] = value;
        return;
      }

      if (value && typeof value === 'object' && value.fileId) {
        refs[name] = value;
        const storageUrl = playerPhotoStorageService.getPhotoUrl(value.fileId);
        if (storageUrl) urls[name] = storageUrl;
      }
    });
    return { urls, refs };
  };

  const recoverRatingsIfMissing = ({ history = tournamentHistory, casual = casualMatches } = {}) => {
    const current = playerRatings && typeof playerRatings === 'object' ? playerRatings : {};
    if (Object.keys(current).length > 0) return current;
    const rebuilt = deriveRatingsFromHistory({ history, casual });
    if (Object.keys(rebuilt).length === 0) return current;
    setPlayerRatings(rebuilt);
    return rebuilt;
  };

  const markRatingsPersisted = (ratings = {}) => {
    const snapshot = ratings && typeof ratings === 'object' ? ratings : {};
    if (ratingsAutosaveTimerRef.current) {
      clearTimeout(ratingsAutosaveTimerRef.current);
      ratingsAutosaveTimerRef.current = null;
    }
    lastRatingsPersistedSignatureRef.current = JSON.stringify(snapshot);
    lastPersistedRatingsRef.current = cloneRatingsSnapshot(snapshot);
  };

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
  const toggleThemeMode = useCallback(() => {
    setThemeMode((prev) => (prev === 'dark' ? 'light' : 'dark'));
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
      if (typeof result === 'boolean') return result;
      return true;
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
    flushOfflineOutbox,
  } = useAppwriteSync(showToast, activeGroup?.id);
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

    queueLocalStorageJson("badminton_ratings", nextRatings);
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
      const newTeams = hasPrefilledTeams
        ? pendingPrefilledTeams.map((team, i) => ({
            id: i + 1,
            emoji: team.emoji || '🏸',
            name: team.name || '',
            player1: team.player1 || team.player || '',
            player: team.player1 || team.player || '',
            player2: gameMode === 'singles' ? '' : (team.player2 || ''),
          }))
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
  }, [step, numTeams, gameMode, pendingPrefilledTeams, teams]);

  const updatePlayerDatabase = (playerName) => {
    if (!assertCanOperate()) return;
    if (!playerName || playerName.trim() === "") return;
  
    setPlayerDatabase(prev => {
      if (prev.includes(playerName.trim())) return prev;
  
      const updated = [...prev, playerName.trim()];
  
      if (isAppwriteEnabled) {
        queuePlayerDatabaseSave(updated);
      } else {
        queueLocalStorageJson("badminton_players", updated);
      }
  
      return updated;
    });
  };

  const saveMembersToLocal = (updatedMembers, baselineMembers = members) => {
    const baseline = Array.isArray(baselineMembers) ? baselineMembers : [];
    const safeMembers = mergeMemberLinks(updatedMembers, baseline);
    if (isAppwriteEnabled) {
      void (async () => {
        let mergedForCloud = safeMembers;
        try {
          const remoteMeta = await appDataService.getAppMeta({
            force: true,
            groupId: activeGroup?.id,
          });
          const remoteMembersRaw = Array.isArray(remoteMeta?.members) ? remoteMeta.members : [];
          const remoteLinks = remoteMeta?.memberAccountLinks && typeof remoteMeta.memberAccountLinks === 'object'
            ? remoteMeta.memberAccountLinks
            : {};
          const remoteMembers = applyMemberAccountLinks(
            mergeMemberLinks(remoteMembersRaw, safeMembers),
            remoteLinks
          );
          mergedForCloud = mergeMembersForCloudSave({
            nextMembers: safeMembers,
            baselineMembers: baseline,
            remoteMembers,
          });
        } catch (error) {
          console.error('Failed to merge latest member links before save:', error);
        }

        try {
          await saveMembersMutation.mutateAsync({
            members: mergedForCloud,
            memberAccountLinks: buildMemberAccountLinks(mergedForCloud),
          });
        } catch (error) {
          console.error('Failed to save members to Appwrite:', error);
        }
      })();
      return;
    }
    queueLocalStorageJson("badminton_members", safeMembers);
  };

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

  const saveTemplatesToLocal = (updatedTemplates) => {
    if (isAppwriteEnabled) {
      saveTemplatesMutation.mutateAsync(updatedTemplates).catch((error) => {
        console.error('Failed to save templates to Appwrite:', error);
      });
      return;
    }
    queueLocalStorageJson("badminton_templates", updatedTemplates);
  };

  const applyAccountLink = (prompt) => {
    if (!prompt || !currentUser) return;

    if (prompt.type === 'member' && prompt.memberId) {
      const updated = members.map((member) => (
        member.id === prompt.memberId
          ? {
              ...member,
              linkedAccountId: currentUser.$id,
              linkedEmail: currentUser.email,
            }
          : member
      ));
      setMembers(updated);
      saveMembersToLocal(updated, members);
      showToast(`Linked to member "${prompt.memberName}"`);
      return;
    }

    if (prompt.type === 'player' && prompt.playerName) {
      const next = [{
        id: `member-${Date.now()}`,
        name: prompt.playerName,
        phone: '',
        linkedAccountId: currentUser.$id,
        linkedEmail: currentUser.email,
      }, ...members];
      setMembers(next);
      saveMembersToLocal(next);
      showToast(`Linked to player "${prompt.playerName}"`);
    }
  };

  const handleSaveProfileName = async (name) => {
    const trimmed = (name || '').trim();
    if (!trimmed || !currentUser) return;

    setAuthLoading(true);
    try {
      const updatedUser = await updateNameMutation.mutateAsync(trimmed);
      queryClient.setQueryData(queryKeys.authCurrentUser, updatedUser);
      setCurrentUser(updatedUser);
      showToast('Profile name updated');
    } catch (error) {
      console.error('Failed to update profile name:', error);
      showToast(error?.message || 'Failed to update profile name', 'error');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleManualLinkToMember = (memberId) => {
    if (!currentUser) return;
    if (groupRole !== 'admin') {
      showToast('Only admin can link other members', 'error');
      return;
    }
    const target = members.find((member) => member.id === memberId);
    if (!target) {
      showToast('Selected member not found', 'error');
      return;
    }
    const linkedToOther = (target.linkedAccountId && target.linkedAccountId !== currentUser.$id)
      || (target.linkedEmail && target.linkedEmail.toLowerCase() !== (currentUser.email || '').toLowerCase());
    if (linkedToOther) {
      showToast('This member is already linked to another account', 'error');
      return;
    }

    const updated = members.map((member) => (
      member.id === memberId
        ? {
            ...member,
            linkedAccountId: currentUser.$id,
            linkedEmail: currentUser.email,
          }
        : member
    ));
    setMembers(updated);
    saveMembersToLocal(updated, members);
    showToast(`Linked account to "${target.name}"`);
  };

  const handleAdminLinkAccountToMember = (accountUserId, playerName) => {
    if (!currentUser || groupRole !== 'admin') {
      showToast('Only admin can link member accounts', 'error');
      return;
    }
    const account = adminAccounts.find((item) => item.userId === accountUserId);
    const targetName = (playerName || '').trim();
    if (!account || !targetName) {
      showToast('Please select both account and player profile', 'error');
      return;
    }
    const existingTarget = members.find((member) => (member.name || '').trim().toLowerCase() === targetName.toLowerCase());
    const targetId = existingTarget?.id || `member-${Date.now()}`;
    const targetPhone = existingTarget?.phone || '';

    const accountEmail = (account.email || '').toLowerCase();
    const baseMembers = existingTarget
      ? [...members]
      : [{ id: targetId, name: targetName, phone: targetPhone }, ...members];
    const updated = baseMembers.map((member) => {
      const sameLinkedAccount = member.linkedAccountId && member.linkedAccountId === account.userId;
      const sameLinkedEmail = accountEmail && (member.linkedEmail || '').toLowerCase() === accountEmail;
      if (member.id === targetId) {
        return {
          ...member,
          name: targetName,
          phone: member.phone || targetPhone,
          linkedAccountId: account.userId,
          linkedEmail: account.email,
        };
      }
      if (sameLinkedAccount || sameLinkedEmail) {
        return { ...member, linkedAccountId: undefined, linkedEmail: undefined };
      }
      return member;
    });

    setMembers(updated);
    saveMembersToLocal(updated, members);
    showToast(`Linked ${account.name || account.email} to ${targetName}`);
  };

  const handleCreateAndLinkOwnMember = () => {
    if (!currentUser) return;
    const displayName = (currentUser.name || currentUser.email?.split('@')[0] || '').trim();
    if (!displayName) {
      showToast('Unable to resolve account name for linking', 'error');
      return;
    }

    const existing = members.find((member) => (member.name || '').trim().toLowerCase() === displayName.toLowerCase());
    if (existing) {
      handleManualLinkToMember(existing.id);
      return;
    }

    const next = [{
      id: `member-${Date.now()}`,
      name: displayName,
      phone: '',
      linkedAccountId: currentUser.$id,
      linkedEmail: currentUser.email,
    }, ...members];
    setMembers(next);
    saveMembersToLocal(next, members);
    showToast(`Created and linked "${displayName}"`);
  };

  const addMember = (memberData) => {
    if (!canManageMembers) {
      const ownName = memberData?.name?.trim();
      if (!canEditOwnProfile(ownName)) {
        showToast('Only admin can manage all members', 'error');
        return { success: false, reason: 'Only admin can manage all members' };
      }
    }
    const name = memberData?.name?.trim();
    const phone = memberData?.phone?.trim();
    if (!name || !phone) return { success: false, reason: 'Name and phone are required' };

    let memberAdded = null;
    setMembers(prev => {
      const existing = prev.find(m => m.name.toLowerCase() === name.toLowerCase());
      const normalizedMember = {
        id: existing?.id || `member-${Date.now()}`,
        name,
        phone,
        linkedAccountId: existing?.linkedAccountId || (currentUserMember?.name?.toLowerCase() === name.toLowerCase() ? currentUser?.$id : undefined),
        linkedEmail: existing?.linkedEmail || (currentUserMember?.name?.toLowerCase() === name.toLowerCase() ? currentUser?.email : undefined),
      };
      const updated = existing
        ? prev.map(m => (m.id === existing.id ? normalizedMember : m))
        : [...prev, normalizedMember];

      saveMembersToLocal(updated, prev);
      memberAdded = existing ? { ...normalizedMember, updated: true } : normalizedMember;
      return updated;
    });

    updatePlayerDatabase(name);
    return { success: true, member: memberAdded };
  };

  const deleteMember = (memberId) => {
    if (!assertCanManageMembers()) return;
    setMembers(prev => {
      const updated = prev.filter(member => member.id !== memberId);
      saveMembersToLocal(updated);
      return updated;
    });
  };

  const updatePlayerPhoto = async (playerName, photoInput) => {
    if (requiresAuth && !canEditOwnProfile(playerName)) {
      showToast('You can edit only your own linked profile photo', 'error');
      return { success: false, reason: 'Read-only access' };
    }
    const name = playerName?.trim();
    if (!name) return { success: false };

    const normalized = normalizePhotoInput(photoInput);
    const existingRef = playerPhotoRefs[name];

    try {
      if (isAppwriteEnabled && playerPhotoStorageService.isStorageEnabled()) {
        if (!normalized) {
          if (existingRef?.fileId) {
            await playerPhotoStorageService.deletePhoto(existingRef.fileId);
          }

          const updatedRefs = { ...playerPhotoRefs };
          delete updatedRefs[name];
          const updatedUrls = { ...playerPhotos };
          delete updatedUrls[name];

          setPlayerPhotoRefs(updatedRefs);
          setPlayerPhotos(updatedUrls);
          await savePlayerPhotosMutation.mutateAsync(updatedRefs);
          return { success: true };
        }

        if (/^data:image\//i.test(normalized)) {
          const uploaded = await playerPhotoStorageService.uploadPhoto({
            playerName: name,
            dataUrl: normalized,
          });

          if (existingRef?.fileId) {
            await playerPhotoStorageService.deletePhoto(existingRef.fileId);
          }

          const updatedRefs = {
            ...playerPhotoRefs,
            [name]: {
              fileId: uploaded.fileId,
              type: 'storage',
              updatedAt: new Date().toISOString(),
            },
          };
          const updatedUrls = {
            ...playerPhotos,
            [name]: uploaded.url,
          };
          setPlayerPhotoRefs(updatedRefs);
          setPlayerPhotos(updatedUrls);
          await savePlayerPhotosMutation.mutateAsync(updatedRefs);
          return { success: true };
        }
      }

      setPlayerPhotos(prev => {
        const updated = { ...prev };
        if (normalized) updated[name] = normalized;
        else delete updated[name];
        if (isAppwriteEnabled) {
          savePlayerPhotosMutation.mutateAsync(updated).catch((saveError) => {
            console.error('Failed to save player photos to Appwrite:', saveError);
            queueLocalStorageJson('badminton_player_photos', updated);
          });
        } else {
          queueLocalStorageJson('badminton_player_photos', updated);
        }
        return updated;
      });
      return { success: true };
    } catch (error) {
      console.error('Failed to update player photo:', error);
      return { success: false, error };
    }

  };

  const saveTournamentTemplate = (templateData) => {
    if (!assertCanOperate()) return { success: false, reason: 'Read-only access' };
    const name = templateData?.name?.trim();
    if (!name) {
      showToast('Template name is required', 'error');
      return { success: false };
    }

    const templateFormat = normalizeTournamentFormat(templateData.tournamentFormat || tournamentFormat);
    const templateGameMode = templateData.gameMode || gameMode;
    const templateNumTeams = Math.max(3, parseInt(templateData.numTeams, 10) || numTeams || 3);
    const normalizedTeams = normalizeTemplateTeams(
      templateData.teams || [],
      templateGameMode,
      templateNumTeams
    );

    const normalizedTemplate = {
      id: templateData.id || `template-${Date.now()}`,
      name,
      gameMode: templateGameMode,
      tournamentFormat: templateFormat,
      format: templateData.format || format,
      numTeams: templateNumTeams,
      teams: normalizedTeams,
      createdAt: new Date().toISOString(),
    };

    setTournamentTemplates(prev => {
      const existingIndex = prev.findIndex(
        t => t.id === normalizedTemplate.id || t.name.toLowerCase() === name.toLowerCase()
      );
      const updated = existingIndex >= 0
        ? prev.map((template, index) =>
            index === existingIndex ? { ...normalizedTemplate, id: template.id } : template
          )
        : [normalizedTemplate, ...prev];

      saveTemplatesToLocal(updated);
      return updated;
    });

    showToast('Template saved');
    return { success: true };
  };

  const applyTournamentTemplate = async (templateId) => {
    if (!assertCanOperate()) return;
    const template = tournamentTemplates.find(t => t.id === templateId);
    if (!template) return;

    const appliedFormat = normalizeTournamentFormat(template.tournamentFormat || 'league');
    const appliedMode = template.gameMode || 'doubles';
    const appliedNumTeams = Math.max(3, parseInt(template.numTeams, 10) || 3);
    const normalizedTeams = normalizeTemplateTeams(template.teams || [], appliedMode, appliedNumTeams);

    setGameMode(appliedMode);
    setTournamentFormat(appliedFormat);
    setFormat(template.format || '1');

    if (appliedFormat === 'semiFinal') {
      setNumTeams(4);
    } else if (appliedFormat === 'fullKnockout') {
      setNumTeams(8);
    } else {
      setNumTeams(appliedNumTeams);
    }
    setPendingPrefilledTeams(normalizedTeams);

    const shouldStartNow = await requestConfirmAction({
      title: 'Start Tournament Now?',
      message: 'Template applied. Generate fixtures and start tournament now?',
      confirmLabel: 'Generate & Start',
      cancelLabel: 'Not Now',
      tone: 'primary',
    });
    if (!shouldStartNow) {
      return;
    }

    const hasCompleteTeams = normalizedTeams.every(team => {
      if (!team.name?.trim()) return false;
      if (!team.player1?.trim()) return false;
      if (appliedMode !== 'singles' && !team.player2?.trim()) return false;
      return true;
    });

    if (!hasCompleteTeams) {
      showToast('Template teams are incomplete. Please review team details first.', 'error');
      setStep('teams');
      return;
    }

    const autoTournamentName = tournamentName.trim() ? tournamentName : `${template.name} Tournament`;
    if (!tournamentName.trim()) {
      setTournamentName(autoTournamentName);
    }
    setTeams(normalizedTeams);
    setPendingPrefilledTeams(null);
    showToast(`Template "${template.name}" applied. Starting now...`);
    generateFixtures({
      teamsOverride: normalizedTeams,
      tournamentFormatOverride: appliedFormat,
      formatOverride: template.format || '1',
      gameModeOverride: appliedMode,
      tournamentNameOverride: autoTournamentName
    });
  };

  const deleteTournamentTemplate = (templateId) => {
    if (!assertCanDelete()) return;
    setTournamentTemplates(prev => {
      const updated = prev.filter(template => template.id !== templateId);
      saveTemplatesToLocal(updated);
      return updated;
    });
    showToast('Template deleted');
  };

  const {
    handleStartTournament,
    generateFixtures,
    scheduleTournament,
    saveMatchResult,
    prioritizeMatch,
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
    cumulativeAllTimeStats,
    eloLeaderboard,
  } = useDashboardDerivedData({
    tournamentHistory,
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
      const fromHistoryRaw = (tournamentHistory || []).filter((item) => item?.status === 'active' && !item?.champion);
      const byName = new Map();
      fromHistoryRaw.forEach((item) => {
        const fallbackId = getTournamentIdCandidates(item)[0] || '';
        const key = (item?.name || '').trim().toLowerCase()
          || fallbackId;
        if (!key) return;
        const existing = byName.get(key);
        byName.set(key, existing ? pickPreferredTournament(existing, item) : item);
      });
      const fromHistory = Array.from(byName.values());
      const lockTournament = buildTournamentFromLock(activeTournamentLock);
      if (!lockTournament) return fromHistory;

      const lockId = lockTournament.id || lockTournament.appwriteId;
      const lockName = (lockTournament.name || '').trim().toLowerCase();
      const matchIndex = fromHistory.findIndex((item) => {
        if (lockId && matchesTournamentId(item, lockId)) return true;
        return lockName && (item?.name || '').trim().toLowerCase() === lockName;
      });
      if (matchIndex === -1) {
        return [...fromHistory, lockTournament];
      }
      const merged = [...fromHistory];
      merged[matchIndex] = pickPreferredTournament(fromHistory[matchIndex], lockTournament);
      return merged;
    },
    [tournamentHistory, activeTournamentLock]
  );

  const handleResumeActiveTournament = async (tournamentId) => {
    const tournamentPayloadDepth = (candidate) => {
      if (!candidate) return 0;
      const fixtureCount = Array.isArray(candidate.fixtures) ? candidate.fixtures.length : 0;
      const bracketCount = Array.isArray(candidate.bracket)
        ? candidate.bracket.reduce((sum, round) => sum + (Array.isArray(round) ? round.length : 0), 0)
        : 0;
      const teamCount = Array.isArray(candidate.teams) ? candidate.teams.length : 0;
      return fixtureCount + bracketCount + teamCount;
    };
    const mergeWithLockIfRicher = (candidate) => {
      if (!candidate) return candidate;
      const lockTournament = buildTournamentFromLock(activeTournamentLock);
      if (!lockTournament) return candidate;

      const candidateIds = getTournamentIdCandidates(candidate);
      const lockIds = getTournamentIdCandidates(lockTournament);
      const idMatched = candidateIds.some((value) => lockIds.includes(value));
      const candidateName = normalizeTournamentName(candidate?.name);
      const lockName = normalizeTournamentName(lockTournament?.name);
      const nameMatched = Boolean(candidateName && lockName && candidateName === lockName);
      if (!idMatched && !nameMatched) return candidate;

      if (tournamentPayloadDepth(lockTournament) <= tournamentPayloadDepth(candidate)) {
        return candidate;
      }

      return {
        ...candidate,
        ...lockTournament,
        id: candidate.appwriteId || candidate.id || lockTournament.appwriteId || lockTournament.id || null,
        appwriteId: candidate.appwriteId || candidate.id || lockTournament.appwriteId || lockTournament.id || null,
        name: candidate.name || lockTournament.name || 'Live tournament',
        date: candidate.date || lockTournament.date || '',
        format: candidate.format || lockTournament.format || '1',
        gameMode: candidate.gameMode || lockTournament.gameMode || 'doubles',
        tournamentFormat: normalizeTournamentFormat(
          candidate.tournamentFormat
            || lockTournament.tournamentFormat
            || candidate.format
            || lockTournament.format
            || 'league'
        ),
        status: candidate.status || lockTournament.status || 'active',
        teams: Array.isArray(candidate.teams) && candidate.teams.length > 0
          ? candidate.teams
          : (Array.isArray(lockTournament.teams) ? lockTournament.teams : []),
        fixtures: Array.isArray(candidate.fixtures) && candidate.fixtures.length > 0
          ? candidate.fixtures
          : (Array.isArray(lockTournament.fixtures) ? lockTournament.fixtures : []),
        bracket: Array.isArray(candidate.bracket) && candidate.bracket.length > 0
          ? candidate.bracket
          : (Array.isArray(lockTournament.bracket) ? lockTournament.bracket : []),
        aiSummaries: Array.isArray(candidate.aiSummaries) && candidate.aiSummaries.length > 0
          ? candidate.aiSummaries
          : (Array.isArray(lockTournament.aiSummaries) ? lockTournament.aiSummaries : []),
        swapHistory: Array.isArray(candidate.swapHistory) && candidate.swapHistory.length > 0
          ? candidate.swapHistory
          : (Array.isArray(lockTournament.swapHistory) ? lockTournament.swapHistory : []),
      };
    };

    const normalizedTargetId = tournamentId ? String(tournamentId) : '';
    const normalizedLockName = (activeTournamentLock?.name || '').trim().toLowerCase();
    const findLocalActive = () => {
      if (normalizedTargetId) {
        const byId = (tournamentHistory || []).find((item) => (
          matchesTournamentId(item, normalizedTargetId)
          && item?.status === 'active'
          && !item?.champion
        ));
        if (byId) return byId;
      }
      if (normalizedLockName) {
        const byName = (tournamentHistory || []).find((item) => (
          item?.status === 'active'
          && !item?.champion
          && (item?.name || '').trim().toLowerCase() === normalizedLockName
        ));
        if (byName) return byName;
      }
      return findActiveTournament(tournamentHistory);
    };

    let active = null;
    if (normalizedTargetId) {
      const detailedTarget = await ensureTournamentDetailsForId(normalizedTargetId);
      if (detailedTarget?.status === 'active' && !detailedTarget?.champion) {
        active = detailedTarget;
      }
    }

    if (!active) {
      const local = findLocalActive();
      if (local) {
        if (local.isSummary && isAppwriteEnabled && (local.appwriteId || local.id)) {
          const detailed = await ensureTournamentDetailsForId(local.appwriteId || local.id);
          active = detailed ? pickPreferredTournament(local, detailed) : null;
        } else {
          active = local;
        }
      }
    }

    if (!active) {
      const lockTournament = buildTournamentFromLock(activeTournamentLock);
      if (lockTournament?.id && isAppwriteEnabled) {
        const detailedLock = await ensureTournamentDetailsForId(lockTournament.id);
        active = detailedLock ? pickPreferredTournament(lockTournament, detailedLock) : null;
      } else if (lockTournament) {
        active = lockTournament;
      }
    }

    active = mergeWithLockIfRicher(active);

    if (!active && isAppwriteEnabled) {
      try {
        const activeSummaries = await queryClient.fetchQuery({
          queryKey: queryKeys.tournamentSummaries(activeGroup?.id),
          queryFn: () => tournamentService.getTournamentSummaries(20, activeGroup?.id, ['active']),
          staleTime: 30 * 1000,
        });
        const candidate = normalizedTargetId
          ? (activeSummaries || []).find((item) => matchesTournamentId(item, normalizedTargetId))
          : findActiveTournament(activeSummaries);
        if (candidate) {
          setTournamentHistory((prev) => upsertTournamentInHistory(prev, candidate));
          const detailed = await ensureTournamentDetailsForId(candidate.appwriteId || candidate.id);
          active = detailed ? pickPreferredTournament(candidate, detailed) : null;
        }
      } catch {
        // Ignore network issues and fallback to the existing local state.
      }
    }

    active = mergeWithLockIfRicher(active);

    if (!active || active.status !== 'active' || active.champion) {
      showToast('Live tournament exists but could not be loaded yet. Please refresh once.', 'error');
      return;
    }

    const resumed = resumeActiveTournament(active);
    if (!resumed) {
      showToast('Unable to resume active tournament', 'error');
      return;
    }
    showToast(`Resumed "${active.name || 'Live tournament'}"`);
  };

  const handleDeleteActiveTournament = async (tournamentId) => {
    const normalizedTargetId = tournamentId ? String(tournamentId) : '';
    const normalizedLockName = (activeTournamentLock?.name || '').trim().toLowerCase();
    const findLocalTarget = () => {
      if (normalizedTargetId) return normalizedTargetId;
      const fromHistory = normalizedLockName
        ? (tournamentHistory || []).find((item) => (
            item?.status === 'active'
            && !item?.champion
            && (item?.name || '').trim().toLowerCase() === normalizedLockName
          ))
        : findActiveTournament(tournamentHistory);
      return fromHistory ? (getTournamentIdCandidates(fromHistory)[0] || '') : '';
    };

    let targetId = findLocalTarget();
    if (!targetId) {
      const lockId = String(activeTournamentLock?.id || '').trim();
      if (lockId) targetId = lockId;
    }

    if (!targetId) {
      showToast('Unable to resolve live tournament to delete', 'error');
      return;
    }

    const confirmed = await requestConfirmAction({
      title: 'Delete Tournament',
      message: 'Delete this tournament?',
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      tone: 'danger',
    });
    if (!confirmed) return;
    invalidateHydrationRequests();

    const targetTournament = (tournamentHistory || []).find((item) => matchesTournamentId(item, targetId));
    const normalizedTargetName = normalizeTournamentName(targetTournament?.name || activeTournamentLock?.name);
    const deleteIds = Array.from(new Set(
      [targetId, targetTournament?.id, targetTournament?.appwriteId, activeTournamentLock?.id]
        .map((value) => String(value || '').trim())
        .filter(Boolean)
    ));

    const needsHydration = isAppwriteEnabled && (!historyHydrated || !casualHydrated);
    if (needsHydration) {
      showToast('Preparing delete...');
      await Promise.all([
        ensureTournamentHistoryHydrated(),
        ensureCasualMatchesHydrated(),
      ]);
    }

    const deleted = await handleDeleteTournamentFromSetup(targetId, {
      skipConfirm: true,
      skipProgressToast: needsHydration,
      awaitCloudSync: true,
    });
    if (!deleted) return;
    setTournamentHistory((prev) => removeTournamentFromList(prev, {
      targetIds: deleteIds,
      targetName: normalizedTargetName,
      removeActiveByName: true,
    }));
    setActiveTournamentLock(null);
    clearBootstrapActiveTournamentCache();
    if (deleteIds.some((id) => String(currentTournamentId || '').trim() === id)) {
      setCurrentTournamentId(null);
    }
    pruneTournamentQueryCacheAfterDelete({
      targetIds: deleteIds,
      targetName: normalizedTargetName,
      removeActiveByName: true,
    });
  };

  const TOURNAMENT_DETAIL_STALE_TIME_MS = 2 * 60 * 1000;

  const ensureTournamentDetailsForId = async (tournamentId) => {
    const targetId = String(tournamentId || '').trim();
    if (!targetId) return null;
    const existing = (tournamentHistory || []).find(
      (item) => matchesTournamentId(item, targetId)
    );
    if (!isAppwriteEnabled) return existing || null;

    try {
      if (existing && !existing?.isSummary) {
        queryClient.setQueryData(
          queryKeys.tournamentDetail(activeGroup?.id, targetId),
          existing
        );
      }
      const full = await queryClient.fetchQuery({
        queryKey: queryKeys.tournamentDetail(activeGroup?.id, targetId),
        queryFn: () => tournamentService.getTournamentById(targetId, activeGroup?.id),
        staleTime: TOURNAMENT_DETAIL_STALE_TIME_MS,
      });
      if (!full) return existing || null;
      setTournamentHistory((prev) => upsertTournamentInHistory(prev, full));
      return full;
    } catch (error) {
      if (Number(error?.code) === 404) {
        const normalizedTargetName = normalizeTournamentName(existing?.name);
        const deleteIds = [targetId];
        setTournamentHistory((prev) => removeTournamentFromList(prev, {
          targetIds: deleteIds,
          targetName: normalizedTargetName,
          removeActiveByName: true,
        }));
        pruneTournamentQueryCacheAfterDelete({
          targetIds: deleteIds,
          targetName: normalizedTargetName,
          removeActiveByName: true,
        });
        if (String(activeTournamentLock?.id || '').trim() === targetId) {
          setActiveTournamentLock(null);
          clearBootstrapActiveTournamentCache();
        }
        return null;
      }
      console.error('Failed to load tournament details:', error);
      showToast('Failed to load tournament details', 'error');
      return existing || null;
    }
  };

  const handleRefreshTournamentFromCloud = async () => {
    if (!isAppwriteEnabled) return false;
    const targetId = String(currentTournamentId || '').trim()
      || String(activeTournamentLock?.id || '').trim();
    if (!targetId) return false;

    try {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.tournamentDetail(activeGroup?.id, targetId),
      });
      const detailed = await ensureTournamentDetailsForId(targetId);
      if (!detailed) return false;
      if (step === 'tournament') {
        resumeActiveTournament(detailed);
      }
      return true;
    } catch (error) {
      console.error('Failed to refresh live tournament:', error);
      return false;
    }
  };

  const handleEditScheduledTournament = async (tournamentId) => {
    const scheduled = await ensureTournamentDetailsForId(tournamentId);
    if (!scheduled) return;

    const scheduledGameMode = scheduled.gameMode || 'doubles';
    const normalizedTeams = (scheduled.teams || []).map((team, index) => {
      const player1 = team.player1 || team.player || '';
      return {
        ...team,
        id: index + 1,
        player1,
        player: player1,
        player2: scheduledGameMode === 'singles' ? '' : (team.player2 || ''),
      };
    });

    setTournamentName(scheduled.name || '');
    setFormat(scheduled.format || '1');
    setGameMode(scheduledGameMode);
    setTournamentFormat(normalizeTournamentFormat(scheduled.tournamentFormat || 'league'));
    setNumTeams(normalizedTeams.length || 3);
    setOddPlayerEnabled(Boolean(scheduled.oddPlayerEnabled));
    setOddPlayerName((scheduled.oddPlayerName || '').trim());
    setTeams(normalizedTeams);
    setPendingPrefilledTeams(normalizedTeams);
    setStep('teams');
    showToast('Scheduled tournament loaded. You can edit teams now.');
  };

  const handleStartScheduledTournament = async (tournamentId) => {
    const scheduled = await ensureTournamentDetailsForId(tournamentId);
    if (!scheduled) return;

    const scheduledGameMode = scheduled.gameMode || 'doubles';
    const normalizedTeams = (scheduled.teams || []).map((team, index) => {
      const player1 = team.player1 || team.player || '';
      return {
        ...team,
        id: index + 1,
        player1,
        player: player1,
        player2: scheduledGameMode === 'singles' ? '' : (team.player2 || ''),
      };
    });

    setTournamentName(scheduled.name || '');
    setFormat(scheduled.format || '1');
    setGameMode(scheduledGameMode);
    setTournamentFormat(normalizeTournamentFormat(scheduled.tournamentFormat || 'league'));
    setNumTeams(normalizedTeams.length || 3);
    setOddPlayerEnabled(Boolean(scheduled.oddPlayerEnabled));
    setOddPlayerName((scheduled.oddPlayerName || '').trim());
    generateFixtures({
      teamsOverride: normalizedTeams,
      tournamentFormatOverride: normalizeTournamentFormat(scheduled.tournamentFormat || 'league'),
      formatOverride: scheduled.format || '1',
      gameModeOverride: scheduledGameMode,
      tournamentNameOverride: scheduled.name || '',
      oddPlayerConfig: {
        oddPlayerEnabled: Boolean(scheduled.oddPlayerEnabled),
        oddPlayerName: (scheduled.oddPlayerName || '').trim(),
      },
    });
  };

  useEffect(() => {
    if (!isAppwriteEnabled) return;
    if (step !== 'setup') return;
    if (requiresAuth && !activeGroup?.id) return;
    if (historyHydrated && casualHydrated) return;
    if (historyHydrationPending || casualHydrationPending) return;
    const now = Date.now();
    if (now < setupHydrationRetryAtRef.current) return;
    setupHydrationRetryAtRef.current = now + 2500;

    const tasks = [];
    if (!historyHydrated) {
      tasks.push(ensureTournamentHistoryHydrated({ silent: true }));
    }
    if (!casualHydrated) {
      tasks.push(ensureCasualMatchesHydrated({ silent: true }));
    }
    if (tasks.length > 0) {
      void Promise.allSettled(tasks);
    }
    return undefined;
  }, [
    isAppwriteEnabled,
    step,
    requiresAuth,
    activeGroup?.id,
    historyHydrated,
    casualHydrated,
    historyHydrationPending,
    casualHydrationPending,
    ensureTournamentHistoryHydrated,
    ensureCasualMatchesHydrated,
  ]);

  const handleOpenHistoryModal = () => {
    setShowHistory(true);
    if (isAppwriteEnabled && !historyHydrated && !historyHydrationPending) {
      void ensureTournamentHistoryHydrated();
    }
  };

  const handleOpenCasualHistoryModal = () => {
    setShowCasualHistory(true);
    if (isAppwriteEnabled && !casualHydrated && !casualHydrationPending) {
      void ensureCasualMatchesHydrated();
    }
  };

  const handleOpenAllTimeStatsModal = () => {
    setShowAllTimeStats(true);
    if (isAppwriteEnabled) {
      if (!historyHydrated && !historyHydrationPending) void ensureTournamentHistoryHydrated();
      if (!casualHydrated && !casualHydrationPending) void ensureCasualMatchesHydrated();
    }
  };

  const handleOpenEloModal = () => {
    setShowEloLeaderboard(true);
    if (isAppwriteEnabled) {
      if (!historyHydrated && !historyHydrationPending) void ensureTournamentHistoryHydrated();
      if (!casualHydrated && !casualHydrationPending) void ensureCasualMatchesHydrated();
    }
  };

  const shouldHydrateForTournamentDelete = (id) => {
    const target = (tournamentHistory || []).find((item) => (
      matchesTournamentId(item, id)
    ));
    if (!target) return false;
    return target.status !== 'scheduled';
  };

  const handleDeleteTournamentWithHydration = async (id) => {
    const normalizedId = String(id || '').trim();
    const target = (tournamentHistory || []).find((item) => matchesTournamentId(item, normalizedId));
    const confirmed = await requestConfirmAction({
      title: 'Delete Tournament',
      message: 'Delete this tournament?',
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      tone: 'danger',
    });
    if (!confirmed) return;
    invalidateHydrationRequests();
    const needsHydration = (
      isAppwriteEnabled
      && shouldHydrateForTournamentDelete(normalizedId)
      && (!historyHydrated || !casualHydrated)
    );
    if (needsHydration) {
      showToast('Preparing delete...');
      await Promise.all([
        ensureTournamentHistoryHydrated(),
        ensureCasualMatchesHydrated(),
      ]);
    }
    const deleted = await handleDeleteTournamentFromSetup(normalizedId, {
      skipConfirm: true,
      skipProgressToast: needsHydration,
    });
    if (!deleted || !isAppwriteEnabled) return;

    const deleteIds = Array.from(new Set(
      [normalizedId, target?.id, target?.appwriteId]
        .map((value) => String(value || '').trim())
        .filter(Boolean)
    ));
    const normalizedTargetName = normalizeTournamentName(target?.name);
    const removeActiveByName = Boolean(target?.status === 'active' && !target?.champion && normalizedTargetName);
    if (removeActiveByName) {
      clearBootstrapActiveTournamentCache();
    }
    pruneTournamentQueryCacheAfterDelete({
      targetIds: deleteIds,
      targetName: normalizedTargetName,
      removeActiveByName,
    });
  };

  const handleDeleteCasualWithHydration = async (id) => {
    const confirmed = await requestConfirmAction({
      title: 'Delete Casual Match',
      message: 'Delete this casual match?',
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      tone: 'danger',
    });
    if (!confirmed) return;
    invalidateHydrationRequests();
    const needsHydration = isAppwriteEnabled && (!historyHydrated || !casualHydrated);
    if (needsHydration) {
      showToast('Preparing delete...');
      await Promise.all([
        ensureTournamentHistoryHydrated(),
        ensureCasualMatchesHydrated(),
      ]);
    }
    const deleted = await handleDeleteCasualMatchFromSetup(id, {
      skipConfirm: true,
      skipProgressToast: needsHydration,
    });
    if (!deleted || !isAppwriteEnabled) return;
    const normalizedId = String(id || '').trim();
    queryClient.setQueryData(
      queryKeys.casualMatches(activeGroup?.id),
      (cached) => (Array.isArray(cached) ? cached : []).filter((item) => {
        const itemId = String(item?.id || '').trim();
        const itemAppwriteId = String(item?.appwriteId || '').trim();
        return itemId !== normalizedId && itemAppwriteId !== normalizedId;
      })
    );
  };

  const handleResetTournamentWithHydration = async () => {
    const confirmed = await requestConfirmAction({
      title: 'Delete & Start New',
      message: 'Delete this tournament and start new? This will remove its impact from ELO/stats.',
      confirmLabel: 'Delete & Start New',
      cancelLabel: 'Cancel',
      tone: 'danger',
    });
    if (!confirmed) return;
    invalidateHydrationRequests();

    const fallbackDeleteIds = Array.from(new Set([
      String(currentTournamentId || '').trim(),
      String(activeTournamentLock?.id || '').trim(),
      ...activeLiveTournaments.flatMap((item) => getTournamentIdCandidates(item)),
    ].map((value) => String(value || '').trim()).filter(Boolean)));
    const fallbackTargetName = normalizeTournamentName(tournamentName || activeTournamentLock?.name || '');

    if (isAppwriteEnabled && (!historyHydrated || !casualHydrated)) {
      showToast('Preparing delete...');
      await Promise.all([
        ensureTournamentHistoryHydrated(),
        ensureCasualMatchesHydrated(),
      ]);
    }
    const result = await resetTournament({ skipConfirm: true, waitForCloudSync: true });
    if (!result?.success || !isAppwriteEnabled) return;

    const deleteIds = Array.from(new Set([
      ...fallbackDeleteIds,
      ...((Array.isArray(result?.deleteIds) ? result.deleteIds : []).map((value) => String(value || '').trim()).filter(Boolean)),
    ]));
    const normalizedTargetName = normalizeTournamentName(result?.targetName || fallbackTargetName);
    setTournamentHistory((prev) => removeTournamentFromList(prev, {
      targetIds: deleteIds,
      targetName: normalizedTargetName,
      removeActiveByName: true,
    }));
    setActiveTournamentLock(null);
    clearBootstrapActiveTournamentCache();
    if (deleteIds.some((id) => String(currentTournamentId || '').trim() === id)) {
      setCurrentTournamentId(null);
    }
    pruneTournamentQueryCacheAfterDelete({
      targetIds: deleteIds,
      targetName: normalizedTargetName,
      removeActiveByName: true,
    });
  };

  const handleHeaderGoHome = () => {
    setShowRequestCenter(false);
    setShowCasualMatch(false);
    goHome();
  };

  const handleMobileGoHome = () => {
    setShowHistory(false);
    setShowCasualHistory(false);
    setShowAllTimeStats(false);
    setShowEloLeaderboard(false);
    setShowCasualMatch(false);
    setShowUtilityDrawer(false);
    if (step !== 'setup' || showRequestCenter) {
      handleHeaderGoHome();
    }
  };

  const handleMobileOpenProfile = () => {
    setShowUtilityDrawer(false);
    if (!requiresAuth || !currentUser) return;
    setShowProfileModal(true);
  };

  const handleMobileRecordCasual = () => {
    setShowUtilityDrawer(false);
    if (!assertCanOperate()) return;
    if (step !== 'setup' || showRequestCenter) {
      handleHeaderGoHome();
    }
    setShowCasualMatch(true);
  };

  const handleMobileGoLive = async () => {
    setShowUtilityDrawer(false);
    if (step === 'tournament') return;

    const liveTournament = activeLiveTournaments[0] || null;
    if (!liveTournament) {
      showToast('No live tournament to resume yet', 'error');
      return;
    }

    const targetId = liveTournament.id || liveTournament.appwriteId || null;
    await withActionLock(
      `setup.resume-live.${String(targetId || 'active')}`,
      () => handleResumeActiveTournament(targetId)
    );
  };

  const handleMobileOpenHistory = () => {
    setShowUtilityDrawer(false);
    if (step !== 'setup' || showRequestCenter) {
      handleHeaderGoHome();
    }
    void handleOpenHistoryModal();
  };

  const handleMobileOpenStats = () => {
    setShowUtilityDrawer(false);
    if (step !== 'setup' || showRequestCenter) {
      handleHeaderGoHome();
    }
    void handleOpenAllTimeStatsModal();
  };

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
  });

  const tournamentViewProps = {
    ...tournamentShellProps,
    calculatePointsTable,
    calculatePlayerStats,
    getPlayerLeaderboard,
  };

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
    if (showUtilityDrawer) return 'action';
    if (showProfileModal) return 'profile';
    if (showAllTimeStats || showEloLeaderboard || showRequestCenter) return 'stats';
    if (showHistory || showCasualHistory) return 'home';
    if (step === 'tournament') return 'live';
    return 'home';
  }, [
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
        onConfirmAction={requestConfirmAction}
        viewerDashboardProps={viewerDashboardProps}
        setupScreenProps={setupScreenProps}
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
            onPrimaryAction={() => setShowUtilityDrawer((prev) => !prev)}
          />
        </>
      )}
    </>
  );
};

export default App;
