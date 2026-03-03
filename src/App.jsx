import React, { Suspense, lazy, useState, useEffect, useMemo, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Moon, Sun } from 'lucide-react';
import AppViewRouter from './components/AppViewRouter';
import Toast from './components/Toast';
import { useAppwriteSync } from './hooks/useAppwriteSync';
import { usePlayerDerivedData } from './hooks/usePlayerDerivedData';
import { useAuthGroupActions } from './hooks/useAuthGroupActions';
import { useTournamentActions } from './hooks/useTournamentActions';
import { useAppStore } from './store/appStore';
import { casualMatchService } from './services/casualmatchservice';
import { authService } from './services/authService';
import { groupService } from './services/groupService';
import { tournamentService } from './services/tournamentService';
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
    } catch (_error) {
      return 'dark';
    }
  });

  useEffect(() => {
    document.body.setAttribute('data-theme', themeMode);
    try {
      localStorage.setItem('badminton_theme_mode', themeMode);
    } catch (_error) {
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
  const step = useAppStore((s) => s.step);
  const setStep = useAppStore((s) => s.setStep);
  const tournamentName = useAppStore((s) => s.tournamentName);
  const setTournamentName = useAppStore((s) => s.setTournamentName);
  const numTeams = useAppStore((s) => s.numTeams);
  const setNumTeams = useAppStore((s) => s.setNumTeams);
  const format = useAppStore((s) => s.format);
  const setFormat = useAppStore((s) => s.setFormat);
  const gameMode = useAppStore((s) => s.gameMode);
  const setGameMode = useAppStore((s) => s.setGameMode);
  const tournamentFormat = useAppStore((s) => s.tournamentFormat);
  const setTournamentFormat = useAppStore((s) => s.setTournamentFormat);
  const teams = useAppStore((s) => s.teams);
  const setTeams = useAppStore((s) => s.setTeams);
  const fixtures = useAppStore((s) => s.fixtures);
  const setFixtures = useAppStore((s) => s.setFixtures);
  const bracket = useAppStore((s) => s.bracket);
  const setBracket = useAppStore((s) => s.setBracket);
  const champion = useAppStore((s) => s.champion);
  const setChampion = useAppStore((s) => s.setChampion);
  const [toast, setToast] = useState(null);
  const loading = useAppStore((s) => s.loading);
  const setLoading = useAppStore((s) => s.setLoading);
  const playerDatabase = useAppStore((s) => s.playerDatabase);
  const setPlayerDatabase = useAppStore((s) => s.setPlayerDatabase);
  const members = useAppStore((s) => s.members);
  const setMembers = useAppStore((s) => s.setMembers);
  const playerRatings = useAppStore((s) => s.playerRatings);
  const setPlayerRatings = useAppStore((s) => s.setPlayerRatings);
  const tournamentHistory = useAppStore((s) => s.tournamentHistory);
  const setTournamentHistory = useAppStore((s) => s.setTournamentHistory);
  const casualMatches = useAppStore((s) => s.casualMatches);
  const setCasualMatches = useAppStore((s) => s.setCasualMatches);
  const [showCasualMatch, setShowCasualMatch] = useState(false);
  const [oddPlayerEnabled, setOddPlayerEnabled] = useState(false);
  const [oddPlayerName, setOddPlayerName] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [showCasualHistory, setShowCasualHistory] = useState(false);
  const [showAllTimeStats, setShowAllTimeStats] = useState(false);
  const [showEloLeaderboard, setShowEloLeaderboard] = useState(false);
  const tournamentTemplates = useAppStore((s) => s.tournamentTemplates);
  const setTournamentTemplates = useAppStore((s) => s.setTournamentTemplates);
  const playerPhotos = useAppStore((s) => s.playerPhotos);
  const setPlayerPhotos = useAppStore((s) => s.setPlayerPhotos);
  const playerPhotoRefs = useAppStore((s) => s.playerPhotoRefs);
  const setPlayerPhotoRefs = useAppStore((s) => s.setPlayerPhotoRefs);
  const pendingPrefilledTeams = useAppStore((s) => s.pendingPrefilledTeams);
  const setPendingPrefilledTeams = useAppStore((s) => s.setPendingPrefilledTeams);
  const aiMatchSummaries = useAppStore((s) => s.aiMatchSummaries);
  const setAiMatchSummaries = useAppStore((s) => s.setAiMatchSummaries);
  const swapHistory = useAppStore((s) => s.swapHistory);
  const setSwapHistory = useAppStore((s) => s.setSwapHistory);
  const authLoading = useAppStore((s) => s.authLoading);
  const setAuthLoading = useAppStore((s) => s.setAuthLoading);
  const authResolved = useAppStore((s) => s.authResolved);
  const setAuthResolved = useAppStore((s) => s.setAuthResolved);
  const currentUser = useAppStore((s) => s.currentUser);
  const setCurrentUser = useAppStore((s) => s.setCurrentUser);
  const groupResolved = useAppStore((s) => s.groupResolved);
  const setGroupResolved = useAppStore((s) => s.setGroupResolved);
  const availableGroups = useAppStore((s) => s.availableGroups);
  const setAvailableGroups = useAppStore((s) => s.setAvailableGroups);
  const publicGroups = useAppStore((s) => s.publicGroups);
  const setPublicGroups = useAppStore((s) => s.setPublicGroups);
  const requestedGroupIds = useAppStore((s) => s.requestedGroupIds);
  const setRequestedGroupIds = useAppStore((s) => s.setRequestedGroupIds);
  const pendingJoinRequests = useAppStore((s) => s.pendingJoinRequests);
  const setPendingJoinRequests = useAppStore((s) => s.setPendingJoinRequests);
  const recentJoinReviews = useAppStore((s) => s.recentJoinReviews);
  const setRecentJoinReviews = useAppStore((s) => s.setRecentJoinReviews);
  const seenPendingRequestIds = useAppStore((s) => s.seenPendingRequestIds);
  const setSeenPendingRequestIds = useAppStore((s) => s.setSeenPendingRequestIds);
  const showRequestCenter = useAppStore((s) => s.showRequestCenter);
  const setShowRequestCenter = useAppStore((s) => s.setShowRequestCenter);
  const activeGroup = useAppStore((s) => s.activeGroup);
  const setActiveGroup = useAppStore((s) => s.setActiveGroup);
  const groupRole = useAppStore((s) => s.groupRole);
  const setGroupRole = useAppStore((s) => s.setGroupRole);
  const inviteLoading = useAppStore((s) => s.inviteLoading);
  const setInviteLoading = useAppStore((s) => s.setInviteLoading);
  const isGuestViewer = useAppStore((s) => s.isGuestViewer);
  const setIsGuestViewer = useAppStore((s) => s.setIsGuestViewer);
  const [pendingLinkPrompt, setPendingLinkPrompt] = useState(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [activeTournamentLock, setActiveTournamentLock] = useState(null);
  const adminAccounts = useAppStore((s) => s.adminAccounts);
  const setAdminAccounts = useAppStore((s) => s.setAdminAccounts);
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

  const showToast = (message, type = 'success') => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
    setToast({ message, type });
    toastTimerRef.current = setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, 3000);
  };
  // Appwrite Integration
  const {
    isAppwriteEnabled,
    isConfigChecked,
    isSyncing,
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
    syncCurrentTournament,
    patchTournamentMatches,
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

  const queryKeys = {
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
  };

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
    mutationFn: (payload) => casualMatchService.createCasualMatch(payload, activeGroup?.id),
  });
  const deleteCasualMatchMutation = useMutation({
    mutationFn: (id) => casualMatchService.deleteCasualMatch(id, activeGroup?.id),
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

  useEffect(() => {
    historyHydrationPromiseRef.current = null;
    casualHydrationPromiseRef.current = null;
    if (!isAppwriteEnabled) {
      setHistoryHydrated(true);
      setCasualHydrated(true);
    }
  }, [activeGroup?.id, isAppwriteEnabled]);

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

  useEffect(() => {
    if (!isAppwriteEnabled) return;
    if (step !== 'setup') return;
    if (historyHydrated && casualHydrated) return;
    if (historyHydrationPending || casualHydrationPending) return;
    void prefetchHomeSetupData();
  }, [
    isAppwriteEnabled,
    step,
    historyHydrated,
    casualHydrated,
    historyHydrationPending,
    casualHydrationPending,
    activeGroup?.id,
  ]);

  useEffect(() => {
    if (!isConfigChecked) return;

    let mounted = true;
    const loadAuth = async () => {
      if (!requiresAuth) {
        if (!mounted) return;
        setAuthResolved(true);
        setGroupResolved(true);
        return;
      }

      setAuthLoading(true);
      try {
        await refreshPublicGroups();
        const user = await fetchCurrentUser();
        if (!mounted) return;
        setCurrentUser(user);
        setAuthResolved(true);

        if (!user) {
          setGroupResolved(true);
          setAvailableGroups([]);
          setActiveGroup(null);
          setGroupRole(null);
          return;
        }

        const groups = await refreshGroups(user);
        if (!mounted) return;
        const pendingRequested = await queryClient.fetchQuery({
          queryKey: queryKeys.userPendingGroupIds(user.$id),
          queryFn: () => groupService.getUserPendingRequestGroupIds(user.$id),
          staleTime: 15 * 1000,
        });
        if (!mounted) return;
        setRequestedGroupIds(pendingRequested);

        if (groups.length === 1 && groups[0].role !== 'viewer') {
          setActiveGroup(groups[0]);
          setGroupRole(groups[0].role);
        } else {
          setActiveGroup(null);
          setGroupRole(null);
        }
        setGroupResolved(true);
      } catch (error) {
        console.error('Failed to load auth state:', error);
        if (!mounted) return;
        setAuthResolved(true);
        setGroupResolved(true);
      } finally {
        if (mounted) setAuthLoading(false);
      }
    };

    loadAuth();
    return () => {
      mounted = false;
    };
  }, [isConfigChecked, requiresAuth]);

  // Load data after auth/group access is resolved
  useEffect(() => {
    if (!isConfigChecked) return;
    if (requiresAuth && (!authResolved || !groupResolved || !activeGroup)) return;

    let mounted = true;
  
    const loadInitialData = async () => {
      setLoading(true);
    
      try {
        const localMembers = JSON.parse(localStorage.getItem("badminton_members") || "[]");
        const localTemplates = JSON.parse(localStorage.getItem("badminton_templates") || "[]");
        const localPhotos = JSON.parse(localStorage.getItem("badminton_player_photos") || "{}");

        // 1️⃣ LOCAL MODE SUPPORT
        if (!isAppwriteEnabled) {
          console.log("Running in LOCAL MODE");
    
          const localPlayers = JSON.parse(localStorage.getItem("badminton_players") || "[]");
          const localRatings = JSON.parse(localStorage.getItem("badminton_ratings") || "{}");
          const localHistory = JSON.parse(localStorage.getItem("badminton_history") || "[]");
          const localCasualMatches = JSON.parse(localStorage.getItem("badminton_casual_matches") || "[]");
    
          if (mounted) {
            setMembers(localMembers);
            const { urls, refs } = hydratePlayerPhotos(localPhotos);
            setPlayerPhotos(urls);
            setPlayerPhotoRefs(refs);
            setTournamentTemplates(
              localTemplates.map(template => ({
                ...template,
                tournamentFormat: normalizeTournamentFormat(template.tournamentFormat || 'league'),
                teams: normalizeTemplateTeams(
                  template.teams || [],
                  template.gameMode || 'doubles',
                  template.numTeams || 3
                ),
              }))
            );
            setPlayerDatabase(localPlayers);
            setPlayerRatings(localRatings);
            markRatingsPersisted(localRatings || {});
            setTournamentHistory(localHistory);
            setCasualMatches(localCasualMatches);
            setHistoryHydrated(true);
            setCasualHydrated(true);
            const localActive = findActiveTournament(localHistory);
            resumeActiveTournament(localActive);
          }
    
          return;
        }
    
        // 2️⃣ APPWRITE MODE
        setHistoryHydrated(false);
        setCasualHydrated(false);
        setTournamentHistory([]);
        setCasualMatches([]);

        const appwriteData = await queryClient.fetchQuery({
          queryKey: queryKeys.appwriteData(activeGroup?.id),
          queryFn: () => loadFromAppwrite({
            includeTournaments: false,
            includePlayerDatabase: true,
            includeRatings: true,
            includeMeta: true,
          }),
          staleTime: 5 * 60 * 1000,
        });
        const tournamentSummaries = await queryClient.fetchQuery({
          queryKey: queryKeys.tournamentSummaries(activeGroup?.id),
          queryFn: () => tournamentService.getTournamentSummaries(40, activeGroup?.id, ['active', 'scheduled']),
          staleTime: 5 * 60 * 1000,
        });
    
        if (mounted && appwriteData) {
          const appwriteTournaments = tournamentSummaries || [];
          setTournamentHistory(appwriteTournaments);
          setPlayerDatabase(appwriteData.playerDatabase || []);
          setPlayerRatings(appwriteData.playerRatings || {});
          markRatingsPersisted(appwriteData.playerRatings || {});
          const loadedMembers = appwriteData.members?.length ? appwriteData.members : localMembers;
          const restoredMembers = applyMemberAccountLinks(
            mergeMemberLinks(loadedMembers, localMembers),
            appwriteData.memberAccountLinks
          );
          setMembers(restoredMembers);
          const sourcePhotos = Object.keys(appwriteData.playerPhotos || {}).length ? appwriteData.playerPhotos : localPhotos;
          const { urls, refs } = hydratePlayerPhotos(sourcePhotos);
          setPlayerPhotos(urls);
          setPlayerPhotoRefs(refs);
          const sourceTemplates = appwriteData.templates?.length ? appwriteData.templates : localTemplates;
          setTournamentTemplates(
            sourceTemplates.map(template => ({
              ...template,
              tournamentFormat: normalizeTournamentFormat(template.tournamentFormat || 'league'),
              teams: normalizeTemplateTeams(
                template.teams || [],
                template.gameMode || 'doubles',
                template.numTeams || 3
              ),
            }))
          );
          setHistoryHydrated(false);
          setActiveTournamentLock(appwriteData.activeTournament || null);
          const activeFromCloud = findActiveTournament(appwriteTournaments);
          const lock = appwriteData.activeTournament;
          const lockCandidate = (lock && lock.status === 'active') ? {
            id: lock.id || null,
            appwriteId: lock.id || null,
            name: lock.name || 'Live tournament',
            date: lock.updatedAt ? new Date(lock.updatedAt).toLocaleDateString() : '',
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
          } : null;
          const scoreTournament = (tournament) => {
            const completedFixtures = (Array.isArray(tournament?.fixtures) ? tournament.fixtures : [])
              .filter((match) => match?.completed).length;
            const completedBracket = (Array.isArray(tournament?.bracket) ? tournament.bracket : [])
              .flatMap((round) => (Array.isArray(round) ? round : []))
              .filter((match) => match?.completed).length;
            return completedFixtures + completedBracket + (tournament?.champion ? 10000 : 0);
          };
          const preferredActive = activeFromCloud && lockCandidate
            ? (scoreTournament(lockCandidate) > scoreTournament(activeFromCloud) ? lockCandidate : activeFromCloud)
            : (activeFromCloud || lockCandidate);
          const hasDetailedCloudState = Boolean(
            preferredActive
            && (
              (Array.isArray(preferredActive.fixtures) && preferredActive.fixtures.length > 0)
              || (Array.isArray(preferredActive.bracket) && preferredActive.bracket.length > 0)
              || (Array.isArray(preferredActive.teams) && preferredActive.teams.length > 0 && !preferredActive.isSummary)
            )
          );
          if (preferredActive && hasDetailedCloudState) {
            resumeActiveTournament(preferredActive);
          }
          void prefetchHomeSetupData();
        }
    
      } catch (error) {
        console.error("Error loading:", error);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    
    loadInitialData();
  
    return () => {
      mounted = false;
    };
  }, [isAppwriteEnabled, isConfigChecked, requiresAuth, authResolved, groupResolved, activeGroup?.id, queryClient]); // Load after access is resolved
  
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

  const {
    teamNameDatabase,
    pairingAnalytics,
    formPowerRankings,
    currentUserMember,
    currentUserPlayerName,
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
  });

  useEffect(() => {
    // Show account-link flow only for approved group members.
    if (!requiresAuth || !currentUser || !activeGroup || groupRole !== 'member' || isGuestViewer || loading) return;
    const email = (currentUser.email || '').toLowerCase();
    const accountName = (currentUser.name || '').trim();
    const emailLocalPart = (currentUser.email || '').split('@')[0]?.trim() || '';
    const displayName = (accountName || emailLocalPart || currentUser.email || '').trim();
    if (!displayName) return;
    const normalizedName = displayName.toLowerCase();
    const currentTournamentPlayers = (teams || [])
      .flatMap((team) => [team?.player, team?.player1, team?.player2])
      .filter(Boolean);
    const knownPlayers = [...new Set([...(playerDatabase || []), ...currentTournamentPlayers])];
    const matchedPlayerName = knownPlayers.find(
      (playerName) => (playerName || '').trim().toLowerCase() === normalizedName
    );

    const linkedByIdentity = members.find((member) => (
      member.linkedAccountId === currentUser.$id
      || ((member.linkedEmail || '').toLowerCase() === email)
    ));

    if (linkedByIdentity) {
      if (pendingLinkPrompt) setPendingLinkPrompt(null);
      const patched = {
        ...linkedByIdentity,
        linkedAccountId: currentUser.$id,
        linkedEmail: currentUser.email,
        name: linkedByIdentity.name || displayName,
      };
      if (JSON.stringify(patched) !== JSON.stringify(linkedByIdentity)) {
        const updated = members.map(member => (
          member.id === linkedByIdentity.id ? patched : member
        ));
        setMembers(updated);
        saveMembersToLocal(updated);
      }
      return;
    }

    // If this name already has a linked profile in the group, skip prompting.
    const alreadyLinkedByName = members.some((member) => (
      Boolean(member.linkedAccountId || member.linkedEmail)
      && (member.name || '').trim().toLowerCase() === normalizedName
    ));
    if (alreadyLinkedByName) {
      if (pendingLinkPrompt) setPendingLinkPrompt(null);
      return;
    }

    const sameNameMembers = members.filter(
      member => (member.name || '').trim().toLowerCase() === normalizedName
    );
    const hasLinkedSameName = sameNameMembers.some(
      member => Boolean(member.linkedAccountId || member.linkedEmail)
    );
    const unlinkedSameName = sameNameMembers.find(
      member => !member.linkedAccountId && !member.linkedEmail
    );

    if (pendingLinkPrompt) return;

    // Ask before linking an existing same-name unlinked member.
    if (unlinkedSameName && !hasLinkedSameName) {
      const promptKey = `${activeGroup.id}:${currentUser.$id}:member:${normalizedName}`;
      if (linkPromptedRef.current.has(promptKey)) return;
      linkPromptedRef.current.add(promptKey);
      setPendingLinkPrompt({
        type: 'member',
        promptKey,
        memberId: unlinkedSameName.id,
        memberName: unlinkedSameName.name,
        displayName,
      });
      return;
    }

    // If player exists in tournament/player database but no member profile exists yet, ask to link that player identity.
    if (matchedPlayerName && sameNameMembers.length === 0 && !hasLinkedSameName) {
      const promptKey = `${activeGroup.id}:${currentUser.$id}:playerdb:${normalizedName}`;
      if (linkPromptedRef.current.has(promptKey)) return;
      linkPromptedRef.current.add(promptKey);
      setPendingLinkPrompt({
        type: 'player',
        promptKey,
        playerName: matchedPlayerName,
        displayName,
      });
      return;
    }

    // If no member with this name exists, create a linked profile member for the account.
    if (sameNameMembers.length === 0) {
      const next = [{
        id: `member-${Date.now()}`,
        name: displayName,
        phone: '',
        linkedAccountId: currentUser.$id,
        linkedEmail: currentUser.email,
      }, ...members];
      setMembers(next);
      saveMembersToLocal(next);
    }
  }, [requiresAuth, currentUser, activeGroup, groupRole, isGuestViewer, members, playerDatabase, teams, loading, pendingLinkPrompt]);

  const canEditOwnProfile = (playerName) => {
    if (!currentUserMember || !playerName) return false;
    const normalized = playerName.trim().toLowerCase();
    if (!normalized) return false;
    return (currentUserMember.name || '').trim().toLowerCase() === normalized;
  };

  useEffect(() => {
    if (!requiresAuth || !currentUser || !activeGroup || groupRole !== 'admin') {
      setPendingJoinRequests([]);
      setRecentJoinReviews([]);
      setSeenPendingRequestIds([]);
      setShowRequestCenter(false);
      return;
    }

    let mounted = true;
    const loadRequests = async () => {
      try {
        const requests = await queryClient.fetchQuery({
          queryKey: queryKeys.adminPendingRequests(activeGroup.id, currentUser.$id),
          queryFn: () => groupService.getPendingRequestsForAdmin({
            groupId: activeGroup.id,
            adminUserId: currentUser.$id,
          }),
          staleTime: 10 * 1000,
        });
        const recent = await queryClient.fetchQuery({
          queryKey: queryKeys.adminRecentReviews(activeGroup.id, currentUser.$id),
          queryFn: () => groupService.getRecentReviewedRequestsForAdmin({
            groupId: activeGroup.id,
            adminUserId: currentUser.$id,
            limit: 6,
          }),
          staleTime: 10 * 1000,
        });
        if (mounted) {
          setPendingJoinRequests(requests);
          setRecentJoinReviews(recent);
        }
      } catch (_error) {
        if (mounted) {
          setPendingJoinRequests([]);
          setRecentJoinReviews([]);
        }
      }
    };

    loadRequests();
    return () => {
      mounted = false;
    };
  }, [requiresAuth, currentUser, activeGroup, groupRole, queryClient]);

  useEffect(() => {
    if (!requiresAuth || !currentUser || !activeGroup || groupRole !== 'admin') {
      setAdminAccounts([]);
      return;
    }
    let mounted = true;
    const loadAdminAccounts = async () => {
      try {
        const accounts = await queryClient.fetchQuery({
          queryKey: queryKeys.adminGroupMembers(activeGroup.id, currentUser.$id),
          queryFn: () => groupService.getGroupMembersForAdmin({
            groupId: activeGroup.id,
            adminUserId: currentUser.$id,
          }),
          staleTime: 20 * 1000,
        });
        if (mounted) setAdminAccounts(accounts || []);
      } catch (_error) {
        if (mounted) setAdminAccounts([]);
      }
    };
    loadAdminAccounts();
    return () => {
      mounted = false;
    };
  }, [requiresAuth, currentUser, activeGroup, groupRole, queryClient]);

  useEffect(() => {
    setShowRequestCenter(false);
    setSeenPendingRequestIds([]);
  }, [activeGroup?.id]);

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

  useEffect(() => {
    if (groupRole !== 'member' && pendingLinkPrompt) {
      setPendingLinkPrompt(null);
    }
  }, [groupRole, pendingLinkPrompt]);

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
      } catch (_error) {
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
  };

  const handleOpenCasualHistoryModal = () => {
    setShowCasualHistory(true);
  };

  const handleOpenAllTimeStatsModal = () => {
    setShowAllTimeStats(true);
  };

  const handleOpenEloModal = () => {
    setShowEloLeaderboard(true);
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
    onNext: handleStartTournament,
    onRecordCasualMatch: () => {
      if (!assertCanOperate()) return;
      setShowCasualMatch(true);
    },
    tournamentHistory,
    scheduledTournaments,
    activeLiveTournaments,
    onEditScheduledTournament: handleEditScheduledTournament,
    onStartScheduledTournament: handleStartScheduledTournament,
    onResumeActiveTournament: handleResumeActiveTournament,
    onDeleteActiveTournament: handleDeleteActiveTournament,
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
    onDeleteTournament: handleDeleteTournamentWithHydration,
    onDeleteCasualMatch: handleDeleteCasualWithHydration,
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
  };

  const teamEntryProps = {
    step,
    teams,
    setTeams,
    gameMode,
    playerDatabase,
    teamNameDatabase,
    onGenerate: generateFixtures,
    loading,
    oddPlayerEnabled,
    setOddPlayerEnabled,
    oddPlayerName,
    setOddPlayerName,
    onBack: () => setStep('setup'),
    onSchedule: scheduleTournament,
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
    onSaveMatchResult: saveMatchResult,
    onPrioritizeMatch: prioritizeMatch,
    onSaveBracketResult: saveBracketMatchResult,
    onSaveFinalResult: saveFinalResult,
    onSwapTeamMember: swapTeamMember,
    swapHistory,
    onGoHome: handleHeaderGoHome,
    onResetTournament: handleResetTournamentWithHydration,
    onRerunTournament: rerunTournament,
    onStartNextTournament: startNextTournament,
    calculatePointsTable,
    calculatePlayerStats,
    getPlayerLeaderboard,
  };

  const casualMatchProps = {
    playerDatabase,
    playerRatings,
    onSaveMatch: saveCasualMatch,
    onAddPlayer: updatePlayerDatabase,
    onClose: () => setShowCasualMatch(false),
  };

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
      />
      <Toast message={toast?.message} type={toast?.type} />

      <button
        type="button"
        onClick={() => setThemeMode((prev) => (prev === 'dark' ? 'light' : 'dark'))}
        className="theme-toggle-btn"
        aria-label={themeMode === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
        title={themeMode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {themeMode === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        <span className="hidden sm:inline">{themeMode === 'dark' ? 'Light' : 'Dark'}</span>
      </button>
    </>
  );
};

export default App;
