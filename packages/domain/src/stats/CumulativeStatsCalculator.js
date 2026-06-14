import { buildCasualMatchDetail } from '../sports/boxCricket/casualMatchDetail.js';
import { listSquadPlayerNames, normalizeSquad } from '../sports/boxCricket/squadUtils.js';
import { isBoxCricketCasualMatch } from '../sports/casualMatchSport.js';

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

const isCompletedRecord = (match) => (
  match?.completed === true
  || Boolean(match?.completedAt)
  || match?.completed === 'true'
  || Boolean(match?.winner)
  || match?.statistics?.series?.winnerTeamId != null
);

const getTeamPlayers = (team, match = null) => {
  if (match?.sportId === 'boxCricket' || team?.squad?.length) {
    const squadNames = listSquadPlayerNames(team);
    if (squadNames.length > 0) return squadNames;
  }
  return [team?.player || team?.player1, team?.player2].filter(Boolean);
};

const resolveBoxCricketWinnerTeamId = (match) => {
  const seriesWinner = match?.statistics?.series?.winnerTeamId;
  if (seriesWinner != null) return seriesWinner;
  if (match?.winner === 'team1') return match?.team1?.id;
  if (match?.winner === 'team2') return match?.team2?.id;
  const score1 = Number(match?.score1);
  const score2 = Number(match?.score2);
  if (!Number.isFinite(score1) || !Number.isFinite(score2) || score1 === score2) return null;
  return score1 > score2 ? match?.team1?.id : match?.team2?.id;
};

const buildPlayerNameLookup = (match = {}) => {
  const byId = new Map();
  const byName = new Map();
  const appendTeam = (team) => {
    normalizeSquad(team?.squad).forEach((player) => {
      byId.set(String(player.id), player.name);
      byName.set(String(player.name).trim().toLowerCase(), player.name);
    });
  };
  appendTeam(match.team1);
  appendTeam(match.team2);
  appendTeam(match.statistics?.teams?.team1);
  appendTeam(match.statistics?.teams?.team2);
  return { byId, byName };
};

const resolveStatPlayerName = (match, row = {}) => {
  const { byId, byName } = buildPlayerNameLookup(match);
  if (row.name && row.name !== String(row.id)) {
    return byName.get(String(row.name).trim().toLowerCase()) || row.name;
  }
  const idKey = String(row.id || row.name || '');
  return byId.get(idKey)
    || byName.get(idKey.trim().toLowerCase())
    || row.name
    || idKey;
};

const isExtraBall = (kind) => kind === 'wide' || kind === 'noBall';

const listBoxCricketGameStatistics = (match = {}) => {
  const series = match.statistics?.series;
  if (series?.games?.length) {
    return series.games.map((game) => game.statistics).filter(Boolean);
  }
  if (match.statistics?.innings?.length) return [match.statistics];
  return [];
};

const addBoxCricketStatsFromBallLogs = (match, ensurePlayer) => {
  listBoxCricketGameStatistics(match).forEach((gameStats) => {
    const scoringMode = gameStats.scoringMode
      || (gameStats.innings?.some((innings) => innings.ballLog?.length) ? 'ballByBall' : 'summary');
    if (scoringMode !== 'ballByBall') return;

    (gameStats.innings || []).forEach((innings) => {
      (innings.ballLog || []).forEach((ball) => {
        const runs = Number(ball.runs) || 0;
        const strikerId = String(ball.strikerId || '');
        const bowlerId = String(ball.bowlerId || '');

        if (strikerId && ball.kind === 'runs') {
          const entry = ensurePlayer(resolveStatPlayerName(match, { id: strikerId, name: strikerId }));
          if (!entry) return;
          entry.cricketRuns += runs;
          if (!isExtraBall(ball.kind)) entry.cricketBalls += 1;
          if (runs === 4) entry.cricketFours += 1;
          if (runs === 6) entry.cricketSixes += 1;
        } else if (strikerId && ball.kind === 'wicket' && !isExtraBall(ball.kind)) {
          const entry = ensurePlayer(resolveStatPlayerName(match, { id: strikerId, name: strikerId }));
          if (entry) entry.cricketBalls += 1;
        }

        if (bowlerId) {
          const entry = ensurePlayer(resolveStatPlayerName(match, { id: bowlerId, name: bowlerId }));
          if (!entry) return;
          entry.cricketRunsConceded += runs;
          if (ball.kind === 'wicket') entry.cricketWickets += 1;
        }
      });
    });
  });
};

const buildBoxCricketCanonicalNameMap = (casualMatches = []) => {
  const canonical = new Map();
  casualMatches
    .filter(isBoxCricketCasualMatch)
    .forEach((match) => {
      [
        match.team1,
        match.team2,
        match.statistics?.teams?.team1,
        match.statistics?.teams?.team2,
      ].forEach((team) => {
        normalizeSquad(team?.squad).forEach((player) => {
          const name = String(player.name || '').trim();
          if (!name) return;
          canonical.set(String(player.id), name);
          canonical.set(name.toLowerCase(), name);
        });
      });
    });
  return canonical;
};

const mergeDuplicatePlayerStats = (statsArray = [], canonicalMap = new Map()) => {
  if (canonicalMap.size === 0) return statsArray;

  const merged = new Map();
  statsArray.forEach((entry) => {
    const rawName = String(entry.name || '').trim();
    const canonicalName = canonicalMap.get(rawName)
      || canonicalMap.get(rawName.toLowerCase())
      || rawName;
    const existing = merged.get(canonicalName);

    if (!existing) {
      merged.set(canonicalName, { ...entry, name: canonicalName });
      return;
    }

    existing.matchesPlayed += entry.matchesPlayed;
    existing.matchesWon += entry.matchesWon;
    existing.totalScored += entry.totalScored;
    existing.totalConceded += entry.totalConceded;
    existing.championships += entry.championships;
    existing.cricketRuns += entry.cricketRuns;
    existing.cricketBalls += entry.cricketBalls;
    existing.cricketFours += entry.cricketFours;
    existing.cricketSixes += entry.cricketSixes;
    existing.cricketWickets += entry.cricketWickets;
    existing.cricketRunsConceded += entry.cricketRunsConceded;
    existing.tournamentsPlayed = Math.max(existing.tournamentsPlayed, entry.tournamentsPlayed);
  });

  return [...merged.values()];
};

/** Canonical all-time rule: include every completed tournament match plus every completed casual match. */
export const calculateCumulativePlayerStats = (historyOrOptions = [], maybeCasualMatches = []) => {
  const {
    tournamentHistory,
    casualMatches,
  } = normalizeAnalyticsStatsInput(historyOrOptions, maybeCasualMatches);
  const cumulativeStats = {};
  const normalizeCompletedMatch = (match) => {
    if (!match?.team1 || !match?.team2 || !isCompletedRecord(match)) return null;
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
        cricketRuns: 0,
        cricketBalls: 0,
        cricketFours: 0,
        cricketSixes: 0,
        cricketWickets: 0,
        cricketRunsConceded: 0,
      };
    }
    return cumulativeStats[player];
  };
  const addMatchToStats = (match, tournamentKey) => {
    const team1Won = match.score1 > match.score2;
    const team1Players = getTeamPlayers(match.team1, match);
    const team2Players = getTeamPlayers(match.team2, match);

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

  const addBoxCricketCasualMatchToStats = (match) => {
    if (!match?.team1 || !match?.team2 || !isCompletedRecord(match)) return;
    const winnerTeamId = resolveBoxCricketWinnerTeamId(match);
    if (winnerTeamId == null) return;

    const team1Players = getTeamPlayers(match.team1, match);
    const team2Players = getTeamPlayers(match.team2, match);
    const team1Won = String(winnerTeamId) === String(match.team1?.id);

    team1Players.forEach((player) => {
      const entry = ensurePlayer(player);
      if (!entry) return;
      entry.matchesPlayed += 1;
      if (team1Won) entry.matchesWon += 1;
    });

    team2Players.forEach((player) => {
      const entry = ensurePlayer(player);
      if (!entry) return;
      entry.matchesPlayed += 1;
      if (!team1Won) entry.matchesWon += 1;
    });

    const detail = buildCasualMatchDetail(match);
    const hasDetailBatting = (detail?.playerStats?.batters || []).length > 0;

    if (hasDetailBatting) {
      detail.playerStats.batters.forEach((row) => {
        const entry = ensurePlayer(resolveStatPlayerName(match, row));
        if (!entry) return;
        entry.cricketRuns += Number(row.runs) || 0;
        entry.cricketBalls += Number(row.balls) || 0;
        entry.cricketFours += Number(row.fours) || 0;
        entry.cricketSixes += Number(row.sixes) || 0;
      });

      detail.playerStats.bowlers.forEach((row) => {
        const entry = ensurePlayer(resolveStatPlayerName(match, row));
        if (!entry) return;
        entry.cricketWickets += Number(row.wickets) || 0;
        entry.cricketRunsConceded += Number(row.runs) || 0;
      });
    } else {
      addBoxCricketStatsFromBallLogs(match, ensurePlayer);
    }
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
      const championPlayers = getTeamPlayers(tournament.champion, tournament);
      championPlayers.forEach((player) => {
        const entry = ensurePlayer(player);
        if (entry) entry.championships += 1;
      });
    }
  });

  (Array.isArray(casualMatches) ? casualMatches : []).forEach((match) => {
    if (isBoxCricketCasualMatch(match)) {
      addBoxCricketCasualMatchToStats(match);
      return;
    }
    const normalized = normalizeCompletedMatch(match);
    if (normalized) addMatchToStats(normalized, null);
  });

  const canonicalMap = buildBoxCricketCanonicalNameMap(casualMatches);
  const statsArray = mergeDuplicatePlayerStats(
    Object.values(cumulativeStats).map((player) => ({
    ...player,
    tournamentsPlayed: player.tournamentsPlayed.size,
    winPercentage: player.matchesPlayed > 0
      ? ((player.matchesWon / player.matchesPlayed) * 100).toFixed(1)
      : 0,
    avgScorePerMatch: player.matchesPlayed > 0
      ? (player.totalScored / player.matchesPlayed).toFixed(1)
      : 0,
    scoreDiff: player.totalScored - player.totalConceded,
    cricketAverage: player.cricketBalls > 0
      ? (player.cricketRuns / player.cricketBalls * 100).toFixed(1)
      : '0.0',
    })),
    canonicalMap,
  );

  return statsArray.sort((a, b) => {
    if (b.cricketRuns !== a.cricketRuns && (b.cricketRuns > 0 || a.cricketRuns > 0)) {
      return b.cricketRuns - a.cricketRuns;
    }
    if (b.championships !== a.championships) return b.championships - a.championships;
    if (b.matchesWon !== a.matchesWon) return b.matchesWon - a.matchesWon;
    const winRateDelta = Number(b.winPercentage || 0) - Number(a.winPercentage || 0);
    if (winRateDelta !== 0) return winRateDelta;
    if (b.matchesPlayed !== a.matchesPlayed) return b.matchesPlayed - a.matchesPlayed;
    return String(a.name || '').localeCompare(String(b.name || ''));
  });
};
