import { getSportPlugin } from '@fixture-maker/domain/sports';
import { ANALYTICS_EVENTS, trackEvent } from '@fixture-maker/analytics';
import { updateBracket } from '@fixture-maker/domain/fixture';
import { queueLocalStorageJson } from '../../services/localStorageWriteService';
import { STORAGE_KEYS } from '../../platform/storageKeys';
import { buildAiMatchSummary } from '@fixture-maker/domain/narrative';
import { getUpsetAlert, predictMatchOutcome } from '@fixture-maker/domain/predictions';

export const useScoringActions = ({
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
  fixtures,
  bracket,
  champion,
  swapHistory,
  playerRatings,
  tournamentHistory,
  casualMatches,
  aiMatchSummaries,
  currentTournamentId,
  setFixtures,
  setBracket,
  setChampion,
  setPlayerRatings,
  setAiMatchSummaries,
  setCurrentTournamentId,
  setTournamentHistory,
  setActiveTournamentLock,
  saveTournamentTransactionToAppwrite,
  markRatingsPersisted,
  ensureLocalTournamentId,
  resolveSyncTournamentId,
  resolveSyncTournamentIdForWrite,
  getChangedLeagueMatchPatches,
  getChangedBracketMatchPatches,
  patchTournamentMatchesWithFallback,
  recoverCloudTournamentIdInBackground,
  buildActiveTournamentSnapshot,
  buildCloudSyncPayload,
  buildRatingsDeltaPayload,
  getBadgeUnlocksForMatch,
  pushAiSummary,
  persistActiveTournamentSnapshot,
  persistActiveTournamentCache,
  queueTournamentSync,
  updateActiveTournamentLock,
  upsertTournamentHistory,
  setRemoteActiveCache,
  cloudIdWarningShownRef,
  cloudIdRecoveryInFlightRef,
  normalizeTournamentId,
  isLikelyLocalTournamentId,
  localTournamentIdRef,
  saveTournamentMutation,
  clearActiveTournamentCache,
  clearActiveTournamentLockIfMatches,
}) => {
  const calculateStandings = (teamsArg, fixturesArg) => {
    const plugin = getSportPlugin(sportId);
    if (plugin.rankings?.calculateStandings) {
      return plugin.rankings.calculateStandings(teamsArg, fixturesArg, ruleConfig);
    }
    return plugin.scoring.calculatePointsTable(teamsArg, fixturesArg, ruleConfig);
  };
  const applyMatchRatings = (ratings, match) => (
    getSportPlugin(sportId).scoring.updatePlayerRatingsAfterMatch(ratings, match, ruleConfig)
  );
  const validateScores = (score1, score2, extras = {}) => {
    const validator = getSportPlugin(sportId).scoring.validateMatchScore;
    if (typeof validator === 'function') {
      return validator(score1, score2, ruleConfig, extras);
    }
    if (score1 === '' || score2 === '' || score1 === score2) {
      return { valid: false, message: 'Invalid scores' };
    }
    return { valid: true };
  };

  const saveMatchResult = async (matchId, score1, score2, extras = {}) => {
    if (!assertCanOperate()) return false;
    const validation = validateScores(score1, score2, extras);
    if (!validation.valid) {
      showToast(validation.message || 'Invalid scores', 'error');
      return false;
    }
    const resolvedScore1 = validation.score1 ?? score1;
    const resolvedScore2 = validation.score2 ?? score2;
    const resolvedStatistics = validation.statistics ?? extras?.statistics;
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
      score1: parseInt(resolvedScore1, 10),
      score2: parseInt(resolvedScore2, 10),
      completed: true,
      upsetAlert,
      preMatchPrediction: prediction,
      completedAt,
      ...(resolvedStatistics ? { statistics: resolvedStatistics } : {}),
    };

    const ratingsBefore = playerRatings;
    const updatedRatings = applyMatchRatings(playerRatings, completedMatch);
    const updatedFixtures = fixtures.map((m) => (m.id === matchId ? completedMatch : m));
    const changedLeagueMatchPatches = getChangedLeagueMatchPatches({
      previousFixtures: fixtures,
      nextFixtures: updatedFixtures,
    });
    const updatedPointsTable = calculateStandings(teams, updatedFixtures);
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
      sportId,
      ruleConfig,
      aiSummaries: nextSummaries,
      swapHistory,
      status: champion ? 'completed' : 'active',
    };

    setTournamentHistory((prev) => {
      const updatedHistory = upsertTournamentHistory(prev, activeSnapshot);
      if (!isAppwriteEnabled) {
        queueLocalStorageJson(STORAGE_KEYS.HISTORY, updatedHistory);
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
          if (typeof saveTournamentTransactionToAppwrite === 'function') {
            await saveTournamentTransactionToAppwrite({
              tournamentId: syncTournamentId,
              tournamentData: buildCloudSyncPayload({
                teamsSnapshot: teams,
                fixturesSnapshot: updatedFixtures,
                bracketSnapshot: bracket,
                championSnapshot: champion,
                aiSummariesSnapshot: nextSummaries,
                swapHistorySnapshot: swapHistory,
                updatedAt: activeLockSnapshot.updatedAt,
              }),
              ratingsDelta: buildRatingsDeltaPayload(ratingsBefore, updatedRatings),
              activeTournament: activeLockSnapshot,
            });
            setRemoteActiveCache(activeLockSnapshot);
            setActiveTournamentLock?.(activeLockSnapshot);
            if (typeof markRatingsPersisted === 'function') {
              markRatingsPersisted(updatedRatings);
            }
          } else {
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
          }
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
              if (typeof saveTournamentTransactionToAppwrite === 'function') {
                await saveTournamentTransactionToAppwrite({
                  tournamentId: recoveredId,
                  tournamentData: buildCloudSyncPayload({
                    teamsSnapshot: teams,
                    fixturesSnapshot: updatedFixtures,
                    bracketSnapshot: bracket,
                    championSnapshot: champion,
                    aiSummariesSnapshot: nextSummaries,
                    swapHistorySnapshot: swapHistory,
                    updatedAt: recoveredLockSnapshot.updatedAt,
                  }),
                  ratingsDelta: buildRatingsDeltaPayload(ratingsBefore, updatedRatings),
                  activeTournament: recoveredLockSnapshot,
                });
                setRemoteActiveCache(recoveredLockSnapshot);
                setActiveTournamentLock?.(recoveredLockSnapshot);
                if (typeof markRatingsPersisted === 'function') {
                  markRatingsPersisted(updatedRatings);
                }
              } else {
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
              }
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
    trackEvent(ANALYTICS_EVENTS.MATCH_SCORED, {
      sportId,
      tournamentFormat,
      matchId,
      completed: true,
    });
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

  const saveTournamentHistory = async (tournament, options = {}) => {
    const {
      ratingsAfter = null,
      ratingsDelta = null,
    } = options || {};
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
      const completionUpdatedAt = new Date().toISOString();
      let savedId = resolvedCompletionId;
      if (typeof saveTournamentTransactionToAppwrite === 'function') {
        const transactionResult = await saveTournamentTransactionToAppwrite({
          tournamentId: resolvedCompletionId,
          tournamentData: {
            ...normalizedTournament,
            status: 'completed',
            updatedAt: completionUpdatedAt,
            sourceUpdatedAt: completionUpdatedAt,
          },
          ratingsDelta,
          activeTournament: null,
        });
        savedId = normalizeCloudTournamentId(
          transactionResult?.tournament?.appwriteId
          || transactionResult?.tournament?.id
          || resolvedCompletionId
        );
        setRemoteActiveCache(null);
        setActiveTournamentLock?.(null);
        if (ratingsAfter && typeof markRatingsPersisted === 'function') {
          markRatingsPersisted(ratingsAfter || {});
        }
      } else {
        const saved = await saveTournamentMutation.mutateAsync({
          ...normalizedTournament,
          status: 'completed',
          updatedAt: completionUpdatedAt,
          sourceUpdatedAt: completionUpdatedAt,
        });
        savedId = normalizeCloudTournamentId(
          saved?.appwriteId || saved?.id || resolvedCompletionId
        );
      }
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
      if (typeof saveTournamentTransactionToAppwrite !== 'function') {
        await clearActiveTournamentLockIfMatches({
          tournamentId: savedId || normalizedTournament.appwriteId || normalizedTournament.id,
          tournamentName: normalizedTournament.name,
        });
      }
    } else if (isAppwriteEnabled) {
      await clearActiveTournamentLockIfMatches({
        tournamentId: normalizedTournament.appwriteId || normalizedTournament.id,
        tournamentName: normalizedTournament.name,
      });
    } else {
      queueLocalStorageJson(STORAGE_KEYS.HISTORY, updatedHistory);
    }
    return updatedHistory;
  };

  const saveBracketMatchResult = async (matchId, score1, score2) => {
    if (!assertCanOperate()) return false;
    const validation = validateScores(score1, score2);
    if (!validation.valid) {
      showToast(validation.message || 'Invalid scores', 'error');
      return false;
    }
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
      const updatedRatings = applyMatchRatings(playerRatings, match);
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
        await saveTournamentHistory(tournament, {
          ratingsAfter: updatedRatings,
          ratingsDelta: buildRatingsDeltaPayload(ratingsBefore, updatedRatings),
        });
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
          if (typeof saveTournamentTransactionToAppwrite === 'function') {
            await saveTournamentTransactionToAppwrite({
              tournamentId: syncTournamentId,
              tournamentData: buildCloudSyncPayload({
                teamsSnapshot: teams,
                fixturesSnapshot: fixtures,
                bracketSnapshot: updatedBracket,
                championSnapshot: null,
                aiSummariesSnapshot: nextSummaries,
                swapHistorySnapshot: swapHistory,
                updatedAt: activeLockSnapshot.updatedAt,
              }),
              ratingsDelta: buildRatingsDeltaPayload(ratingsBefore, updatedRatings),
              activeTournament: activeLockSnapshot,
            });
            setRemoteActiveCache(activeLockSnapshot);
            setActiveTournamentLock?.(activeLockSnapshot);
            if (typeof markRatingsPersisted === 'function') {
              markRatingsPersisted(updatedRatings);
            }
          } else {
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
          }
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
    const validation = validateScores(score1, score2);
    if (!validation.valid) {
      showToast(validation.message || 'Invalid scores', 'error');
      return false;
    }

    const pointsTable = calculateStandings(teams, fixtures);
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
    const updatedRatings = applyMatchRatings(playerRatings, finalMatch);
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
    await saveTournamentHistory(tournament, {
      ratingsAfter: updatedRatings,
      ratingsDelta: buildRatingsDeltaPayload(ratingsBefore, updatedRatings),
    });
    trackEvent(ANALYTICS_EVENTS.TOURNAMENT_COMPLETED, {
      sportId,
      tournamentFormat,
      champion: winner?.name || null,
    });
    showToast(`🎉 ${winner.name} are the champions!`);
    return true;
  };

  const updateMatchSchedule = (matchId, schedule) => {
    if (!assertCanOperate()) return false;
    const updatedFixtures = fixtures.map((match) => (
      match.id === matchId ? { ...match, schedule: schedule || undefined } : match
    ));
    setFixtures(updatedFixtures);
    persistActiveTournamentSnapshot({ fixturesSnapshot: updatedFixtures });
    showToast('Schedule saved');
    return true;
  };

  return {
    saveMatchResult,
    prioritizeMatch,
    updateMatchSchedule,
    saveBracketMatchResult,
    saveFinalResult,
    saveTournamentHistory,
  };
};
