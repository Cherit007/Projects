import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import AppModals from './components/AppModals';
import AppViewRouter from './components/AppViewRouter';
import { useAppwriteSync } from './hooks/useAppwriteSync';
import { usePlayerDerivedData } from './hooks/usePlayerDerivedData';
import { useAuthGroupActions } from './hooks/useAuthGroupActions';
import { useTournamentActions } from './hooks/useTournamentActions';
import { useAppStore } from './store/appStore';
import { casualMatchService } from './services/casualmatchservice';
import { authService } from './services/authService';
import { groupService } from './services/groupService';
import { getInvitablePlayers } from './utils/invitations';
import {
  calculatePointsTable, 
  calculatePlayerStats, 
  calculateCumulativePlayerStats,
  getPlayerLeaderboard,
} from './utils/calculations';
import { normalizePhotoInput } from './utils/playerPhotos';
import { playerPhotoStorageService } from './services/playerPhotoStorageService';

const App = () => {
  const queryClient = useQueryClient();
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
  const lastTournamentConfig = useAppStore((s) => s.lastTournamentConfig);
  const setLastTournamentConfig = useAppStore((s) => s.setLastTournamentConfig);
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
  const undoStack = useAppStore((s) => s.undoStack);
  const setUndoStack = useAppStore((s) => s.setUndoStack);
  const aiMatchSummaries = useAppStore((s) => s.aiMatchSummaries);
  const setAiMatchSummaries = useAppStore((s) => s.setAiMatchSummaries);
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
  const adminAccounts = useAppStore((s) => s.adminAccounts);
  const setAdminAccounts = useAppStore((s) => s.setAdminAccounts);
  const linkPromptedRef = useRef(new Set());

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

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
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
  } = useAppwriteSync(showToast);
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
  const createCasualMatchMutation = useMutation({
    mutationFn: (payload) => casualMatchService.createCasualMatch(payload),
  });
  const deleteCasualMatchMutation = useMutation({
    mutationFn: (id) => casualMatchService.deleteCasualMatch(id),
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
            setTournamentHistory(localHistory);
            setCasualMatches(localCasualMatches);
            const localActive = findActiveTournament(localHistory);
            resumeActiveTournament(localActive);
          }
    
          return;
        }
    
        // 2️⃣ APPWRITE MODE
        const appwriteData = await queryClient.fetchQuery({
          queryKey: queryKeys.appwriteData(activeGroup?.id),
          queryFn: () => loadFromAppwrite(),
          staleTime: 15 * 1000,
        });
    
        if (mounted && appwriteData) {
          const appwriteTournaments = appwriteData.tournaments || [];
          setTournamentHistory(appwriteTournaments);
          setPlayerDatabase(appwriteData.playerDatabase || []);
          setPlayerRatings(appwriteData.playerRatings || {});
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
          const activeFromCloud = findActiveTournament(appwriteTournaments);
          resumeActiveTournament(activeFromCloud);
        }
    
        const matches = await queryClient.fetchQuery({
          queryKey: queryKeys.casualMatches(activeGroup?.id),
          queryFn: () => casualMatchService.getAllCasualMatches(),
          staleTime: 10 * 1000,
        });
        if (mounted) setCasualMatches(matches || []);
    
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
  }, [isAppwriteEnabled, isConfigChecked, requiresAuth, authResolved, groupResolved, activeGroup, queryClient]); // Load after access is resolved
  
  // Auto-save player ratings to Appwrite
  useEffect(() => {
    if (Object.keys(playerRatings).length > 0) {
      if (isAppwriteEnabled) {
        saveRatingsMutation.mutate(playerRatings);
      } else {
        localStorage.setItem("badminton_ratings", JSON.stringify(playerRatings));
      }
    }
    
  }, [playerRatings, isAppwriteEnabled]);

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

  const captureUndoSnapshot = () => {
    const snapshot = {
      step,
      tournamentName,
      numTeams,
      format,
      gameMode,
      tournamentFormat,
      teams: JSON.parse(JSON.stringify(teams)),
      fixtures: JSON.parse(JSON.stringify(fixtures)),
      bracket: JSON.parse(JSON.stringify(bracket)),
      champion: champion ? JSON.parse(JSON.stringify(champion)) : null,
      aiMatchSummaries: JSON.parse(JSON.stringify(aiMatchSummaries)),
      playerRatings: JSON.parse(JSON.stringify(playerRatings)),
      tournamentHistory: JSON.parse(JSON.stringify(tournamentHistory)),
      casualMatches: JSON.parse(JSON.stringify(casualMatches)),
      currentTournamentId,
    };

    setUndoStack(prev => [...prev.slice(-19), snapshot]);
  };

  const undoLastAction = async () => {
    if (!assertCanOperate()) return;
    const lastSnapshot = undoStack[undoStack.length - 1];
    if (!lastSnapshot) {
      showToast('Nothing to undo', 'error');
      return;
    }

    setUndoStack(prev => prev.slice(0, -1));
    setStep(lastSnapshot.step);
    setTournamentName(lastSnapshot.tournamentName);
    setNumTeams(lastSnapshot.numTeams);
    setFormat(lastSnapshot.format);
    setGameMode(lastSnapshot.gameMode);
    setTournamentFormat(lastSnapshot.tournamentFormat);
    setTeams(lastSnapshot.teams);
    setFixtures(lastSnapshot.fixtures);
    setBracket(lastSnapshot.bracket);
    setChampion(lastSnapshot.champion);
    setAiMatchSummaries(lastSnapshot.aiMatchSummaries || []);
    setPlayerRatings(lastSnapshot.playerRatings);
    setTournamentHistory(lastSnapshot.tournamentHistory);
    setCasualMatches(lastSnapshot.casualMatches);
    setCurrentTournamentId(lastSnapshot.currentTournamentId);

    if (isAppwriteEnabled) {
      await saveRatingsMutation.mutateAsync(lastSnapshot.playerRatings);
    } else {
      localStorage.setItem("badminton_ratings", JSON.stringify(lastSnapshot.playerRatings));
      localStorage.setItem("badminton_history", JSON.stringify(lastSnapshot.tournamentHistory));
      localStorage.setItem("badminton_casual_matches", JSON.stringify(lastSnapshot.casualMatches));
    }

    showToast('Undid last action');
  };

  // Initialize teams
  useEffect(() => {
    if (step === 'teams') {
      const newTeams = Array.isArray(pendingPrefilledTeams) && pendingPrefilledTeams.length === numTeams
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
      setTeams(newTeams);
      setPendingPrefilledTeams(null);
    }
  }, [step, numTeams, gameMode, pendingPrefilledTeams]);

  const updatePlayerDatabase = (playerName) => {
    if (!assertCanOperate()) return;
    if (!playerName || playerName.trim() === "") return;
  
    setPlayerDatabase(prev => {
      if (prev.includes(playerName.trim())) return prev;
  
      const updated = [...prev, playerName.trim()];
  
      if (isAppwriteEnabled) {
        savePlayerDatabaseMutation.mutateAsync(updated)
          .then(() => queryClient.invalidateQueries({ queryKey: queryKeys.appwriteData(activeGroup?.id) }))
          .catch(() => {});
      } else {
        localStorage.setItem("badminton_players", JSON.stringify(updated));
      }
  
      return updated;
    });
  };

  const saveMembersToLocal = (updatedMembers, baselineMembers = members) => {
    const safeMembers = mergeMemberLinks(updatedMembers, baselineMembers);
    const memberAccountLinks = buildMemberAccountLinks(safeMembers);
    if (isAppwriteEnabled) {
      saveMembersMutation.mutateAsync({
        members: safeMembers,
        memberAccountLinks,
      }).catch((error) => {
        console.error('Failed to save members to Appwrite:', error);
      }).finally(() => {
        queryClient.invalidateQueries({ queryKey: queryKeys.appwriteData(activeGroup?.id) });
      });
      return;
    }
    localStorage.setItem("badminton_members", JSON.stringify(safeMembers));
  };

  const saveTemplatesToLocal = (updatedTemplates) => {
    if (isAppwriteEnabled) {
      saveTemplatesMutation.mutateAsync(updatedTemplates).catch((error) => {
        console.error('Failed to save templates to Appwrite:', error);
      }).finally(() => {
        queryClient.invalidateQueries({ queryKey: queryKeys.appwriteData(activeGroup?.id) });
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
      saveMembersToLocal(updated, prev);
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
          await queryClient.invalidateQueries({ queryKey: queryKeys.appwriteData(activeGroup?.id) });
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
          await queryClient.invalidateQueries({ queryKey: queryKeys.appwriteData(activeGroup?.id) });
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
          }).finally(() => {
            queryClient.invalidateQueries({ queryKey: queryKeys.appwriteData(activeGroup?.id) });
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
    saveMatchResult,
    prioritizeMatch,
    saveBracketMatchResult,
    saveFinalResult,
    saveCasualMatch,
    resetTournament,
    rerunTournament,
    goHome,
    handleDeleteTournamentFromSetup,
    handleDeleteCasualMatchFromSetup,
  } = useTournamentActions({
    assertCanOperate,
    assertCanDelete,
    showToast,
    isAppwriteEnabled,
    activeGroup,
    queryClient,
    queryKeys,
    captureUndoSnapshot,
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
    setLastTournamentConfig,
    currentTournamentId,
    setCurrentTournamentId,
    syncCurrentTournament,
    saveTournamentMutation,
    deleteTournamentMutation,
    savePlayerDatabaseMutation,
    saveRatingsMutation,
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
    setStep,
  });

  const viewerDashboardProps = {
    group: activeGroup,
    tournamentName,
    tournamentFormat,
    step,
    champion,
    fixtures,
    bracket,
    tournamentHistory,
    allTimeStats: calculateCumulativePlayerStats(tournamentHistory),
    eloLeaderboard: getPlayerLeaderboard(playerRatings),
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
    lastTournamentConfig,
    onReuseTournament: () => {
      if (!lastTournamentConfig) return;
      setTournamentName(lastTournamentConfig.name + ' (Rematch)');
      setNumTeams(lastTournamentConfig.numTeams);
      setFormat(lastTournamentConfig.format);
      setGameMode(lastTournamentConfig.gameMode || 'doubles');
      setTournamentFormat(normalizeTournamentFormat(lastTournamentConfig.tournamentFormat || 'league'));
      setPendingPrefilledTeams(lastTournamentConfig.teams.map((team, i) => ({ ...team, id: i + 1 })));
      setStep('teams');
      showToast('Tournament loaded!');
    },
    tournamentHistory,
    casualMatches,
    playerDatabase,
    teamNameDatabase,
    showHistory,
    setShowHistory,
    members,
    onAddMember: addMember,
    onDeleteMember: deleteMember,
    showCasualHistory,
    setShowCasualHistory,
    showAllTimeStats,
    setShowAllTimeStats,
    showEloLeaderboard,
    setShowEloLeaderboard,
    tournamentTemplates,
    onSaveTemplate: saveTournamentTemplate,
    onApplyTemplate: applyTournamentTemplate,
    onDeleteTemplate: deleteTournamentTemplate,
    canUndo: undoStack.length > 0,
    onUndoLastAction: undoLastAction,
    onDeleteTournament: handleDeleteTournamentFromSetup,
    onDeleteCasualMatch: handleDeleteCasualMatchFromSetup,
    allTimeStats: calculateCumulativePlayerStats(tournamentHistory),
    eloLeaderboard: getPlayerLeaderboard(playerRatings),
    playerRatings,
    pairingAnalytics,
    formPowerRankings,
    playerPhotos,
    onUpdatePlayerPhoto: updatePlayerPhoto,
    canEditPlayerPhoto: canEditOwnProfile,
    isAppwriteEnabled,
    isSyncing,
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
    inviteList: getInvitablePlayers({
      teams,
      members,
      fixtures,
      bracket,
      format,
      tournamentFormat,
      tournamentName
    }),
    onSaveMatchResult: saveMatchResult,
    onPrioritizeMatch: prioritizeMatch,
    onSaveBracketResult: saveBracketMatchResult,
    onSaveFinalResult: saveFinalResult,
    canUndo: undoStack.length > 0,
    onUndoLastAction: undoLastAction,
    onGoHome: goHome,
    onResetTournament: resetTournament,
    onRerunTournament: rerunTournament,
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

  const appModals = (
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
  );

  return (
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
      inviteLoading={inviteLoading}
      onLogin={handleLogin}
      onRegister={handleRegister}
      onContinueAsViewer={handleContinueAsViewer}
      onCreateGroup={handleCreateGroup}
      onRequestAccess={handleRequestAccess}
      onWatchGroup={handleWatchGroup}
      onSelectGroup={handleSelectGroup}
      onOpenProfile={() => setShowProfileModal(true)}
      onBackToGroups={handleBackToGroups}
      onOpenRequestCenter={handleOpenRequestCenter}
      onLogout={handleLogout}
      onCloseRequestCenter={() => setShowRequestCenter(false)}
      onApproveRequest={handleApproveRequest}
      onRejectRequest={handleRejectRequest}
      viewerDashboardProps={viewerDashboardProps}
      setupScreenProps={setupScreenProps}
      teamEntryProps={teamEntryProps}
      tournamentViewProps={tournamentViewProps}
      casualMatchProps={casualMatchProps}
      showCasualMatch={showCasualMatch}
      appModals={appModals}
      toast={toast}
    />
  );
};

export default App;
