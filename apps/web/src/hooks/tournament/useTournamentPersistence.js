import { useEffect, useRef } from 'react';
import { appDataService } from '../../services/appDataService';
import { tournamentService } from '../../services/tournamentService';
import { queueLocalStorageJson, queueLocalStorageValue } from '../../services/localStorageWriteService';
import { STORAGE_KEYS } from '../../platform/storageKeys';
import {
  dedupeTournamentHistory,
  getTournamentIdCandidates,
  matchesTournamentId,
  normalizeTournamentName,
} from '../../utils/appHelpers';
import { serializeMatchStatistics } from '@fixture-maker/domain/sports/matchStatistics.js';

export const useTournamentPersistence = ({
  isAppwriteEnabled,
  activeGroup,
  tournamentName,
  format,
  gameMode,
  sportId,
  ruleConfig = {},
  tournamentFormat,
  teams,
  fixtures,
  bracket,
  champion,
  aiMatchSummaries,
  swapHistory,
  currentTournamentId,
  setCurrentTournamentId,
  tournamentHistory,
  setTournamentHistory,
  setActiveTournamentLock,
  syncCurrentTournament,
  patchTournamentMatches,
  saveTournamentMutation,
  buildRatingsDelta,
}) => {
  const activeLockTimerRef = useRef(null);
  const pendingActiveLockRef = useRef(undefined);
  const lastActiveLockSignatureRef = useRef('');
  const cloudIdWarningShownRef = useRef(false);
  const cloudIdRecoveryInFlightRef = useRef(false);
  const tournamentSyncTimerRef = useRef(null);
  const pendingTournamentSyncRef = useRef(null);
  const tournamentSyncInFlightRef = useRef(false);
  const createTournamentRunIdRef = useRef(0);
  const pendingCreateRef = useRef(null);
  const localTournamentIdRef = useRef(null);
  const remoteActiveCacheRef = useRef({
    hasValue: false,
    value: null,
    cachedAt: 0,
  });
  const ACTIVE_TOURNAMENT_CACHE_KEY = STORAGE_KEYS.ACTIVE_TOURNAMENT_CACHE;
  const shouldPersistActiveCache = Boolean(isAppwriteEnabled);

  const persistActiveTournamentCache = (snapshot) => {
    if (!shouldPersistActiveCache) return;
    if (!snapshot) {
      queueLocalStorageValue(ACTIVE_TOURNAMENT_CACHE_KEY, null);
      return;
    }
    const payload = {
      ...snapshot,
      _cacheGroupId: activeGroup?.id || null,
      _cachedAt: new Date().toISOString(),
    };
    queueLocalStorageJson(ACTIVE_TOURNAMENT_CACHE_KEY, payload);
  };

  const clearActiveTournamentCache = () => {
    if (!shouldPersistActiveCache) return;
    queueLocalStorageValue(ACTIVE_TOURNAMENT_CACHE_KEY, null);
  };

  const normalizeTournamentId = (value) => String(value || '').trim();
  const hasTournamentIds = (tournament) => getTournamentIdCandidates(tournament).length > 0;
  const isIdlessActiveTournamentNameMatch = (tournament, normalizedTargetName) => (
    Boolean(
      normalizedTargetName
      && tournament?.status === 'active'
      && !tournament?.champion
      && !hasTournamentIds(tournament)
      && normalizeTournamentName(tournament?.name) === normalizedTargetName
    )
  );
  const isLikelyLocalTournamentId = (value) => {
    const normalized = normalizeTournamentId(value);
    if (!normalized) return false;
    if (/^\d{10,}$/.test(normalized)) return true;
    return normalized.startsWith('sched-local-') || normalized.startsWith('local-');
  };
  const createLocalTournamentId = () => `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  useEffect(() => () => {
    if (activeLockTimerRef.current) {
      clearTimeout(activeLockTimerRef.current);
      activeLockTimerRef.current = null;
    }
    if (tournamentSyncTimerRef.current) {
      clearTimeout(tournamentSyncTimerRef.current);
      tournamentSyncTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    const normalizedCurrentId = normalizeTournamentId(currentTournamentId);
    const normalizedName = normalizeTournamentId(tournamentName);
    if (!normalizedCurrentId && !normalizedName) {
      localTournamentIdRef.current = null;
      return;
    }
    const historyList = Array.isArray(tournamentHistory) ? tournamentHistory : [];
    let match = null;
    if (normalizedCurrentId) {
      match = historyList.find((item) => matchesTournamentId(item, normalizedCurrentId));
    }
    if (!match) {
      const normalizedNameLower = normalizedName.toLowerCase();
      if (normalizedNameLower) {
        const activeMatches = historyList.filter((item) => (
          item?.status === 'active'
          && !item?.champion
          && normalizeTournamentId(item?.name).toLowerCase() === normalizedNameLower
        ));
        if (activeMatches.length === 1) {
          match = activeMatches[0];
        }
      }
    }
    const legacyId = normalizeTournamentId(match?.legacyTournamentId);
    const nextLocalId = legacyId || normalizedCurrentId || '';
    if (nextLocalId && localTournamentIdRef.current !== nextLocalId) {
      localTournamentIdRef.current = nextLocalId;
    }
  }, [currentTournamentId, tournamentName, tournamentHistory]);

  const upsertTournamentHistory = (history, tournament) => {
    const list = Array.isArray(history) ? history : [];
    if (!tournament) return dedupeTournamentHistory(list);
    return dedupeTournamentHistory([tournament, ...list]);
  };

  const persistActiveTournamentSnapshot = ({
    teamsSnapshot = teams,
    fixturesSnapshot = fixtures,
    bracketSnapshot = bracket,
    championSnapshot = champion,
    aiSummariesSnapshot = aiMatchSummaries,
    swapHistorySnapshot = swapHistory,
  } = {}) => {
    const localTournamentId = ensureLocalTournamentId();
    const normalizedCurrentId = normalizeTournamentId(currentTournamentId);
    const appwriteId = (
      isAppwriteEnabled
      && normalizedCurrentId
      && !isLikelyLocalTournamentId(normalizedCurrentId)
    ) ? normalizedCurrentId : null;

    const snapshot = {
      id: localTournamentId || appwriteId || normalizedCurrentId || Date.now(),
      legacyTournamentId: localTournamentId || null,
      appwriteId,
      name: tournamentName,
      date: new Date().toLocaleDateString(),
      teams: Array.isArray(teamsSnapshot) ? teamsSnapshot : [],
      fixtures: Array.isArray(fixturesSnapshot) ? fixturesSnapshot : [],
      bracket: Array.isArray(bracketSnapshot) ? bracketSnapshot : [],
      champion: championSnapshot || null,
      format,
      gameMode,
      tournamentFormat,
      aiSummaries: Array.isArray(aiSummariesSnapshot) ? aiSummariesSnapshot : [],
      swapHistory: Array.isArray(swapHistorySnapshot) ? swapHistorySnapshot : [],
      status: championSnapshot ? 'completed' : 'active',
    };

    persistActiveTournamentCache(snapshot);

    setTournamentHistory((prev) => {
      const next = upsertTournamentHistory(prev, snapshot);
      if (!isAppwriteEnabled) {
        queueLocalStorageJson(STORAGE_KEYS.HISTORY, next);
      }
      return next;
    });
    return snapshot;
  };

  const setRemoteActiveCache = (value) => {
    remoteActiveCacheRef.current = {
      hasValue: true,
      value: value || null,
      cachedAt: Date.now(),
    };
  };

  const normalizeTournamentFormatKey = (value) => (
    normalizeTournamentName(value || 'league')
  );

  const buildTournamentTeamSignature = (teamsList = []) => {
    if (!Array.isArray(teamsList) || teamsList.length === 0) return '';
    return teamsList
      .map((team) => (
        [
          normalizeTournamentName(team?.name),
          normalizeTournamentName(team?.player || team?.player1),
          normalizeTournamentName(team?.player2),
        ].join('|')
      ))
      .sort()
      .join('||');
  };

  const getTournamentTeamsCount = (tournament) => {
    if (Array.isArray(tournament?.teams)) return tournament.teams.length;
    const count = Number(tournament?.teamsCount);
    return Number.isFinite(count) ? count : 0;
  };

  const matchesRemoteTournamentContext = (
    tournament,
    {
      targetId = null,
      targetName = tournamentName,
      targetTeams = teams,
      targetFormat = tournamentFormat,
    } = {}
  ) => {
    if (!tournament || tournament?.status !== 'active' || tournament?.champion) return false;

    const normalizedTargetId = normalizeTournamentId(targetId);
    if (normalizedTargetId && matchesTournamentId(tournament, normalizedTargetId)) {
      return true;
    }

    const normalizedTargetName = normalizeTournamentName(targetName);
    const normalizedCandidateName = normalizeTournamentName(tournament?.name);
    if (!normalizedTargetName || !normalizedCandidateName || normalizedCandidateName !== normalizedTargetName) {
      return false;
    }

    const normalizedTargetFormat = normalizeTournamentFormatKey(targetFormat);
    const normalizedCandidateFormat = normalizeTournamentFormatKey(
      tournament?.tournamentFormat || tournament?.format || 'league'
    );
    if (normalizedTargetFormat !== normalizedCandidateFormat) {
      return false;
    }

    const targetTeamsCount = Array.isArray(targetTeams) ? targetTeams.length : 0;
    const candidateTeamsCount = getTournamentTeamsCount(tournament);
    if (targetTeamsCount > 0 && candidateTeamsCount > 0 && targetTeamsCount !== candidateTeamsCount) {
      return false;
    }

    const targetSignature = buildTournamentTeamSignature(targetTeams);
    const candidateSignature = buildTournamentTeamSignature(tournament?.teams);
    if (targetSignature && candidateSignature) {
      return targetSignature === candidateSignature;
    }

    return targetTeamsCount > 0 && candidateTeamsCount > 0;
  };

  const pickMatchingRemoteActiveTournament = (candidates = [], context = {}) => {
    const activeCandidates = (Array.isArray(candidates) ? candidates : []).filter((item) => (
      item?.status === 'active' && !item?.champion
    ));
    if (activeCandidates.length === 0) return null;

    const normalizedTargetId = normalizeTournamentId(context?.targetId);
    if (normalizedTargetId) {
      const idMatch = activeCandidates.find((item) => matchesTournamentId(item, normalizedTargetId));
      if (idMatch) return idMatch;
    }

    const contextMatches = activeCandidates.filter((item) => matchesRemoteTournamentContext(item, context));
    if (contextMatches.length === 0) return null;
    if (contextMatches.length === 1) return contextMatches[0];

    const detailedMatch = contextMatches.find((item) => buildTournamentTeamSignature(item?.teams));
    return detailedMatch || contextMatches[0];
  };

  const fetchRemoteActiveLiveTournament = async ({
    force = false,
    targetId = null,
    targetName = tournamentName,
    targetTeams = teams,
    targetFormat = tournamentFormat,
    requireMatch = false,
  } = {}) => {
    if (!isAppwriteEnabled) return null;
    const matchContext = {
      targetId,
      targetName,
      targetTeams,
      targetFormat,
    };
    const cache = remoteActiveCacheRef.current;
    if (
      !force
      && cache?.hasValue
      && Date.now() - Number(cache.cachedAt || 0) < 15 * 1000
    ) {
      const cachedLock = cache.value || null;
      if (!requireMatch || matchesRemoteTournamentContext(cachedLock, matchContext)) {
        return cachedLock;
      }
    }

    try {
      const meta = await appDataService.getAppMeta({ groupId: activeGroup?.id });
      const lock = meta?.activeTournament;
      if (
        lock
        && lock.status === 'active'
        && (!requireMatch || matchesRemoteTournamentContext(lock, matchContext))
      ) {
        setRemoteActiveCache(lock);
        return lock;
      }
    } catch {
      // Ignore meta read errors and fallback to tournament collection scan.
    }

    try {
      const tournaments = await tournamentService.getTournamentSummaries(20, activeGroup?.id, ['active']);
      const activeCandidates = (Array.isArray(tournaments) ? tournaments : []).filter((item) => (
        item?.status === 'active' && !item?.champion
      ));
      const matchedActive = pickMatchingRemoteActiveTournament(activeCandidates, matchContext);
      const active = requireMatch
        ? (matchedActive || null)
        : (matchedActive || activeCandidates[0] || null);
      setRemoteActiveCache(active);
      return active;
    } catch {
      return null;
    }
  };

  const persistActiveTournamentLock = async (payload) => {
    if (!isAppwriteEnabled) return;
    setRemoteActiveCache(payload || null);
    try {
      await appDataService.saveAppMeta(
        {
          activeTournament: payload || null,
        },
        { groupId: activeGroup?.id }
      );
    } catch {
      // Non-blocking: tournament flow should continue even if meta update fails.
    }
  };

  const updateActiveTournamentLock = async (payload, { immediate = false } = {}) => {
    if (!isAppwriteEnabled) return;
    const nextPayload = payload || null;
    const signature = JSON.stringify(nextPayload);
    pendingActiveLockRef.current = nextPayload;
    setRemoteActiveCache(nextPayload);

    if (immediate) {
      if (activeLockTimerRef.current) {
        clearTimeout(activeLockTimerRef.current);
        activeLockTimerRef.current = null;
      }
      if (lastActiveLockSignatureRef.current === signature) return;
      lastActiveLockSignatureRef.current = signature;
      await persistActiveTournamentLock(nextPayload);
      return;
    }

    if (activeLockTimerRef.current) {
      clearTimeout(activeLockTimerRef.current);
    }
    activeLockTimerRef.current = setTimeout(async () => {
      const queued = pendingActiveLockRef.current || null;
      const queuedSignature = JSON.stringify(queued);
      if (lastActiveLockSignatureRef.current === queuedSignature) return;
      lastActiveLockSignatureRef.current = queuedSignature;
      await persistActiveTournamentLock(queued);
    }, 1200);
  };

  const buildActiveTournamentSnapshot = ({
    id,
    name = tournamentName,
    teamsSnapshot = teams,
    fixturesSnapshot = fixtures,
    bracketSnapshot = bracket,
    championSnapshot = champion,
    aiSummariesSnapshot = aiMatchSummaries,
    swapHistorySnapshot = swapHistory,
    formatSnapshot = format,
    gameModeSnapshot = gameMode,
    sportIdSnapshot = sportId,
    ruleConfigSnapshot = ruleConfig,
    tournamentFormatSnapshot = tournamentFormat,
    allowLocalId = !isAppwriteEnabled,
  } = {}) => {
    const localTournamentId = normalizeTournamentId(localTournamentIdRef.current);
    const normalizedCurrentId = normalizeTournamentId(currentTournamentId);
    const currentIsRemote = normalizedCurrentId && !isLikelyLocalTournamentId(normalizedCurrentId);
    const resolvedId = (() => {
      if (id !== undefined) return id;
      if (currentIsRemote) return normalizedCurrentId;
      if (allowLocalId) return localTournamentId || normalizedCurrentId || null;
      return null;
    })();
    const resolvedAppwriteId = (() => {
      if (id !== undefined) return id;
      if (currentIsRemote) return normalizedCurrentId;
      return null;
    })();
    return ({
      id: resolvedId,
      appwriteId: resolvedAppwriteId,
      legacyTournamentId: localTournamentId || null,
      name: name || 'Live tournament',
      status: championSnapshot ? 'completed' : 'active',
      updatedAt: new Date().toISOString(),
      teams: Array.isArray(teamsSnapshot) ? teamsSnapshot : [],
      fixtures: Array.isArray(fixturesSnapshot) ? fixturesSnapshot : [],
      bracket: Array.isArray(bracketSnapshot) ? bracketSnapshot : [],
      champion: championSnapshot || null,
      aiSummaries: Array.isArray(aiSummariesSnapshot) ? aiSummariesSnapshot : [],
      swapHistory: Array.isArray(swapHistorySnapshot) ? swapHistorySnapshot : [],
      format: formatSnapshot || '1',
      gameMode: gameModeSnapshot || 'doubles',
      sportId: sportIdSnapshot,
      ruleConfig: ruleConfigSnapshot || {},
      tournamentFormat: tournamentFormatSnapshot || 'league',
      date: new Date().toLocaleDateString(),
    });
  };

  const buildCloudTournamentPayload = ({
    teamsSnapshot = teams,
    fixturesSnapshot = fixtures,
    bracketSnapshot = bracket,
    championSnapshot = champion,
    aiSummariesSnapshot = aiMatchSummaries,
    swapHistorySnapshot = swapHistory,
  } = {}) => {
    const localTournamentId = normalizeTournamentId(localTournamentIdRef.current);
    return ({
      legacyTournamentId: localTournamentId || null,
      name: tournamentName,
      date: new Date().toLocaleDateString(),
      teams: Array.isArray(teamsSnapshot) ? teamsSnapshot : [],
      fixtures: Array.isArray(fixturesSnapshot) ? fixturesSnapshot : [],
      bracket: Array.isArray(bracketSnapshot) && bracketSnapshot.length > 0 ? bracketSnapshot : null,
      champion: championSnapshot || null,
      finalMatch: null,
      format,
      gameMode,
      sportId,
      ruleConfig,
      tournamentFormat,
      aiSummaries: Array.isArray(aiSummariesSnapshot) ? aiSummariesSnapshot : [],
      swapHistory: Array.isArray(swapHistorySnapshot) ? swapHistorySnapshot : [],
      status: championSnapshot ? 'completed' : 'active',
    });
  };

  const buildRatingsDeltaPayload = (beforeRatings = {}, afterRatings = {}) => {
    if (typeof buildRatingsDelta === 'function') {
      return buildRatingsDelta(beforeRatings || {}, afterRatings || {});
    }
    return {
      changedRatings: {},
      deletedPlayerNames: [],
    };
  };

  const buildCloudSyncPayload = ({
    teamsSnapshot = teams,
    fixturesSnapshot = fixtures,
    bracketSnapshot = bracket,
    championSnapshot = champion,
    aiSummariesSnapshot = aiMatchSummaries,
    swapHistorySnapshot = swapHistory,
    updatedAt = new Date().toISOString(),
  } = {}) => ({
    ...buildCloudTournamentPayload({
      teamsSnapshot,
      fixturesSnapshot,
      bracketSnapshot,
      championSnapshot,
      aiSummariesSnapshot,
      swapHistorySnapshot,
    }),
    updatedAt,
    sourceUpdatedAt: updatedAt,
  });

  const resolveLocalTournamentId = () => {
    const fromRef = normalizeTournamentId(localTournamentIdRef.current);
    if (fromRef) return fromRef;
    const fromCurrent = normalizeTournamentId(currentTournamentId);
    if (fromCurrent) return fromCurrent;
    const normalizedName = normalizeTournamentId(tournamentName).toLowerCase();
    if (!normalizedName) return null;
    const activeMatches = (Array.isArray(tournamentHistory) ? tournamentHistory : [])
      .filter((item) => (
        item?.status === 'active'
        && !item?.champion
        && normalizeTournamentId(item?.name).toLowerCase() === normalizedName
      ));
    if (activeMatches.length !== 1) return null;
    const candidate = activeMatches[0];
    return normalizeTournamentId(candidate?.legacyTournamentId || candidate?.id || candidate?.appwriteId);
  };

  const ensureLocalTournamentId = () => {
    const resolved = resolveLocalTournamentId();
    if (resolved) return resolved;
    const created = createLocalTournamentId();
    localTournamentIdRef.current = created;
    if (!currentTournamentId) {
      setCurrentTournamentId(created);
    }
    return created;
  };

  const resolveSyncTournamentId = () => {
    if (!isAppwriteEnabled) {
      return resolveLocalTournamentId();
    }
    const currentId = normalizeTournamentId(currentTournamentId);
    if (currentId && !isLikelyLocalTournamentId(currentId)) {
      return currentId;
    }

    const localId = normalizeTournamentId(localTournamentIdRef.current) || currentId;
    if (localId) {
      const historyMatch = (Array.isArray(tournamentHistory) ? tournamentHistory : [])
        .find((item) => matchesTournamentId(item, localId));
      const matchAppwriteId = normalizeTournamentId(historyMatch?.appwriteId);
      if (matchAppwriteId) return matchAppwriteId;
    }

    const normalizedName = normalizeTournamentId(tournamentName).toLowerCase();
    if (!normalizedName) return null;
    const activeByName = (Array.isArray(tournamentHistory) ? tournamentHistory : [])
      .filter((item) => (
        item?.status === 'active'
        && !item?.champion
        && normalizeTournamentId(item?.name).toLowerCase() === normalizedName
        && normalizeTournamentId(item?.appwriteId)
      ));
    const uniqueIds = Array.from(new Set(
      activeByName
        .map((item) => normalizeTournamentId(item?.appwriteId))
        .filter(Boolean)
    ));
    if (uniqueIds.length === 1) {
      return uniqueIds[0];
    }
    return null;
  };

  const waitForPendingCreateResolution = async ({
    targetLegacyId = resolveLocalTournamentId(),
    timeoutMs = 8000,
  } = {}) => {
    const pending = pendingCreateRef.current;
    if (!pending?.promise) return null;

    const pendingLegacy = normalizeTournamentId(pending.legacyId);
    const desiredLegacy = normalizeTournamentId(targetLegacyId || pendingLegacy);
    if (!pendingLegacy || !desiredLegacy || pendingLegacy !== desiredLegacy) {
      return null;
    }

    try {
      const saved = timeoutMs > 0
        ? await Promise.race([
            pending.promise,
            new Promise((resolve) => setTimeout(() => resolve(null), timeoutMs)),
          ])
        : await pending.promise;
      if (!saved) return null;

      const savedId = normalizeTournamentId(saved?.appwriteId || saved?.id);
      if (!savedId) return null;

      setTournamentHistory((prev) => upsertTournamentHistory(prev, {
        ...saved,
        id: desiredLegacy,
        legacyTournamentId: desiredLegacy,
        appwriteId: savedId,
      }));
      setCurrentTournamentId(savedId);
      cloudIdWarningShownRef.current = false;
      return savedId;
    } catch {
      return null;
    }
  };

  const flushQueuedTournamentSync = async () => {
    if (!isAppwriteEnabled || tournamentSyncInFlightRef.current) return;
    const queued = pendingTournamentSyncRef.current;
    if (!queued?.tournamentId || !queued?.tournamentData) return;

    pendingTournamentSyncRef.current = null;
    tournamentSyncInFlightRef.current = true;
    try {
      await syncCurrentTournament(queued.tournamentData, queued.tournamentId);
    } catch (error) {
      console.error('Deferred tournament sync failed:', error);
    } finally {
      tournamentSyncInFlightRef.current = false;
      if (pendingTournamentSyncRef.current) {
        void flushQueuedTournamentSync();
      }
    }
  };

  const queueTournamentSync = ({
    tournamentId = null,
    tournamentData = null,
    delayMs = 1000,
    immediate = false,
  } = {}) => {
    if (!isAppwriteEnabled || !tournamentData) return;
    const targetId = tournamentId || resolveSyncTournamentId();
    if (!targetId) return;
    pendingTournamentSyncRef.current = { tournamentId: targetId, tournamentData };

    if (immediate) {
      if (tournamentSyncTimerRef.current) {
        clearTimeout(tournamentSyncTimerRef.current);
        tournamentSyncTimerRef.current = null;
      }
      void flushQueuedTournamentSync();
      return;
    }

    if (tournamentSyncTimerRef.current) {
      clearTimeout(tournamentSyncTimerRef.current);
    }
    tournamentSyncTimerRef.current = setTimeout(() => {
      tournamentSyncTimerRef.current = null;
      void flushQueuedTournamentSync();
    }, delayMs);
  };

  const toComparableMatchState = (match) => ({
    id: String(match?.id ?? '').trim(),
    round: String(match?.round ?? '').trim(),
    nextMatchId: String(match?.nextMatchId ?? '').trim(),
    score1: match?.score1 ?? '',
    score2: match?.score2 ?? '',
    completed: Boolean(match?.completed),
    statistics: match?.statistics ?? null,
    team1: {
      id: String(match?.team1?.id ?? '').trim(),
      name: String(match?.team1?.name ?? '').trim(),
      player1: String(match?.team1?.player || match?.team1?.player1 || '').trim(),
      player2: String(match?.team1?.player2 || '').trim(),
    },
    team2: {
      id: String(match?.team2?.id ?? '').trim(),
      name: String(match?.team2?.name ?? '').trim(),
      player1: String(match?.team2?.player || match?.team2?.player1 || '').trim(),
      player2: String(match?.team2?.player2 || '').trim(),
    },
  });

  const areMatchStatesEqual = (before, after) => (
    JSON.stringify(toComparableMatchState(before)) === JSON.stringify(toComparableMatchState(after))
  );

  const buildLeagueMatchPatch = (match) => ({
    matchKind: 'league',
    id: String(match?.id ?? '').trim(),
    legacyMatchId: String(match?.legacyMatchId ?? match?.immutableMatchId ?? match?.id ?? match?.appwriteId ?? '').trim(),
    team1: match?.team1 || null,
    team2: match?.team2 || null,
    score1: match?.score1 ?? '',
    score2: match?.score2 ?? '',
    completed: Boolean(match?.completed),
    completedAt: match?.completedAt || '',
    sourceUpdatedAt: match?.optimisticVersion || match?.updatedAt || match?.completedAt || new Date().toISOString(),
    roundLabel: match?.round ?? '',
    roundNo: match?.round ?? '',
    nextLegacyMatchId: match?.nextMatchId ?? '',
    ...(match?.statistics ? { statisticsJson: serializeMatchStatistics(match.statistics) } : {}),
  });

  const buildBracketMatchPatch = (match, roundIndex, matchIndex) => {
    const roundLabel = String(match?.round || '').trim();
    const normalizedRound = roundLabel.toLowerCase();
    return {
      matchKind: normalizedRound === 'final' ? 'final' : 'knockout',
      id: String(match?.id ?? '').trim(),
      legacyMatchId: String(match?.legacyMatchId ?? match?.immutableMatchId ?? match?.id ?? match?.appwriteId ?? '').trim(),
      bracketRoundIndex: roundIndex + 1,
      bracketMatchIndex: matchIndex + 1,
      team1: match?.team1 || null,
      team2: match?.team2 || null,
      score1: match?.score1 ?? '',
      score2: match?.score2 ?? '',
      completed: Boolean(match?.completed),
      completedAt: match?.completedAt || '',
      sourceUpdatedAt: match?.optimisticVersion || match?.updatedAt || match?.completedAt || new Date().toISOString(),
      roundLabel,
      roundNo: match?.round ?? '',
      nextLegacyMatchId: match?.nextMatchId ?? '',
      ...(match?.statistics ? { statisticsJson: serializeMatchStatistics(match.statistics) } : {}),
    };
  };

  const getChangedLeagueMatchPatches = ({ previousFixtures = [], nextFixtures = [] } = {}) => {
    const beforeById = new Map(
      (Array.isArray(previousFixtures) ? previousFixtures : []).map((match) => [String(match?.id ?? '').trim(), match])
    );
    return (Array.isArray(nextFixtures) ? nextFixtures : [])
      .filter((match) => {
        const key = String(match?.id ?? '').trim();
        if (!key) return false;
        return !areMatchStatesEqual(beforeById.get(key), match);
      })
      .map(buildLeagueMatchPatch);
  };

  const getChangedBracketMatchPatches = ({ previousBracket = [], nextBracket = [] } = {}) => {
    const patches = [];
    (Array.isArray(nextBracket) ? nextBracket : []).forEach((round, roundIndex) => {
      (Array.isArray(round) ? round : []).forEach((match, matchIndex) => {
        const previousMatch = Array.isArray(previousBracket?.[roundIndex])
          ? previousBracket[roundIndex][matchIndex]
          : null;
        if (areMatchStatesEqual(previousMatch, match)) return;
        const patch = buildBracketMatchPatch(match, roundIndex, matchIndex);
        if (!patch.legacyMatchId) return;
        patches.push(patch);
      });
    });
    return patches;
  };

  const patchTournamentMatchesWithFallback = async ({
    tournamentId,
    matchPatches = [],
    fallbackTournamentData = null,
    fallbackDelayMs = 900,
    fallbackImmediate = false,
    requireDurableSync = false,
  } = {}) => {
    if (!isAppwriteEnabled || !tournamentId || !Array.isArray(matchPatches) || matchPatches.length === 0) {
      return true;
    }

    const runDurableFallbackSync = async () => {
      if (!fallbackTournamentData || typeof syncCurrentTournament !== 'function') return false;
      try {
        await syncCurrentTournament(fallbackTournamentData, tournamentId);
        return true;
      } catch (error) {
        console.error('Durable fallback tournament sync failed:', error);
        return false;
      }
    };

    if (typeof patchTournamentMatches !== 'function') {
      if (fallbackTournamentData) {
        if (requireDurableSync) {
          return runDurableFallbackSync();
        }
        queueTournamentSync({
          tournamentId,
          tournamentData: fallbackTournamentData,
          delayMs: fallbackDelayMs,
          immediate: fallbackImmediate,
        });
      }
      return false;
    }

    try {
      const summary = await patchTournamentMatches(matchPatches, tournamentId);
      if (Number(summary?.missingMatches || 0) > 0) {
        if (fallbackTournamentData) {
          if (requireDurableSync) {
            return runDurableFallbackSync();
          }
          queueTournamentSync({
            tournamentId,
            tournamentData: fallbackTournamentData,
            delayMs: fallbackDelayMs,
            immediate: fallbackImmediate,
          });
        }
        return false;
      }
      return true;
    } catch (error) {
      console.error('Match patch sync failed; falling back to full tournament sync:', error);
      if (fallbackTournamentData) {
        if (requireDurableSync) {
          return runDurableFallbackSync();
        }
        queueTournamentSync({
          tournamentId,
          tournamentData: fallbackTournamentData,
          delayMs: fallbackDelayMs,
          immediate: fallbackImmediate,
        });
      }
      return false;
    }
  };

  const resolveSyncTournamentIdForWrite = async () => {
    const localResolved = resolveSyncTournamentId();
    if (localResolved) return localResolved;
    if (!isAppwriteEnabled) return null;

    const pendingCreateId = await waitForPendingCreateResolution();
    if (pendingCreateId) return pendingCreateId;

    const localId = resolveLocalTournamentId();
    const remoteActive = await fetchRemoteActiveLiveTournament({
      targetId: localId || currentTournamentId,
      targetName: tournamentName,
      targetTeams: teams,
      targetFormat: tournamentFormat,
      requireMatch: true,
    });
    const remoteId = remoteActive?.appwriteId || remoteActive?.id || null;
    if (typeof remoteId === 'string' && remoteId.trim()) {
      return remoteId;
    }
    return null;
  };

  const recoverCloudTournamentIdInBackground = async ({
    teamsSnapshot = teams,
    fixturesSnapshot = fixtures,
    bracketSnapshot = bracket,
    championSnapshot = champion,
    aiSummariesSnapshot = aiMatchSummaries,
    swapHistorySnapshot = swapHistory,
  } = {}) => {
    if (!isAppwriteEnabled || cloudIdRecoveryInFlightRef.current) return null;
    cloudIdRecoveryInFlightRef.current = true;

    try {
      const localId = resolveLocalTournamentId();
      if (localId) {
        const existing = (Array.isArray(tournamentHistory) ? tournamentHistory : [])
          .find((item) => matchesTournamentId(item, localId) && item?.appwriteId);
        const existingId = normalizeTournamentId(existing?.appwriteId);
        if (existingId) {
          setCurrentTournamentId(existingId);
          cloudIdWarningShownRef.current = false;
          return existingId;
        }
      }

      const pendingCreateId = await waitForPendingCreateResolution({ targetLegacyId: localId });
      if (pendingCreateId) return pendingCreateId;

      let recoveredId = await resolveSyncTournamentIdForWrite();

      if (!recoveredId) {
        const payload = buildCloudTournamentPayload({
          teamsSnapshot,
          fixturesSnapshot,
          bracketSnapshot,
          championSnapshot,
          aiSummariesSnapshot,
          swapHistorySnapshot,
        });
        const saved = await saveTournamentMutation.mutateAsync(payload);
        recoveredId = saved?.appwriteId || saved?.id || null;

        if (typeof recoveredId === 'string' && recoveredId.trim()) {
          const localId = resolveLocalTournamentId();
          setTournamentHistory((prev) => upsertTournamentHistory(prev, {
            ...payload,
            id: localId || recoveredId,
            legacyTournamentId: localId || payload?.legacyTournamentId || null,
            appwriteId: recoveredId,
          }));
        }
      }

      if (typeof recoveredId === 'string' && recoveredId.trim()) {
        setCurrentTournamentId(recoveredId);
        cloudIdWarningShownRef.current = false;
        return recoveredId;
      }
    } catch (error) {
      console.error('Background tournament id recovery failed:', error);
    } finally {
      cloudIdRecoveryInFlightRef.current = false;
    }

    return null;
  };

  const clearActiveTournamentLockIfMatches = async ({
    tournamentId,
    tournamentName,
    force = false,
  } = {}) => {
    if (!isAppwriteEnabled) return false;
    const targetId = String(tournamentId || '').trim();
    const targetName = String(tournamentName || '').trim().toLowerCase();
    const clearLock = async () => {
      await updateActiveTournamentLock(null, { immediate: true });
      setActiveTournamentLock?.(null);
      return true;
    };
    const lockMatchesTarget = (lock) => {
      if (!lock) return false;
      const lockId = String(lock.id || '').trim();
      const lockAppwriteId = String(lock.appwriteId || '').trim();
      const lockName = String(lock.name || '').trim().toLowerCase();
      const idMatch = Boolean(
        targetId
        && (
          (lockId && lockId === targetId)
          || (lockAppwriteId && lockAppwriteId === targetId)
        )
      );
      const nameMatch = Boolean(lockName && targetName && lockName === targetName);
      return idMatch || nameMatch;
    };

    try {
      if (force) {
        return clearLock();
      }

      if (remoteActiveCacheRef.current?.hasValue) {
        const cachedLock = remoteActiveCacheRef.current.value || null;
        if (lockMatchesTarget(cachedLock)) {
          return clearLock();
        }
      }

      const meta = await appDataService.getAppMeta({ groupId: activeGroup?.id, force: true });
      const lock = meta?.activeTournament;
      if (lockMatchesTarget(lock)) {
        return clearLock();
      }
    } catch {
      // Ignore lock clear failures.
    }
    return false;
  };

  return {
    tournamentSyncTimerRef,
    pendingTournamentSyncRef,
    pendingCreateRef,
    localTournamentIdRef,
    cloudIdWarningShownRef,
    cloudIdRecoveryInFlightRef,
    createTournamentRunIdRef,
    normalizeTournamentId,
    isLikelyLocalTournamentId,
    createLocalTournamentId,
    isIdlessActiveTournamentNameMatch,
    upsertTournamentHistory,
    persistActiveTournamentSnapshot,
    persistActiveTournamentCache,
    clearActiveTournamentCache,
    setRemoteActiveCache,
    updateActiveTournamentLock,
    buildActiveTournamentSnapshot,
    buildCloudTournamentPayload,
    buildCloudSyncPayload,
    buildRatingsDeltaPayload,
    ensureLocalTournamentId,
    resolveSyncTournamentId,
    resolveSyncTournamentIdForWrite,
    waitForPendingCreateResolution,
    queueTournamentSync,
    flushQueuedTournamentSync,
    getChangedLeagueMatchPatches,
    getChangedBracketMatchPatches,
    patchTournamentMatchesWithFallback,
    recoverCloudTournamentIdInBackground,
    clearActiveTournamentLockIfMatches,
    fetchRemoteActiveLiveTournament,
  };
};
