import {
  calculatePointsTable,
  generateFixtures as createFixtures,
  generateKnockoutBracket,
  updateBracket,
  updatePlayerRatingsAfterMatch,
} from '../utils/calculations';
import { buildPlayerAchievements } from '../utils/playerAchievements';
import { buildAiMatchSummary, detectNewlyUnlockedBadges } from '../utils/matchSummary';
import { getUpsetAlert, predictMatchOutcome } from '../utils/matchPredictions';

export const useTournamentActions = ({
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
}) => {
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

    if (isAppwriteEnabled) {
      await savePlayerDatabaseMutation.mutateAsync(rebuilt);
      await queryClient.invalidateQueries({ queryKey: queryKeys.appwriteData(activeGroup?.id) });
    } else {
      localStorage.setItem('badminton_players', JSON.stringify(rebuilt));
    }
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
    const tournamentKey = tournament.appwriteId || tournament.id;
    const existingIndex = history.findIndex((t) => (t.appwriteId || t.id) === tournamentKey);
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

  const handleStartTournament = (rawNumTeamsInput) => {
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

  const generateFixtures = ({
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
    setLastTournamentConfig({
      name: selectedTournamentName,
      numTeams: selectedTeams.length || numTeams,
      format: selectedFormat,
      teams: selectedTeams,
      gameMode: selectedGameMode,
      tournamentFormat: selectedTournamentFormat,
    });

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

    setTimeout(async () => {
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
          status: 'active',
        };

        const saved = await saveTournamentMutation.mutateAsync(tournamentData);
        if (saved) {
          setCurrentTournamentId(saved.id);
        }
      }

      setStep('tournament');
      setLoading(false);
      if (selectedGameMode !== 'singles' && selectedOddPlayerEnabled && selectedOddPlayerName) {
        showToast(`Tournament generated with rotating odd player: ${selectedOddPlayerName} 🏸`);
        return;
      }
      showToast('Tournament generated! 🏸');
    }, 800);
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
      status: 'scheduled',
      oddPlayerEnabled: selectedOddPlayerEnabled,
      oddPlayerName: selectedOddPlayerName,
    };

    if (isAppwriteEnabled) {
      const saved = await saveTournamentMutation.mutateAsync(payload);
      if (saved) {
        setTournamentHistory((prev) => upsertTournamentHistory(prev, saved));
      }
      await queryClient.invalidateQueries({ queryKey: queryKeys.appwriteData(activeGroup?.id) });
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

  const saveMatchResult = (matchId, score1, score2) => {
    if (!assertCanOperate()) return;
    if (score1 === '' || score2 === '' || score1 === score2) {
      showToast('Invalid scores', 'error');
      return;
    }
    captureUndoSnapshot();

    const match = fixtures.find((m) => m.id === matchId);
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

    if (isAppwriteEnabled && currentTournamentId) {
      syncCurrentTournament({
        fixtures: updatedFixtures,
        bracket,
        champion,
        finalMatch: null,
        aiSummaries: nextSummaries,
      });
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

    captureUndoSnapshot();
    const reordered = [...fixtures];
    [reordered[currentIndex], reordered[targetIndex]] = [reordered[targetIndex], reordered[currentIndex]];
    setFixtures(reordered);
    if (isAppwriteEnabled && currentTournamentId) {
      syncCurrentTournament({
        fixtures: reordered,
        bracket,
        champion,
        finalMatch: null,
        aiSummaries: aiMatchSummaries,
      });
    }
    showToast('Match moved to LIVE NOW');
  };

  const saveTournamentHistory = async (tournament) => {
    const updatedHistory = upsertTournamentHistory(tournamentHistory, tournament);
    setTournamentHistory(updatedHistory);

    if (isAppwriteEnabled && tournament.appwriteId) {
      await saveTournamentMutation.mutateAsync({
        ...tournament,
        status: 'completed',
      });
    } else {
      localStorage.setItem('badminton_history', JSON.stringify(updatedHistory));
    }
    return updatedHistory;
  };

  const saveBracketMatchResult = async (matchId, score1, score2) => {
    if (!assertCanOperate()) return;
    captureUndoSnapshot();
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
        if (isAppwriteEnabled && currentTournamentId) {
          syncCurrentTournament({
            fixtures,
            bracket: updatedBracket,
            champion: null,
            finalMatch: null,
            aiSummaries: nextSummaries,
          });
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
    captureUndoSnapshot();

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
      captureUndoSnapshot();
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
        await saveRatingsMutation.mutateAsync(updatedRatings);
      }

      if (isAppwriteEnabled) {
        const savedMatch = await createCasualMatchMutation.mutateAsync(matchWithWinner);
        setCasualMatches((prev) => [savedMatch, ...prev]);
        await queryClient.invalidateQueries({ queryKey: queryKeys.casualMatches(activeGroup?.id) });
        await queryClient.invalidateQueries({ queryKey: queryKeys.appwriteData(activeGroup?.id) });
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
      captureUndoSnapshot();
      const updatedHistory = tournamentHistory.filter((t) => {
        if (!currentTournamentId) return true;
        return t.id !== currentTournamentId && t.appwriteId !== currentTournamentId;
      });

      if (isAppwriteEnabled && currentTournamentId) {
        await deleteTournamentMutation.mutateAsync(currentTournamentId);
        await queryClient.invalidateQueries({ queryKey: queryKeys.appwriteData(activeGroup?.id) });
      }

      setTournamentHistory(updatedHistory);

      const recalculatedRatings = recalculateEloFromHistory(updatedHistory, casualMatches);
      setPlayerRatings(recalculatedRatings);

      if (isAppwriteEnabled) {
        await saveRatingsMutation.mutateAsync(recalculatedRatings);
      } else {
        localStorage.setItem('badminton_history', JSON.stringify(updatedHistory));
      }

      setStep('setup');
      setTournamentName('');
      setNumTeams(3);
      setTeams([]);
      setFixtures([]);
      setBracket([]);
      setChampion(null);
      setAiMatchSummaries([]);
      setCurrentTournamentId(null);
      await rebuildPlayerDatabase({
        history: updatedHistory,
        casual: casualMatches,
        liveTeams: [],
        liveFixtures: [],
        liveBracket: [],
        liveChampion: null,
      });
      showToast('Tournament deleted. ELO/stats recalculated.');
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
    setCurrentTournamentId(null);

    setTimeout(() => {
      if (tournamentFormat === 'league') {
        const newFixtures = createFixtures(teams, format);
        setFixtures(newFixtures);
      } else {
        const newBracket = generateKnockoutBracket(teams, tournamentFormat);
        setBracket(newBracket);
      }
      showToast('Rematch started! 🏸');
    }, 500);
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
    setCurrentTournamentId(null);
  };

  const handleDeleteTournamentFromSetup = async (id) => {
    if (!assertCanDelete()) return;
    if (!window.confirm('Delete this tournament?')) return;

    captureUndoSnapshot();
    const tournament = tournamentHistory.find((t) => t.id === id);
    if (isAppwriteEnabled && tournament?.appwriteId) {
      await deleteTournamentMutation.mutateAsync(tournament.appwriteId);
    }

    const updatedHistory = tournamentHistory.filter((t) => t.id !== id);
    setTournamentHistory(updatedHistory);
    const recalculatedRatings = recalculateEloFromHistory(updatedHistory, casualMatches);
    setPlayerRatings(recalculatedRatings);

    if (isAppwriteEnabled) {
      await saveRatingsMutation.mutateAsync(recalculatedRatings);
      await queryClient.invalidateQueries({ queryKey: queryKeys.appwriteData(activeGroup?.id) });
    } else {
      localStorage.setItem('badminton_history', JSON.stringify(updatedHistory));
    }

    await rebuildPlayerDatabase({
      history: updatedHistory,
      casual: casualMatches,
    });

    showToast('Tournament deleted - ratings recalculated');
  };

  const handleDeleteCasualMatchFromSetup = async (id) => {
    if (!assertCanDelete()) return;
    if (!window.confirm('Delete this casual match?')) return;

    try {
      captureUndoSnapshot();
      if (isAppwriteEnabled) {
        await deleteCasualMatchMutation.mutateAsync(id);
        await queryClient.invalidateQueries({ queryKey: queryKeys.casualMatches(activeGroup?.id) });
        await queryClient.invalidateQueries({ queryKey: queryKeys.appwriteData(activeGroup?.id) });
      }

      const updatedCasualMatches = casualMatches.filter((match) => (match.id || match.appwriteId) !== id);
      setCasualMatches(updatedCasualMatches);

      if (!isAppwriteEnabled) {
        localStorage.setItem('badminton_casual_matches', JSON.stringify(updatedCasualMatches));
      }

      const recalculatedRatings = recalculateEloFromHistory(tournamentHistory, updatedCasualMatches);
      setPlayerRatings(recalculatedRatings);

      if (isAppwriteEnabled) {
        await saveRatingsMutation.mutateAsync(recalculatedRatings);
      }
      await rebuildPlayerDatabase({
        history: tournamentHistory,
        casual: updatedCasualMatches,
      });

      showToast('Casual match deleted - ratings recalculated');
    } catch (error) {
      console.error('Error deleting casual match:', error);
      showToast('Failed to delete casual match', 'error');
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
    resetTournament,
    rerunTournament,
    goHome,
    handleDeleteTournamentFromSetup,
    handleDeleteCasualMatchFromSetup,
  };
};
