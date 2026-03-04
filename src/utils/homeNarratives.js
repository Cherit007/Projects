import { predictMatchOutcome } from './matchPredictions';

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toText = (value) => String(value || '').trim();

const parseDateLike = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (!value) return null;
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : null;
};

const getTeamPlayers = (team) => {
  const primary = toText(team?.player || team?.player1);
  const secondary = toText(team?.player2);
  return [primary, secondary].filter(Boolean);
};

const getTeamLabel = (team) => {
  const explicitName = toText(team?.name);
  if (explicitName) return explicitName;
  const players = getTeamPlayers(team);
  if (players.length === 0) return 'Unknown Team';
  return players.join(' & ');
};

const isCompletedMatch = (match) => {
  const score1 = toNumber(match?.score1, Number.NaN);
  const score2 = toNumber(match?.score2, Number.NaN);
  return Boolean(
    match
    && match.team1
    && match.team2
    && match.completed
    && Number.isFinite(score1)
    && Number.isFinite(score2)
    && score1 !== score2
  );
};

const buildMatchRecord = ({
  match,
  timestamp,
  source = 'tournament',
  index = 0,
  tournamentName = '',
}) => {
  if (!isCompletedMatch(match)) return null;
  return {
    source,
    index,
    timestamp: Number.isFinite(timestamp) ? timestamp : Date.now(),
    tournamentName: toText(tournamentName),
    team1: match.team1,
    team2: match.team2,
    team1Label: getTeamLabel(match.team1),
    team2Label: getTeamLabel(match.team2),
    team1Players: getTeamPlayers(match.team1),
    team2Players: getTeamPlayers(match.team2),
    score1: toNumber(match.score1, 0),
    score2: toNumber(match.score2, 0),
  };
};

const collectHistoryMatches = (tournamentHistory = []) => {
  const rows = [];
  let index = 0;
  (Array.isArray(tournamentHistory) ? tournamentHistory : []).forEach((tournament) => {
    const tournamentName = toText(tournament?.name);
    const tournamentTs = (
      parseDateLike(tournament?.updatedAt)
      || parseDateLike(tournament?.date)
      || Date.now()
    );
    const pushRow = (match, source, sourceIndex) => {
      const row = buildMatchRecord({
        match,
        timestamp: parseDateLike(match?.updatedAt) || parseDateLike(match?.date) || (tournamentTs + sourceIndex),
        source,
        index: index += 1,
        tournamentName,
      });
      if (row) rows.push(row);
    };

    (Array.isArray(tournament?.fixtures) ? tournament.fixtures : []).forEach((match, fixtureIndex) => {
      pushRow(match, 'fixture', fixtureIndex);
    });
    (Array.isArray(tournament?.bracket) ? tournament.bracket : [])
      .flatMap((round) => (Array.isArray(round) ? round : []))
      .forEach((match, bracketIndex) => {
        pushRow(match, 'bracket', bracketIndex + 2000);
      });
    if (tournament?.finalMatch) {
      pushRow(tournament.finalMatch, 'final', 5000);
    }
  });
  return rows;
};

const collectCasualMatches = (casualMatches = []) => {
  const rows = [];
  (Array.isArray(casualMatches) ? casualMatches : []).forEach((match, index) => {
    const row = buildMatchRecord({
      match: { ...match, completed: true },
      timestamp: parseDateLike(match?.date) || parseDateLike(match?.createdAt) || (Date.now() + index),
      source: 'casual',
      index,
    });
    if (row) rows.push(row);
  });
  return rows;
};

const sortByTime = (matches = []) => (
  [...matches].sort((a, b) => {
    if (a.timestamp !== b.timestamp) return a.timestamp - b.timestamp;
    return a.index - b.index;
  })
);

const buildStreakLeaders = (matches = []) => {
  const perPlayer = new Map();

  matches.forEach((match) => {
    const team1Won = match.score1 > match.score2;
    const winners = team1Won ? match.team1Players : match.team2Players;
    const losers = team1Won ? match.team2Players : match.team1Players;

    winners.forEach((playerName) => {
      const previous = perPlayer.get(playerName) || { type: 'none', count: 0 };
      const next = previous.type === 'win'
        ? { type: 'win', count: previous.count + 1 }
        : { type: 'win', count: 1 };
      perPlayer.set(playerName, next);
    });

    losers.forEach((playerName) => {
      const previous = perPlayer.get(playerName) || { type: 'none', count: 0 };
      const next = previous.type === 'loss'
        ? { type: 'loss', count: previous.count + 1 }
        : { type: 'loss', count: 1 };
      perPlayer.set(playerName, next);
    });
  });

  return [...perPlayer.entries()]
    .map(([name, meta]) => ({
      name,
      type: meta.type,
      count: meta.count,
    }))
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      if (a.type !== b.type) return a.type === 'win' ? -1 : 1;
      return a.name.localeCompare(b.name);
    })
    .slice(0, 3);
};

const buildRivalries = (matches = []) => {
  const map = new Map();
  matches.forEach((match) => {
    const labels = [match.team1Label, match.team2Label].sort((a, b) => a.localeCompare(b));
    if (labels.length !== 2) return;
    const key = `${labels[0]}::${labels[1]}`;
    const previous = map.get(key) || {
      teamA: labels[0],
      teamB: labels[1],
      games: 0,
      lastPlayedAt: 0,
    };
    map.set(key, {
      ...previous,
      games: previous.games + 1,
      lastPlayedAt: Math.max(previous.lastPlayedAt, match.timestamp || 0),
    });
  });

  return [...map.values()]
    .filter((entry) => entry.games >= 2)
    .sort((a, b) => {
      if (b.games !== a.games) return b.games - a.games;
      return b.lastPlayedAt - a.lastPlayedAt;
    })
    .slice(0, 3);
};

const buildFormWatch = (eloLeaderboard = []) => (
  (Array.isArray(eloLeaderboard) ? eloLeaderboard : [])
    .slice(0, 6)
    .map((player) => {
      const history = Array.isArray(player?.history) ? player.history : [];
      const recentChanges = history.slice(-4).map((item) => toNumber(item?.change, 0));
      const lastDelta = recentChanges.length > 0 ? recentChanges[recentChanges.length - 1] : 0;
      const trendScore = recentChanges.reduce((sum, value) => sum + value, 0);
      const tone = trendScore > 0 ? 'up' : trendScore < 0 ? 'down' : 'neutral';
      return {
        name: toText(player?.name) || 'Unknown Player',
        rating: toNumber(player?.rating, 1000),
        delta: lastDelta,
        trendScore,
        tone,
      };
    })
    .sort((a, b) => Math.abs(b.trendScore) - Math.abs(a.trendScore))
    .slice(0, 4)
);

const getUpcomingMatches = (activeLiveTournaments = []) => {
  const rows = [];
  (Array.isArray(activeLiveTournaments) ? activeLiveTournaments : []).forEach((tournament) => {
    const tournamentName = toText(tournament?.name) || 'Live Tournament';
    (Array.isArray(tournament?.fixtures) ? tournament.fixtures : [])
      .filter((match) => match && !match.completed && match.team1 && match.team2)
      .slice(0, 8)
      .forEach((match) => {
        rows.push({
          tournamentName,
          match,
        });
      });
  });
  return rows;
};

const buildUpsetWatch = ({
  activeLiveTournaments = [],
  playerRatings = {},
  tournamentHistory = [],
  casualMatches = [],
}) => {
  const candidates = getUpcomingMatches(activeLiveTournaments)
    .map(({ tournamentName, match }) => {
      const prediction = predictMatchOutcome({
        match,
        playerRatings,
        tournamentHistory,
        casualMatches,
      });
      const p1 = toNumber(prediction?.team1Probability, 0.5);
      const p2 = toNumber(prediction?.team2Probability, 0.5);
      const underdogProbability = Math.min(p1, p2);
      const favorite = p1 >= p2 ? getTeamLabel(match.team1) : getTeamLabel(match.team2);
      const underdog = p1 < p2 ? getTeamLabel(match.team1) : getTeamLabel(match.team2);
      return {
        tournamentName,
        matchup: `${getTeamLabel(match.team1)} vs ${getTeamLabel(match.team2)}`,
        favorite,
        underdog,
        underdogProbability,
      };
    })
    .filter((row) => row.underdogProbability <= 0.45)
    .sort((a, b) => a.underdogProbability - b.underdogProbability)
    .slice(0, 3);

  return candidates;
};

export const buildHomeNarratives = ({
  tournamentHistory = [],
  casualMatches = [],
  eloLeaderboard = [],
  playerRatings = {},
  activeLiveTournaments = [],
}) => {
  const matches = sortByTime([
    ...collectHistoryMatches(tournamentHistory),
    ...collectCasualMatches(casualMatches),
  ]);

  return {
    streakLeaders: buildStreakLeaders(matches),
    rivalries: buildRivalries(matches),
    formWatch: buildFormWatch(eloLeaderboard),
    upsetWatch: buildUpsetWatch({
      activeLiveTournaments,
      playerRatings,
      tournamentHistory,
      casualMatches,
    }),
  };
};

