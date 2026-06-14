import {
  generateFixtures as createFixtures,
  generateKnockoutBracket,
} from '@fixture-maker/domain/fixture';
import { queueLocalStorageJson } from '../../services/localStorageWriteService';
import { STORAGE_KEYS } from '../../platform/storageKeys';
import { tournamentService } from '../../services/tournamentService';
import { deriveRatingsFromHistory, normalizeTournamentName } from '../../utils/appHelpers';
import {
  clearAutoResumeSuppressedTournamentId,
  setAutoResumeSuppressedTournamentId,
} from '../../utils/autoResumePreference';

export const useTournamentHistory = ({
  assertCanOperate,
  assertCanDelete,
  confirmAction,
  showToast,
  isAppwriteEnabled,
  activeGroup,
  tournamentName,
  setTournamentName,
  setNumTeams,
  format,
  gameMode,
  tournamentFormat,
  setStep,
  setTeams,
  setFixtures,
  setBracket,
  setChampion,
  setAiMatchSummaries,
  setSwapHistory,
  setCurrentTournamentId,
  setActiveTournamentLock,
  setPlayerDatabase,
  setPlayerRatings,
  members,
  playerRatings,
  tournamentHistory,
  setTournamentHistory,
  casualMatches,
  currentTournamentId,
  teams,
  fixtures,
  bracket,
  champion,
  generateFixtures,
  savePlayerDatabaseMutation,
  deleteTournamentMutation,
  saveRatingsMutation,
  buildRatingsDelta,
  markRatingsPersisted,
  normalizeTournamentId,
  isIdlessActiveTournamentNameMatch,
  clearActiveTournamentCache,
  fetchRemoteActiveLiveTournament,
  clearActiveTournamentLockIfMatches,
  createTournamentRunIdRef,
  localTournamentIdRef,
  pendingTournamentSyncRef,
  tournamentSyncTimerRef,
  cloudIdWarningShownRef,
}) => {
  const requestConfirmation = async (options = {}) => {
    if (typeof confirmAction !== 'function') return false;
    try {
      const result = await confirmAction(options);
      return Boolean(result);
    } catch {
      return false;
    }
  };

  const yieldToUi = () => new Promise((resolve) => {
    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(() => resolve());
      return;
    }
    setTimeout(resolve, 0);
  });

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
      queueLocalStorageJson(STORAGE_KEYS.PLAYERS, rebuilt);
    }
    return rebuilt;
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
          queueLocalStorageJson(STORAGE_KEYS.HISTORY, updatedHistory);
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
      await clearActiveTournamentLockIfMatches({
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
      queueLocalStorageJson(STORAGE_KEYS.HISTORY, updatedHistory);
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

  return {
    rebuildPlayerDatabase,
    recalculateEloFromHistory,
    resetTournament,
    rerunTournament,
    goHome,
    startNextTournament,
    handleDeleteTournamentFromSetup,
  };
};
