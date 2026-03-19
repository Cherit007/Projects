import { useEffect, useRef } from 'react';
import {
  calculatePointsTable,
  generateFixtures as createFixtures,
  generateKnockoutBracket,
  updateBracket,
  updatePlayerRatingsAfterMatch,
} from '../utils/calculations';
import { appDataService } from '../services/appDataService';
import { tournamentService } from '../services/tournamentService';
import { queueLocalStorageJson, queueLocalStorageValue } from '../services/localStorageWriteService';
import { buildPlayerAchievements } from '../utils/playerAchievements';
import { buildAiMatchSummary, detectNewlyUnlockedBadges } from '../utils/matchSummary';
import { getUpsetAlert, predictMatchOutcome } from '../utils/matchPredictions';
import {
  dedupeTournamentHistory,
  deriveRatingsFromHistory,
  getTournamentIdCandidates,
  matchesTournamentId,
  normalizeTournamentName,
} from '../utils/appHelpers';
import {
  clearAutoResumeSuppressedTournamentId,
  setAutoResumeSuppressedTournamentId,
} from '../utils/autoResumePreference';

export const useTournamentActions = ({
  assertCanOperate,
  assertCanDelete,
  confirmAction,
  showToast,
  isAppwriteEnabled,
  activeGroup,
  updatePlayerDatabase,
  tournamentName,
  setTournamentName,
  setNumTeams,
  format,
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
  const ACTIVE_TOURNAMENT_CACHE_KEY = 'bfm:appwrite-active-tournament';
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

  const yieldToUi = () => new Promise((resolve) => {
    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(() => resolve());
      return;
    }
    setTimeout(resolve, 0);
  });
  const requestConfirmation = async (options = {}) => {
    if (typeof confirmAction !== 'function') return false;
    try {
      const result = await confirmAction(options);
      return Boolean(result);
    } catch {
      return false;
    }
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

  const getOrdinalSuffix = (value) => {
    const num = Number(value);
    const mod100 = num % 100;
    if (mod100 >= 11 && mod100 <= 13) return 'th';
    const mod10 = num % 10;
    if (mod10 === 1) return 'st';
    if (mod10 === 2) return 'nd';
    if (mod10 === 3) return 'rd';
    return 'th';
  };

  const getSuggestedNextTournamentName = (name) => {
    const source = String(name || '').trim();
    if (!source) return 'Next Tournament';

    const ordinalMatches = Array.from(source.matchAll(/(\d+)(st|nd|rd|th)\b/gi));
    const lastOrdinal = ordinalMatches[ordinalMatches.length - 1];
    if (lastOrdinal && Number.isFinite(Number(lastOrdinal[1]))) {
      const nextNumber = Number(lastOrdinal[1]) + 1;
      const replacement = `${nextNumber}${getOrdinalSuffix(nextNumber)}`;
      const matchText = lastOrdinal[0];
      const start = lastOrdinal.index ?? source.lastIndexOf(matchText);
      return `${source.slice(0, start)}${replacement}${source.slice(start + matchText.length)}`;
    }

    const numberMatches = Array.from(source.matchAll(/\d+/g));
    const lastNumber = numberMatches[numberMatches.length - 1];
    if (lastNumber && Number.isFinite(Number(lastNumber[0]))) {
      const nextNumber = Number(lastNumber[0]) + 1;
      const matchText = lastNumber[0];
      const start = lastNumber.index ?? source.lastIndexOf(matchText);
      return `${source.slice(0, start)}${nextNumber}${source.slice(start + matchText.length)}`;
    }

    if (/tournament/i.test(source)) {
      return source.replace(/tournament/i, '2nd Tournament');
    }

    return `${source} 2nd Tournament`;
  };

  const collectPlayersFromTeam = (team) => (
    [team?.player || team?.player1, team?.player2].filter(Boolean)
  );

  const collectPlayersFromMatch = (match) => (
    [
      match?.team1?.player || match?.team1?.player1,
      match?.team1?.player2,
      match?.team2?.player || match?.team2?.player1,
      match?.team2?.player2,
    ].filter(Boolean)
  );

  const rebuildPlayerDatabase = async ({
    history = tournamentHistory,
    casual = casualMatches,
    liveTeams = teams,
    liveFixtures = fixtures,
    liveBracket = bracket,
    liveChampion = champion,
    persistCloud = true,
    pruneMissing = false,
  } = {}) => {
    const normalized = new Map();
    const addPlayer = (name) => {
      const value = String(name || '').trim();
      if (!value) return;
      const key = value.toLowerCase();
      if (!normalized.has(key)) normalized.set(key, value);
    };

    (Array.isArray(history) ? history : []).forEach((tournament) => {
      (Array.isArray(tournament?.teams) ? tournament.teams : []).forEach((team) => {
        collectPlayersFromTeam(team).forEach(addPlayer);
      });
      (Array.isArray(tournament?.fixtures) ? tournament.fixtures : []).forEach((match) => {
        collectPlayersFromMatch(match).forEach(addPlayer);
      });
      if (Array.isArray(tournament?.bracket)) {
        tournament.bracket.forEach((round) => {
          (Array.isArray(round) ? round : []).forEach((match) => {
            collectPlayersFromMatch(match).forEach(addPlayer);
          });
        });
      }
      if (tournament?.finalMatch) {
        collectPlayersFromMatch(tournament.finalMatch).forEach(addPlayer);
      }
      if (tournament?.champion) {
        collectPlayersFromTeam(tournament.champion).forEach(addPlayer);
      }
    });

    (Array.isArray(casual) ? casual : []).forEach((match) => {
      collectPlayersFromMatch(match).forEach(addPlayer);
    });

    (Array.isArray(liveTeams) ? liveTeams : []).forEach((team) => {
      collectPlayersFromTeam(team).forEach(addPlayer);
    });
    (Array.isArray(liveFixtures) ? liveFixtures : []).forEach((match) => {
      collectPlayersFromMatch(match).forEach(addPlayer);
    });
    if (Array.isArray(liveBracket)) {
      liveBracket.forEach((round) => {
        (Array.isArray(round) ? round : []).forEach((match) => {
          collectPlayersFromMatch(match).forEach(addPlayer);
        });
      });
    }
    if (liveChampion) {
      collectPlayersFromTeam(liveChampion).forEach(addPlayer);
    }
    (Array.isArray(members) ? members : []).forEach((member) => addPlayer(member?.name));

    const rebuilt = Array.from(normalized.values()).sort((a, b) => a.localeCompare(b));
    setPlayerDatabase(rebuilt);

    if (isAppwriteEnabled && persistCloud) {
      await savePlayerDatabaseMutation.mutateAsync({
        players: rebuilt,
        pruneMissing,
      });
    } else if (!isAppwriteEnabled) {
      queueLocalStorageJson('badminton_players', rebuilt);
    }
    return rebuilt;
  };

  const injectRotatingOddPlayer = ({ fixtures: baseFixtures = [], oddPlayerName = '' }) => {
    const oddName = (oddPlayerName || '').trim();
    if (!oddName) return baseFixtures;

    const playCount = {};
    const allPlayers = new Set([oddName]);
    const bump = (name) => {
      if (!name) return;
      playCount[name] = (playCount[name] || 0) + 1;
    };
    const getCount = (name) => playCount[name] || 0;

    baseFixtures.forEach((fixture) => {
      [
        fixture?.team1?.player || fixture?.team1?.player1,
        fixture?.team1?.player2,
        fixture?.team2?.player || fixture?.team2?.player1,
        fixture?.team2?.player2,
      ].filter(Boolean).forEach((name) => allPlayers.add(name));
    });

    const evaluateOption = (players) => {
      const next = {};
      allPlayers.forEach((name) => {
        next[name] = getCount(name);
      });
      players.forEach((name) => {
        if (!name) return;
        next[name] = (next[name] || 0) + 1;
      });
      const values = Object.values(next);
      const max = Math.max(...values);
      const min = Math.min(...values);
      return {
        imbalance: max - min,
        oddAppearances: next[oddName] || 0,
      };
    };

    const totalPlayerSlots = baseFixtures.length * 4;
    const minOddAppearances = Math.max(1, Math.floor(totalPlayerSlots / Math.max(1, allPlayers.size)));
    const updatedFixtures = [];

    baseFixtures.forEach((fixture, index) => {
      const team1P1 = fixture?.team1?.player1 || fixture?.team1?.player;
      const team1P2 = fixture?.team1?.player2;
      const team2P1 = fixture?.team2?.player1 || fixture?.team2?.player;
      const team2P2 = fixture?.team2?.player2;
      const candidates = [
        { team: 'team1', slot: 'player1', name: team1P1 },
        { team: 'team1', slot: 'player2', name: team1P2 },
        { team: 'team2', slot: 'player1', name: team2P1 },
        { team: 'team2', slot: 'player2', name: team2P2 },
      ].filter((item) => item.name);

      if (candidates.length < 4) {
        updatedFixtures.push(fixture);
        return;
      }

      const makeFixture = (benchTarget = null) => {
        const updatedFixture = {
          ...fixture,
          team1: { ...fixture.team1 },
          team2: { ...fixture.team2 },
        };
        if (!benchTarget) return updatedFixture;
        if (benchTarget.team === 'team1') {
          updatedFixture.team1[benchTarget.slot] = oddName;
          if (benchTarget.slot === 'player1') {
            updatedFixture.team1.player = oddName;
          }
        } else {
          updatedFixture.team2[benchTarget.slot] = oddName;
          if (benchTarget.slot === 'player1') {
            updatedFixture.team2.player = oddName;
          }
        }
        return updatedFixture;
      };

      const oddPlayedSoFar = getCount(oddName);
      const remainingFixturesAfterThis = baseFixtures.length - index - 1;
      const oddStillNeeded = Math.max(0, minOddAppearances - oddPlayedSoFar);
      const mustUseOddNow = oddStillNeeded > remainingFixturesAfterThis;

      const optionFixtures = [
        ...(!mustUseOddNow ? [makeFixture(null)] : []),
        ...candidates.map((candidate) => makeFixture(candidate)),
      ];

      const scoredOptions = optionFixtures.map((candidateFixture) => {
        const playersInMatch = [
          candidateFixture.team1.player || candidateFixture.team1.player1,
          candidateFixture.team1.player2,
          candidateFixture.team2.player || candidateFixture.team2.player1,
          candidateFixture.team2.player2,
        ].filter(Boolean);
        const score = evaluateOption(playersInMatch);
        return { candidateFixture, playersInMatch, score };
      });

      scoredOptions.sort((a, b) => {
        if (a.score.imbalance !== b.score.imbalance) {
          return a.score.imbalance - b.score.imbalance;
        }
        if (!mustUseOddNow && a.score.oddAppearances !== b.score.oddAppearances) {
          return a.score.oddAppearances - b.score.oddAppearances;
        }
        return 0;
      });

      const best = scoredOptions.filter((option) => (
        option.score.imbalance === scoredOptions[0].score.imbalance
        && option.score.oddAppearances === scoredOptions[0].score.oddAppearances
      ));
      const selected = best[Math.floor(Math.random() * best.length)];

      selected.playersInMatch.forEach(bump);
      updatedFixtures.push(selected.candidateFixture);
    });

    return updatedFixtures;
  };

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
        queueLocalStorageJson('badminton_history', next);
      }
      return next;
    });
    return snapshot;
  };

  const getPlayersFromMatch = (match) => {
    if (!match?.team1 || !match?.team2) return [];
    const players = [
      match.team1.player || match.team1.player1,
      match.team1.player2,
      match.team2.player || match.team2.player1,
      match.team2.player2,
    ].filter(Boolean);
    return [...new Set(players)];
  };

  const getBadgeUnlocksForMatch = ({
    match,
    ratingsBefore,
    ratingsAfter,
    historyBefore = tournamentHistory,
    historyAfter = tournamentHistory,
  }) => {
    const players = getPlayersFromMatch(match);
    return players.flatMap((playerName) => {
      const before = buildPlayerAchievements({
        playerName,
        playerRatings: ratingsBefore,
        tournamentHistory: historyBefore,
        casualMatches,
      });
      const after = buildPlayerAchievements({
        playerName,
        playerRatings: ratingsAfter,
        tournamentHistory: historyAfter,
        casualMatches,
      });
      return detectNewlyUnlockedBadges(before.badges, after.badges).map((badge) => ({
        player: playerName,
        ...badge,
      }));
    });
  };

  const pushAiSummary = (summary) => {
    if (!summary) return aiMatchSummaries;
    const updated = [summary, ...aiMatchSummaries].slice(0, 50);
    setAiMatchSummaries(updated);
    return updated;
  };

  const normalizePlayerName = (value) => String(value || '').trim().toLowerCase();

  const getTeamSlotValue = (team, slot) => {
    if (slot === 'player1') return team?.player1 || team?.player || '';
    if (slot === 'player2') return team?.player2 || '';
    return '';
  };

  const setTeamSlotValue = (team, slot, playerName) => {
    const value = String(playerName || '').trim();
    if (slot === 'player1') {
      team.player1 = value;
      if ('player' in team || !team.player) {
        team.player = value;
      }
      return;
    }
    if (slot === 'player2') {
      team.player2 = value;
    }
  };

  const findPlayerSlotInTeam = (team, playerName) => {
    const needle = normalizePlayerName(playerName);
    if (!needle) return null;
    const slots = ['player1', 'player2'];
    for (const slot of slots) {
      const value = getTeamSlotValue(team, slot);
      if (normalizePlayerName(value) === needle) return slot;
    }
    return null;
  };

  const setRemoteActiveCache = (value) => {
    remoteActiveCacheRef.current = {
      hasValue: true,
      value: value || null,
      cachedAt: Date.now(),
    };
  };

  const fetchRemoteActiveLiveTournament = async ({ force = false } = {}) => {
    if (!isAppwriteEnabled) return null;
    const cache = remoteActiveCacheRef.current;
    if (
      !force
      && cache?.hasValue
      && Date.now() - Number(cache.cachedAt || 0) < 15 * 1000
    ) {
      return cache.value || null;
    }

    try {
      const meta = await appDataService.getAppMeta({ groupId: activeGroup?.id });
      const lock = meta?.activeTournament;
      if (lock && lock.status === 'active') {
        setRemoteActiveCache(lock);
        return lock;
      }
    } catch {
      // Ignore meta read errors and fallback to tournament collection scan.
    }

    try {
      const tournaments = await tournamentService.getTournamentSummaries(20, activeGroup?.id, ['active']);
      const active = (Array.isArray(tournaments) ? tournaments : []).find((item) => (
        item?.status === 'active' && !item?.champion
      )) || null;
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
      tournamentFormat,
      aiSummaries: Array.isArray(aiSummariesSnapshot) ? aiSummariesSnapshot : [],
      swapHistory: Array.isArray(swapHistorySnapshot) ? swapHistorySnapshot : [],
      status: championSnapshot ? 'completed' : 'active',
    });
  };

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
    legacyMatchId: String(match?.id ?? '').trim(),
    team1: match?.team1 || null,
    team2: match?.team2 || null,
    score1: match?.score1 ?? '',
    score2: match?.score2 ?? '',
    completed: Boolean(match?.completed),
    roundLabel: match?.round ?? '',
    roundNo: match?.round ?? '',
    nextLegacyMatchId: match?.nextMatchId ?? '',
  });

  const buildBracketMatchPatch = (match, roundIndex, matchIndex) => {
    const roundLabel = String(match?.round || '').trim();
    const normalizedRound = roundLabel.toLowerCase();
    return {
      matchKind: normalizedRound === 'final' ? 'final' : 'knockout',
      id: String(match?.id ?? '').trim(),
      legacyMatchId: String(match?.id ?? '').trim(),
      bracketRoundIndex: roundIndex + 1,
      bracketMatchIndex: matchIndex + 1,
      team1: match?.team1 || null,
      team2: match?.team2 || null,
      score1: match?.score1 ?? '',
      score2: match?.score2 ?? '',
      completed: Boolean(match?.completed),
      roundLabel,
      roundNo: match?.round ?? '',
      nextLegacyMatchId: match?.nextMatchId ?? '',
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

    const remoteActive = await fetchRemoteActiveLiveTournament();
    const remoteId = remoteActive?.appwriteId || remoteActive?.id || null;
    if (typeof remoteId === 'string' && remoteId.trim()) {
      const localId = resolveLocalTournamentId();
      if (localId && matchesTournamentId(remoteActive, localId)) {
        return remoteId;
      }
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

  const handleStartTournament = async (rawNumTeamsInput) => {
    if (!assertCanOperate()) return;
    if (!tournamentName.trim()) {
      showToast('Please enter tournament name', 'error');
      return;
    }

    if (tournamentFormat === 'league') {
      const parsedNumTeams = parseInt(rawNumTeamsInput, 10);
      if (Number.isNaN(parsedNumTeams)) {
        showToast('Please enter number of teams', 'error');
        return;
      }
      if (parsedNumTeams < 3 || parsedNumTeams > 12) {
        showToast('Number of teams must be between 3 and 12', 'error');
        return;
      }
      setNumTeams(parsedNumTeams);
    }

    if (tournamentFormat === 'knockoutByes') {
      const parsedNumTeams = parseInt(rawNumTeamsInput, 10);
      if (Number.isNaN(parsedNumTeams)) {
        showToast('Please enter number of teams', 'error');
        return;
      }
      if (parsedNumTeams < 3 || parsedNumTeams > 16) {
        showToast('Number of teams must be between 3 and 16', 'error');
        return;
      }
      setNumTeams(parsedNumTeams);
    }

    if (tournamentFormat === 'semiFinal') {
      setNumTeams(4);
    } else if (tournamentFormat === 'fullKnockout') {
      setNumTeams(8);
    }

    setStep('teams');
  };

  const generateFixtures = async ({
    teamsOverride,
    tournamentFormatOverride,
    formatOverride,
    gameModeOverride,
    tournamentNameOverride,
    existingTournamentId,
    oddPlayerConfig,
    oddPlayerEnabled,
    oddPlayerName,
  } = {}) => {
    if (!assertCanOperate()) return false;
    clearAutoResumeSuppressedTournamentId();
    const createRunId = createTournamentRunIdRef.current + 1;
    createTournamentRunIdRef.current = createRunId;
    const selectedTeams = teamsOverride || teams;
    const selectedTournamentFormat = tournamentFormatOverride || tournamentFormat;
    const selectedFormat = formatOverride || format;
    const selectedGameMode = gameModeOverride || gameMode;
    const selectedTournamentName = tournamentNameOverride || tournamentName;
    const normalizedExistingTournamentId = String(existingTournamentId || '').trim();
    const selectedOddPlayerEnabled = Boolean(
      oddPlayerConfig?.oddPlayerEnabled ?? oddPlayerEnabled
    );
    const selectedOddPlayerName = (
      oddPlayerConfig?.oddPlayerName ?? oddPlayerName ?? ''
    ).trim();
    const nowIso = new Date().toISOString();
    const historyList = Array.isArray(tournamentHistory) ? tournamentHistory : [];
    const localTournamentId = normalizedExistingTournamentId
      || localTournamentIdRef.current
      || createLocalTournamentId();
    const existingEntry = historyList.find((item) => matchesTournamentId(item, localTournamentId));
    const legacyTournamentId = normalizeTournamentId(existingEntry?.legacyTournamentId) || localTournamentId;
    const createdAt = normalizeTournamentId(existingEntry?.createdAt) || nowIso;
    localTournamentIdRef.current = legacyTournamentId;
    setCurrentTournamentId(normalizedExistingTournamentId || legacyTournamentId);

    setLoading(true);
    const updatedRatings = { ...playerRatings };
    selectedTeams.forEach((team) => {
      const player1 = team.player || team.player1;
      const player2 = team.player2;

      updatePlayerDatabase(player1);
      if (player2) updatePlayerDatabase(player2);

      if (player1 && !updatedRatings[player1]) {
        updatedRatings[player1] = { rating: 1000, matchesPlayed: 0, history: [] };
      }
      if (player2 && !updatedRatings[player2]) {
        updatedRatings[player2] = { rating: 1000, matchesPlayed: 0, history: [] };
      }
    });
    if (selectedOddPlayerEnabled && selectedOddPlayerName && !updatedRatings[selectedOddPlayerName]) {
      updatePlayerDatabase(selectedOddPlayerName);
      updatedRatings[selectedOddPlayerName] = { rating: 1000, matchesPlayed: 0, history: [] };
    }
    setPlayerRatings(updatedRatings);

    let newFixtures = [];
    let newBracket = [];

    if (selectedTournamentFormat === 'league') {
      newFixtures = createFixtures(selectedTeams, selectedFormat);
      if (selectedGameMode !== 'singles' && selectedOddPlayerEnabled && selectedOddPlayerName) {
        newFixtures = injectRotatingOddPlayer({
          fixtures: newFixtures,
          oddPlayerName: selectedOddPlayerName,
        });
      }
      setFixtures(newFixtures);
    } else {
      newBracket = generateKnockoutBracket(selectedTeams, selectedTournamentFormat);
      setBracket(newBracket);
    }
    setAiMatchSummaries([]);
    setSwapHistory([]);
    cloudIdWarningShownRef.current = false;
    cloudIdRecoveryInFlightRef.current = false;

    const localTournamentSnapshot = {
      id: legacyTournamentId,
      legacyTournamentId,
      appwriteId: normalizedExistingTournamentId || existingEntry?.appwriteId || null,
      name: selectedTournamentName,
      date: new Date().toLocaleDateString(),
      createdAt,
      updatedAt: nowIso,
      teams: selectedTeams,
      fixtures: newFixtures,
      bracket: newBracket,
      champion: null,
      finalMatch: null,
      aiSummaries: [],
      swapHistory: [],
      format: selectedFormat,
      gameMode: selectedGameMode,
      tournamentFormat: selectedTournamentFormat,
      status: 'active',
      oddPlayerEnabled: selectedOddPlayerEnabled,
      oddPlayerName: selectedOddPlayerName,
      pendingSync: Boolean(isAppwriteEnabled && !normalizedExistingTournamentId),
    };
    setTournamentHistory((prev) => {
      const next = upsertTournamentHistory(prev, localTournamentSnapshot);
      if (!isAppwriteEnabled) {
        queueLocalStorageJson('badminton_history', next);
      }
      return next;
    });
    persistActiveTournamentCache(localTournamentSnapshot);

    if (isAppwriteEnabled) {
      const tournamentData = {
        ...(normalizedExistingTournamentId ? { appwriteId: normalizedExistingTournamentId } : {}),
        legacyTournamentId,
        name: selectedTournamentName,
        date: new Date().toLocaleDateString(),
        teams: selectedTeams,
        fixtures: newFixtures,
        bracket: newBracket.length > 0 ? newBracket : null,
        format: selectedFormat,
        gameMode: selectedGameMode,
        tournamentFormat: selectedTournamentFormat,
        aiSummaries: [],
        swapHistory: [],
        status: 'active',
        oddPlayerEnabled: selectedOddPlayerEnabled,
        oddPlayerName: selectedOddPlayerName,
      };
      const createPromise = saveTournamentMutation.mutateAsync(tournamentData);
      pendingCreateRef.current = {
        runId: createRunId,
        legacyId: legacyTournamentId,
        promise: createPromise,
      };

      void (async () => {
        try {
          const saved = await createPromise;
          if (!saved) return;
          const savedId = saved.appwriteId || saved.id || await resolveSyncTournamentIdForWrite();
          const isStaleCreate = createRunId !== createTournamentRunIdRef.current;
          if (isStaleCreate) {
            if (savedId) {
              try {
                await deleteTournamentMutation.mutateAsync(savedId);
              } catch {
                // Ignore cleanup errors for stale create writes.
              }
            }
            await clearActiveTournamentLockIfMatches({
              tournamentId: savedId || null,
              tournamentName: selectedTournamentName,
              force: true,
            });
            return;
          }
          if (savedId) setCurrentTournamentId(savedId);
          setTournamentHistory((prev) => upsertTournamentHistory(prev, {
            ...saved,
            id: legacyTournamentId,
            legacyTournamentId,
            appwriteId: savedId || saved.appwriteId || null,
            status: 'active',
            teams: selectedTeams,
            fixtures: newFixtures,
            bracket: newBracket,
            champion: null,
            aiSummaries: [],
            swapHistory: [],
            format: selectedFormat,
            gameMode: selectedGameMode,
            tournamentFormat: selectedTournamentFormat,
            oddPlayerEnabled: selectedOddPlayerEnabled,
            oddPlayerName: selectedOddPlayerName,
            createdAt,
            updatedAt: new Date().toISOString(),
          }));
          await updateActiveTournamentLock(buildActiveTournamentSnapshot({
            id: savedId || null,
            name: selectedTournamentName,
            teamsSnapshot: selectedTeams,
            fixturesSnapshot: newFixtures,
            bracketSnapshot: newBracket,
            championSnapshot: null,
            aiSummariesSnapshot: [],
            swapHistorySnapshot: [],
            formatSnapshot: selectedFormat,
            gameModeSnapshot: selectedGameMode,
            tournamentFormatSnapshot: selectedTournamentFormat,
          }), { immediate: true });
        } catch (error) {
          console.error('Failed to sync new tournament to cloud:', error);
          showToast('Tournament started locally; cloud sync failed.', 'error');
        } finally {
          if (pendingCreateRef.current?.runId === createRunId) {
            pendingCreateRef.current = null;
          }
        }
      })();
    }

    setStep('tournament');
    setLoading(false);
    if (selectedGameMode !== 'singles' && selectedOddPlayerEnabled && selectedOddPlayerName) {
      showToast(`Tournament generated with rotating odd player: ${selectedOddPlayerName} 🏸`);
      return true;
    }
    showToast('Tournament generated! 🏸');
    return true;
  };

  const scheduleTournament = async ({
    teamsOverride,
    tournamentFormatOverride,
    formatOverride,
    gameModeOverride,
    tournamentNameOverride,
    oddPlayerConfig,
    oddPlayerEnabled,
    oddPlayerName,
    scheduledAt,
  } = {}) => {
    if (!assertCanOperate()) return;
    const selectedTeams = teamsOverride || teams;
    const selectedTournamentFormat = tournamentFormatOverride || tournamentFormat;
    const selectedFormat = formatOverride || format;
    const selectedGameMode = gameModeOverride || gameMode;
    const selectedTournamentName = (tournamentNameOverride || tournamentName || '').trim();
    const selectedOddPlayerEnabled = Boolean(
      oddPlayerConfig?.oddPlayerEnabled ?? oddPlayerEnabled
    );
    const selectedOddPlayerName = (
      oddPlayerConfig?.oddPlayerName ?? oddPlayerName ?? ''
    ).trim();

    if (!selectedTournamentName) {
      showToast('Please enter tournament name', 'error');
      return;
    }

    const scheduledTimestampMs = scheduledAt
      ? new Date(scheduledAt).getTime()
      : Date.now();
    const normalizedScheduledMs = Number.isFinite(scheduledTimestampMs)
      ? scheduledTimestampMs
      : Date.now();
    const scheduledIso = new Date(normalizedScheduledMs).toISOString();
    const scheduleLabel = new Date(normalizedScheduledMs).toLocaleString();

    const payload = {
      name: selectedTournamentName,
      date: scheduledIso,
      teams: selectedTeams,
      fixtures: [],
      bracket: null,
      format: selectedFormat,
      gameMode: selectedGameMode,
      tournamentFormat: selectedTournamentFormat,
      aiSummaries: [],
      swapHistory: [],
      status: 'scheduled',
      oddPlayerEnabled: selectedOddPlayerEnabled,
      oddPlayerName: selectedOddPlayerName,
    };

    const optimisticId = `sched-local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const scheduled = {
      ...payload,
      id: optimisticId,
      legacyTournamentId: optimisticId,
      appwriteId: null,
      pendingSync: Boolean(isAppwriteEnabled),
    };

    if (isAppwriteEnabled) {
      setTournamentHistory((prev) => {
        return upsertTournamentHistory(prev, scheduled);
      });
      setStep('setup');
      showToast(`Tournament scheduled for ${scheduleLabel}`);

      void (async () => {
        try {
          const saved = await saveTournamentMutation.mutateAsync(payload);
          if (!saved || typeof saved !== 'object') return;

          const savedId = String(saved.appwriteId || saved.id || '').trim();
          if (!savedId) return;
          setTournamentHistory((prev) => {
            const withoutOptimistic = (Array.isArray(prev) ? prev : []).filter((item) => {
              const itemId = normalizeTournamentId(item?.id);
              const itemAppwriteId = normalizeTournamentId(item?.appwriteId);
              return itemId !== optimisticId && itemAppwriteId !== optimisticId;
            });
            return upsertTournamentHistory(withoutOptimistic, {
              ...saved,
              id: savedId,
              appwriteId: savedId,
              pendingSync: false,
            });
          });
        } catch (error) {
          console.error('Failed to sync scheduled tournament to cloud:', error);
          showToast('Scheduled locally; cloud sync pending.', 'error');
        }
      })();
      return;
    }

    setTournamentHistory((prev) => {
      const next = upsertTournamentHistory(prev, scheduled);
      queueLocalStorageJson('badminton_history', next);
      return next;
    });

    showToast(`Tournament scheduled for ${scheduleLabel}`);
    setStep('setup');
  };

  const saveMatchResult = async (matchId, score1, score2) => {
    if (!assertCanOperate()) return false;
    if (score1 === '' || score2 === '' || score1 === score2) {
      showToast('Invalid scores', 'error');
      return false;
    }
    const localTournamentId = ensureLocalTournamentId();
    let syncTournamentId = resolveSyncTournamentId();
    if (isAppwriteEnabled && !syncTournamentId) {
      syncTournamentId = await resolveSyncTournamentIdForWrite();
    }
    const missingCloudId = Boolean(isAppwriteEnabled && !syncTournamentId);

    const match = fixtures.find((m) => m.id === matchId);
    if (!match) {
      showToast('Live match not found. Please refresh and resume.', 'error');
      return false;
    }
    const prediction = predictMatchOutcome({
      match,
      playerRatings,
      tournamentHistory,
      casualMatches,
    });
    const upsetAlert = getUpsetAlert({
      prediction,
      score1,
      score2,
      team1Name: match?.team1?.name,
      team2Name: match?.team2?.name,
    });
    const completedAt = match?.completedAt || new Date().toISOString();
    const completedMatch = {
      ...match,
      score1: parseInt(score1, 10),
      score2: parseInt(score2, 10),
      completed: true,
      upsetAlert,
      preMatchPrediction: prediction,
      completedAt,
    };

    const ratingsBefore = playerRatings;
    const updatedRatings = updatePlayerRatingsAfterMatch(playerRatings, completedMatch);
    const updatedFixtures = fixtures.map((m) => (m.id === matchId ? completedMatch : m));
    const changedLeagueMatchPatches = getChangedLeagueMatchPatches({
      previousFixtures: fixtures,
      nextFixtures: updatedFixtures,
    });
    const updatedPointsTable = calculatePointsTable(teams, updatedFixtures);
    const badgeUnlocks = getBadgeUnlocksForMatch({
      match: completedMatch,
      ratingsBefore,
      ratingsAfter: updatedRatings,
    });

    setPlayerRatings(updatedRatings);
    setFixtures(updatedFixtures);
    const nextSummaries = pushAiSummary(buildAiMatchSummary({
      match: completedMatch,
      tournamentName,
      tournamentFormat,
      prediction,
      upsetAlert,
      pointsTable: updatedPointsTable,
      badgeUnlocks,
      isFinal: false,
    }));

    const activeSnapshot = {
      id: localTournamentId || currentTournamentId || Date.now(),
      legacyTournamentId: localTournamentId || null,
      appwriteId: isAppwriteEnabled ? (syncTournamentId || null) : null,
      name: tournamentName,
      date: new Date().toLocaleDateString(),
      teams,
      fixtures: updatedFixtures,
      bracket,
      champion,
      format,
      gameMode,
      tournamentFormat,
      aiSummaries: nextSummaries,
      swapHistory,
      status: champion ? 'completed' : 'active',
    };

    setTournamentHistory((prev) => {
      const updatedHistory = upsertTournamentHistory(prev, activeSnapshot);
      if (!isAppwriteEnabled) {
        queueLocalStorageJson('badminton_history', updatedHistory);
      }
      return updatedHistory;
    });
    persistActiveTournamentCache(activeSnapshot);

    if (isAppwriteEnabled) {
      if (syncTournamentId) {
        if (!currentTournamentId) setCurrentTournamentId(syncTournamentId);
        cloudIdWarningShownRef.current = false;
        try {
          const activeLockSnapshot = buildActiveTournamentSnapshot({
            id: syncTournamentId,
            fixturesSnapshot: updatedFixtures,
            bracketSnapshot: bracket,
            championSnapshot: champion,
            aiSummariesSnapshot: nextSummaries,
            swapHistorySnapshot: swapHistory,
          });
          await patchTournamentMatchesWithFallback({
            tournamentId: syncTournamentId,
            matchPatches: changedLeagueMatchPatches,
            fallbackDelayMs: 450,
            fallbackTournamentData: {
              teams,
              fixtures: updatedFixtures,
              bracket,
              champion,
              finalMatch: null,
              aiSummaries: nextSummaries,
              swapHistory,
            },
            requireDurableSync: true,
          });
          await updateActiveTournamentLock(activeLockSnapshot, { immediate: true });
        } catch (error) {
          console.error('Failed to sync match result to cloud:', error);
          showToast('Result saved locally; cloud sync failed. Avoid refresh and try again.', 'error');
        }
      } else {
        try {
          await updateActiveTournamentLock(buildActiveTournamentSnapshot({
            id: null,
            fixturesSnapshot: updatedFixtures,
            bracketSnapshot: bracket,
            championSnapshot: champion,
            aiSummariesSnapshot: nextSummaries,
            swapHistorySnapshot: swapHistory,
          }), { immediate: true });
        } catch {
          // Keep running even if lock update fails.
        }

        if (missingCloudId) {
          if (!cloudIdWarningShownRef.current) {
            showToast('Result saved. Cloud tournament id is still resolving; keep internet on and continue.');
            cloudIdWarningShownRef.current = true;
          }
          const recoveredId = await recoverCloudTournamentIdInBackground({
            teamsSnapshot: teams,
            fixturesSnapshot: updatedFixtures,
            bracketSnapshot: bracket,
            championSnapshot: champion,
            aiSummariesSnapshot: nextSummaries,
            swapHistorySnapshot: swapHistory,
          });

          if (recoveredId) {
            try {
              const recoveredLockSnapshot = buildActiveTournamentSnapshot({
                id: recoveredId,
                fixturesSnapshot: updatedFixtures,
                bracketSnapshot: bracket,
                championSnapshot: champion,
                aiSummariesSnapshot: nextSummaries,
                swapHistorySnapshot: swapHistory,
              });
              await patchTournamentMatchesWithFallback({
                tournamentId: recoveredId,
                matchPatches: changedLeagueMatchPatches,
                fallbackImmediate: true,
                fallbackTournamentData: {
                  teams,
                  fixtures: updatedFixtures,
                  bracket,
                  champion,
                  finalMatch: null,
                  aiSummaries: nextSummaries,
                  swapHistory,
                },
                requireDurableSync: true,
              });
              await updateActiveTournamentLock(recoveredLockSnapshot, { immediate: true });
              setTournamentHistory((prev) => upsertTournamentHistory(prev, {
                id: recoveredId,
                appwriteId: recoveredId,
                name: tournamentName,
                date: new Date().toLocaleDateString(),
                teams,
                fixtures: updatedFixtures,
                bracket,
                champion,
                format,
                gameMode,
                tournamentFormat,
                aiSummaries: nextSummaries,
                swapHistory,
                status: champion ? 'completed' : 'active',
              }));
              cloudIdWarningShownRef.current = false;
              showToast('Cloud sync restored for live tournament.');
            } catch (error) {
              console.error('Deferred cloud sync failed after id recovery:', error);
            }
          }
        }
      }
    }

    showToast('Result saved! ✓');
    return true;
  };

  const prioritizeMatch = (matchId) => {
    if (!assertCanOperate()) return;
    const currentIndex = fixtures.findIndex((match) => !match.completed);
    const targetIndex = fixtures.findIndex((match) => match.id === matchId && !match.completed);

    if (currentIndex === -1 || targetIndex === -1 || currentIndex === targetIndex) {
      return;
    }

    const reordered = [...fixtures];
    [reordered[currentIndex], reordered[targetIndex]] = [reordered[targetIndex], reordered[currentIndex]];
    setFixtures(reordered);
    persistActiveTournamentSnapshot({ fixturesSnapshot: reordered });
    const syncTournamentId = resolveSyncTournamentId();
    const reorderedLockSnapshot = buildActiveTournamentSnapshot({
      id: syncTournamentId || null,
      fixturesSnapshot: reordered,
      bracketSnapshot: bracket,
      championSnapshot: champion,
      aiSummariesSnapshot: aiMatchSummaries,
      swapHistorySnapshot: swapHistory,
    });
    if (isAppwriteEnabled && syncTournamentId) {
      if (!currentTournamentId) setCurrentTournamentId(syncTournamentId);
      queueTournamentSync({
        tournamentId: syncTournamentId,
        delayMs: 900,
        tournamentData: {
        fixtures: reordered,
        bracket,
        champion,
        finalMatch: null,
        aiSummaries: aiMatchSummaries,
        swapHistory,
        },
      });
    }
    if (isAppwriteEnabled) {
      void updateActiveTournamentLock(reorderedLockSnapshot, { immediate: true });
    }
    showToast('Match moved to LIVE NOW');
  };

  const swapTeamMember = ({ teamId, currentPlayerName, replacementPlayerName }) => {
    if (!assertCanOperate()) return false;
    const leagueCompleted = fixtures.length > 0 && fixtures.every((match) => match.completed);
    const flatBracket = (Array.isArray(bracket) ? bracket : []).flatMap((round) => (Array.isArray(round) ? round : []));
    const knockoutCompleted = flatBracket.length > 0 && flatBracket.every((match) => match?.completed);
    if (champion || leagueCompleted || knockoutCompleted) {
      showToast('Swap is blocked. Tournament or match flow is already completed.', 'error');
      return false;
    }

    const replacement = String(replacementPlayerName || '').trim();
    const currentPlayer = String(currentPlayerName || '').trim();
    const normalizedReplacement = normalizePlayerName(replacement);
    if (!replacement || !currentPlayer) {
      showToast('Please select both players', 'error');
      return false;
    }
    if (normalizedReplacement === normalizePlayerName(currentPlayer)) {
      showToast('Replacement must be different from current player', 'error');
      return false;
    }

    const targetTeamIndex = teams.findIndex(team => String(team.id) === String(teamId));
    if (targetTeamIndex === -1) {
      showToast('Team not found', 'error');
      return false;
    }

    const updatedTeams = teams.map(team => ({ ...team }));
    const targetTeam = updatedTeams[targetTeamIndex];
    const targetSlot = findPlayerSlotInTeam(targetTeam, currentPlayer);
    if (!targetSlot) {
      showToast('Player not found in selected team', 'error');
      return false;
    }
    const otherSlot = targetSlot === 'player1' ? 'player2' : 'player1';
    const otherPlayer = getTeamSlotValue(targetTeam, otherSlot);
    if (normalizedReplacement === normalizePlayerName(otherPlayer)) {
      showToast('Replacement player already exists in selected team', 'error');
      return false;
    }

    const currentLiveMatch = (Array.isArray(fixtures) ? fixtures : []).find((match) => !match?.completed) || null;
    if (currentLiveMatch) {
      const selectedTeamId = String(teamId || '');
      const team1Id = String(currentLiveMatch.team1?.id || '');
      const team2Id = String(currentLiveMatch.team2?.id || '');
      if (selectedTeamId === team1Id || selectedTeamId === team2Id) {
        const opponentTeam = selectedTeamId === team1Id ? currentLiveMatch.team2 : currentLiveMatch.team1;
        const opponentPlayers = [
          opponentTeam?.player || opponentTeam?.player1,
          opponentTeam?.player2,
        ]
          .map((name) => normalizePlayerName(name))
          .filter(Boolean);
        if (opponentPlayers.includes(normalizedReplacement)) {
          showToast('Cannot pick a player from the current live opposite team. Choose another player.', 'error');
          return false;
        }
      }
    }

    const outgoingPlayer = getTeamSlotValue(targetTeam, targetSlot);
    setTeamSlotValue(targetTeam, targetSlot, replacement);

    const teamMap = new Map(updatedTeams.map(team => [String(team.id), team]));
    const updatedFixtures = fixtures.map((match) => {
      if (!match || match.completed) return match;
      const next = { ...match };
      if (match.team1?.id && teamMap.has(String(match.team1.id))) {
        next.team1 = { ...teamMap.get(String(match.team1.id)) };
      }
      if (match.team2?.id && teamMap.has(String(match.team2.id))) {
        next.team2 = { ...teamMap.get(String(match.team2.id)) };
      }
      return next;
    });
    const updatedBracket = bracket.map((round) => (
      (Array.isArray(round) ? round : []).map((match) => {
        if (!match || match.completed) return match;
        const next = { ...match };
        if (match.team1?.id && teamMap.has(String(match.team1.id))) {
          next.team1 = { ...teamMap.get(String(match.team1.id)) };
        }
        if (match.team2?.id && teamMap.has(String(match.team2.id))) {
          next.team2 = { ...teamMap.get(String(match.team2.id)) };
        }
        return next;
      })
    ));

    setTeams(updatedTeams);
    setFixtures(updatedFixtures);
    setBracket(updatedBracket);
    updatePlayerDatabase(replacement);

    if (!playerRatings[replacement]) {
      setPlayerRatings({
        ...playerRatings,
        [replacement]: { rating: 1000, matchesPlayed: 0, history: [] },
      });
    }

    const swapEntry = {
      id: `swap-${Date.now()}`,
      at: new Date().toISOString(),
      teamId: targetTeam.id,
      teamName: targetTeam.name,
      fromPlayer: outgoingPlayer,
      toPlayer: replacement,
    };
    const updatedSwapHistory = [...swapHistory, swapEntry];
    setSwapHistory(updatedSwapHistory);
    persistActiveTournamentSnapshot({
      teamsSnapshot: updatedTeams,
      fixturesSnapshot: updatedFixtures,
      bracketSnapshot: updatedBracket,
      swapHistorySnapshot: updatedSwapHistory,
    });

    const syncTournamentId = resolveSyncTournamentId();
    const swapLockSnapshot = buildActiveTournamentSnapshot({
      id: syncTournamentId || null,
      teamsSnapshot: updatedTeams,
      fixturesSnapshot: updatedFixtures,
      bracketSnapshot: updatedBracket,
      championSnapshot: champion,
      aiSummariesSnapshot: aiMatchSummaries,
      swapHistorySnapshot: updatedSwapHistory,
    });
    if (isAppwriteEnabled && syncTournamentId) {
      if (!currentTournamentId) setCurrentTournamentId(syncTournamentId);
      queueTournamentSync({
        tournamentId: syncTournamentId,
        delayMs: 900,
        tournamentData: {
        teams: updatedTeams,
        fixtures: updatedFixtures,
        bracket: updatedBracket,
        champion,
        finalMatch: null,
        aiSummaries: aiMatchSummaries,
        swapHistory: updatedSwapHistory,
        },
      });
    }
    if (isAppwriteEnabled) {
      void updateActiveTournamentLock(swapLockSnapshot, { immediate: true });
    }

    showToast(`Updated ${targetTeam.name}: ${outgoingPlayer} → ${replacement}`);
    return true;
  };

  const normalizeCloudTournamentId = (value) => {
    const normalized = normalizeTournamentId(value);
    return normalized || null;
  };

  const resolveTournamentIdForCompletion = async (fallbackId = null) => {
    const explicit = normalizeCloudTournamentId(fallbackId);
    if (!isAppwriteEnabled) return explicit;
    if (explicit && !isLikelyLocalTournamentId(explicit)) return explicit;
    return normalizeCloudTournamentId(await resolveSyncTournamentIdForWrite());
  };

  const saveTournamentHistory = async (tournament) => {
    const resolvedCompletionId = await resolveTournamentIdForCompletion(
      tournament?.appwriteId || currentTournamentId
    );
    const fallbackLocalId = normalizeTournamentId(
      tournament?.legacyTournamentId || tournament?.id || localTournamentIdRef.current || currentTournamentId
    );
    const normalizedTournament = {
      ...(tournament || {}),
      ...(fallbackLocalId ? { id: fallbackLocalId } : {}),
      legacyTournamentId: normalizeTournamentId(tournament?.legacyTournamentId) || fallbackLocalId || null,
      appwriteId: resolvedCompletionId || tournament?.appwriteId || null,
      status: 'completed',
    };
    const updatedHistory = upsertTournamentHistory(tournamentHistory, normalizedTournament);
    setTournamentHistory(updatedHistory);
    clearActiveTournamentCache();

    if (isAppwriteEnabled && resolvedCompletionId) {
      const saved = await saveTournamentMutation.mutateAsync({
        ...normalizedTournament,
        status: 'completed',
      });
      const savedId = normalizeCloudTournamentId(
        saved?.appwriteId || saved?.id || resolvedCompletionId
      );
      if (savedId) {
        setCurrentTournamentId(savedId);
        setTournamentHistory((prev) => upsertTournamentHistory(prev, {
          ...normalizedTournament,
          id: normalizedTournament.id || fallbackLocalId || savedId,
          legacyTournamentId: normalizedTournament.legacyTournamentId || fallbackLocalId || null,
          appwriteId: savedId,
          status: 'completed',
        }));
      }
      await clearActiveTournamentLockIfMatches({
        tournamentId: savedId || normalizedTournament.appwriteId || normalizedTournament.id,
        tournamentName: normalizedTournament.name,
      });
    } else if (isAppwriteEnabled) {
      await clearActiveTournamentLockIfMatches({
        tournamentId: normalizedTournament.appwriteId || normalizedTournament.id,
        tournamentName: normalizedTournament.name,
      });
    } else {
      queueLocalStorageJson('badminton_history', updatedHistory);
    }
    return updatedHistory;
  };

  const saveBracketMatchResult = async (matchId, score1, score2) => {
    if (!assertCanOperate()) return false;
    const localTournamentId = ensureLocalTournamentId();
    const sourceMatch = bracket.flat().find((m) => m.id === matchId);
    const prediction = predictMatchOutcome({
      match: sourceMatch,
      playerRatings,
      tournamentHistory,
      casualMatches,
    });
    const upsetAlert = getUpsetAlert({
      prediction,
      score1,
      score2,
      team1Name: sourceMatch?.team1?.name,
      team2Name: sourceMatch?.team2?.name,
    });

    const rawBracket = updateBracket(bracket, matchId, score1, score2);
    const bracketCompletedAt = new Date().toISOString();
    const updatedBracket = rawBracket.map((round) => round.map((match) => {
      if (match.id !== matchId) return match;
      const completedAt = match.completed
        ? (match.completedAt || bracketCompletedAt)
        : match.completedAt;
      return {
        ...match,
        upsetAlert,
        preMatchPrediction: prediction,
        ...(completedAt ? { completedAt } : {}),
      };
    }));
    const changedBracketMatchPatches = getChangedBracketMatchPatches({
      previousBracket: bracket,
      nextBracket: updatedBracket,
    });
    setBracket(updatedBracket);
    let nextSummaries = aiMatchSummaries;

    let match = null;
    for (const round of updatedBracket) {
      match = round.find((m) => m.id === matchId);
      if (match) break;
    }

    if (match && match.completed) {
      const ratingsBefore = playerRatings;
      const updatedRatings = updatePlayerRatingsAfterMatch(playerRatings, match);
      setPlayerRatings(updatedRatings);
      const finalRound = updatedBracket[updatedBracket.length - 1];
      const finalMatch = finalRound[0];
      const isFinalMatch = finalMatch?.id === match.id;

      if (!isFinalMatch) {
        const badgeUnlocks = getBadgeUnlocksForMatch({
          match,
          ratingsBefore,
          ratingsAfter: updatedRatings,
        });
        const midSummary = buildAiMatchSummary({
          match,
          tournamentName,
          tournamentFormat,
          prediction,
          upsetAlert,
          pointsTable: [],
          badgeUnlocks,
          isFinal: false,
        });
        if (midSummary) {
          nextSummaries = [midSummary, ...nextSummaries].slice(0, 50);
        }
      }

      if (finalMatch.completed) {
        const winner = finalMatch.score1 > finalMatch.score2 ? finalMatch.team1 : finalMatch.team2;
        setChampion(winner);
        const resolvedTournamentId = await resolveTournamentIdForCompletion(currentTournamentId);
        const tournamentId = localTournamentId || currentTournamentId || Date.now();
        setCurrentTournamentId(resolvedTournamentId || currentTournamentId || tournamentId);

        const tournament = {
          id: tournamentId,
          legacyTournamentId: localTournamentId || null,
          appwriteId: resolvedTournamentId || null,
          name: tournamentName,
          date: new Date().toLocaleDateString(),
          teams,
          bracket: updatedBracket,
          champion: winner,
          format,
          gameMode,
          tournamentFormat,
          swapHistory,
          status: 'completed',
        };
        const historyAfter = upsertTournamentHistory(tournamentHistory, tournament);
        const finalBadgeUnlocks = getBadgeUnlocksForMatch({
          match: finalMatch,
          ratingsBefore,
          ratingsAfter: updatedRatings,
          historyBefore: tournamentHistory,
          historyAfter,
        });
        const finalSummary = buildAiMatchSummary({
          match: finalMatch,
          tournamentName,
          tournamentFormat,
          prediction: finalMatch.preMatchPrediction,
          upsetAlert: finalMatch.upsetAlert,
          pointsTable: [],
          badgeUnlocks: finalBadgeUnlocks,
          isFinal: true,
        });
        if (finalSummary) {
          nextSummaries = [finalSummary, ...nextSummaries].slice(0, 50);
        }
        setAiMatchSummaries(nextSummaries);
        tournament.aiSummaries = nextSummaries;
        await saveTournamentHistory(tournament);
      } else {
        setAiMatchSummaries(nextSummaries);
        persistActiveTournamentSnapshot({
          fixturesSnapshot: fixtures,
          bracketSnapshot: updatedBracket,
          aiSummariesSnapshot: nextSummaries,
          swapHistorySnapshot: swapHistory,
        });
        const syncTournamentId = resolveSyncTournamentId();
        if (isAppwriteEnabled && syncTournamentId) {
          if (!currentTournamentId) setCurrentTournamentId(syncTournamentId);
          const activeLockSnapshot = buildActiveTournamentSnapshot({
            id: syncTournamentId,
            fixturesSnapshot: fixtures,
            bracketSnapshot: updatedBracket,
            championSnapshot: null,
            aiSummariesSnapshot: nextSummaries,
            swapHistorySnapshot: swapHistory,
          });
          await patchTournamentMatchesWithFallback({
            tournamentId: syncTournamentId,
            matchPatches: changedBracketMatchPatches,
            fallbackDelayMs: 900,
            fallbackTournamentData: {
              fixtures,
              bracket: updatedBracket,
              champion: null,
              finalMatch: null,
              aiSummaries: nextSummaries,
              swapHistory,
            },
            requireDurableSync: true,
          });
          await updateActiveTournamentLock(activeLockSnapshot, { immediate: true });
        } else if (isAppwriteEnabled) {
          try {
            const activeLockSnapshot = buildActiveTournamentSnapshot({
              id: null,
              fixturesSnapshot: fixtures,
              bracketSnapshot: updatedBracket,
              championSnapshot: null,
              aiSummariesSnapshot: nextSummaries,
              swapHistorySnapshot: swapHistory,
            });
            await updateActiveTournamentLock(activeLockSnapshot, { immediate: true });
          } catch {
            // Keep running even if lock update fails.
          }
        }
      }
    }

    showToast('Result saved! ✓');
    return true;
  };

  const saveFinalResult = async (score1, score2, finalistsOverride = null) => {
    if (!assertCanOperate()) return false;
    const localTournamentId = ensureLocalTournamentId();
    if (score1 === '' || score2 === '' || score1 === score2) {
      showToast('Invalid scores', 'error');
      return false;
    }

    const pointsTable = calculatePointsTable(teams, fixtures);
    const finalists = Array.isArray(finalistsOverride) && finalistsOverride.length >= 2
      ? finalistsOverride
      : [pointsTable[0], pointsTable[1]];
    const prediction = predictMatchOutcome({
      match: { team1: finalists[0], team2: finalists[1] },
      playerRatings,
      tournamentHistory,
      casualMatches,
    });
    const upsetAlert = getUpsetAlert({
      prediction,
      score1,
      score2,
      team1Name: finalists[0]?.name,
      team2Name: finalists[1]?.name,
    });
    const winner = score1 > score2 ? finalists[0] : finalists[1];

    const finalMatch = {
      id: 'final',
      team1: finalists[0],
      team2: finalists[1],
      score1: parseInt(score1, 10),
      score2: parseInt(score2, 10),
      completed: true,
      upsetAlert,
      preMatchPrediction: prediction,
      completedAt: new Date().toISOString(),
    };

    const ratingsBefore = playerRatings;
    const updatedRatings = updatePlayerRatingsAfterMatch(playerRatings, finalMatch);
    setPlayerRatings(updatedRatings);
    setChampion(winner);
    const resolvedTournamentId = await resolveTournamentIdForCompletion(currentTournamentId);
    const tournamentId = localTournamentId || currentTournamentId || Date.now();
    setCurrentTournamentId(resolvedTournamentId || currentTournamentId || tournamentId);

    const tournament = {
      id: tournamentId,
      legacyTournamentId: localTournamentId || null,
      appwriteId: resolvedTournamentId || null,
      name: tournamentName,
      date: new Date().toLocaleDateString(),
      teams,
      fixtures,
      finalMatch,
      champion: winner,
      format,
      gameMode,
      tournamentFormat,
      swapHistory,
      status: 'completed',
    };
    const historyAfter = upsertTournamentHistory(tournamentHistory, tournament);
    const badgeUnlocks = getBadgeUnlocksForMatch({
      match: finalMatch,
      ratingsBefore,
      ratingsAfter: updatedRatings,
      historyBefore: tournamentHistory,
      historyAfter,
    });
    const nextSummaries = pushAiSummary(buildAiMatchSummary({
      match: finalMatch,
      tournamentName,
      tournamentFormat,
      prediction,
      upsetAlert,
      pointsTable,
      badgeUnlocks,
      isFinal: true,
    }));
    tournament.aiSummaries = nextSummaries;
    await saveTournamentHistory(tournament);
    showToast(`🎉 ${winner.name} are the champions!`);
    return true;
  };

  const saveCasualMatch = async (matchData) => {
    if (!assertCanOperate()) return;
    try {
      const winner = matchData.score1 > matchData.score2 ? 'team1' : 'team2';
      const completedAt = new Date().toISOString();
      const matchWithWinner = { ...matchData, winner, completedAt };

      const match = {
        id: `casual-${Date.now()}`,
        team1: matchData.team1,
        team2: matchData.team2,
        score1: matchData.score1,
        score2: matchData.score2,
        completed: true,
        completedAt,
      };

      const updatedRatings = updatePlayerRatingsAfterMatch(playerRatings, match);
      setPlayerRatings(updatedRatings);

      if (isAppwriteEnabled) {
        const savedMatch = await createCasualMatchMutation.mutateAsync(matchWithWinner);
        setCasualMatches((prev) => [savedMatch, ...prev]);
      } else {
        const localMatch = {
          ...matchWithWinner,
          id: `casual-${Date.now()}`,
          createdAt: new Date().toISOString(),
        };
        setCasualMatches((prev) => {
          const updatedMatches = [localMatch, ...prev];
          queueLocalStorageJson('badminton_casual_matches', updatedMatches);
          return updatedMatches;
        });
      }

      showToast('✅ Match recorded & ELO updated!');
      setShowCasualMatch(false);
      return { success: true };
    } catch (error) {
      console.error('Error saving casual match:', error);
      showToast('Failed to save match', 'error');
      return { success: false, error };
    }
  };

  const recalculateEloFromHistory = (history, casualMatchHistory = []) => {
    return deriveRatingsFromHistory({
      history: Array.isArray(history) ? history : [],
      casual: Array.isArray(casualMatchHistory) ? casualMatchHistory : [],
    });
  };

  const resetTournament = async (options = {}) => {
    const { skipConfirm = false, waitForCloudSync = false } = options || {};
    if (!assertCanDelete()) return { success: false };
    createTournamentRunIdRef.current += 1;
    if (!skipConfirm) {
      const confirmed = await requestConfirmation({
        title: 'Delete & Start New',
        message: 'Delete this tournament and start new? This will remove its impact from ELO/stats.',
        confirmLabel: 'Delete & Start New',
        cancelLabel: 'Cancel',
        tone: 'danger',
      });
      if (!confirmed) return { success: false, cancelled: true };
    }

    try {
      const pushUniqueId = (list, value) => {
        const normalized = normalizeTournamentId(value);
        if (!normalized) return;
        if (!list.includes(normalized)) list.push(normalized);
      };
      const normalizedTournamentName = normalizeTournamentName(tournamentName);
      const deleteCandidateIds = [];
      pushUniqueId(deleteCandidateIds, currentTournamentId);

      (Array.isArray(tournamentHistory) ? tournamentHistory : []).forEach((item) => {
        const itemId = item?.id;
        const itemAppwriteId = item?.appwriteId;
        const isSameCurrent = String(itemId || '') === String(currentTournamentId || '')
          || String(itemAppwriteId || '') === String(currentTournamentId || '');
        const isSameNameDuplicate = isIdlessActiveTournamentNameMatch(item, normalizedTournamentName);
        if (isSameCurrent || isSameNameDuplicate) {
          pushUniqueId(deleteCandidateIds, itemAppwriteId);
          pushUniqueId(deleteCandidateIds, itemId);
        }
      });
      const deleteResult = {
        success: true,
        deleteIds: [...deleteCandidateIds],
        targetName: normalizedTournamentName,
      };

      const updatedHistory = tournamentHistory.filter((t) => {
        const tId = normalizeTournamentId(t?.id);
        const tAppwriteId = normalizeTournamentId(t?.appwriteId);
        if (deleteCandidateIds.includes(tId) || deleteCandidateIds.includes(tAppwriteId)) return false;
        if (!deleteCandidateIds.length && isIdlessActiveTournamentNameMatch(t, normalizedTournamentName)) {
          return false;
        }
        return true;
      });

      setTournamentHistory(updatedHistory);
      clearActiveTournamentCache();
      const recalculatedRatings = recalculateEloFromHistory(updatedHistory, casualMatches);
      const recalculatedRatingsDelta = typeof buildRatingsDelta === 'function'
        ? buildRatingsDelta(playerRatings || {}, recalculatedRatings || {})
        : { changedRatings: {}, deletedPlayerNames: [] };
      setPlayerRatings(recalculatedRatings);

      setStep('setup');
      setTournamentName('');
      setNumTeams(3);
      setTeams([]);
      setFixtures([]);
      setBracket([]);
      setChampion(null);
      setAiMatchSummaries([]);
      setSwapHistory([]);
      setCurrentTournamentId(null);
      setActiveTournamentLock?.(null);

      const persistDeletion = async () => {
        const cloudDeleteIds = [...deleteCandidateIds];
        if (isAppwriteEnabled) {
          const remoteActive = await fetchRemoteActiveLiveTournament({ force: true });
          pushUniqueId(cloudDeleteIds, remoteActive?.appwriteId);
          pushUniqueId(cloudDeleteIds, remoteActive?.id);
          let remoteActiveSummaries = [];
          try {
            remoteActiveSummaries = await tournamentService.getTournamentSummaries(20, activeGroup?.id, ['active']);
            (Array.isArray(remoteActiveSummaries) ? remoteActiveSummaries : []).forEach((summary) => {
              const summaryName = normalizeTournamentName(summary?.name);
              const summaryIds = [summary?.id, summary?.appwriteId]
                .map((value) => String(value || '').trim())
                .filter(Boolean);
              const idMatched = summaryIds.some((value) => cloudDeleteIds.includes(value));
              const nameMatched = Boolean(
                summaryIds.length === 0
                && normalizedTournamentName
                && summaryName
                && summaryName === normalizedTournamentName
              );
              if (!idMatched && !nameMatched) return;
              summaryIds.forEach((value) => pushUniqueId(cloudDeleteIds, value));
            });
          } catch {
            // Ignore remote summary read errors and continue with collected ids.
          }
          let deletedFromCloud = cloudDeleteIds.length === 0;
          let deletedAny = false;
          for (const deleteId of cloudDeleteIds) {
            // Keep calls sequential and try all candidates to remove duplicate active entries.
            const result = await deleteTournamentMutation.mutateAsync(deleteId);
            if (result !== false) {
              deletedFromCloud = true;
              deletedAny = true;
            }
          }
          const stillHasMatchingActive = (Array.isArray(remoteActiveSummaries) ? remoteActiveSummaries : [])
            .some((summary) => {
              const summaryName = normalizeTournamentName(summary?.name);
              const summaryIds = [summary?.id, summary?.appwriteId]
                .map((value) => String(value || '').trim())
                .filter(Boolean);
              const idMatched = summaryIds.some((value) => cloudDeleteIds.includes(value));
              const nameMatched = Boolean(
                summaryIds.length === 0
                && normalizedTournamentName
                && summaryName
                && summaryName === normalizedTournamentName
              );
              return idMatched || nameMatched;
            });
          if (!deletedAny && !stillHasMatchingActive) {
            deletedFromCloud = true;
          }
          if (!deletedFromCloud) {
            showToast('Failed to delete tournament from cloud. Cleared local state only.', 'error');
          }

          if (deletedAny || cloudDeleteIds.length === 0 || !stillHasMatchingActive) {
            await clearActiveTournamentLockIfMatches({
              tournamentId: cloudDeleteIds[0],
              tournamentName: tournamentName,
              force: true,
            });
          }

          await saveRatingsMutation.mutateAsync(recalculatedRatingsDelta);
          if (typeof markRatingsPersisted === 'function') {
            markRatingsPersisted(recalculatedRatings || {});
          }
        } else {
          queueLocalStorageJson('badminton_history', updatedHistory);
        }

        await rebuildPlayerDatabase({
          history: updatedHistory,
          casual: casualMatches,
          liveTeams: [],
          liveFixtures: [],
          liveBracket: [],
          liveChampion: null,
          persistCloud: false,
          pruneMissing: false,
        });
      };

      if (isAppwriteEnabled) {
        if (waitForCloudSync) {
          await persistDeletion();
          showToast('Tournament deleted. ELO/stats recalculated.');
          return deleteResult;
        }
        showToast('Tournament deleted locally. Cloud sync in progress.');
        void persistDeletion().then(() => {
          showToast('Tournament deleted. ELO/stats recalculated.');
        }).catch((error) => {
          console.error('Error syncing deleted tournament to cloud:', error);
          showToast('Tournament deleted locally, but cloud sync failed.', 'error');
        });
        return deleteResult;
      } else {
        await persistDeletion();
        showToast('Tournament deleted. ELO/stats recalculated.');
        return deleteResult;
      }
    } catch (error) {
      console.error('Error deleting current tournament:', error);
      showToast('Failed to delete current tournament', 'error');
      return { success: false, error };
    }
  };

  const rerunTournament = () => {
    if (!assertCanOperate()) return;
    setFixtures([]);
    setBracket([]);
    setChampion(null);
    setAiMatchSummaries([]);
    setSwapHistory([]);
    setCurrentTournamentId(null);

    if (tournamentFormat === 'league') {
      const newFixtures = createFixtures(teams, format);
      setFixtures(newFixtures);
    } else {
      const newBracket = generateKnockoutBracket(teams, tournamentFormat);
      setBracket(newBracket);
    }
    showToast('Rematch started! 🏸');
  };

  const goHome = () => {
    setAutoResumeSuppressedTournamentId(localTournamentIdRef.current || currentTournamentId);
    setStep('setup');
    setTournamentName('');
    setNumTeams(3);
    setTeams([]);
    setFixtures([]);
    setBracket([]);
    setChampion(null);
    setAiMatchSummaries([]);
    setSwapHistory([]);
    setCurrentTournamentId(null);
    localTournamentIdRef.current = null;
  };

  const startNextTournament = async ({ editTeams = false, tournamentNameOverride = '' } = {}) => {
    if (!assertCanOperate()) return false;
    if (!Array.isArray(teams) || teams.length === 0) {
      showToast('No teams available to continue. Please create teams first.', 'error');
      return false;
    }

    clearAutoResumeSuppressedTournamentId();
    createTournamentRunIdRef.current += 1;
    pendingTournamentSyncRef.current = null;
    if (tournamentSyncTimerRef.current) {
      clearTimeout(tournamentSyncTimerRef.current);
      tournamentSyncTimerRef.current = null;
    }

    const customName = String(tournamentNameOverride || '').trim();
    const nextName = customName || getSuggestedNextTournamentName(tournamentName);
    setTournamentName(nextName);
    setChampion(null);
    setAiMatchSummaries([]);
    setSwapHistory([]);
    setCurrentTournamentId(null);
    localTournamentIdRef.current = null;
    setActiveTournamentLock?.(null);
    cloudIdWarningShownRef.current = false;

    if (isAppwriteEnabled) {
      void clearActiveTournamentLockIfMatches({
        tournamentId: currentTournamentId,
        tournamentName,
        force: true,
      });
    }

    if (editTeams) {
      setFixtures([]);
      setBracket([]);
      setNumTeams(teams.length);
      setStep('teams');
      showToast('Next tournament loaded. Edit teams and generate fixtures.');
      return true;
    }

    return generateFixtures({
      teamsOverride: teams,
      tournamentFormatOverride: tournamentFormat,
      formatOverride: format,
      gameModeOverride: gameMode,
      tournamentNameOverride: nextName,
    });
  };

  const handleDeleteTournamentFromSetup = async (id, options = {}) => {
    const {
      skipConfirm = false,
      skipProgressToast = false,
      awaitCloudSync = false,
      silent = false,
    } = options || {};
    if (!assertCanDelete()) return false;
    createTournamentRunIdRef.current += 1;
    if (!id) {
      showToast('Tournament id not found for delete', 'error');
      return false;
    }
    if (!skipConfirm) {
      const confirmed = await requestConfirmation({
        title: 'Delete Tournament',
        message: 'Delete this tournament?',
        confirmLabel: 'Delete',
        cancelLabel: 'Cancel',
        tone: 'danger',
      });
      if (!confirmed) return false;
    }
    if (!skipProgressToast) {
      if (!silent) showToast('Deleting tournament...');
      await yieldToUi();
    }

    const tournament = tournamentHistory.find((t) => (
      String(t.id || '') === String(id)
      || String(t.appwriteId || '') === String(id)
    ));
    const deleteId = tournament?.appwriteId || tournament?.id || id;
    if (!deleteId) {
      showToast('Tournament id not found for delete', 'error');
      return false;
    }

    const pushUniqueId = (list, value) => {
      const normalized = normalizeTournamentId(value);
      if (!normalized) return;
      if (!list.includes(normalized)) list.push(normalized);
    };

    const normalizedTargetName = normalizeTournamentName(tournament?.name);
    const targetIsActive = tournament?.status === 'active' && !tournament?.champion;
    const deleteCandidateIds = [];
    pushUniqueId(deleteCandidateIds, String(deleteId));
    pushUniqueId(deleteCandidateIds, String(id));
    pushUniqueId(deleteCandidateIds, tournament?.id);
    pushUniqueId(deleteCandidateIds, tournament?.appwriteId);

    if (targetIsActive) {
      (Array.isArray(tournamentHistory) ? tournamentHistory : []).forEach((item) => {
        const itemId = normalizeTournamentId(item?.id);
        const itemAppwriteId = normalizeTournamentId(item?.appwriteId);
        const isSameCurrent = deleteCandidateIds.includes(itemId) || deleteCandidateIds.includes(itemAppwriteId);
        const isSameActiveByName = isIdlessActiveTournamentNameMatch(item, normalizedTargetName);
        if (isSameCurrent || isSameActiveByName) {
          pushUniqueId(deleteCandidateIds, itemId);
          pushUniqueId(deleteCandidateIds, itemAppwriteId);
        }
      });
    }

    const updatedHistory = tournamentHistory.filter((item) => {
      const itemId = normalizeTournamentId(item?.id);
      const itemAppwriteId = normalizeTournamentId(item?.appwriteId);
      if (deleteCandidateIds.includes(itemId) || deleteCandidateIds.includes(itemAppwriteId)) return false;
      if (
        targetIsActive
        && isIdlessActiveTournamentNameMatch(item, normalizedTargetName)
      ) {
        return false;
      }
      return true;
    });
    const hasActiveRemaining = updatedHistory.some((item) => item?.status === 'active' && !item?.champion);
    const recalculatedRatings = recalculateEloFromHistory(updatedHistory, casualMatches);
    const recalculatedRatingsDelta = typeof buildRatingsDelta === 'function'
      ? buildRatingsDelta(playerRatings || {}, recalculatedRatings || {})
      : { changedRatings: {}, deletedPlayerNames: [] };

    setTournamentHistory(updatedHistory);
    setPlayerRatings(recalculatedRatings);
    if (targetIsActive || !hasActiveRemaining) {
      setActiveTournamentLock?.(null);
    }

    if (!isAppwriteEnabled) {
      queueLocalStorageJson('badminton_history', updatedHistory);
    }

    const persistDeletion = async () => {
      if (isAppwriteEnabled && deleteId) {
        const cloudDeleteIds = deleteCandidateIds.length > 0 ? [...deleteCandidateIds] : [deleteId];
        let deletedFromCloud = false;
        let deletedAny = false;
        for (const candidateId of cloudDeleteIds) {
          // Keep calls sequential and try all candidates to remove duplicate active entries.
          const result = await deleteTournamentMutation.mutateAsync(candidateId);
          if (result !== false) {
            deletedFromCloud = true;
            deletedAny = true;
          }
        }
        if (!deletedAny) {
          deletedFromCloud = true;
        }
        if (!deletedFromCloud) {
          throw new Error('Failed to delete tournament from cloud');
        }
        if (targetIsActive || !hasActiveRemaining) {
          await clearActiveTournamentLockIfMatches({
            tournamentId: cloudDeleteIds[0],
            tournamentName: tournament?.name,
            force: true,
          });
        }
        await saveRatingsMutation.mutateAsync(recalculatedRatingsDelta);
        if (typeof markRatingsPersisted === 'function') {
          markRatingsPersisted(recalculatedRatings || {});
        }
      }

      if (isAppwriteEnabled) {
        await rebuildPlayerDatabase({
          history: updatedHistory,
          casual: casualMatches,
          persistCloud: false,
          pruneMissing: false,
        });
        return;
      }

      await rebuildPlayerDatabase({
        history: updatedHistory,
        casual: casualMatches,
      });
    };

    if (isAppwriteEnabled) {
      if (!silent) showToast('Tournament deleted');
      if (awaitCloudSync || targetIsActive) {
        try {
          await persistDeletion();
          return true;
        } catch (error) {
          console.error('Tournament delete cloud sync failed:', error);
          if (!silent) showToast('Tournament deleted locally, but cloud sync failed.', 'error');
          return false;
        }
      }
      void persistDeletion().catch((error) => {
        console.error('Tournament delete cloud sync failed:', error);
        if (!silent) showToast('Tournament deleted locally, but cloud sync failed.', 'error');
      });
      return true;
    }

    await persistDeletion();
    if (!silent) showToast('Tournament deleted');
    return true;
  };

  const handleDeleteCasualMatchFromSetup = async (id, options = {}) => {
    const { skipConfirm = false, skipProgressToast = false } = options || {};
    if (!assertCanDelete()) return false;
    if (!skipConfirm) {
      const confirmed = await requestConfirmation({
        title: 'Delete Casual Match',
        message: 'Delete this casual match?',
        confirmLabel: 'Delete',
        cancelLabel: 'Cancel',
        tone: 'danger',
      });
      if (!confirmed) return false;
    }
    if (!skipProgressToast) {
      showToast('Deleting casual match...');
      await yieldToUi();
    }

    try {
      const updatedCasualMatches = casualMatches.filter((match) => (
        String(match?.id || '').trim() !== String(id || '').trim()
        && String(match?.appwriteId || '').trim() !== String(id || '').trim()
      ));
      setCasualMatches(updatedCasualMatches);

      if (!isAppwriteEnabled) {
        queueLocalStorageJson('badminton_casual_matches', updatedCasualMatches);
      }

      const recalculatedRatings = recalculateEloFromHistory(tournamentHistory, updatedCasualMatches);
      setPlayerRatings(recalculatedRatings);

      const persistDeletion = async () => {
        if (isAppwriteEnabled) {
          await deleteCasualMatchMutation.mutateAsync(id);
          await rebuildPlayerDatabase({
            history: tournamentHistory,
            casual: updatedCasualMatches,
            persistCloud: false,
            pruneMissing: false,
          });
          return;
        }

        await rebuildPlayerDatabase({
          history: tournamentHistory,
          casual: updatedCasualMatches,
        });
      };

      if (isAppwriteEnabled) {
        showToast('Casual match deleted');
        void persistDeletion().catch((rebuildError) => {
          console.error('Casual match delete cloud sync failed:', rebuildError);
          showToast('Casual match deleted locally, but cloud sync failed.', 'error');
        });
        return true;
      }

      await persistDeletion();
      showToast('Casual match deleted');
      return true;
    } catch (error) {
      console.error('Error deleting casual match:', error);
      showToast('Failed to delete casual match', 'error');
      return false;
    }
  };

  return {
    handleStartTournament,
    generateFixtures,
    scheduleTournament,
    saveMatchResult,
    prioritizeMatch,
    saveBracketMatchResult,
    saveFinalResult,
    saveTournamentHistory,
    saveCasualMatch,
    swapTeamMember,
    resetTournament,
    rerunTournament,
    startNextTournament,
    goHome,
    handleDeleteTournamentFromSetup,
    handleDeleteCasualMatchFromSetup,
  };
};
