const normalizeAnalyticsStatsInput = (historyOrOptions = [], maybeCasualMatches = []) => {
  if (Array.isArray(historyOrOptions)) {
    return {
      tournamentHistory: historyOrOptions,
      casualMatches: Array.isArray(maybeCasualMatches) ? maybeCasualMatches : [],
    };
  }

  if (historyOrOptions && typeof historyOrOptions === 'object') {
    return {
      tournamentHistory: Array.isArray(historyOrOptions.tournamentHistory)
        ? historyOrOptions.tournamentHistory
        : [],
      casualMatches: Array.isArray(historyOrOptions.casualMatches)
        ? historyOrOptions.casualMatches
        : [],
    };
  }

  return {
    tournamentHistory: [],
    casualMatches: Array.isArray(maybeCasualMatches) ? maybeCasualMatches : [],
  };
};

/** Canonical all-time rule: include every completed tournament match plus every completed casual match. */
export const calculateCumulativePlayerStats = (historyOrOptions = [], maybeCasualMatches = []) => {
  const {
    tournamentHistory,
    casualMatches,
  } = normalizeAnalyticsStatsInput(historyOrOptions, maybeCasualMatches);
  const cumulativeStats = {};
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
  const getTeamPlayers = (team) => (
    [team?.player || team?.player1, team?.player2].filter(Boolean)
  );
  const ensurePlayer = (player) => {
    if (!player) return null;
    if (!cumulativeStats[player]) {
      cumulativeStats[player] = {
        name: player,
        tournamentsPlayed: new Set(),
        matchesPlayed: 0,
        matchesWon: 0,
        totalScored: 0,
        totalConceded: 0,
        championships: 0,
      };
    }
    return cumulativeStats[player];
  };
  const addMatchToStats = (match, tournamentKey) => {
    const team1Won = match.score1 > match.score2;
    const team1Players = getTeamPlayers(match.team1);
    const team2Players = getTeamPlayers(match.team2);

    team1Players.forEach((player) => {
      const entry = ensurePlayer(player);
      if (!entry) return;
      if (tournamentKey) entry.tournamentsPlayed.add(tournamentKey);
      entry.matchesPlayed += 1;
      entry.totalScored += match.score1;
      entry.totalConceded += match.score2;
      if (team1Won) entry.matchesWon += 1;
    });

    team2Players.forEach((player) => {
      const entry = ensurePlayer(player);
      if (!entry) return;
      if (tournamentKey) entry.tournamentsPlayed.add(tournamentKey);
      entry.matchesPlayed += 1;
      entry.totalScored += match.score2;
      entry.totalConceded += match.score1;
      if (!team1Won) entry.matchesWon += 1;
    });
  };

  (Array.isArray(tournamentHistory) ? tournamentHistory : []).forEach((tournament) => {
    const tournamentKey = String(
      tournament?.id
      || tournament?.immutableTournamentId
      || tournament?.appwriteId
      || tournament?.legacyTournamentId
      || (tournament?.name && tournament?.date ? `${tournament.name}-${tournament.date}` : tournament?.name || '')
    ).trim();

    (Array.isArray(tournament?.fixtures) ? tournament.fixtures : [])
      .map(normalizeCompletedMatch)
      .filter(Boolean)
      .forEach((match) => addMatchToStats(match, tournamentKey));

    (Array.isArray(tournament?.bracket) ? tournament.bracket : [])
      .flatMap((round) => (Array.isArray(round) ? round : []))
      .map(normalizeCompletedMatch)
      .filter(Boolean)
      .forEach((match) => addMatchToStats(match, tournamentKey));

    const finalMatch = normalizeCompletedMatch(tournament?.finalMatch);
    if (finalMatch) {
      addMatchToStats(finalMatch, tournamentKey);
    }

    if (tournament.champion) {
      const championPlayers = getTeamPlayers(tournament.champion);
      championPlayers.forEach((player) => {
        const entry = ensurePlayer(player);
        if (entry) entry.championships += 1;
      });
    }
  });

  (Array.isArray(casualMatches) ? casualMatches : [])
    .map(normalizeCompletedMatch)
    .filter(Boolean)
    .forEach((match) => addMatchToStats(match, null));

  const statsArray = Object.values(cumulativeStats).map(player => ({
    ...player,
    tournamentsPlayed: player.tournamentsPlayed.size,
    winPercentage: player.matchesPlayed > 0
      ? ((player.matchesWon / player.matchesPlayed) * 100).toFixed(1)
      : 0,
    avgScorePerMatch: player.matchesPlayed > 0
      ? (player.totalScored / player.matchesPlayed).toFixed(1)
      : 0,
    scoreDiff: player.totalScored - player.totalConceded,
  }));

  return statsArray.sort((a, b) => {
    if (b.championships !== a.championships) return b.championships - a.championships;
    if (b.matchesWon !== a.matchesWon) return b.matchesWon - a.matchesWon;
    const winRateDelta = Number(b.winPercentage || 0) - Number(a.winPercentage || 0);
    if (winRateDelta !== 0) return winRateDelta;
    if (b.matchesPlayed !== a.matchesPlayed) return b.matchesPlayed - a.matchesPlayed;
    return String(a.name || '').localeCompare(String(b.name || ''));
  });
};
