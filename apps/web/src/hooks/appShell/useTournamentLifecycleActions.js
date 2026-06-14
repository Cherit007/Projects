import { useCallback } from 'react';
import { tournamentService } from '../../services/tournamentService';
import { queryKeys } from '../../config/queryKeys';
import {
  generateFixtures as createFixtures,
  generateKnockoutBracket,
} from '@fixture-maker/domain/fixture';
import {
  buildTournamentFromLock,
  findActiveTournament,
  getTournamentIdCandidates,
  isScheduledTournamentAlreadyStarted,
  matchesTournamentId,
  normalizeTournamentFormat,
  normalizeTournamentName,
  pickPreferredTournament,
  removeTournamentFromList,
  upsertTournamentInHistory,
} from '../../utils/appHelpers';
import {
  buildTournamentShareMessage,
  getAppBaseUrl,
  shareTournamentInvite,
} from '../../utils/shareTournament';

export const TOURNAMENT_DETAIL_STALE_TIME_MS = 2 * 60 * 1000;

const tournamentPayloadDepth = (candidate) => {
  if (!candidate) return 0;
  const fixtureCount = Array.isArray(candidate.fixtures) ? candidate.fixtures.length : 0;
  const bracketCount = Array.isArray(candidate.bracket)
    ? candidate.bracket.reduce((sum, round) => sum + (Array.isArray(round) ? round.length : 0), 0)
    : 0;
  const teamCount = Array.isArray(candidate.teams) ? candidate.teams.length : 0;
  return fixtureCount + bracketCount + teamCount;
};

export const buildNormalizedTeamsForScheduled = (tournament) => {
  const scheduledGameMode = tournament?.gameMode || 'doubles';
  return (tournament?.teams || []).map((team, index) => {
    const player1 = team.player1 || team.player || '';
    return {
      ...team,
      id: index + 1,
      player1,
      player: player1,
      player2: scheduledGameMode === 'singles' ? '' : (team.player2 || ''),
    };
  });
};

export const findScheduledTournamentInHistory = (tournamentHistory, tournamentId) => {
  const normalizedTargetId = String(tournamentId || '').trim();
  if (!normalizedTargetId) return null;
  return (tournamentHistory || []).find((item) => (
    item?.status === 'scheduled' && matchesTournamentId(item, normalizedTargetId)
  )) || null;
};

const hasRenderableFixtures = (tournament) => {
  const fixtureCount = (Array.isArray(tournament?.fixtures) ? tournament.fixtures : [])
    .filter((match) => match?.team1 && match?.team2).length;
  const bracketCount = (Array.isArray(tournament?.bracket) ? tournament.bracket : [])
    .flatMap((round) => (Array.isArray(round) ? round : []))
    .filter((match) => match?.team1 && match?.team2).length;
  const finalReady = Boolean(tournament?.finalMatch?.team1 && tournament?.finalMatch?.team2);
  return fixtureCount > 0 || bracketCount > 0 || finalReady;
};

export const useTournamentLifecycleActions = ({
  isAppwriteEnabled = false,
  activeGroup = null,
  step = 'setup',
  tournamentHistory = [],
  setTournamentHistory,
  activeTournamentLock = null,
  setActiveTournamentLock,
  currentTournamentId,
  setCurrentTournamentId,
  activeLiveTournaments = [],
  tournamentName = '',
  historyHydrated = false,
  casualHydrated = false,
  historyHydrationPending = false,
  casualHydrationPending = false,
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
  activeGroupName,
}) => {
  const mergeWithLockIfRicher = useCallback((candidate) => {
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
  }, [activeTournamentLock]);

  const ensureTournamentDetailsForId = useCallback(async (tournamentId) => {
    const targetId = String(tournamentId || '').trim();
    if (!targetId) return null;
    const existing = (tournamentHistory || []).find(
      (item) => matchesTournamentId(item, targetId)
    );
    if (!isAppwriteEnabled) return existing || null;
    if (
      existing
      && (
        existing?.pendingSync
        || !String(existing?.appwriteId || '').trim()
      )
    ) {
      return existing;
    }

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
  }, [
    activeGroup?.id,
    activeTournamentLock?.id,
    clearBootstrapActiveTournamentCache,
    isAppwriteEnabled,
    pruneTournamentQueryCacheAfterDelete,
    queryClient,
    setActiveTournamentLock,
    setTournamentHistory,
    showToast,
    tournamentHistory,
  ]);

  const toastScheduledAlreadyStarted = useCallback((scheduled) => {
    const label = String(scheduled?.name || '').trim() || 'This scheduled tournament';
    showToast(`"${label}" is already started. Resume it from Live Tournament.`, 'error');
  }, [showToast]);

  const handleResumeActiveTournament = useCallback(async (tournamentId) => {
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
  }, [
    activeGroup?.id,
    activeTournamentLock,
    ensureTournamentDetailsForId,
    isAppwriteEnabled,
    mergeWithLockIfRicher,
    queryClient,
    resumeActiveTournament,
    setTournamentHistory,
    showToast,
    tournamentHistory,
  ]);

  const handleDeleteActiveTournament = useCallback(async (tournamentId) => {
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
  }, [
    activeTournamentLock,
    casualHydrated,
    clearBootstrapActiveTournamentCache,
    currentTournamentId,
    ensureCasualMatchesHydrated,
    ensureTournamentHistoryHydrated,
    handleDeleteTournamentFromSetup,
    historyHydrated,
    invalidateHydrationRequests,
    isAppwriteEnabled,
    pruneTournamentQueryCacheAfterDelete,
    requestConfirmAction,
    setActiveTournamentLock,
    setCurrentTournamentId,
    setTournamentHistory,
    showToast,
    tournamentHistory,
  ]);

  const handleRefreshTournamentFromCloud = useCallback(async () => {
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
  }, [
    activeGroup?.id,
    activeTournamentLock?.id,
    currentTournamentId,
    ensureTournamentDetailsForId,
    isAppwriteEnabled,
    queryClient,
    resumeActiveTournament,
    step,
  ]);

  const loadScheduledTeams = useCallback(async (scheduled, tournamentId) => {
    let normalizedTeams = buildNormalizedTeamsForScheduled(scheduled);
    if (
      normalizedTeams.length === 0
      && isAppwriteEnabled
      && (scheduled?.appwriteId || scheduled?.id)
    ) {
      const refreshId = scheduled.appwriteId || scheduled.id || tournamentId;
      await queryClient.invalidateQueries({
        queryKey: queryKeys.tournamentDetail(activeGroup?.id, String(refreshId || '')),
      });
      const refreshed = await ensureTournamentDetailsForId(refreshId);
      if (refreshed) {
        scheduled = refreshed;
        normalizedTeams = buildNormalizedTeamsForScheduled(refreshed);
      }
    }
    return { scheduled, normalizedTeams };
  }, [activeGroup?.id, ensureTournamentDetailsForId, isAppwriteEnabled, queryClient]);

  const handleEditScheduledTournament = useCallback(async (tournamentId) => {
    const scheduledFromHistory = findScheduledTournamentInHistory(tournamentHistory, tournamentId);
    if (
      scheduledFromHistory
      && isScheduledTournamentAlreadyStarted(scheduledFromHistory, activeLiveTournaments)
    ) {
      toastScheduledAlreadyStarted(scheduledFromHistory);
      return;
    }

    let scheduled = await ensureTournamentDetailsForId(tournamentId);
    if (!scheduled) return;
    if (
      scheduled?.status === 'active'
      || isScheduledTournamentAlreadyStarted(scheduled, activeLiveTournaments)
    ) {
      toastScheduledAlreadyStarted(scheduled);
      return;
    }

    const loaded = await loadScheduledTeams(scheduled, tournamentId);
    scheduled = loaded.scheduled;
    const normalizedTeamsLegacy = loaded.normalizedTeams;

    if (normalizedTeamsLegacy.length === 0) {
      showToast('No saved team details found for this scheduled tournament', 'error');
      return;
    }

    const scheduledGameMode = scheduled.gameMode || 'doubles';
    setTournamentName(scheduled.name || '');
    setFormat(scheduled.format || '1');
    setGameMode(scheduledGameMode);
    setTournamentFormat(normalizeTournamentFormat(scheduled.tournamentFormat || 'league'));
    setNumTeams(normalizedTeamsLegacy.length || 3);
    setOddPlayerEnabled(Boolean(scheduled.oddPlayerEnabled));
    setOddPlayerName((scheduled.oddPlayerName || '').trim());
    setTeams(normalizedTeamsLegacy);
    setPendingPrefilledTeams(normalizedTeamsLegacy);
    setStep('teams');
    showToast('Scheduled tournament loaded. You can edit teams now.');
  }, [
    activeLiveTournaments,
    ensureTournamentDetailsForId,
    loadScheduledTeams,
    setFormat,
    setGameMode,
    setNumTeams,
    setOddPlayerEnabled,
    setOddPlayerName,
    setPendingPrefilledTeams,
    setStep,
    setTeams,
    setTournamentFormat,
    setTournamentName,
    showToast,
    toastScheduledAlreadyStarted,
    tournamentHistory,
  ]);

  const handleStartScheduledTournament = useCallback(async (tournamentId) => {
    const scheduledFromHistory = findScheduledTournamentInHistory(tournamentHistory, tournamentId);
    if (
      scheduledFromHistory
      && isScheduledTournamentAlreadyStarted(scheduledFromHistory, activeLiveTournaments)
    ) {
      toastScheduledAlreadyStarted(scheduledFromHistory);
      return;
    }

    let scheduled = await ensureTournamentDetailsForId(tournamentId);
    if (!scheduled) return;
    if (
      scheduled?.status === 'active'
      || isScheduledTournamentAlreadyStarted(scheduled, activeLiveTournaments)
    ) {
      toastScheduledAlreadyStarted(scheduled);
      return;
    }

    const loaded = await loadScheduledTeams(scheduled, tournamentId);
    scheduled = loaded.scheduled;
    const normalizedTeamsLegacy = loaded.normalizedTeams;

    if (normalizedTeamsLegacy.length === 0) {
      showToast('No saved team details found for this scheduled tournament', 'error');
      return;
    }

    const scheduledGameMode = scheduled.gameMode || 'doubles';
    setTournamentName(scheduled.name || '');
    setFormat(scheduled.format || '1');
    setGameMode(scheduledGameMode);
    setTournamentFormat(normalizeTournamentFormat(scheduled.tournamentFormat || 'league'));
    setNumTeams(normalizedTeamsLegacy.length || 3);
    setOddPlayerEnabled(Boolean(scheduled.oddPlayerEnabled));
    setOddPlayerName((scheduled.oddPlayerName || '').trim());
    await generateFixtures({
      teamsOverride: normalizedTeamsLegacy,
      tournamentFormatOverride: normalizeTournamentFormat(scheduled.tournamentFormat || 'league'),
      formatOverride: scheduled.format || '1',
      gameModeOverride: scheduledGameMode,
      tournamentNameOverride: scheduled.name || '',
      existingTournamentId: scheduled.appwriteId || scheduled.id || tournamentId,
      oddPlayerConfig: {
        oddPlayerEnabled: Boolean(scheduled.oddPlayerEnabled),
        oddPlayerName: (scheduled.oddPlayerName || '').trim(),
      },
    });
  }, [
    activeLiveTournaments,
    ensureTournamentDetailsForId,
    generateFixtures,
    loadScheduledTeams,
    setFormat,
    setGameMode,
    setNumTeams,
    setOddPlayerEnabled,
    setOddPlayerName,
    setTournamentFormat,
    setTournamentName,
    showToast,
    toastScheduledAlreadyStarted,
    tournamentHistory,
  ]);

  const handleViewScheduledTournament = useCallback(async (tournamentId, fallbackTournament = null) => {
    const normalizedId = String(tournamentId || '').trim();
    if (!normalizedId) return fallbackTournament || null;

    let detailed = await ensureTournamentDetailsForId(normalizedId);
    if (
      detailed
      && detailed.isSummary
      && isAppwriteEnabled
      && (detailed.appwriteId || detailed.id)
    ) {
      const refreshId = detailed.appwriteId || detailed.id;
      await queryClient.invalidateQueries({
        queryKey: queryKeys.tournamentDetail(activeGroup?.id, String(refreshId || '')),
      });
      const refreshed = await ensureTournamentDetailsForId(refreshId);
      if (refreshed) detailed = refreshed;
    }

    const resolved = detailed || fallbackTournament || null;
    if (!resolved || typeof resolved !== 'object') return null;

    if (hasRenderableFixtures(resolved) || resolved?.status !== 'scheduled') {
      return resolved;
    }

    const previewTeams = (Array.isArray(resolved?.teams) ? resolved.teams : [])
      .map((team, index) => {
        const player1 = team?.player1 || team?.player || '';
        return {
          ...team,
          id: team?.id ?? (index + 1),
          player1,
          player: player1,
          player2: team?.player2 || '',
        };
      })
      .filter((team) => team?.player1 || team?.player || team?.name);

    if (previewTeams.length < 2) {
      return resolved;
    }

    const previewTournamentFormat = normalizeTournamentFormat(
      resolved?.tournamentFormat || resolved?.format || 'league'
    );
    if (previewTournamentFormat === 'league') {
      return {
        ...resolved,
        fixtures: createFixtures(previewTeams, resolved?.format || '1'),
      };
    }

    return {
      ...resolved,
      bracket: generateKnockoutBracket(previewTeams, previewTournamentFormat),
    };
  }, [activeGroup?.id, ensureTournamentDetailsForId, isAppwriteEnabled, queryClient]);

  const handleShareScheduledTournament = useCallback(async (tournament) => {
    const tournamentId = String(tournament?.appwriteId || tournament?.id || '').trim();
    const resolvedTournament = tournamentId
      ? ((await handleViewScheduledTournament(tournamentId, tournament)) || tournament)
      : tournament;

    const sharePayload = buildTournamentShareMessage({
      tournament: resolvedTournament,
      groupName: activeGroupName,
      baseUrl: getAppBaseUrl(),
    });

    if (!sharePayload?.message) {
      showToast('Tournament details unavailable for sharing', 'error');
      return;
    }

    const result = await shareTournamentInvite({
      message: sharePayload.message,
      title: sharePayload.title,
      appUrl: sharePayload.appUrl,
      onWhatsAppFallback: () => showToast('Opening WhatsApp with full fixture invite...'),
    });

    if (result.method === 'error') {
      showToast('Unable to open WhatsApp from this device', 'error');
    }
  }, [activeGroupName, handleViewScheduledTournament, showToast]);

  const handleOpenHistoryModal = useCallback(() => {
    setShowHistory(true);
    if (isAppwriteEnabled && !historyHydrated && !historyHydrationPending) {
      void ensureTournamentHistoryHydrated();
    }
  }, [
    ensureTournamentHistoryHydrated,
    historyHydrated,
    historyHydrationPending,
    isAppwriteEnabled,
    setShowHistory,
  ]);

  const handleOpenCasualHistoryModal = useCallback(() => {
    setShowCasualHistory(true);
    if (isAppwriteEnabled && !casualHydrated && !casualHydrationPending) {
      void ensureCasualMatchesHydrated();
    }
  }, [
    casualHydrated,
    casualHydrationPending,
    ensureCasualMatchesHydrated,
    isAppwriteEnabled,
    setShowCasualHistory,
  ]);

  const handleOpenAllTimeStatsModal = useCallback(() => {
    setShowAllTimeStats(true);
    if (isAppwriteEnabled) {
      if (!historyHydrated && !historyHydrationPending) void ensureTournamentHistoryHydrated();
      if (!casualHydrated && !casualHydrationPending) void ensureCasualMatchesHydrated();
    }
  }, [
    casualHydrated,
    casualHydrationPending,
    ensureCasualMatchesHydrated,
    ensureTournamentHistoryHydrated,
    historyHydrated,
    historyHydrationPending,
    isAppwriteEnabled,
    setShowAllTimeStats,
  ]);

  const handleOpenEloModal = useCallback(() => {
    setShowEloLeaderboard(true);
    if (isAppwriteEnabled) {
      if (!historyHydrated && !historyHydrationPending) void ensureTournamentHistoryHydrated();
      if (!casualHydrated && !casualHydrationPending) void ensureCasualMatchesHydrated();
    }
  }, [
    casualHydrated,
    casualHydrationPending,
    ensureCasualMatchesHydrated,
    ensureTournamentHistoryHydrated,
    historyHydrated,
    historyHydrationPending,
    isAppwriteEnabled,
    setShowEloLeaderboard,
  ]);

  const shouldHydrateForTournamentDelete = useCallback((id) => {
    const target = (tournamentHistory || []).find((item) => (
      matchesTournamentId(item, id)
    ));
    if (!target) return false;
    return target.status !== 'scheduled';
  }, [tournamentHistory]);

  const handleDeleteTournamentWithHydration = useCallback(async (id) => {
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
  }, [
    casualHydrated,
    clearBootstrapActiveTournamentCache,
    ensureCasualMatchesHydrated,
    ensureTournamentHistoryHydrated,
    handleDeleteTournamentFromSetup,
    historyHydrated,
    invalidateHydrationRequests,
    isAppwriteEnabled,
    pruneTournamentQueryCacheAfterDelete,
    requestConfirmAction,
    shouldHydrateForTournamentDelete,
    showToast,
    tournamentHistory,
  ]);

  const handleDeleteCasualWithHydration = useCallback(async (id) => {
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
  }, [
    activeGroup?.id,
    casualHydrated,
    ensureCasualMatchesHydrated,
    ensureTournamentHistoryHydrated,
    handleDeleteCasualMatchFromSetup,
    historyHydrated,
    invalidateHydrationRequests,
    isAppwriteEnabled,
    queryClient,
    requestConfirmAction,
    showToast,
  ]);

  const handleResetTournamentWithHydration = useCallback(async () => {
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
  }, [
    activeTournamentLock,
    casualHydrated,
    clearBootstrapActiveTournamentCache,
    currentTournamentId,
    ensureCasualMatchesHydrated,
    ensureTournamentHistoryHydrated,
    historyHydrated,
    invalidateHydrationRequests,
    isAppwriteEnabled,
    pruneTournamentQueryCacheAfterDelete,
    requestConfirmAction,
    resetTournament,
    setActiveTournamentLock,
    setCurrentTournamentId,
    setTournamentHistory,
    showToast,
    tournamentName,
  ]);

  return {
    ensureTournamentDetailsForId,
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
  };
};
