import { queueLocalStorageJson } from '../../services/localStorageWriteService';
import { STORAGE_KEYS } from '../../platform/storageKeys';
import { getSport, getSportPlugin } from '@fixture-maker/domain/sports';
import { listSquadPlayerNames } from '@fixture-maker/domain/sports/boxCricket/squadUtils';
import { ANALYTICS_EVENTS, trackEvent } from '@fixture-maker/analytics';
import { injectRotatingOddPlayer } from '../../utils/oddPlayerInjection';
import { clearAutoResumeSuppressedTournamentId } from '../../utils/autoResumePreference';

export const useFixtureActions = ({
  assertCanOperate,
  showToast,
  isAppwriteEnabled,
  tournamentName,
  tournamentFormat,
  format,
  gameMode,
  sportId,
  ruleConfig = {},
  teams,
  playerRatings,
  tournamentHistory,
  setNumTeams,
  setStep,
  setLoading,
  setFixtures,
  setBracket,
  setPlayerRatings,
  setAiMatchSummaries,
  setSwapHistory,
  setCurrentTournamentId,
  setTournamentHistory,
  updatePlayerDatabase,
  saveTournamentMutation,
  deleteTournamentMutation,
  createTournamentRunIdRef,
  pendingCreateRef,
  localTournamentIdRef,
  cloudIdWarningShownRef,
  cloudIdRecoveryInFlightRef,
  normalizeTournamentId,
  createLocalTournamentId,
  matchesTournamentId,
  upsertTournamentHistory,
  persistActiveTournamentCache,
  updateActiveTournamentLock,
  clearActiveTournamentLockIfMatches,
  resolveSyncTournamentIdForWrite,
  buildActiveTournamentSnapshot,
}) => {

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
      const squadNames = listSquadPlayerNames(team);
      if (squadNames.length > 0) {
        squadNames.forEach((playerName) => {
          updatePlayerDatabase(playerName);
          if (playerName && !updatedRatings[playerName]) {
            updatedRatings[playerName] = { rating: 1000, matchesPlayed: 0, history: [] };
          }
        });
        return;
      }

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
    const sportPlugin = getSportPlugin(sportId);
    const fixtureResult = sportPlugin.fixture.generateFixturesByFormat(selectedTeams, {
      tournamentFormat: selectedTournamentFormat,
      format: selectedFormat,
    });

    if (fixtureResult.kind === 'league') {
      newFixtures = fixtureResult.fixtures || [];
      const isSquadSport = getSport(sportId).participantModel === 'squad';
      if (!isSquadSport && selectedGameMode !== 'singles' && selectedOddPlayerEnabled && selectedOddPlayerName) {
        newFixtures = injectRotatingOddPlayer({
          fixtures: newFixtures,
          teams: selectedTeams,
          oddPlayerName: selectedOddPlayerName,
        });
      }
      setFixtures(newFixtures);
      setBracket([]);
    } else {
      newBracket = fixtureResult.bracket || [];
      setBracket(newBracket);
      setFixtures([]);
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
      sportId,
      ruleConfig,
      status: 'active',
      oddPlayerEnabled: selectedOddPlayerEnabled,
      oddPlayerName: selectedOddPlayerName,
      pendingSync: Boolean(isAppwriteEnabled && !normalizedExistingTournamentId),
    };
    setTournamentHistory((prev) => {
      const next = upsertTournamentHistory(prev, localTournamentSnapshot);
      if (!isAppwriteEnabled) {
        queueLocalStorageJson(STORAGE_KEYS.HISTORY, next);
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
        sportId,
        ruleConfig,
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
            sportId,
            ruleConfig,
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
            sportIdSnapshot: sportId,
            ruleConfigSnapshot: ruleConfig,
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
      showToast(`Tournament generated with random odd-player swap mode: ${selectedOddPlayerName} 🏸`);
      return true;
    }
    showToast('Tournament generated! 🏸');
    trackEvent(ANALYTICS_EVENTS.TOURNAMENT_STARTED, {
      sportId,
      tournamentFormat: selectedTournamentFormat,
      format: selectedFormat,
      gameMode: selectedGameMode,
      teamCount: selectedTeams.length,
    });
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

    const optimisticId = `sched-local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const payload = {
      legacyTournamentId: optimisticId,
      name: selectedTournamentName,
      date: scheduledIso,
      teams: selectedTeams,
      fixtures: [],
      bracket: null,
      format: selectedFormat,
      gameMode: selectedGameMode,
      tournamentFormat: selectedTournamentFormat,
      sportId,
      ruleConfig,
      aiSummaries: [],
      swapHistory: [],
      status: 'scheduled',
      oddPlayerEnabled: selectedOddPlayerEnabled,
      oddPlayerName: selectedOddPlayerName,
    };
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
      trackEvent(ANALYTICS_EVENTS.TOURNAMENT_CREATED, {
        sportId,
        status: 'scheduled',
        tournamentFormat: selectedTournamentFormat,
        teamCount: selectedTeams.length,
      });

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
      queueLocalStorageJson(STORAGE_KEYS.HISTORY, next);
      return next;
    });

    showToast(`Tournament scheduled for ${scheduleLabel}`);
    trackEvent(ANALYTICS_EVENTS.TOURNAMENT_CREATED, {
      sportId,
      status: 'scheduled',
      tournamentFormat: selectedTournamentFormat,
      teamCount: selectedTeams.length,
    });
    setStep('setup');
  };

  return {
    handleStartTournament,
    generateFixtures,
    scheduleTournament,
  };
};
