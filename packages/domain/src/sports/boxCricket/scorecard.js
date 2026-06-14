const isExtra = (kind) => kind === 'wide' || kind === 'noBall';

const emptyBatterRow = (player) => ({
  id: player.id,
  name: player.name,
  runs: 0,
  balls: 0,
  fours: 0,
  sixes: 0,
  status: 'not out',
});

/**
 * @param {ReturnType<import('./ballByBallScoring.js').createBallByBallInningsState>} state
 * @param {Array<{ id: string, name: string }>} battingSquad
 * @param {Array<{ id: string, name: string }>} bowlingSquad
 */
export const buildInningsScorecard = (state, battingSquad = [], bowlingSquad = []) => {
  const batterMap = new Map(
    battingSquad.filter((player) => player?.id).map((player) => [String(player.id), emptyBatterRow(player)]),
  );
  const bowlerMap = new Map(
    bowlingSquad.filter((player) => player?.id).map((player) => [String(player.id), {
      id: player.id,
      name: player.name,
      overs: 0,
      legalBalls: 0,
      runs: 0,
      wickets: 0,
    }]),
  );
  const fallOfWickets = [];

  state.balls.forEach((ball, index) => {
    const strikerKey = String(ball.strikerId || '');
    const bowlerKey = String(ball.bowlerId || '');
    const ballRuns = Number(ball.runs) || 0;

    if (strikerKey && batterMap.has(strikerKey)) {
      const row = batterMap.get(strikerKey);
      if (ball.kind === 'runs') {
        row.runs += ballRuns;
        row.balls += 1;
        if (ballRuns === 4) row.fours += 1;
        if (ballRuns === 6) row.sixes += 1;
      } else if (ball.kind === 'wicket' && String(ball.dismissedPlayerId || strikerKey) === strikerKey) {
        row.balls += 1;
      }
    }

    if (bowlerKey && bowlerMap.has(bowlerKey)) {
      const row = bowlerMap.get(bowlerKey);
      row.runs += Number(ball.runs) || 0;
      if (!isExtra(ball.kind)) row.legalBalls += 1;
      if (ball.kind === 'wicket') row.wickets += 1;
    }

    if (ball.kind === 'wicket' && ball.dismissedPlayerId) {
      const dismissedKey = String(ball.dismissedPlayerId);
      if (batterMap.has(dismissedKey)) {
        batterMap.get(dismissedKey).status = 'out';
      }
      fallOfWickets.push({
        wicket: fallOfWickets.length + 1,
        score: state.balls.slice(0, index + 1).reduce((sum, entry) => sum + (Number(entry.runs) || 0), 0),
        batterId: ball.dismissedPlayerId,
        batterName: batterMap.get(dismissedKey)?.name || '—',
      });
    }
  });

  bowlerMap.forEach((row) => {
    row.overs = `${Math.floor(row.legalBalls / 6)}.${row.legalBalls % 6}`;
  });

  const batting = Array.from(batterMap.values())
    .filter((row) => row.balls > 0 || row.status === 'out' || state.dismissedIds.includes(row.id))
    .sort((left, right) => right.runs - left.runs);

  const currentlyBatting = [state.strikerId, state.nonStrikerId]
    .filter(Boolean)
    .map((id) => batterMap.get(String(id)))
    .filter(Boolean);

  currentlyBatting.forEach((row) => {
    if (row.status !== 'out') row.status = 'batting';
  });

  const bowling = Array.from(bowlerMap.values())
    .filter((row) => row.legalBalls > 0 || row.runs > 0)
    .sort((left, right) => right.wickets - left.wickets || left.runs - right.runs);

  return {
    total: `${state.runs}/${state.wickets}`,
    overs: state.legalBalls,
    batting,
    bowling,
    fallOfWickets,
    extras: state.balls
      .filter((ball) => isExtra(ball.kind))
      .reduce((sum, ball) => sum + (Number(ball.runs) || 0), 0),
  };
};

export const buildMatchHighlights = ({
  innings1State,
  innings2State,
  firstBattingTeam,
  secondBattingTeam,
  firstBowlingTeam,
  secondBowlingTeam,
}) => {
  const inn1Batters = normalizeSquad(firstBattingTeam?.squad).map((player) => ({
    id: player.id,
    name: player.name,
  }));
  const inn1Bowlers = normalizeSquad(firstBowlingTeam?.squad).map((player) => ({
    id: player.id,
    name: player.name,
  }));
  const inn2Batters = normalizeSquad(secondBattingTeam?.squad).map((player) => ({
    id: player.id,
    name: player.name,
  }));
  const inn2Bowlers = normalizeSquad(secondBowlingTeam?.squad).map((player) => ({
    id: player.id,
    name: player.name,
  }));

  const scorecard1 = buildInningsScorecard(innings1State, inn1Batters, inn1Bowlers);
  const scorecard2 = buildInningsScorecard(innings2State, inn2Batters, inn2Bowlers);

  const batterTotals = new Map();
  [...scorecard1.batting, ...scorecard2.batting].forEach((row) => {
    const key = String(row.id);
    const existing = batterTotals.get(key) || {
      id: row.id,
      name: row.name,
      runs: 0,
      balls: 0,
      fours: 0,
      sixes: 0,
    };
    existing.runs += row.runs;
    existing.balls += row.balls;
    existing.fours += row.fours;
    existing.sixes += row.sixes;
    batterTotals.set(key, existing);
  });

  const bowlerTotals = new Map();
  [...scorecard1.bowling, ...scorecard2.bowling].forEach((row) => {
    const key = String(row.id);
    const existing = bowlerTotals.get(key) || {
      id: row.id,
      name: row.name,
      overs: '0.0',
      legalBalls: 0,
      runs: 0,
      wickets: 0,
    };
    existing.legalBalls += row.legalBalls ?? 0;
    existing.runs += row.runs;
    existing.wickets += row.wickets;
    existing.overs = `${Math.floor(existing.legalBalls / 6)}.${existing.legalBalls % 6}`;
    bowlerTotals.set(key, existing);
  });

  const topBatter = [...batterTotals.values()].sort((left, right) => right.runs - left.runs)[0] || null;
  const topBowler = [...bowlerTotals.values()].sort((left, right) => (
    right.wickets - left.wickets || left.runs - right.runs
  ))[0] || null;

  const runs1 = Number(innings1State?.runs) || 0;
  const runs2 = Number(innings2State?.runs) || 0;
  const target = runs1 + 1;
  const chaseWon = Boolean(
    innings2State?.chaseComplete
    || (Number(innings2State?.chaseTarget) > 0 && runs2 >= Number(innings2State.chaseTarget))
    || runs2 >= target,
  );
  const winnerTeam = chaseWon ? secondBattingTeam : firstBattingTeam;
  const margin = chaseWon ? runs2 - runs1 : runs1 - runs2;

  return {
    winnerTeam,
    loserTeam: chaseWon ? firstBattingTeam : secondBattingTeam,
    firstBattingTeam,
    secondBattingTeam,
    margin,
    chaseWon,
    scorecard1,
    scorecard2,
    topBatter,
    topBowler,
    summary: `${winnerTeam?.name || 'Winner'} won by ${Math.max(margin, 0)} run${margin === 1 ? '' : 's'}`,
  };
};

const normalizeSquad = (squadInput) => {
  const source = Array.isArray(squadInput) ? squadInput : [];
  return source
    .map((entry, index) => ({
      id: String(entry?.id || `p-${index + 1}`),
      name: String(entry?.name || '').trim(),
    }))
    .filter((entry) => entry.name);
};
