// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  confirmInningsBatter,
  confirmInningsLineup,
  createBallByBallInningsState,
  getAvailableBowlers,
  getCurrentOverBalls,
  inningsStateToSummary,
  isInningsComplete,
  isOverComplete,
  recordBallDelivery,
  setInningsBowler,
  swapInningsBatter,
  swapInningsBowler,
  undoLastDelivery,
  needsBowlerSelection,
} from '@fixture-maker/domain/sports/boxCricket/ballByBallScoring';
import { resolveBoxCricketRules } from '@fixture-maker/domain/sports/boxCricket/boxCricketScoring';
import { buildInningsScorecard } from '@fixture-maker/domain/sports/boxCricket/scorecard';
import { resolveBattingOrder } from '@fixture-maker/domain/sports/boxCricket/matchSetup';

const rules = resolveBoxCricketRules({ oversLimit: 1, maxWickets: 2 });
const squad = [
  { id: 'p1', name: 'A' },
  { id: 'p2', name: 'B' },
  { id: 'p3', name: 'C' },
];
const bowlers = [
  { id: 'b1', name: 'X' },
  { id: 'b2', name: 'Y' },
];

const readyState = () => confirmInningsLineup(
  createBallByBallInningsState({
    squad,
    battingTeamId: 1,
    bowlingTeamId: 2,
    rules,
  }),
  { strikerId: 'p1', nonStrikerId: 'p2', bowlerId: 'b1' },
);

describe('ballByBallScoring', () => {
  it('tracks runs and swaps striker on odd runs', () => {
    let state = readyState();
    state = recordBallDelivery(state, { kind: 'runs', runs: 1 }).state;
    state = recordBallDelivery(state, { kind: 'runs', runs: 4 }).state;
    expect(state.runs).toBe(5);
    expect(state.legalBalls).toBe(2);
    expect(state.strikerId).toBe('p2');
  });

  it('does not count wides as legal balls', () => {
    let state = readyState();
    state = recordBallDelivery(state, { kind: 'wide', runs: 1 }).state;
    expect(state.runs).toBe(1);
    expect(state.legalBalls).toBe(0);
  });

  it('ends innings after over limit and swaps at end of over', () => {
    let state = readyState();
    for (let i = 0; i < 5; i += 1) {
      state = recordBallDelivery(state, { kind: 'runs', runs: 0 }).state;
    }
    expect(state.strikerId).toBe('p1');
    state = recordBallDelivery(state, { kind: 'runs', runs: 2 }).state;
    expect(isOverComplete(state.legalBalls)).toBe(true);
    expect(state.strikerId).toBe('p2');
    expect(state.pendingBowlerSelection).toBe(true);
    expect(isInningsComplete(state)).toBe(true);
    const summary = inningsStateToSummary(state);
    expect(summary.runs).toBe(2);
  });

  it('requires bowler selection after each over before next ball', () => {
    const twoOverRules = resolveBoxCricketRules({ oversLimit: 2, maxWickets: 10 });
    let state = confirmInningsLineup(
      createBallByBallInningsState({
        squad,
        battingTeamId: 1,
        bowlingTeamId: 2,
        rules: twoOverRules,
      }),
      { strikerId: 'p1', nonStrikerId: 'p2', bowlerId: 'b1' },
    );
    for (let i = 0; i < 6; i += 1) {
      if (state.pendingBowlerSelection) {
        state = setInningsBowler(state, 'b2').state;
      }
      const result = recordBallDelivery(state, { kind: 'runs', runs: 0 });
      expect(result.error).toBeNull();
      state = result.state;
    }
    expect(state.legalBalls).toBe(6);
    expect(state.pendingBowlerSelection).toBe(true);
    expect(state.lastBowlerId).toBe('b1');
  });

  it('blocks the same bowler from bowling consecutive overs', () => {
    const twoOverRules = resolveBoxCricketRules({ oversLimit: 2, maxWickets: 10 });
    let state = confirmInningsLineup(
      createBallByBallInningsState({
        squad,
        battingTeamId: 1,
        bowlingTeamId: 2,
        rules: twoOverRules,
      }),
      { strikerId: 'p1', nonStrikerId: 'p2', bowlerId: 'b1' },
    );
    for (let i = 0; i < 6; i += 1) {
      state = recordBallDelivery(state, { kind: 'runs', runs: 0 }).state;
    }
    expect(state.pendingBowlerSelection).toBe(true);
    const blocked = setInningsBowler(state, 'b1');
    expect(blocked.error).toMatch(/consecutive overs/i);
    state = setInningsBowler(state, 'b2').state;
    expect(state.bowlerId).toBe('b2');
  });

  it('requires explicit batter selection after a wicket', () => {
    let state = readyState();
    state = recordBallDelivery(state, { kind: 'wicket', runs: 0, dismissedPlayerId: 'p1' }).state;
    expect(state.pendingBatterSelection).toBe(true);
    expect(state.strikerId).toBe('');
    const blocked = recordBallDelivery(state, { kind: 'runs', runs: 1 });
    expect(blocked.error).toMatch(/new batter/i);
    state = confirmInningsBatter(state, 'p3').state;
    state = recordBallDelivery(state, { kind: 'runs', runs: 2 }).state;
    expect(state.strikerId).toBe('p3');
    expect(state.wickets).toBe(1);
  });

  it('clears the over map between overs', () => {
    const twoOverRules = resolveBoxCricketRules({ oversLimit: 2, maxWickets: 10 });
    let state = confirmInningsLineup(
      createBallByBallInningsState({
        squad,
        battingTeamId: 1,
        bowlingTeamId: 2,
        rules: twoOverRules,
      }),
      { strikerId: 'p1', nonStrikerId: 'p2', bowlerId: 'b1' },
    );
    for (let i = 0; i < 6; i += 1) {
      state = recordBallDelivery(state, { kind: 'runs', runs: 1 }).state;
    }
    expect(getCurrentOverBalls(state)).toEqual([]);
    state = setInningsBowler(state, 'b2').state;
    expect(getCurrentOverBalls(state)).toEqual([]);
    state = recordBallDelivery(state, { kind: 'runs', runs: 4 }).state;
    expect(getCurrentOverBalls(state)).toHaveLength(1);
  });

  it('undoes the last delivery', () => {
    let state = readyState();
    state = recordBallDelivery(state, { kind: 'runs', runs: 4 }).state;
    state = recordBallDelivery(state, { kind: 'runs', runs: 2 }).state;
    const undone = undoLastDelivery(state);
    expect(undone.error).toBeNull();
    expect(undone.state.runs).toBe(4);
    expect(undone.state.legalBalls).toBe(1);
  });

  it('undoes the ball that ended the innings', () => {
    let state = readyState();
    for (let i = 0; i < 6; i += 1) {
      state = recordBallDelivery(state, { kind: 'runs', runs: 1 }).state;
    }
    expect(isInningsComplete(state)).toBe(true);
    const undone = undoLastDelivery(state);
    expect(undone.error).toBeNull();
    expect(isInningsComplete(undone.state)).toBe(false);
    expect(undone.state.legalBalls).toBe(5);
  });

  it('stops scoring when chase target is reached', () => {
    let state = readyState();
    state = { ...state, chaseTarget: 5 };
    state = recordBallDelivery(state, { kind: 'runs', runs: 4 }).state;
    expect(isInningsComplete(state)).toBe(false);
    state = recordBallDelivery(state, { kind: 'runs', runs: 2 }).state;
    expect(state.runs).toBe(6);
    expect(state.chaseComplete).toBe(true);
    expect(isInningsComplete(state)).toBe(true);
    const blocked = recordBallDelivery(state, { kind: 'runs', runs: 1 });
    expect(blocked.error).toMatch(/innings already complete/i);
  });

  it('builds a scorecard from ball log', () => {
    let state = readyState();
    state = recordBallDelivery(state, { kind: 'runs', runs: 4 }).state;
    state = recordBallDelivery(state, { kind: 'wicket', runs: 0, dismissedPlayerId: 'p1' }).state;
    state = confirmInningsBatter(state, 'p3').state;
    const scorecard = buildInningsScorecard(state, squad, bowlers);
    expect(scorecard.total).toBe('4/1');
    expect(scorecard.batting.some((row) => row.id === 'p1' && row.status === 'out')).toBe(true);
    expect(scorecard.batting.find((row) => row.id === 'p1')?.fours).toBe(1);
    expect(scorecard.batting.find((row) => row.id === 'p1')?.balls).toBe(2);
    expect(scorecard.fallOfWickets).toHaveLength(1);
  });

  it('counts a duck as one ball faced', () => {
    let state = readyState();
    state = recordBallDelivery(state, { kind: 'wicket', runs: 0, dismissedPlayerId: 'p1' }).state;
    const scorecard = buildInningsScorecard(state, squad, bowlers);
    const batter = scorecard.batting.find((row) => row.id === 'p1');
    expect(batter?.runs).toBe(0);
    expect(batter?.balls).toBe(1);
    expect(batter?.fours).toBe(0);
  });

  it('excludes last bowler from available bowlers', () => {
    const available = getAvailableBowlers(bowlers, { lastBowlerId: 'b1' });
    expect(available.map((player) => player.id)).toEqual(['b2']);
  });

  it('ends innings when no batters remain after a wicket', () => {
    const smallSquadRules = resolveBoxCricketRules({ oversLimit: 2, maxWickets: 10 });
    let state = confirmInningsLineup(
      createBallByBallInningsState({
        squad: [{ id: 'p1', name: 'A' }, { id: 'p2', name: 'B' }],
        battingTeamId: 1,
        bowlingTeamId: 2,
        rules: smallSquadRules,
      }),
      { strikerId: 'p1', nonStrikerId: 'p2', bowlerId: 'b1' },
    );
    state = recordBallDelivery(state, { kind: 'wicket', runs: 0, dismissedPlayerId: 'p1' }, [
      { id: 'p1', name: 'A' },
      { id: 'p2', name: 'B' },
    ]).state;
    expect(state.allOut).toBe(true);
    expect(state.pendingBatterSelection).toBe(false);
    expect(isInningsComplete(state)).toBe(true);
  });

  it('allows swapping a bench batter onto the crease', () => {
    const squad = [
      { id: 'p1', name: 'A' },
      { id: 'p2', name: 'B' },
      { id: 'p3', name: 'C' },
    ];
    let state = confirmInningsLineup(
      createBallByBallInningsState({
        squad,
        battingTeamId: 1,
        bowlingTeamId: 2,
        rules,
      }),
      { strikerId: 'p1', nonStrikerId: 'p2', bowlerId: 'b1' },
    );
    const swapped = swapInningsBatter(state, { creaseRole: 'striker', incomingId: 'p3' }, squad);
    expect(swapped.error).toBeNull();
    expect(swapped.state.strikerId).toBe('p3');
  });

  it('resolves batting order from toss', () => {
    const team1 = { id: 1, name: 'T1' };
    const team2 = { id: 2, name: 'T2' };
    const order = resolveBattingOrder(team1, team2, {
      tossWinnerTeamId: 2,
      electedTo: 'bat',
    });
    expect(order.firstBattingTeam.id).toBe(2);
    expect(order.battingFirstTeamId).toBe(2);
  });

  it('does not ask for bowler before opening lineup is confirmed', () => {
    const state = createBallByBallInningsState({
      squad,
      battingTeamId: 1,
      bowlingTeamId: 2,
      rules,
    });
    expect(state.pendingBowlerSelection).toBe(false);
    expect(needsBowlerSelection(state)).toBe(false);
  });

  it('allows swapping bowler mid-over', () => {
    let state = readyState();
    state = recordBallDelivery(state, { kind: 'runs', runs: 1 }).state;
    const swapped = swapInningsBowler(state, 'b2', bowlers);
    expect(swapped.error).toBeNull();
    expect(swapped.state.bowlerId).toBe('b2');
  });
});
