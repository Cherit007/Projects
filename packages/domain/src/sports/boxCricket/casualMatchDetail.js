import { resolveBoxCricketRules } from './boxCricketScoring.js';
import { buildInningsScorecard, buildMatchHighlights } from './scorecard.js';
import { normalizeSquad } from './squadUtils.js';

const isExtra = (kind) => kind === 'wide' || kind === 'noBall';

const squadFromBallLog = (ballLog = []) => {
  const map = new Map();
  ballLog.forEach((ball) => {
    [ball.strikerId, ball.nonStrikerId, ball.dismissedPlayerId, ball.bowlerId].forEach((id) => {
      if (!id) return;
      const key = String(id);
      if (!map.has(key)) map.set(key, { id: key, name: key });
    });
  });
  return Array.from(map.values());
};

const mergeSquads = (primary = [], fallback = []) => {
  const byId = new Map(fallback.map((player) => [String(player.id), player]));
  const byName = new Map(
    fallback
      .filter((player) => player.name)
      .map((player) => [String(player.name).trim().toLowerCase(), player]),
  );

  return primary.map((player) => {
    if (player.name && player.name !== String(player.id)) return player;
    const key = String(player.id);
    const named = byId.get(key) || byName.get(String(player.name || key).trim().toLowerCase());
    return named?.name ? { ...player, name: named.name } : player;
  });
};

export const buildInningsStateFromStoredBallLog = (inningsEntry = {}, rules = {}) => {
  const balls = Array.isArray(inningsEntry.ballLog) ? inningsEntry.ballLog : [];
  const legalBalls = balls.filter((ball) => !isExtra(ball.kind)).length;
  const runs = balls.reduce((sum, ball) => sum + (Number(ball.runs) || 0), 0);
  const wickets = balls.filter((ball) => ball.kind === 'wicket').length;
  const dismissedIds = balls
    .filter((ball) => ball.kind === 'wicket' && ball.dismissedPlayerId)
    .map((ball) => String(ball.dismissedPlayerId));

  return {
    balls,
    runs: Number.isFinite(Number(inningsEntry.runs)) ? Number(inningsEntry.runs) : runs,
    wickets: Number.isFinite(Number(inningsEntry.wickets)) ? Number(inningsEntry.wickets) : wickets,
    legalBalls,
    oversLimit: rules.oversLimit,
    maxWickets: rules.maxWickets,
    dismissedIds,
    strikerId: null,
    nonStrikerId: null,
    chaseTarget: Number(inningsEntry.chaseTarget) || 0,
    chaseComplete: Boolean(inningsEntry.chaseComplete),
  };
};

export const resolveTeamsForStoredMatch = (match = {}, statistics = null) => {
  const stats = statistics || match.statistics;
  if (stats?.teams?.team1 && stats?.teams?.team2) {
    return {
      team1: {
        id: stats.teams.team1.id ?? 1,
        name: stats.teams.team1.name || match.team1?.name || 'Team 1',
        squad: normalizeSquad(stats.teams.team1.squad),
      },
      team2: {
        id: stats.teams.team2.id ?? 2,
        name: stats.teams.team2.name || match.team2?.name || 'Team 2',
        squad: normalizeSquad(stats.teams.team2.squad),
      },
    };
  }

  const team1 = {
    id: match.team1?.id ?? 1,
    name: match.team1?.name || 'Team 1',
    squad: normalizeSquad(match.team1?.squad),
  };
  const team2 = {
    id: match.team2?.id ?? 2,
    name: match.team2?.name || 'Team 2',
    squad: normalizeSquad(match.team2?.squad),
  };
  return { team1, team2 };
};

const resolveTeamById = (teamId, team1, team2) => (
  String(teamId) === String(team2.id) ? team2 : team1
);

const mergeTeamContext = (stored = {}, fallback = {}, { defaultName = 'Team 1', defaultId = 1 } = {}) => {
  const storedSquad = normalizeSquad(stored.squad);
  const fallbackSquad = normalizeSquad(fallback?.squad);
  return {
    id: stored.id ?? fallback?.id ?? defaultId,
    name: stored.name || fallback?.name || defaultName,
    squad: storedSquad.length > 0 ? storedSquad : fallbackSquad,
  };
};

const resolveSquadForSide = (team, ballLog = []) => {
  const squad = normalizeSquad(team?.squad);
  if (squad.length > 0) return squad;
  return squadFromBallLog(ballLog);
};

export const buildStoredGameDetail = ({
  gameStatistics,
  team1,
  team2,
  gameNo = 1,
  score1 = null,
  score2 = null,
}) => {
  if (!gameStatistics?.innings?.length) return null;

  const rules = resolveBoxCricketRules({
    oversLimit: gameStatistics.oversLimit,
    ballType: gameStatistics.ballType,
    ...gameStatistics.specialRules,
  });

  const storedTeams = resolveTeamsForStoredMatch({ team1, team2 }, gameStatistics);
  const resolvedTeam1 = mergeTeamContext(storedTeams.team1, team1, { defaultName: 'Team 1', defaultId: 1 });
  const resolvedTeam2 = mergeTeamContext(storedTeams.team2, team2, { defaultName: 'Team 2', defaultId: 2 });

  const [innings1Entry, innings2Entry] = gameStatistics.innings;
  const firstBattingTeam = resolveTeamById(innings1Entry.battingTeamId, resolvedTeam1, resolvedTeam2);
  const firstBowlingTeam = resolveTeamById(innings1Entry.bowlingTeamId, resolvedTeam1, resolvedTeam2);
  const secondBattingTeam = resolveTeamById(innings2Entry.battingTeamId, resolvedTeam1, resolvedTeam2);
  const secondBowlingTeam = resolveTeamById(innings2Entry.bowlingTeamId, resolvedTeam1, resolvedTeam2);

  const scoringMode = gameStatistics.scoringMode
    || (innings1Entry.ballLog?.length || innings2Entry.ballLog?.length ? 'ballByBall' : 'summary');

  const innings1State = buildInningsStateFromStoredBallLog(innings1Entry, rules);
  const innings2State = buildInningsStateFromStoredBallLog(innings2Entry, rules);

  const inn1Batters = mergeSquads(
    resolveSquadForSide(firstBattingTeam, innings1Entry.ballLog),
    squadFromBallLog(innings1Entry.ballLog),
  );
  const inn1Bowlers = mergeSquads(
    resolveSquadForSide(firstBowlingTeam, innings1Entry.ballLog),
    squadFromBallLog(innings1Entry.ballLog),
  );
  const inn2Batters = mergeSquads(
    resolveSquadForSide(secondBattingTeam, innings2Entry.ballLog),
    squadFromBallLog(innings2Entry.ballLog),
  );
  const inn2Bowlers = mergeSquads(
    resolveSquadForSide(secondBowlingTeam, innings2Entry.ballLog),
    squadFromBallLog(innings2Entry.ballLog),
  );

  const scorecard1 = buildInningsScorecard(innings1State, inn1Batters, inn1Bowlers);
  const scorecard2 = buildInningsScorecard(innings2State, inn2Batters, inn2Bowlers);

  const highlights = scoringMode === 'ballByBall'
    ? buildMatchHighlights({
      innings1State,
      innings2State,
      firstBattingTeam,
      secondBattingTeam,
      firstBowlingTeam,
      secondBowlingTeam,
    })
    : {
      winnerTeam: resolveTeamById(gameStatistics.result?.winnerTeamId, resolvedTeam1, resolvedTeam2),
      summary: gameStatistics.result?.marginType === 'tie'
        ? 'Match tied'
        : `${resolveTeamById(gameStatistics.result?.winnerTeamId, resolvedTeam1, resolvedTeam2)?.name || 'Winner'} won`,
      chaseWon: false,
      scorecard1,
      scorecard2,
      firstBattingTeam,
      secondBattingTeam,
      topBatter: null,
      topBowler: null,
    };

  const team1Runs = String(resolvedTeam1.id) === String(innings1Entry.battingTeamId)
    ? innings1State.runs
    : innings2State.runs;
  const team2Runs = String(resolvedTeam2.id) === String(innings1Entry.battingTeamId)
    ? innings1State.runs
    : innings2State.runs;

  return {
    gameNo,
    scoringMode,
    score1: score1 ?? team1Runs,
    score2: score2 ?? team2Runs,
    highlights,
    scorecard1,
    scorecard2,
    firstBattingTeam,
    secondBattingTeam,
    innings1Summary: {
      runs: innings1Entry.runs,
      wickets: innings1Entry.wickets,
      overs: innings1Entry.overs,
    },
    innings2Summary: {
      runs: innings2Entry.runs,
      wickets: innings2Entry.wickets,
      overs: innings2Entry.overs,
    },
  };
};

const aggregatePlayerStats = (games = []) => {
  const batters = new Map();
  const bowlers = new Map();

  games.forEach((game) => {
    if (game.scoringMode !== 'ballByBall') return;
    [...(game.scorecard1?.batting || []), ...(game.scorecard2?.batting || [])].forEach((row) => {
      const key = String(row.id || row.name);
      const existing = batters.get(key) || {
        id: row.id,
        name: row.name,
        runs: 0,
        balls: 0,
        fours: 0,
        sixes: 0,
        innings: 0,
      };
      existing.runs += row.runs;
      existing.balls += row.balls;
      existing.fours += row.fours;
      existing.sixes += row.sixes;
      if (row.balls > 0 || row.status === 'out') existing.innings += 1;
      batters.set(key, existing);
    });

    [...(game.scorecard1?.bowling || []), ...(game.scorecard2?.bowling || [])].forEach((row) => {
      const key = String(row.id || row.name);
      const existing = bowlers.get(key) || {
        id: row.id,
        name: row.name,
        legalBalls: 0,
        runs: 0,
        wickets: 0,
      };
      existing.legalBalls += row.legalBalls ?? 0;
      existing.runs += row.runs;
      existing.wickets += row.wickets;
      existing.overs = `${Math.floor(existing.legalBalls / 6)}.${existing.legalBalls % 6}`;
      bowlers.set(key, existing);
    });
  });

  return {
    batters: [...batters.values()].sort((left, right) => right.runs - left.runs),
    bowlers: [...bowlers.values()].sort((left, right) => (
      right.wickets - left.wickets || left.runs - right.runs
    )),
  };
};

export const buildCasualMatchDetail = (match = {}) => {
  const statistics = match.statistics;
  const isBoxCricketStats = statistics?.sportId === 'boxCricket'
    || statistics?.format === 'casualSeries'
    || Boolean(statistics?.series?.games?.length);
  if (!statistics || !isBoxCricketStats) return null;

  const { team1, team2 } = resolveTeamsForStoredMatch(match, statistics);
  const series = statistics.series;

  if (series?.games?.length) {
    const games = series.games
      .map((game) => buildStoredGameDetail({
        gameStatistics: game.statistics,
        team1,
        team2,
        gameNo: game.gameNo,
        score1: game.score1,
        score2: game.score2,
      }))
      .filter(Boolean);

    const winnerTeam = series.winnerTeamId != null
      ? resolveTeamById(series.winnerTeamId, team1, team2)
      : null;

    const hasBallByBall = games.some((game) => game.scoringMode === 'ballByBall');
    const playerStats = hasBallByBall ? aggregatePlayerStats(games) : null;

    return {
      match,
      team1,
      team2,
      series: {
        format: series.format,
        label: series.label,
        team1Wins: series.team1Wins,
        team2Wins: series.team2Wins,
        winnerTeam,
      },
      games,
      playerStats,
    };
  }

  const game = buildStoredGameDetail({
    gameStatistics: statistics,
    team1,
    team2,
  });
  if (!game) return null;

  const playerStats = game.scoringMode === 'ballByBall'
    ? aggregatePlayerStats([game])
    : null;

  return {
    match,
    team1,
    team2,
    series: null,
    games: [game],
    playerStats,
  };
};
