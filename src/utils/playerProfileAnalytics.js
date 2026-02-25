const asNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const getPlayersFromTeam = (team) => {
  if (!team) return [];
  return [team.player || team.player1, team.player2].filter(Boolean);
};

const inferGameMode = (team1Players, team2Players) => {
  const maxPlayers = Math.max(team1Players.length, team2Players.length);
  return maxPlayers <= 1 ? 'singles' : 'doubles';
};

const gameModeLabel = (mode, source) => {
  if (source === 'casual') {
    return mode === 'singles' ? 'Casual Singles' : 'Casual Doubles';
  }
  if (mode === 'mixed') return 'Mixed Doubles';
  if (mode === 'singles') return 'Singles';
  return 'Doubles';
};

const addResultToMap = (map, key, won) => {
  const safeKey = key || 'Unknown';
  if (!map[safeKey]) {
    map[safeKey] = { name: safeKey, played: 0, wins: 0, losses: 0, winRate: '0.0' };
  }
  map[safeKey].played += 1;
  if (won) map[safeKey].wins += 1;
  else map[safeKey].losses += 1;
};

const finalizeRecordList = (map, sortBy = 'played') => {
  return Object.values(map)
    .map(record => ({
      ...record,
      winRate: record.played > 0 ? ((record.wins / record.played) * 100).toFixed(1) : '0.0',
    }))
    .sort((a, b) => {
      if (sortBy === 'wins' && b.wins !== a.wins) return b.wins - a.wins;
      if (b.played !== a.played) return b.played - a.played;
      return a.name.localeCompare(b.name);
    });
};

const buildTournamentMatchRecords = (tournamentHistory = []) => {
  const records = [];

  tournamentHistory.forEach((tournament) => {
    if (!tournament) return;

    const baseContext = {
      source: 'tournament',
      venue: tournament.venue || tournament.location || tournament.name || 'Tournament Court',
      tournamentFormat: tournament.tournamentFormat || tournament.format || 'league',
      gameMode: tournament.gameMode,
    };

    const pushMatch = (match, phase) => {
      if (!match?.completed || !match.team1 || !match.team2) return;

      const team1Players = getPlayersFromTeam(match.team1);
      const team2Players = getPlayersFromTeam(match.team2);
      if (team1Players.length === 0 || team2Players.length === 0) return;

      const score1 = asNumber(match.score1);
      const score2 = asNumber(match.score2);
      if (score1 === null || score2 === null || score1 === score2) return;

      records.push({
        ...baseContext,
        matchId: match.id,
        date: match.completedAt || tournament.updatedAt || tournament.date || tournament.createdAt || null,
        phase,
        gameMode: baseContext.gameMode || inferGameMode(team1Players, team2Players),
        team1Players,
        team2Players,
        score1,
        score2,
      });
    };

    (tournament.fixtures || []).forEach(match => pushMatch(match, 'league'));
    if (tournament.finalMatch) pushMatch(tournament.finalMatch, 'final');
    (tournament.bracket || []).forEach(round => {
      (round || []).forEach(match => pushMatch(match, 'knockout'));
    });
  });

  return records;
};

const buildCasualMatchRecords = (casualMatches = []) => {
  const records = [];

  casualMatches.forEach((match) => {
    if (!match?.team1 || !match?.team2) return;

    const team1Players = getPlayersFromTeam(match.team1);
    const team2Players = getPlayersFromTeam(match.team2);
    if (team1Players.length === 0 || team2Players.length === 0) return;

    const score1 = asNumber(match.score1);
    const score2 = asNumber(match.score2);
    if (score1 === null || score2 === null || score1 === score2) return;

    const mode = match.matchType || inferGameMode(team1Players, team2Players);

    records.push({
      source: 'casual',
      matchId: match.id || match.appwriteId,
      date: match.date || match.createdAt || null,
      venue: match.venue || match.location || 'Casual Court',
      tournamentFormat: 'casual',
      phase: 'casual',
      gameMode: mode,
      team1Players,
      team2Players,
      score1,
      score2,
    });
  });

  return records;
};

const buildLiveTournamentRecords = (liveTournament) => {
  if (!liveTournament) return [];

  const records = [];
  const baseContext = {
    source: 'live',
    venue: liveTournament.venue || liveTournament.tournamentName || 'Current Tournament',
    tournamentFormat: liveTournament.tournamentFormat || 'league',
    gameMode: liveTournament.gameMode,
  };

  const pushMatch = (match, phase) => {
    if (!match?.completed || !match.team1 || !match.team2) return;

    const team1Players = getPlayersFromTeam(match.team1);
    const team2Players = getPlayersFromTeam(match.team2);
    if (team1Players.length === 0 || team2Players.length === 0) return;

    const score1 = asNumber(match.score1);
    const score2 = asNumber(match.score2);
    if (score1 === null || score2 === null || score1 === score2) return;

    records.push({
      ...baseContext,
      matchId: match.id,
      date: match.completedAt || new Date().toISOString(),
      phase,
      gameMode: baseContext.gameMode || inferGameMode(team1Players, team2Players),
      team1Players,
      team2Players,
      score1,
      score2,
    });
  };

  (liveTournament.fixtures || []).forEach(match => pushMatch(match, 'league'));
  (liveTournament.bracket || []).forEach(round => {
    (round || []).forEach(match => pushMatch(match, 'knockout'));
  });
  if (liveTournament.finalMatch) pushMatch(liveTournament.finalMatch, 'final');

  return records;
};

export const buildPlayerAdvancedProfile = ({
  playerName,
  tournamentHistory = [],
  casualMatches = [],
  liveTournament = null,
}) => {
  if (!playerName) {
    return {
      totalTrackedMatches: 0,
      headToHead: [],
      preferredPartners: [],
      winRateByFormat: [],
      performanceByVenue: [],
    };
  }

  const allMatches = [
    ...buildTournamentMatchRecords(tournamentHistory),
    ...buildCasualMatchRecords(casualMatches),
    ...buildLiveTournamentRecords(liveTournament),
  ];

  const relevantMatches = allMatches.filter(match =>
    match.team1Players.includes(playerName) || match.team2Players.includes(playerName)
  );

  const uniqueMatches = new Map();
  relevantMatches.forEach(match => {
    const uniqueKey = `${match.source}-${match.matchId || ''}-${match.date || ''}-${match.team1Players.join('&')}-${match.team2Players.join('&')}-${match.score1}-${match.score2}`;
    uniqueMatches.set(uniqueKey, match);
  });

  const matches = Array.from(uniqueMatches.values());

  const headToHeadMap = {};
  const partnerMap = {};
  const formatMap = {};
  const venueMap = {};

  matches.forEach((match) => {
    const isTeam1 = match.team1Players.includes(playerName);
    const myTeam = isTeam1 ? match.team1Players : match.team2Players;
    const opponentTeam = isTeam1 ? match.team2Players : match.team1Players;
    const myScore = isTeam1 ? match.score1 : match.score2;
    const opponentScore = isTeam1 ? match.score2 : match.score1;
    const won = myScore > opponentScore;

    opponentTeam.forEach(opponent => {
      addResultToMap(headToHeadMap, opponent, won);
    });

    const partners = myTeam.filter(player => player !== playerName);
    partners.forEach(partner => {
      addResultToMap(partnerMap, partner, won);
    });

    addResultToMap(formatMap, gameModeLabel(match.gameMode, match.source), won);
    addResultToMap(venueMap, match.venue, won);
  });

  return {
    totalTrackedMatches: matches.length,
    headToHead: finalizeRecordList(headToHeadMap, 'wins'),
    preferredPartners: finalizeRecordList(partnerMap, 'wins'),
    winRateByFormat: finalizeRecordList(formatMap),
    performanceByVenue: finalizeRecordList(venueMap),
  };
};
