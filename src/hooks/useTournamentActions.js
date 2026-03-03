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
import { buildPlayerAchievements } from '../utils/playerAchievements';
import { buildAiMatchSummary, detectNewlyUnlockedBadges } from '../utils/matchSummary';
import { getUpsetAlert, predictMatchOutcome } from '../utils/matchPredictions';

export const useTournamentActions = ({
  assertCanOperate,
  assertCanDelete,
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
  const remoteActiveCacheRef = useRef({
    hasValue: false,
    value: null,
    cachedAt: 0,
  });

  const yieldToUi = () => new Promise((resolve) => {
    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(() => resolve());
      return;
    }
    setTimeout(resolve, 0);
  });

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
      localStorage.setItem('badminton_players', JSON.stringify(rebuilt));
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
    const incomingIds = Array.from(new Set(
      [tournament?.appwriteId, tournament?.id]
        .map((value) => String(value || '').trim())
        .filter(Boolean)
    ));
    const matchesId = (item, targetId) => {
      const normalizedTarget = String(targetId || '').trim();
      if (!normalizedTarget) return false;
      const ids = [item?.appwriteId, item?.id]
        .map((value) => String(value || '').trim())
        .filter(Boolean);
      return ids.includes(normalizedTarget);
    };
    const existingIndex = history.findIndex((t) => (
      incomingIds.some((candidateId) => matchesId(t, candidateId))
    ));
    return existingIndex >= 0
      ? history.map((t, index) => (index === existingIndex ? tournament : t))
      : [tournament, ...history];
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

  const getActiveLiveTournament = () => (
    (Array.isArray(tournamentHistory) ? tournamentHistory : []).find((item) => (
      item?.status === 'active'
      && !item?.champion
    )) || null
  );

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
      const meta = await appDataService.getAppMeta();
      const lock = meta?.activeTournament;
      if (lock && lock.status === 'active') {
        setRemoteActiveCache(lock);
        return lock;
      }
    } catch (_error) {
      // Ignore meta read errors and fallback to tournament collection scan.
    }

    try {
      const tournaments = await tournamentService.getTournamentSummaries(20, activeGroup?.id, ['active']);
      const active = (Array.isArray(tournaments) ? tournaments : []).find((item) => (
        item?.status === 'active' && !item?.champion
      )) || null;
      setRemoteActiveCache(active);
      return active;
    } catch (_error) {
      return null;
    }
  };

  const persistActiveTournamentLock = async (payload) => {
    if (!isAppwriteEnabled) return;
    setRemoteActiveCache(payload || null);
    try {
      await appDataService.saveAppMeta({
        activeTournament: payload || null,
      });
    } catch (_error) {
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
  } = {}) => ({
    id: id || currentTournamentId || null,
    appwriteId: id || currentTournamentId || null,
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

  const buildCloudTournamentPayload = ({
    teamsSnapshot = teams,
    fixturesSnapshot = fixtures,
    bracketSnapshot = bracket,
    championSnapshot = champion,
    aiSummariesSnapshot = aiMatchSummaries,
    swapHistorySnapshot = swapHistory,
  } = {}) => ({
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

  const resolveSyncTournamentId = () => {
    if (currentTournamentId) {
      if (!isAppwriteEnabled) return currentTournamentId;
      if (typeof currentTournamentId === 'string' && currentTournamentId.trim()) return currentTournamentId;
    }
    const activeByName = (Array.isArray(tournamentHistory) ? tournamentHistory : []).find((item) => (
      item?.status === 'active'
      && !item?.champion
      && (item?.name || '').trim().toLowerCase() === (tournamentName || '').trim().toLowerCase()
    ));
    if (!activeByName) return null;
    if (!isAppwriteEnabled) return activeByName?.appwriteId || activeByName?.id || null;
    if (typeof activeByName?.appwriteId === 'string' && activeByName.appwriteId.trim()) {
      return activeByName.appwriteId;
    }
    if (typeof activeByName?.id === 'string' && activeByName.id.trim()) {
      return activeByName.id;
    }
    return null;
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

    const remoteActive = await fetchRemoteActiveLiveTournament();
    const remoteId = remoteActive?.appwriteId || remoteActive?.id || null;
    if (typeof remoteId === 'string' && remoteId.trim()) return remoteId;
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
          setTournamentHistory((prev) => upsertTournamentHistory(prev, {
            ...payload,
            id: recoveredId,
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

  const clearActiveTournamentLockIfMatches = async ({ tournamentId, tournamentName } = {}) => {
    if (!isAppwriteEnabled) return;
    const targetId = String(tournamentId || '').trim();
    const targetName = String(tournamentName || '').trim().toLowerCase();
    const lockMatchesTarget = (lock) => {
      if (!lock) return false;
      const lockId = String(lock.id || '').trim();
      const lockName = String(lock.name || '').trim().toLowerCase();
      const idMatch = Boolean(lockId && targetId && lockId === targetId);
      const nameMatch = Boolean(lockName && targetName && lockName === targetName);
      return idMatch || nameMatch;
    };

    try {
      if (remoteActiveCacheRef.current?.hasValue) {
        const cachedLock = remoteActiveCacheRef.current.value || null;
        if (!lockMatchesTarget(cachedLock)) return;
        await updateActiveTournamentLock(null, { immediate: true });
        setActiveTournamentLock?.(null);
        return;
      }

      const meta = await appDataService.getAppMeta();
      const lock = meta?.activeTournament;
      if (lockMatchesTarget(lock)) {
        await updateActiveTournamentLock(null, { immediate: true });
        setActiveTournamentLock?.(null);
      }
    } catch {
      // Ignore lock clear failures.
    }
  };

  const blockWhenLiveTournamentExists = async () => {
    const activeLive = getActiveLiveTournament();
    if (activeLive) {
      showToast(`"${activeLive.name || 'Live tournament'}" is already in progress. Complete it before starting another.`, 'error');
      return true;
    }

    const remoteActive = await fetchRemoteActiveLiveTournament();
    if (remoteActive) {
      if (Array.isArray(remoteActive.teams) || Array.isArray(remoteActive.fixtures)) {
        setTournamentHistory((prev) => upsertTournamentHistory(prev, remoteActive));
      }
      showToast(`"${remoteActive.name || 'Live tournament'}" is already in progress. Complete it before starting another.`, 'error');
      return true;
    }
    return false;
  };


  const handleStartTournament = async (rawNumTeamsInput) => {
    if (!assertCanOperate()) return;
    const activeLive = getActiveLiveTournament();
    if (activeLive) {
      showToast(`"${activeLive.name || 'Live tournament'}" is already in progress. Complete it before starting another.`, 'error');
      return;
    }
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
    oddPlayerConfig,
    oddPlayerEnabled,
    oddPlayerName,
  } = {}) => {
    if (!assertCanOperate()) return;
    if (await blockWhenLiveTournamentExists()) return;
    const selectedTeams = teamsOverride || teams;
    const selectedTournamentFormat = tournamentFormatOverride || tournamentFormat;
    const selectedFormat = formatOverride || format;
    const selectedGameMode = gameModeOverride || gameMode;
    const selectedTournamentName = tournamentNameOverride || tournamentName;
    const selectedOddPlayerEnabled = Boolean(
      oddPlayerConfig?.oddPlayerEnabled ?? oddPlayerEnabled
    );
    const selectedOddPlayerName = (
      oddPlayerConfig?.oddPlayerName ?? oddPlayerName ?? ''
    ).trim();

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

    if (isAppwriteEnabled) {
      const tournamentData = {
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

      void (async () => {
        try {
          const saved = await saveTournamentMutation.mutateAsync(tournamentData);
          if (!saved) return;
          const savedId = saved.appwriteId || saved.id || await resolveSyncTournamentIdForWrite();
          if (savedId) setCurrentTournamentId(savedId);
          setTournamentHistory((prev) => upsertTournamentHistory(prev, {
            ...saved,
            id: savedId || saved.id || Date.now(),
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
        }
      })();
    }

    setStep('tournament');
    setLoading(false);
    if (selectedGameMode !== 'singles' && selectedOddPlayerEnabled && selectedOddPlayerName) {
      showToast(`Tournament generated with rotating odd player: ${selectedOddPlayerName} 🏸`);
      return;
    }
    showToast('Tournament generated! 🏸');
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
    if (await blockWhenLiveTournamentExists()) return;
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

    const scheduleLabel = scheduledAt
      ? new Date(scheduledAt).toLocaleString()
      : new Date().toLocaleString();

    const payload = {
      name: selectedTournamentName,
      date: scheduleLabel,
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

    if (isAppwriteEnabled) {
      const saved = await saveTournamentMutation.mutateAsync(payload);
      if (saved) {
        setTournamentHistory((prev) => upsertTournamentHistory(prev, saved));
      }
    } else {
      const scheduled = {
        ...payload,
        id: Date.now(),
        appwriteId: null,
      };
      setTournamentHistory((prev) => {
        const next = [scheduled, ...prev];
        localStorage.setItem('badminton_history', JSON.stringify(next));
        return next;
      });
    }

    showToast(`Tournament scheduled for ${scheduleLabel}`);
    setStep('setup');
  };

  const saveMatchResult = async (matchId, score1, score2) => {
    if (!assertCanOperate()) return;
    if (score1 === '' || score2 === '' || score1 === score2) {
      showToast('Invalid scores', 'error');
      return;
    }
    const syncTournamentId = resolveSyncTournamentId();
    const missingCloudId = Boolean(isAppwriteEnabled && !syncTournamentId);

    const match = fixtures.find((m) => m.id === matchId);
    if (!match) {
      showToast('Live match not found. Please refresh and resume.', 'error');
      return;
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
    const completedMatch = {
      ...match,
      score1: parseInt(score1, 10),
      score2: parseInt(score2, 10),
      completed: true,
      upsetAlert,
      preMatchPrediction: prediction,
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

    setTournamentHistory((prev) => {
      const updatedHistory = upsertTournamentHistory(prev, {
        id: syncTournamentId || currentTournamentId || Date.now(),
        appwriteId: isAppwriteEnabled
          ? (syncTournamentId || currentTournamentId || null)
          : null,
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
      });
      if (!isAppwriteEnabled) {
        localStorage.setItem('badminton_history', JSON.stringify(updatedHistory));
      }
      return updatedHistory;
    });

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
          updateActiveTournamentLock(activeLockSnapshot);
        } catch (error) {
          console.error('Failed to sync match result to cloud:', error);
          showToast('Result saved locally; cloud sync failed. Avoid refresh and try again.', 'error');
        }
      } else {
        try {
          updateActiveTournamentLock(buildActiveTournamentSnapshot({
            id: null,
            fixturesSnapshot: updatedFixtures,
            bracketSnapshot: bracket,
            championSnapshot: champion,
            aiSummariesSnapshot: nextSummaries,
            swapHistorySnapshot: swapHistory,
          }));
        } catch (_error) {
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
              updateActiveTournamentLock(recoveredLockSnapshot);
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
    const syncTournamentId = resolveSyncTournamentId();
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
      updateActiveTournamentLock(buildActiveTournamentSnapshot({
        id: syncTournamentId,
        fixturesSnapshot: reordered,
        bracketSnapshot: bracket,
        championSnapshot: champion,
        aiSummariesSnapshot: aiMatchSummaries,
        swapHistorySnapshot: swapHistory,
      }));
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

    const syncTournamentId = resolveSyncTournamentId();
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
      updateActiveTournamentLock(buildActiveTournamentSnapshot({
        id: syncTournamentId,
        teamsSnapshot: updatedTeams,
        fixturesSnapshot: updatedFixtures,
        bracketSnapshot: updatedBracket,
        championSnapshot: champion,
        aiSummariesSnapshot: aiMatchSummaries,
        swapHistorySnapshot: updatedSwapHistory,
      }));
    }

    showToast(`Updated ${targetTeam.name}: ${outgoingPlayer} → ${replacement}`);
    return true;
  };

  const saveTournamentHistory = async (tournament) => {
    const updatedHistory = upsertTournamentHistory(tournamentHistory, tournament);
    setTournamentHistory(updatedHistory);

    if (isAppwriteEnabled && tournament.appwriteId) {
      await saveTournamentMutation.mutateAsync({
        ...tournament,
        status: 'completed',
      });
      await clearActiveTournamentLockIfMatches({
        tournamentId: tournament.appwriteId || tournament.id,
        tournamentName: tournament.name,
      });
    } else {
      localStorage.setItem('badminton_history', JSON.stringify(updatedHistory));
    }
    return updatedHistory;
  };

  const saveBracketMatchResult = async (matchId, score1, score2) => {
    if (!assertCanOperate()) return;
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
    const updatedBracket = rawBracket.map((round) => round.map((match) => (
      match.id === matchId
        ? { ...match, upsetAlert, preMatchPrediction: prediction }
        : match
    )));
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
        const tournamentId = currentTournamentId || Date.now();
        setCurrentTournamentId(tournamentId);

        const tournament = {
          id: tournamentId,
          appwriteId: currentTournamentId,
          name: tournamentName,
          date: new Date().toLocaleDateString(),
          teams,
          bracket: updatedBracket,
          champion: winner,
          format: tournamentFormat,
          gameMode,
          swapHistory,
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
          updateActiveTournamentLock(activeLockSnapshot);
        }
      }
    }

    showToast('Result saved! ✓');
  };

  const saveFinalResult = async (score1, score2, finalistsOverride = null) => {
    if (!assertCanOperate()) return;
    if (score1 === '' || score2 === '' || score1 === score2) {
      showToast('Invalid scores', 'error');
      return;
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
    };

    const ratingsBefore = playerRatings;
    const updatedRatings = updatePlayerRatingsAfterMatch(playerRatings, finalMatch);
    setPlayerRatings(updatedRatings);
    setChampion(winner);
    const tournamentId = currentTournamentId || Date.now();
    setCurrentTournamentId(tournamentId);

    const tournament = {
      id: tournamentId,
      appwriteId: currentTournamentId,
      name: tournamentName,
      date: new Date().toLocaleDateString(),
      teams,
      fixtures,
      finalMatch,
      champion: winner,
      format,
      gameMode,
      swapHistory,
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
  };

  const saveCasualMatch = async (matchData) => {
    if (!assertCanOperate()) return;
    try {
      const winner = matchData.score1 > matchData.score2 ? 'team1' : 'team2';
      const matchWithWinner = { ...matchData, winner };

      const match = {
        id: `casual-${Date.now()}`,
        team1: matchData.team1,
        team2: matchData.team2,
        score1: matchData.score1,
        score2: matchData.score2,
        completed: true,
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
          localStorage.setItem('badminton_casual_matches', JSON.stringify(updatedMatches));
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

  const updatePlayerRatingsAfterMatchStatic = (currentRatings, match) => {
    if (!match || !match.team1 || !match.team2) return currentRatings;

    const updatedRatings = { ...currentRatings };
    const team1Players = [match.team1.player || match.team1.player1, match.team1.player2].filter(Boolean);
    const team2Players = [match.team2.player || match.team2.player1, match.team2.player2].filter(Boolean);

    if (team1Players.length === 0 || team2Players.length === 0) return currentRatings;

    [...team1Players, ...team2Players].forEach((player) => {
      if (player && !updatedRatings[player]) {
        updatedRatings[player] = { rating: 1000, matchesPlayed: 0, history: [] };
      }
    });

    const team1AvgRating = team1Players.reduce((sum, p) => sum + (updatedRatings[p]?.rating || 1000), 0) / team1Players.length;
    const team2AvgRating = team2Players.reduce((sum, p) => sum + (updatedRatings[p]?.rating || 1000), 0) / team2Players.length;

    const team1Score = match.score1 > match.score2 ? 1 : 0;
    const team2Score = match.score2 > match.score1 ? 1 : 0;

    team1Players.forEach((player) => {
      if (!player || !updatedRatings[player]) return;
      const oldRating = updatedRatings[player].rating;
      const expectedScore = 1 / (1 + Math.pow(10, (team2AvgRating - oldRating) / 400));
      const newRating = Math.round(oldRating + 32 * (team1Score - expectedScore));
      const change = newRating - oldRating;

      updatedRatings[player] = {
        rating: newRating,
        matchesPlayed: (updatedRatings[player].matchesPlayed || 0) + 1,
        history: [
          ...(updatedRatings[player].history || []),
          { matchId: match.id, oldRating, newRating, change, opponent: team2Players.join(' & '), result: team1Score === 1 ? 'win' : 'loss', date: new Date().toISOString() },
        ],
      };
    });

    team2Players.forEach((player) => {
      if (!player || !updatedRatings[player]) return;
      const oldRating = updatedRatings[player].rating;
      const expectedScore = 1 / (1 + Math.pow(10, (team1AvgRating - oldRating) / 400));
      const newRating = Math.round(oldRating + 32 * (team2Score - expectedScore));
      const change = newRating - oldRating;

      updatedRatings[player] = {
        rating: newRating,
        matchesPlayed: (updatedRatings[player].matchesPlayed || 0) + 1,
        history: [
          ...(updatedRatings[player].history || []),
          { matchId: match.id, oldRating, newRating, change, opponent: team1Players.join(' & '), result: team2Score === 1 ? 'win' : 'loss', date: new Date().toISOString() },
        ],
      };
    });

    return updatedRatings;
  };

  const recalculateEloFromHistory = (history, casualMatchHistory = []) => {
    let ratings = {};
    const tournamentHistoryList = Array.isArray(history) ? history : [];
    const sortedHistory = [...tournamentHistoryList].sort((a, b) => (a.id || 0) - (b.id || 0));

    sortedHistory.forEach((tournament) => {
      if (!tournament) return;

      const tournamentTeams = tournament.teams || [];
      tournamentTeams.forEach((team) => {
        if (!team) return;
        const players = [team.player || team.player1, team.player2].filter(Boolean);
        players.forEach((player) => {
          if (player && !ratings[player]) {
            ratings[player] = { rating: 1000, matchesPlayed: 0, history: [] };
          }
        });
      });

      const allMatches = [
        ...(Array.isArray(tournament.fixtures) ? tournament.fixtures : []),
        ...(tournament.finalMatch ? [tournament.finalMatch] : []),
      ];

      if (Array.isArray(tournament.bracket)) {
        tournament.bracket.forEach((round) => {
          if (Array.isArray(round)) {
            round.forEach((match) => {
              if (match && match.completed) allMatches.push(match);
            });
          }
        });
      }

      allMatches.forEach((match) => {
        if (match && match.completed && match.team1 && match.team2) {
          try {
            ratings = updatePlayerRatingsAfterMatchStatic(ratings, match);
          } catch (error) {
            console.error('Error updating ratings for match:', error);
          }
        }
      });
    });

    casualMatchHistory.forEach((match) => {
      if (!match || !match.team1 || !match.team2) return;
      const normalizedMatch = {
        ...match,
        score1: Number(match.score1),
        score2: Number(match.score2),
        completed: true,
      };

      if (Number.isNaN(normalizedMatch.score1) || Number.isNaN(normalizedMatch.score2)) return;
      ratings = updatePlayerRatingsAfterMatchStatic(ratings, normalizedMatch);
    });

    return ratings;
  };

  const resetTournament = async () => {
    if (!assertCanDelete()) return;
    if (!window.confirm('Delete this tournament and start new? This will remove its impact from ELO/stats.')) return;

    try {
      const pushUniqueId = (list, value) => {
        const normalized = typeof value === 'string' ? value.trim() : '';
        if (!normalized) return;
        if (!list.includes(normalized)) list.push(normalized);
      };
      const normalizedTournamentName = (tournamentName || '').trim().toLowerCase();
      const deleteCandidateIds = [];
      pushUniqueId(deleteCandidateIds, currentTournamentId);

      (Array.isArray(tournamentHistory) ? tournamentHistory : []).forEach((item) => {
        const itemId = item?.id;
        const itemAppwriteId = item?.appwriteId;
        const isSameCurrent = String(itemId || '') === String(currentTournamentId || '')
          || String(itemAppwriteId || '') === String(currentTournamentId || '');
        const isActive = item?.status === 'active' && !item?.champion;
        const isSameName = normalizedTournamentName
          && (item?.name || '').trim().toLowerCase() === normalizedTournamentName;
        if (isSameCurrent || isActive || isSameName) {
          pushUniqueId(deleteCandidateIds, itemAppwriteId);
          pushUniqueId(deleteCandidateIds, itemId);
        }
      });

      const updatedHistory = tournamentHistory.filter((t) => {
        const tId = typeof t?.id === 'string' ? t.id.trim() : '';
        const tAppwriteId = typeof t?.appwriteId === 'string' ? t.appwriteId.trim() : '';
        if (deleteCandidateIds.includes(tId) || deleteCandidateIds.includes(tAppwriteId)) return false;
        if (!deleteCandidateIds.length && normalizedTournamentName) {
          const isActive = t?.status === 'active' && !t?.champion;
          const sameName = (t?.name || '').trim().toLowerCase() === normalizedTournamentName;
          if (isActive && sameName) return false;
        }
        return true;
      });

      setTournamentHistory(updatedHistory);
      const hasActiveRemaining = updatedHistory.some((item) => item?.status === 'active' && !item?.champion);
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
          const remoteActive = await fetchRemoteActiveLiveTournament();
          pushUniqueId(cloudDeleteIds, remoteActive?.appwriteId);
          pushUniqueId(cloudDeleteIds, remoteActive?.id);
          let deletedFromCloud = cloudDeleteIds.length === 0;
          for (const deleteId of cloudDeleteIds) {
            // Keep calls sequential so we stop at first successful delete.
            // eslint-disable-next-line no-await-in-loop
            const result = await deleteTournamentMutation.mutateAsync(deleteId);
            if (result !== false) {
              deletedFromCloud = true;
              // eslint-disable-next-line no-await-in-loop
              await clearActiveTournamentLockIfMatches({
                tournamentId: deleteId,
                tournamentName: tournamentName,
              });
              break;
            }
          }
          if (!deletedFromCloud) {
            showToast('Failed to delete tournament from cloud. Cleared local state only.', 'error');
          }

          if (cloudDeleteIds.length === 0) {
            await clearActiveTournamentLockIfMatches({ tournamentName: tournamentName });
          }

          if (!hasActiveRemaining) {
            await updateActiveTournamentLock(null, { immediate: true });
          }

          await saveRatingsMutation.mutateAsync(recalculatedRatingsDelta);
          if (typeof markRatingsPersisted === 'function') {
            markRatingsPersisted(recalculatedRatings || {});
          }
        } else {
          localStorage.setItem('badminton_history', JSON.stringify(updatedHistory));
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
        showToast('Tournament deleted locally. Cloud sync in progress.');
        void persistDeletion().then(() => {
          showToast('Tournament deleted. ELO/stats recalculated.');
        }).catch((error) => {
          console.error('Error syncing deleted tournament to cloud:', error);
          showToast('Tournament deleted locally, but cloud sync failed.', 'error');
        });
      } else {
        await persistDeletion();
        showToast('Tournament deleted. ELO/stats recalculated.');
      }
    } catch (error) {
      console.error('Error deleting current tournament:', error);
      showToast('Failed to delete current tournament', 'error');
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
  };

  const startNextTournament = ({ editTeams = false, tournamentNameOverride = '' } = {}) => {
    if (!assertCanOperate()) return;
    if (!Array.isArray(teams) || teams.length === 0) {
      showToast('No teams available to continue. Please create teams first.', 'error');
      return;
    }

    const customName = String(tournamentNameOverride || '').trim();
    const nextName = customName || getSuggestedNextTournamentName(tournamentName);
    setTournamentName(nextName);
    setChampion(null);
    setAiMatchSummaries([]);
    setSwapHistory([]);
    setCurrentTournamentId(null);

    if (editTeams) {
      setFixtures([]);
      setBracket([]);
      setNumTeams(teams.length);
      setStep('teams');
      showToast('Next tournament loaded. Edit teams and generate fixtures.');
      return;
    }

    setFixtures([]);
    setBracket([]);
    if (tournamentFormat === 'league') {
      const newFixtures = createFixtures(teams, format);
      setFixtures(newFixtures);
    } else {
      const newBracket = generateKnockoutBracket(teams, tournamentFormat);
      setBracket(newBracket);
    }
    setStep('tournament');
    showToast('Next tournament started with same teams.');
  };

  const handleDeleteTournamentFromSetup = async (id, options = {}) => {
    const { skipConfirm = false, skipProgressToast = false } = options || {};
    if (!assertCanDelete()) return false;
    if (!id) {
      showToast('Tournament id not found for delete', 'error');
      return false;
    }
    if (!skipConfirm && !window.confirm('Delete this tournament?')) return false;
    if (!skipProgressToast) {
      showToast('Deleting tournament...');
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
      const normalized = typeof value === 'string' ? value.trim() : '';
      if (!normalized) return;
      if (!list.includes(normalized)) list.push(normalized);
    };

    const normalizedTargetName = (tournament?.name || '').trim().toLowerCase();
    const targetIsActive = tournament?.status === 'active' && !tournament?.champion;
    const deleteCandidateIds = [];
    pushUniqueId(deleteCandidateIds, String(deleteId));
    pushUniqueId(deleteCandidateIds, String(id));
    pushUniqueId(deleteCandidateIds, tournament?.id);
    pushUniqueId(deleteCandidateIds, tournament?.appwriteId);

    if (targetIsActive) {
      (Array.isArray(tournamentHistory) ? tournamentHistory : []).forEach((item) => {
        const itemId = String(item?.id || '').trim();
        const itemAppwriteId = String(item?.appwriteId || '').trim();
        const isSameCurrent = deleteCandidateIds.includes(itemId) || deleteCandidateIds.includes(itemAppwriteId);
        const isSameActiveByName = normalizedTargetName
          && item?.status === 'active'
          && !item?.champion
          && (item?.name || '').trim().toLowerCase() === normalizedTargetName;
        if (isSameCurrent || isSameActiveByName) {
          pushUniqueId(deleteCandidateIds, itemId);
          pushUniqueId(deleteCandidateIds, itemAppwriteId);
        }
      });
    }

    const updatedHistory = tournamentHistory.filter((item) => {
      const itemId = String(item?.id || '').trim();
      const itemAppwriteId = String(item?.appwriteId || '').trim();
      if (deleteCandidateIds.includes(itemId) || deleteCandidateIds.includes(itemAppwriteId)) return false;
      if (
        targetIsActive
        && normalizedTargetName
        && item?.status === 'active'
        && !item?.champion
        && (item?.name || '').trim().toLowerCase() === normalizedTargetName
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
      localStorage.setItem('badminton_history', JSON.stringify(updatedHistory));
    }

    const persistDeletion = async () => {
      if (isAppwriteEnabled && deleteId) {
        let deletedFromCloud = false;
        for (const candidateId of (deleteCandidateIds.length > 0 ? deleteCandidateIds : [deleteId])) {
          // Keep calls sequential so we stop at first successful delete.
          // eslint-disable-next-line no-await-in-loop
          const result = await deleteTournamentMutation.mutateAsync(candidateId);
          if (result !== false) {
            deletedFromCloud = true;
            // eslint-disable-next-line no-await-in-loop
            await clearActiveTournamentLockIfMatches({
              tournamentId: candidateId,
              tournamentName: tournament?.name,
            });
            break;
          }
        }
        if (!deletedFromCloud) {
          throw new Error('Failed to delete tournament from cloud');
        }
        if (targetIsActive || !hasActiveRemaining) {
          await updateActiveTournamentLock(null, { immediate: true });
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
      showToast('Tournament deleted');
      void persistDeletion().catch((error) => {
        console.error('Tournament delete cloud sync failed:', error);
        showToast('Tournament deleted locally, but cloud sync failed.', 'error');
      });
      return true;
    }

    await persistDeletion();
    showToast('Tournament deleted');
    return true;
  };

  const handleDeleteCasualMatchFromSetup = async (id, options = {}) => {
    const { skipConfirm = false, skipProgressToast = false } = options || {};
    if (!assertCanDelete()) return false;
    if (!skipConfirm && !window.confirm('Delete this casual match?')) return false;
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
        localStorage.setItem('badminton_casual_matches', JSON.stringify(updatedCasualMatches));
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
