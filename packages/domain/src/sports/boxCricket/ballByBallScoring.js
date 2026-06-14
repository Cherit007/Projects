import { resolveBoxCricketRules } from './boxCricketScoring.js';

const LEGAL_BALLS_PER_OVER = 6;

export const resolveSquadMaxWickets = (squadSize = 0, rules = {}) => {
  const configured = Number(rules.maxWickets) || 10;
  const squadCap = Math.max(1, Number(squadSize) - 1);
  if (!Number(squadSize)) return configured;
  return Math.min(configured, squadCap);
};

export const getBenchBatters = (squad = [], state) => (
  getAvailableBatters(squad, state.dismissedIds).filter((player) => (
    String(player.id) !== String(state.strikerId)
    && String(player.id) !== String(state.nonStrikerId)
  ))
);

export const hasBattersRemaining = (squad = [], state) => (
  getAvailableBatters(squad, state.dismissedIds).some((player) => (
    String(player.id) !== String(state.nonStrikerId)
  ))
);

/** @typedef {'runs'|'wicket'|'wide'|'noBall'} DeliveryKind */

/**
 * @typedef {Object} BallDelivery
 * @property {number} over
 * @property {number} ballInOver
 * @property {DeliveryKind} kind
 * @property {number} runs
 * @property {string} strikerId
 * @property {string} nonStrikerId
 * @property {string} [bowlerId]
 * @property {string} [dismissedPlayerId]
 */

/**
 * @param {Array<{ id: string, name: string }>} squad
 * @param {{ battingTeamId: unknown, bowlingTeamId: unknown, rules: ReturnType<typeof resolveBoxCricketRules>, strikerId?: string, nonStrikerId?: string, bowlerId?: string, lineupConfirmed?: boolean }} options
 */
export const createBallByBallInningsState = ({
  squad = [],
  battingTeamId,
  bowlingTeamId,
  rules,
  strikerId = '',
  nonStrikerId = '',
  bowlerId = '',
  lineupConfirmed = false,
}) => {
  const squadSize = Array.isArray(squad) ? squad.filter((player) => player?.name).length : 0;
  const maxWickets = resolveSquadMaxWickets(squadSize, rules);
  return {
  battingTeamId,
  bowlingTeamId,
  balls: /** @type {BallDelivery[]} */ ([]),
  strikerId,
  nonStrikerId,
  bowlerId,
  dismissedIds: /** @type {string[]} */ ([]),
  legalBalls: 0,
  runs: 0,
  wickets: 0,
  oversLimit: rules.oversLimit,
  maxWickets,
  squadSize,
  allOut: false,
  chaseTarget: 0,
  chaseComplete: false,
  lineupConfirmed,
  pendingBowlerSelection: lineupConfirmed && !bowlerId,
  pendingBatterSelection: false,
  lastBowlerId: '',
  lineupSnapshot: null,
};
};

const nextOverNotation = (legalBalls) => {
  const over = Math.floor(legalBalls / LEGAL_BALLS_PER_OVER);
  const ballInOver = (legalBalls % LEGAL_BALLS_PER_OVER) + 1;
  return { over, ballInOver };
};

const swapStrikers = (state) => ({
  ...state,
  strikerId: state.nonStrikerId,
  nonStrikerId: state.strikerId,
});

export const getLegalBallsInCurrentOver = (legalBalls) => legalBalls % LEGAL_BALLS_PER_OVER;

export const getCurrentOverNumber = (legalBalls) => Math.floor(legalBalls / LEGAL_BALLS_PER_OVER);

export const isOverComplete = (legalBalls) => (
  legalBalls > 0 && legalBalls % LEGAL_BALLS_PER_OVER === 0
);

/** Balls shown in the current over strip — empty when between overs awaiting bowler. */
export const getCurrentOverBalls = (state) => {
  if (state.pendingBowlerSelection && isOverComplete(state.legalBalls)) {
    return [];
  }
  const overNumber = getCurrentOverNumber(state.legalBalls);
  return state.balls.filter((ball) => ball.over === overNumber);
};

export const needsLineupSetup = (state) => (
  !state.lineupConfirmed
  || !state.strikerId
  || !state.nonStrikerId
  || (state.pendingBowlerSelection && !state.pendingBatterSelection && !state.bowlerId)
);

export const needsBatterSelection = (state) => (
  Boolean(state.pendingBatterSelection) && !isInningsComplete(state)
);

export const needsBowlerSelection = (state) => (
  Boolean(state.lineupConfirmed)
  && Boolean(state.pendingBowlerSelection)
  && !state.pendingBatterSelection
  && !isInningsComplete(state)
);

export const canSwapBowlerMidOver = (state) => (
  state.lineupConfirmed
  && !isInningsComplete(state)
  && !needsBatterSelection(state)
  && !needsBowlerSelection(state)
  && Boolean(state.bowlerId)
  && getLegalBallsInCurrentOver(state.legalBalls) > 0
  && getLegalBallsInCurrentOver(state.legalBalls) < LEGAL_BALLS_PER_OVER
);

export const confirmInningsLineup = (state, { strikerId, nonStrikerId, bowlerId }) => ({
  ...state,
  strikerId,
  nonStrikerId,
  bowlerId,
  lineupConfirmed: true,
  pendingBowlerSelection: false,
  pendingBatterSelection: false,
  lastBowlerId: '',
  lineupSnapshot: { strikerId, nonStrikerId, bowlerId },
});

export const setInningsBowler = (state, bowlerId) => {
  if (!bowlerId) {
    return { state, error: 'Select a bowler' };
  }
  if (state.lastBowlerId && String(bowlerId) === String(state.lastBowlerId)) {
    return { state, error: 'Same bowler cannot bowl consecutive overs' };
  }
  return {
    state: {
      ...state,
      bowlerId,
      pendingBowlerSelection: false,
    },
    error: null,
  };
};

export const confirmInningsBatter = (state, strikerId) => {
  if (!strikerId) {
    return { state, error: 'Select the new batter' };
  }
  if (String(strikerId) === String(state.nonStrikerId)) {
    return { state, error: 'New batter cannot be the non-striker' };
  }
  if (state.dismissedIds.includes(strikerId)) {
    return { state, error: 'Batter is already dismissed' };
  }
  return {
    state: {
      ...state,
      strikerId,
      pendingBatterSelection: false,
    },
    error: null,
  };
};

export const swapInningsBowler = (state, incomingId, bowlers = []) => {
  if (!incomingId) {
    return { state, error: 'Select a bowler to swap in' };
  }
  if (!canSwapBowlerMidOver(state)) {
    return { state, error: 'Bowler swap is only available mid-over' };
  }
  if (String(incomingId) === String(state.bowlerId)) {
    return { state, error: 'Bowler is already bowling this over' };
  }
  const exists = bowlers.some((player) => String(player.id) === String(incomingId));
  if (bowlers.length && !exists) {
    return { state, error: 'Select a valid bowler' };
  }
  return {
    state: {
      ...state,
      bowlerId: incomingId,
    },
    error: null,
  };
};

export const swapInningsBatter = (state, { creaseRole, incomingId }, squad = []) => {
  if (!incomingId) {
    return { state, error: 'Select a batter to swap in' };
  }
  if (needsBatterSelection(state) || needsBowlerSelection(state)) {
    return { state, error: 'Finish the current selection first' };
  }
  if (isInningsComplete(state)) {
    return { state, error: 'Innings already complete' };
  }
  const role = creaseRole === 'nonStriker' ? 'nonStriker' : 'striker';
  const outgoingId = role === 'striker' ? state.strikerId : state.nonStrikerId;
  if (String(incomingId) === String(outgoingId)) {
    return { state, error: 'Batter is already at the crease' };
  }
  if (String(incomingId) === String(state.strikerId) || String(incomingId) === String(state.nonStrikerId)) {
    return { state, error: 'Batter is already at the crease' };
  }
  if (state.dismissedIds.includes(incomingId)) {
    return { state, error: 'Batter is already dismissed' };
  }
  const onBench = getBenchBatters(squad, state).some((player) => String(player.id) === String(incomingId));
  if (!onBench) {
    return { state, error: 'Select a batter who is not out' };
  }
  return {
    state: {
      ...state,
      [role === 'striker' ? 'strikerId' : 'nonStrikerId']: incomingId,
    },
    error: null,
  };
};

/**
 * @param {ReturnType<typeof createBallByBallInningsState>} state
 * @param {{ kind: DeliveryKind, runs?: number, dismissedPlayerId?: string }} delivery
 * @param {Array<{ id: string, name: string }>} [battingSquad]
 */
export const recordBallDelivery = (state, delivery, battingSquad = []) => {
  if (isInningsComplete(state)) {
    return { state, error: 'Innings already complete' };
  }
  if (needsBatterSelection(state)) {
    return { state, error: 'Select the new batter first' };
  }
  if (needsBowlerSelection(state)) {
    return { state, error: 'Select the bowler for this over' };
  }
  if (!state.strikerId || !state.bowlerId) {
    return { state, error: 'Select striker and bowler before recording a ball' };
  }

  const kind = delivery.kind || 'runs';
  const runs = Math.max(0, Number(delivery.runs) || 0);
  const { over, ballInOver } = nextOverNotation(state.legalBalls);
  const isExtra = kind === 'wide' || kind === 'noBall';
  const legalBall = !isExtra;

  /** @type {BallDelivery} */
  const ball = {
    over,
    ballInOver: isExtra ? Math.max(1, ballInOver - 1 || 1) : ballInOver,
    kind,
    runs,
    strikerId: state.strikerId,
    nonStrikerId: state.nonStrikerId,
    bowlerId: state.bowlerId,
    ...(delivery.dismissedPlayerId ? { dismissedPlayerId: delivery.dismissedPlayerId } : {}),
  };

  let next = {
    ...state,
    balls: [...state.balls, ball],
    runs: state.runs + runs,
    legalBalls: state.legalBalls + (legalBall ? 1 : 0),
  };

  if (kind === 'wicket') {
    const dismissedId = delivery.dismissedPlayerId || state.strikerId;
    next.wickets += 1;
    next.dismissedIds = [...next.dismissedIds, dismissedId];
    next.strikerId = '';
    const canSendBatter = battingSquad.length
      ? hasBattersRemaining(battingSquad, { ...next, strikerId: next.nonStrikerId })
      : next.wickets < next.maxWickets;
    if (canSendBatter && next.wickets < next.maxWickets) {
      next.pendingBatterSelection = true;
      next.pendingBowlerSelection = false;
    } else {
      next.pendingBatterSelection = false;
      next.allOut = true;
    }
  }

  if (legalBall && kind === 'runs' && runs % 2 === 1) {
    next = swapStrikers(next);
  }

  if (legalBall && next.legalBalls > 0 && next.legalBalls % LEGAL_BALLS_PER_OVER === 0) {
    next = swapStrikers(next);
    next.lastBowlerId = next.bowlerId;
    next.bowlerId = '';
    next.pendingBowlerSelection = true;
  }

  if (next.chaseTarget && next.runs >= next.chaseTarget) {
    next.chaseComplete = true;
    next.pendingBatterSelection = false;
    next.pendingBowlerSelection = false;
  }

  return { state: next, error: null };
};

const deliveryFromBall = (ball) => ({
  kind: ball.kind,
  runs: ball.runs,
  ...(ball.dismissedPlayerId ? { dismissedPlayerId: ball.dismissedPlayerId } : {}),
});

const battingSquadFromBalls = (balls = []) => {
  const map = new Map();
  balls.forEach((ball) => {
    [ball.strikerId, ball.nonStrikerId, ball.dismissedPlayerId].forEach((id) => {
      if (!id) return;
      const key = String(id);
      if (!map.has(key)) map.set(key, { id: key, name: key });
    });
  });
  return Array.from(map.values());
};

/** Replay ball log onto a fresh innings shell (for undo). */
export const rebuildInningsStateFromBalls = (baseState, balls = []) => {
  const snapshot = baseState.lineupSnapshot;
  if (!snapshot) {
    return { state: baseState, error: 'Cannot undo before lineup is confirmed' };
  }

  const battingSquad = battingSquadFromBalls(balls);

  let state = confirmInningsLineup(
    createBallByBallInningsState({
      squad: battingSquad,
      battingTeamId: baseState.battingTeamId,
      bowlingTeamId: baseState.bowlingTeamId,
      rules: {
        oversLimit: baseState.oversLimit,
        maxWickets: baseState.maxWickets,
      },
    }),
    snapshot,
  );

  state = {
    ...state,
    squadSize: baseState.squadSize,
    maxWickets: baseState.maxWickets,
    chaseTarget: baseState.chaseTarget || 0,
    chaseComplete: false,
    allOut: false,
  };

  for (const ball of balls) {
    if (state.pendingBowlerSelection && ball.bowlerId) {
      const bowlerResult = setInningsBowler(state, ball.bowlerId);
      if (bowlerResult.error) return bowlerResult;
      state = bowlerResult.state;
    }
    if (state.pendingBatterSelection && ball.strikerId) {
      const batterResult = confirmInningsBatter(state, ball.strikerId);
      if (batterResult.error) return batterResult;
      state = batterResult.state;
    }
    const result = recordBallDelivery(state, deliveryFromBall(ball), battingSquad);
    if (result.error) return result;
    state = result.state;
  }

  return { state, error: null };
};

export const undoLastDelivery = (state) => {
  if (!state.balls.length) {
    return { state, error: 'Nothing to undo' };
  }
  return rebuildInningsStateFromBalls(state, state.balls.slice(0, -1));
};

export const cloneInningsState = (state) => JSON.parse(JSON.stringify(state));

export const isChaseComplete = (state) => (
  Number(state.chaseTarget) > 0 && state.runs >= Number(state.chaseTarget)
);

export const isInningsComplete = (state) => {
  const maxLegalBalls = state.oversLimit * LEGAL_BALLS_PER_OVER;
  if (state.chaseComplete || isChaseComplete(state)) return true;
  if (state.legalBalls >= maxLegalBalls) return true;
  if (state.wickets >= state.maxWickets) return true;
  if (state.allOut) return true;
  return false;
};

export const getInningsEndReason = (state) => {
  if (!isInningsComplete(state)) return null;
  if (state.chaseComplete || isChaseComplete(state)) return 'chaseWon';
  if (state.allOut || state.wickets >= state.maxWickets) return 'allOut';
  if (state.legalBalls >= state.oversLimit * LEGAL_BALLS_PER_OVER) return 'overs';
  return 'complete';
};

export const setInningsChaseTarget = (state, target) => ({
  ...state,
  chaseTarget: Math.max(0, Number(target) || 0),
  chaseComplete: false,
});

export const inningsStateToSummary = (state) => ({
  runs: state.runs,
  wickets: state.wickets,
  overs: Math.max(state.legalBalls / LEGAL_BALLS_PER_OVER, 0.1).toFixed(1),
  ballLog: state.balls,
  scoringMode: 'ballByBall',
});

export const aggregateBallLogToInningsInput = (ballLog = [], rules) => {
  let runs = 0;
  let wickets = 0;
  let legalBalls = 0;

  ballLog.forEach((ball) => {
    runs += Number(ball.runs) || 0;
    if (ball.kind === 'wicket') wickets += 1;
    if (ball.kind !== 'wide' && ball.kind !== 'noBall') legalBalls += 1;
  });

  const overs = Math.max(legalBalls / LEGAL_BALLS_PER_OVER, 0.1);

  return {
    runs,
    wickets,
    overs: Math.min(overs, rules.oversLimit).toFixed(1),
    ballLog,
    scoringMode: 'ballByBall',
  };
};

export const getAvailableBatters = (squad = [], dismissedIds = []) => (
  squad.filter((player) => player?.id && player?.name && !dismissedIds.includes(player.id))
);

export const getAvailableBowlers = (squad = [], { excludeId = '', lastBowlerId = '' } = {}) => (
  squad.filter((player) => {
    if (!player?.id || !player?.name) return false;
    if (excludeId && String(player.id) === String(excludeId)) return false;
    if (lastBowlerId && String(player.id) === String(lastBowlerId)) return false;
    return true;
  })
);

export const formatOverLabel = (legalBalls) => (
  legalBalls > 0
    ? `${Math.floor(legalBalls / LEGAL_BALLS_PER_OVER)}.${legalBalls % LEGAL_BALLS_PER_OVER}`
    : '0.0'
);
