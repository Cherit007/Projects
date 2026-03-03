import React, { Suspense, lazy, useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, House, Moon, SlidersHorizontal, Sun, UserCircle2, X } from 'lucide-react';
import AppViewRouter from './components/AppViewRouter';
import MobileBottomNav from './components/MobileBottomNav';
import Toast from './components/Toast';
import PwaControls from './components/PwaControls';
import { useAppwriteSync } from './hooks/useAppwriteSync';
import { usePlayerDerivedData } from './hooks/usePlayerDerivedData';
import { useAuthGroupActions } from './hooks/useAuthGroupActions';
import { useTournamentActions } from './hooks/useTournamentActions';
import { useSetupPrefetchEffect } from './hooks/useSetupPrefetchEffect';
import { useAuthBootstrapEffect } from './hooks/useAuthBootstrapEffect';
import { useInitialDataLoadEffect } from './hooks/useInitialDataLoadEffect';
import { useMemberLinkEffect } from './hooks/useMemberLinkEffect';
import { useAdminRequestsEffect } from './hooks/useAdminRequestsEffect';
import { useAppStoreShallow } from './store/appStore';
import { casualMatchService } from './services/casualmatchservice';
import { authService } from './services/authService';
import { groupService } from './services/groupService';
import { tournamentService } from './services/tournamentService';
import { appDataService } from './services/appDataService';
import {
  calculatePointsTable, 
  calculatePlayerStats, 
  calculateCumulativePlayerStats,
  getPlayerLeaderboard,
  updatePlayerRatingsAfterMatch,
} from './utils/calculations';
import { normalizePhotoInput } from './utils/playerPhotos';
import { playerPhotoStorageService } from './services/playerPhotoStorageService';

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
      localStorage.setItem('badminton_theme_mode', themeMode);
    } catch {
      // Ignore storage errors (private mode / quota issues).
    }
  }, [themeMode]);

  const normalizeTournamentFormat = (value) =>
    value === 'playInFinal' ? 'knockoutByes' : value;
  const findActiveTournament = (history = []) => {
    if (!Array.isArray(history)) return null;
    return history.find(item => item?.status === 'active') || null;
  };

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

  const normalizeTemplateTeams = (teamsData = [], templateGameMode = 'doubles', templateNumTeams = 3) => {
    const safeNumTeams = Math.max(3, parseInt(templateNumTeams, 10) || 3);
    return Array.from({ length: safeNumTeams }, (_, index) => {
      const rawTeam = teamsData[index] || {};
      const player1 = rawTeam.player1 || rawTeam.player || '';
      return {
        id: index + 1,
        emoji: rawTeam.emoji || '🏸',
        name: rawTeam.name || '',
        player1,
        player: player1,
        player2: templateGameMode === 'singles' ? '' : (rawTeam.player2 || ''),
      };
    });
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
  const [showCasualMatch, setShowCasualMatch] = useState(false);
  const [oddPlayerEnabled, setOddPlayerEnabled] = useState(false);
  const [oddPlayerName, setOddPlayerName] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [showCasualHistory, setShowCasualHistory] = useState(false);
  const [showAllTimeStats, setShowAllTimeStats] = useState(false);
  const [showEloLeaderboard, setShowEloLeaderboard] = useState(false);
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
  const [pendingLinkPrompt, setPendingLinkPrompt] = useState(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
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
  const [pendingActions, setPendingActions] = useState({});
  const pendingActionsRef = useRef({});
  const [isMobileViewport, setIsMobileViewport] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(max-width: 767px)').matches;
  });
  const [showUtilityDrawer, setShowUtilityDrawer] = useState(false);

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

  const mergeMemberLinks = (incomingMembers = [], baselineMembers = []) => {
    const baseline = Array.isArray(baselineMembers) ? baselineMembers : [];
    return (Array.isArray(incomingMembers) ? incomingMembers : []).map((member) => {
      const byId = baseline.find((item) => item.id && member.id && item.id === member.id);
      const byName = baseline.find((item) => (
        (item.name || '').trim().toLowerCase() === (member.name || '').trim().toLowerCase()
      ));
      const source = byId || byName;
      if (!source) return member;
      return {
        ...member,
        linkedAccountId: member.linkedAccountId || source.linkedAccountId,
        linkedEmail: member.linkedEmail || source.linkedEmail,
      };
    });
  };

  const normalizeMemberName = (value) => String(value || '').trim().toLowerCase();

  const getMemberIdentityKey = (member) => {
    const id = String(member?.id || '').trim();
    if (id) return `id:${id}`;
    const name = normalizeMemberName(member?.name);
    return name ? `name:${name}` : '';
  };

  const membersMatchIdentity = (left, right) => {
    const leftId = String(left?.id || '').trim();
    const rightId = String(right?.id || '').trim();
    if (leftId && rightId) return leftId === rightId;
    const leftName = normalizeMemberName(left?.name);
    const rightName = normalizeMemberName(right?.name);
    return Boolean(leftName && rightName && leftName === rightName);
  };

  const hasMemberLink = (member) => Boolean(
    String(member?.linkedAccountId || '').trim()
    || String(member?.linkedEmail || '').trim()
  );

  const areMemberLinksEqual = (left, right) => (
    String(left?.linkedAccountId || '').trim() === String(right?.linkedAccountId || '').trim()
    && String(left?.linkedEmail || '').trim().toLowerCase() === String(right?.linkedEmail || '').trim().toLowerCase()
  );

  const mergeMembersForCloudSave = ({
    nextMembers = [],
    baselineMembers = [],
    remoteMembers = [],
  } = {}) => {
    const next = Array.isArray(nextMembers) ? nextMembers : [];
    const baseline = Array.isArray(baselineMembers) ? baselineMembers : [];
    const remote = Array.isArray(remoteMembers) ? remoteMembers : [];

    const removedKeys = new Set(
      baseline
        .filter((member) => !next.some((candidate) => membersMatchIdentity(candidate, member)))
        .map(getMemberIdentityKey)
        .filter(Boolean)
    );

    const merged = next.map((member) => ({ ...member }));

    remote.forEach((remoteMember) => {
      const remoteKey = getMemberIdentityKey(remoteMember);
      if (!remoteKey) return;

      const index = merged.findIndex((member) => membersMatchIdentity(member, remoteMember));
      if (index === -1) {
        if (removedKeys.has(remoteKey)) return;
        merged.push({ ...remoteMember });
        return;
      }

      const candidate = merged[index];
      if (hasMemberLink(candidate) || !hasMemberLink(remoteMember)) return;

      const baselineMember = baseline.find((member) => membersMatchIdentity(member, candidate)) || null;
      const linkChangedLocally = baselineMember ? !areMemberLinksEqual(candidate, baselineMember) : false;
      if (linkChangedLocally) return;

      merged[index] = {
        ...candidate,
        linkedAccountId: candidate.linkedAccountId || remoteMember.linkedAccountId,
        linkedEmail: candidate.linkedEmail || remoteMember.linkedEmail,
      };
    });

    return merged;
  };

  const buildMemberAccountLinks = (membersList = []) => {
    const links = { byId: {}, byName: {} };
    (Array.isArray(membersList) ? membersList : []).forEach((member) => {
      const linkedAccountId = member?.linkedAccountId;
      const linkedEmail = member?.linkedEmail;
      if (!linkedAccountId && !linkedEmail) return;

      const linkValue = {
        linkedAccountId: linkedAccountId || '',
        linkedEmail: linkedEmail || '',
      };
      if (member?.id) links.byId[member.id] = linkValue;
      const normalizedName = (member?.name || '').trim().toLowerCase();
      if (normalizedName) links.byName[normalizedName] = linkValue;
    });
    return links;
  };

  const applyMemberAccountLinks = (membersList = [], memberAccountLinks = {}) => {
    const byId = memberAccountLinks?.byId || {};
    const byName = memberAccountLinks?.byName || {};
    return (Array.isArray(membersList) ? membersList : []).map((member) => {
      const normalizedName = (member?.name || '').trim().toLowerCase();
      const linkFromId = member?.id ? byId[member.id] : null;
      const linkFromName = normalizedName ? byName[normalizedName] : null;
      const source = linkFromId || linkFromName || {};
      return {
        ...member,
        linkedAccountId: member?.linkedAccountId || source.linkedAccountId,
        linkedEmail: member?.linkedEmail || source.linkedEmail,
      };
    });
  };

  const deriveRatingsFromHistory = ({ history = [], casual = [] } = {}) => {
    const toTimestamp = (value) => {
      const parsed = Date.parse(String(value || ''));
      return Number.isFinite(parsed) ? parsed : 0;
    };

    const normalizeCompletedMatch = (match) => {
      if (!match?.team1 || !match?.team2 || !match?.completed) return null;
      const score1 = Number(match?.score1);
      const score2 = Number(match?.score2);
      if (!Number.isFinite(score1) || !Number.isFinite(score2) || score1 === score2) return null;
      return {
        ...match,
        score1,
        score2,
        completed: true,
      };
    };

    const sortByTimeAscending = (list = []) => [...list].sort((a, b) => {
      const aTime = Math.max(
        toTimestamp(a?.createdAt),
        toTimestamp(a?.updatedAt),
        toTimestamp(a?.date),
      );
      const bTime = Math.max(
        toTimestamp(b?.createdAt),
        toTimestamp(b?.updatedAt),
        toTimestamp(b?.date),
      );
      if (aTime !== bTime) return aTime - bTime;
      return String(a?.id || a?.appwriteId || '').localeCompare(String(b?.id || b?.appwriteId || ''));
    });

    let rebuilt = {};

    sortByTimeAscending(Array.isArray(history) ? history : []).forEach((tournament) => {
      (Array.isArray(tournament?.fixtures) ? tournament.fixtures : [])
        .map(normalizeCompletedMatch)
        .filter(Boolean)
        .forEach((match) => {
          rebuilt = updatePlayerRatingsAfterMatch(rebuilt, match);
        });

      (Array.isArray(tournament?.bracket) ? tournament.bracket : [])
        .flatMap((round) => (Array.isArray(round) ? round : []))
        .map(normalizeCompletedMatch)
        .filter(Boolean)
        .forEach((match) => {
          rebuilt = updatePlayerRatingsAfterMatch(rebuilt, match);
        });

      const finalMatch = normalizeCompletedMatch(tournament?.finalMatch);
      if (finalMatch) {
        rebuilt = updatePlayerRatingsAfterMatch(rebuilt, finalMatch);
      }
    });

    sortByTimeAscending(Array.isArray(casual) ? casual : [])
      .map(normalizeCompletedMatch)
      .filter(Boolean)
      .forEach((match) => {
        rebuilt = updatePlayerRatingsAfterMatch(rebuilt, match);
      });

    return rebuilt;
  };

  const recoverRatingsIfMissing = ({ history = tournamentHistory, casual = casualMatches } = {}) => {
    const current = playerRatings && typeof playerRatings === 'object' ? playerRatings : {};
    if (Object.keys(current).length > 0) return current;
    const rebuilt = deriveRatingsFromHistory({ history, casual });
    if (Object.keys(rebuilt).length === 0) return current;
    setPlayerRatings(rebuilt);
    return rebuilt;
  };

  const cloneRatingsSnapshot = (ratings = {}) => (
    JSON.parse(JSON.stringify(ratings && typeof ratings === 'object' ? ratings : {}))
  );

  const buildRatingsDelta = (previousRatings = {}, nextRatings = {}) => {
    const previous = previousRatings && typeof previousRatings === 'object' ? previousRatings : {};
    const next = nextRatings && typeof nextRatings === 'object' ? nextRatings : {};
    const changedRatings = {};
    const deletedPlayerNames = [];

    Object.entries(next).forEach(([playerName, snapshot]) => {
      const before = previous[playerName];
      if (JSON.stringify(before || null) === JSON.stringify(snapshot || null)) return;
      changedRatings[playerName] = snapshot;
    });

    Object.keys(previous).forEach((playerName) => {
      if (Object.prototype.hasOwnProperty.call(next, playerName)) return;
      deletedPlayerNames.push(playerName);
    });

    return { changedRatings, deletedPlayerNames };
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
  const requiresAuth = isAppwriteEnabled;
  const canOperate = !requiresAuth || groupRole === 'admin' || groupRole === 'member';
  const canDelete = !requiresAuth || groupRole === 'admin';
  const canManageMembers = !requiresAuth || groupRole === 'admin';
  const isViewerMode = requiresAuth && groupRole === 'viewer';
  const unreadRequestCount = useMemo(
    () => pendingJoinRequests.filter(item => !seenPendingRequestIds.includes(item.id)).length,
    [pendingJoinRequests, seenPendingRequestIds]
  );
  const pendingActionCount = useMemo(
    () => Object.keys(pendingActions || {}).length,
    [pendingActions]
  );
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

  const assertCanOperate = () => {
    if (canOperate) return true;
    showToast('Read-only access: viewers can only watch', 'error');
    return false;
  };

  const assertCanDelete = () => {
    if (canDelete) return true;
    showToast('Only group admin can delete data', 'error');
    return false;
  };

  const assertCanManageMembers = () => {
    if (canManageMembers) return true;
    showToast('Only group admin can manage members', 'error');
    return false;
  };

  const queryKeys = useMemo(() => ({
    authCurrentUser: ['auth', 'current-user'],
    publicGroups: ['groups', 'public'],
    userGroups: (userId) => ['groups', 'user', userId],
    userPendingGroupIds: (userId) => ['groups', 'pending', userId],
    adminPendingRequests: (groupId, userId) => ['groups', 'admin', groupId, 'pending', userId],
    adminRecentReviews: (groupId, userId) => ['groups', 'admin', groupId, 'recent', userId],
    adminGroupMembers: (groupId, userId) => ['groups', 'admin', groupId, 'members', userId],
    appwriteData: (groupId) => ['appwrite', 'bootstrap', groupId || 'nogroup'],
    tournamentSummaries: (groupId) => ['tournaments', 'summaries', groupId || 'nogroup'],
    tournamentHistory: (groupId) => ['tournaments', 'history', groupId || 'nogroup'],
    tournamentDetail: (groupId, tournamentId) => ['tournaments', 'detail', groupId || 'nogroup', String(tournamentId || '')],
    casualMatches: (groupId) => ['casual-matches', groupId || 'nogroup'],
  }), []);

  const loginMutation = useMutation({
    mutationFn: ({ email, password }) => authService.login(email, password),
  });
  const registerMutation = useMutation({
    mutationFn: ({ name, email, password }) => authService.register(name, email, password),
  });
  const logoutMutation = useMutation({
    mutationFn: () => authService.logout(),
  });
  const updateNameMutation = useMutation({
    mutationFn: (name) => authService.updateName(name),
  });
  const createGroupMutation = useMutation({
    mutationFn: ({ name, user }) => groupService.createGroup({ name, user }),
  });
  const requestAccessMutation = useMutation({
    mutationFn: ({ groupId, user }) => groupService.requestGroupAccess({ groupId, user }),
  });
  const approveJoinMutation = useMutation({
    mutationFn: ({ requestId, adminUserId }) => groupService.approveJoinRequest({ requestId, adminUserId }),
  });
  const rejectJoinMutation = useMutation({
    mutationFn: ({ requestId, adminUserId }) => groupService.rejectJoinRequest({ requestId, adminUserId }),
  });
  const updateGroupMemberRoleMutation = useMutation({
    mutationFn: ({ groupId, targetUserId, nextRole, adminUserId }) => groupService.updateGroupMemberRole({
      groupId,
      targetUserId,
      nextRole,
      adminUserId,
    }),
  });
  const removeGroupMemberMutation = useMutation({
    mutationFn: ({ groupId, targetUserId, adminUserId }) => groupService.removeGroupMember({
      groupId,
      targetUserId,
      adminUserId,
    }),
  });
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

  const fetchCurrentUser = async () => queryClient.fetchQuery({
    queryKey: queryKeys.authCurrentUser,
    queryFn: () => authService.getCurrentUser(),
    staleTime: 15 * 1000,
  });

  const refreshGroups = async (user) => {
    if (!user) {
      setAvailableGroups([]);
      return [];
    }
    const groups = await queryClient.fetchQuery({
      queryKey: queryKeys.userGroups(user.$id),
      queryFn: () => groupService.getUserGroups(user.$id),
      staleTime: 15 * 1000,
    });
    setAvailableGroups(groups);
    return groups;
  };

  const refreshPublicGroups = async () => {
    const groups = await queryClient.fetchQuery({
      queryKey: queryKeys.publicGroups,
      queryFn: () => groupService.getAllGroups(),
      staleTime: 30 * 1000,
    });
    setPublicGroups(groups);
    return groups;
  };

  const getTournamentIdCandidates = (tournament) => Array.from(new Set(
    [tournament?.appwriteId, tournament?.id]
      .map((value) => String(value || '').trim())
      .filter(Boolean)
  ));

  const matchesTournamentId = (tournament, targetId) => {
    const normalizedTarget = String(targetId || '').trim();
    if (!normalizedTarget) return false;
    return getTournamentIdCandidates(tournament).includes(normalizedTarget);
  };

  const upsertTournamentInHistory = (history = [], tournament = null) => {
    if (!tournament) return history;
    const incomingIds = getTournamentIdCandidates(tournament);
    if (incomingIds.length === 0) return [tournament, ...(Array.isArray(history) ? history : [])];
    const list = Array.isArray(history) ? history : [];
    const index = list.findIndex((item) => (
      incomingIds.some((candidateId) => matchesTournamentId(item, candidateId))
    ));
    if (index < 0) return [tournament, ...list];
    return list.map((item, idx) => (idx === index ? tournament : item));
  };

  const normalizeTournamentName = (value) => String(value || '').trim().toLowerCase();

  const removeTournamentFromList = (
    source = [],
    { targetIds = [], targetName = '', removeActiveByName = false } = {}
  ) => {
    const list = Array.isArray(source) ? source : [];
    const idSet = new Set(
      (Array.isArray(targetIds) ? targetIds : [])
        .map((value) => String(value || '').trim())
        .filter(Boolean)
    );
    const normalizedName = normalizeTournamentName(targetName);

    return list.filter((item) => {
      const itemIds = getTournamentIdCandidates(item);
      if (itemIds.some((candidateId) => idSet.has(candidateId))) return false;
      if (
        removeActiveByName
        && normalizedName
        && item?.status === 'active'
        && !item?.champion
        && normalizeTournamentName(item?.name) === normalizedName
      ) {
        return false;
      }
      return true;
    });
  };

  const pruneTournamentQueryCacheAfterDelete = ({
    targetIds = [],
    targetName = '',
    removeActiveByName = false,
  } = {}) => {
    const normalizedIds = Array.from(new Set(
      (Array.isArray(targetIds) ? targetIds : [])
        .map((value) => String(value || '').trim())
        .filter(Boolean)
    ));

    queryClient.setQueryData(
      queryKeys.tournamentSummaries(activeGroup?.id),
      (cached) => removeTournamentFromList(cached, {
        targetIds: normalizedIds,
        targetName,
        removeActiveByName,
      })
    );
    queryClient.setQueryData(
      queryKeys.tournamentHistory(activeGroup?.id),
      (cached) => removeTournamentFromList(cached, {
        targetIds: normalizedIds,
        targetName,
        removeActiveByName,
      })
    );

    normalizedIds.forEach((id) => {
      queryClient.removeQueries({
        queryKey: queryKeys.tournamentDetail(activeGroup?.id, id),
        exact: true,
      });
    });
  };

  const ensureTournamentHistoryHydrated = async ({ force = false } = {}) => {
    if (!isAppwriteEnabled) {
      setHistoryHydrated(true);
      return tournamentHistory || [];
    }
    if (!force && historyHydrated) {
      return tournamentHistory || [];
    }
    if (!force && historyHydrationPromiseRef.current) {
      return historyHydrationPromiseRef.current;
    }

    setHistoryHydrationPending(true);
    const promise = (async () => {
      try {
        const history = await queryClient.fetchQuery({
          queryKey: queryKeys.tournamentHistory(activeGroup?.id),
          queryFn: () => tournamentService.getAllTournaments(100, activeGroup?.id),
          staleTime: 5 * 60 * 1000,
        });
        setTournamentHistory(history || []);
        recoverRatingsIfMissing({
          history: history || [],
          casual: casualMatches || [],
        });
        setHistoryHydrated(true);
        return history || [];
      } catch (error) {
        console.error('Failed to load tournament history:', error);
        showToast('Failed to load tournament history', 'error');
        return tournamentHistory || [];
      } finally {
        setHistoryHydrationPending(false);
        historyHydrationPromiseRef.current = null;
      }
    })();

    historyHydrationPromiseRef.current = promise;
    return promise;
  };

  const ensureCasualMatchesHydrated = async ({ force = false } = {}) => {
    if (!isAppwriteEnabled) {
      setCasualHydrated(true);
      return casualMatches || [];
    }
    if (!force && casualHydrated) {
      return casualMatches || [];
    }
    if (!force && casualHydrationPromiseRef.current) {
      return casualHydrationPromiseRef.current;
    }

    setCasualHydrationPending(true);
    const promise = (async () => {
      try {
        const matches = await queryClient.fetchQuery({
          queryKey: queryKeys.casualMatches(activeGroup?.id),
          queryFn: () => casualMatchService.getAllCasualMatches(100, activeGroup?.id),
          staleTime: 5 * 60 * 1000,
        });
        setCasualMatches(matches || []);
        recoverRatingsIfMissing({
          history: tournamentHistory || [],
          casual: matches || [],
        });
        setCasualHydrated(true);
        return matches || [];
      } catch (error) {
        console.error('Failed to load casual match history:', error);
        showToast('Failed to load casual match history', 'error');
        return casualMatches || [];
      } finally {
        setCasualHydrationPending(false);
        casualHydrationPromiseRef.current = null;
      }
    })();

    casualHydrationPromiseRef.current = promise;
    return promise;
  };

  const prefetchHomeSetupData = async () => {
    if (!isAppwriteEnabled) return;
    const [history, casual] = await Promise.all([
      ensureTournamentHistoryHydrated(),
      ensureCasualMatchesHydrated(),
    ]);
    recoverRatingsIfMissing({ history, casual });
  };

  useSetupPrefetchEffect({
    activeGroupId: activeGroup?.id,
    isAppwriteEnabled,
    setHistoryHydrated,
    setCasualHydrated,
    historyHydrationPromiseRef,
    casualHydrationPromiseRef,
    step,
    historyHydrated,
    casualHydrated,
    historyHydrationPending,
    casualHydrationPending,
    prefetchHomeSetupData,
  });

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
    prefetchHomeSetupData,
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

    localStorage.setItem("badminton_ratings", JSON.stringify(nextRatings));
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
        localStorage.setItem("badminton_players", JSON.stringify(updated));
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
          const remoteMeta = await appDataService.getAppMeta({ force: true });
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
    localStorage.setItem("badminton_members", JSON.stringify(safeMembers));
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
    localStorage.setItem("badminton_templates", JSON.stringify(updatedTemplates));
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
            localStorage.setItem('badminton_player_photos', JSON.stringify(updated));
          });
        } else {
          localStorage.setItem('badminton_player_photos', JSON.stringify(updated));
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

  const applyTournamentTemplate = (templateId) => {
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

    showToast(`Template "${template.name}" applied`);

    if (!window.confirm('Template applied. Generate fixtures and start tournament now?')) {
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
  } = useAuthGroupActions({
    currentUser,
    activeGroup,
    groupRole,
    availableGroups,
    pendingJoinRequests,
    queryClient,
    queryKeys,
    showToast,
    refreshGroups,
    refreshPublicGroups,
    loginMutation,
    registerMutation,
    logoutMutation,
    createGroupMutation,
    requestAccessMutation,
    approveJoinMutation,
    rejectJoinMutation,
    updateGroupMemberRoleMutation,
    removeGroupMemberMutation,
    setAuthLoading,
    setIsGuestViewer,
    setCurrentUser,
    setActiveGroup,
    setGroupRole,
    setRequestedGroupIds,
    setAvailableGroups,
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

  const cumulativeAllTimeStats = useMemo(
    () => calculateCumulativePlayerStats(tournamentHistory),
    [tournamentHistory]
  );

  const eloLeaderboard = useMemo(
    () => getPlayerLeaderboard(playerRatings),
    [playerRatings]
  );

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

  const scheduledTournaments = useMemo(
    () => (tournamentHistory || []).filter((item) => item?.status === 'scheduled'),
    [tournamentHistory]
  );

  const buildTournamentFromLock = (lock) => {
    if (!lock || lock.status !== 'active') return null;
    return {
      id: lock.id || null,
      appwriteId: lock.id || null,
      name: lock.name || 'Live tournament',
      date: lock.updatedAt
        ? new Date(lock.updatedAt).toLocaleDateString()
        : '',
      teams: Array.isArray(lock.teams) ? lock.teams : [],
      fixtures: Array.isArray(lock.fixtures) ? lock.fixtures : [],
      bracket: Array.isArray(lock.bracket) ? lock.bracket : [],
      champion: lock.champion || null,
      aiSummaries: Array.isArray(lock.aiSummaries) ? lock.aiSummaries : [],
      swapHistory: Array.isArray(lock.swapHistory) ? lock.swapHistory : [],
      format: lock.format || '1',
      gameMode: lock.gameMode || 'doubles',
      tournamentFormat: normalizeTournamentFormat(lock.tournamentFormat || 'league'),
      status: 'active',
      _fromLock: true,
    };
  };

  const getTournamentProgressScore = (tournament) => {
    const completedFixtures = (Array.isArray(tournament?.fixtures) ? tournament.fixtures : [])
      .filter((match) => match?.completed).length;
    const completedBracket = (Array.isArray(tournament?.bracket) ? tournament.bracket : [])
      .flatMap((round) => (Array.isArray(round) ? round : []))
      .filter((match) => match?.completed).length;
    const championBonus = tournament?.champion ? 10000 : 0;
    return championBonus + completedFixtures + completedBracket;
  };

  const pickPreferredTournament = (primary, secondary) => {
    if (!primary) return secondary || null;
    if (!secondary) return primary;
    return getTournamentProgressScore(secondary) > getTournamentProgressScore(primary)
      ? secondary
      : primary;
  };

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
          active = pickPreferredTournament(local, detailed);
        } else {
          active = local;
        }
      }
    }

    if (!active) {
      const lockTournament = buildTournamentFromLock(activeTournamentLock);
      if (lockTournament?.id && isAppwriteEnabled) {
        const detailedLock = await ensureTournamentDetailsForId(lockTournament.id);
        active = pickPreferredTournament(lockTournament, detailedLock);
      } else if (lockTournament) {
        active = lockTournament;
      }
    }

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
          active = pickPreferredTournament(candidate, detailed);
        }
      } catch {
        // Ignore network issues and fallback to the existing local state.
      }
    }

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

    if (!window.confirm('Delete this tournament?')) return;

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
    });
    if (!deleted) return;
    setTournamentHistory((prev) => removeTournamentFromList(prev, {
      targetIds: deleteIds,
      targetName: normalizedTargetName,
      removeActiveByName: true,
    }));
    setActiveTournamentLock(null);
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
    if (!window.confirm('Delete this tournament?')) return;
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
    pruneTournamentQueryCacheAfterDelete({
      targetIds: deleteIds,
      targetName: normalizedTargetName,
      removeActiveByName,
    });
  };

  const handleDeleteCasualWithHydration = async (id) => {
    if (!window.confirm('Delete this casual match?')) return;
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
    if (isAppwriteEnabled && (!historyHydrated || !casualHydrated)) {
      await Promise.all([
        ensureTournamentHistoryHydrated(),
        ensureCasualMatchesHydrated(),
      ]);
    }
    await resetTournament();
  };

  const handleHeaderGoHome = () => {
    setShowRequestCenter(false);
    setShowCasualMatch(false);
    goHome();
    if (isAppwriteEnabled) {
      void prefetchHomeSetupData();
    }
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
    onRecordCasualMatch: () => {
      if (!assertCanOperate()) return;
      setShowCasualMatch(true);
    },
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
    calculatePointsTable,
    calculatePlayerStats,
    getPlayerLeaderboard,
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
    if (showUtilityDrawer) return 'utilities';
    if (showHistory || showCasualHistory) return 'history';
    if (showAllTimeStats || showEloLeaderboard || showRequestCenter) return 'stats';
    if (step === 'tournament') return 'live';
    return 'home';
  }, [
    showUtilityDrawer,
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
        viewerDashboardProps={viewerDashboardProps}
        setupScreenProps={setupScreenProps}
        teamEntryProps={teamEntryProps}
        tournamentViewProps={tournamentViewProps}
        casualMatchProps={casualMatchProps}
        showCasualMatch={showCasualMatch}
        appModals={appModals}
        isMobileViewport={isMobileViewport}
      />
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
          {!shouldShowMobileBottomNav && (
            <button
              type="button"
              onClick={() => setShowUtilityDrawer((prev) => !prev)}
              className={`utility-fab ${showUtilityDrawer ? 'is-open' : ''}`}
              aria-label={showUtilityDrawer ? 'Close utility drawer' : 'Open utility drawer'}
              title={showUtilityDrawer ? 'Close utilities' : 'Open utilities'}
            >
              {showUtilityDrawer ? <X size={18} /> : <SlidersHorizontal size={18} />}
              <span>Utilities</span>
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
              aria-label="Mobile utility drawer"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="utility-drawer-header">
                <p className="utility-drawer-title">Utilities</p>
                <button
                  type="button"
                  className="utility-drawer-close"
                  onClick={() => setShowUtilityDrawer(false)}
                  aria-label="Close utility drawer"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="utility-drawer-body">
                {(step !== 'setup' || showRequestCenter || showHistory || showCasualHistory || showAllTimeStats || showEloLeaderboard) && (
                  <button
                    type="button"
                    onClick={handleMobileGoHome}
                    className="utility-drawer-action"
                    aria-label="Go to home"
                  >
                    <House size={17} />
                    <span>Go Home</span>
                  </button>
                )}
                {requiresAuth && currentUser && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowUtilityDrawer(false);
                      setShowProfileModal(true);
                    }}
                    className="utility-drawer-action"
                    aria-label="Open profile"
                  >
                    <UserCircle2 size={17} />
                    <span>Open Profile</span>
                  </button>
                )}
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
            onHistory={handleMobileOpenHistory}
            onStats={handleMobileOpenStats}
            onUtilities={() => setShowUtilityDrawer((prev) => !prev)}
          />
        </>
      )}
    </>
  );
};

export default App;
