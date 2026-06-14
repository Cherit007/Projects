import { describe, expect, it } from 'vitest';
import {
  buildCasualMatchDetail,
  buildInningsStateFromStoredBallLog,
} from '@fixture-maker/domain/sports/boxCricket/casualMatchDetail';
import { buildUnifiedHistoryEntries } from '../utils/historyEntries';

describe('buildInningsStateFromStoredBallLog', () => {
  it('derives runs and wickets from ball log', () => {
    const state = buildInningsStateFromStoredBallLog({
      ballLog: [
        { kind: 'runs', runs: 4, strikerId: 'p1', bowlerId: 'p9' },
        { kind: 'wicket', runs: 0, strikerId: 'p1', dismissedPlayerId: 'p1', bowlerId: 'p9' },
      ],
    }, { oversLimit: 6, maxWickets: 10 });

    expect(state.runs).toBe(4);
    expect(state.wickets).toBe(1);
    expect(state.legalBalls).toBe(2);
  });
});

describe('buildCasualMatchDetail', () => {
  it('builds ball-by-ball scorecards and player stats', () => {
    const match = {
      sportId: 'boxCricket',
      score1: 45,
      score2: 42,
      team1: { id: 1, name: 'Aces', squad: [{ id: 'p1', name: 'Alex' }, { id: 'p2', name: 'Ben' }] },
      team2: { id: 2, name: 'Blaze', squad: [{ id: 'p9', name: 'Chris' }, { id: 'p10', name: 'Dan' }] },
      statistics: {
        sportId: 'boxCricket',
        format: 'casualSeries',
        teams: {
          team1: { id: 1, name: 'Aces', squad: [{ id: 'p1', name: 'Alex' }, { id: 'p2', name: 'Ben' }] },
          team2: { id: 2, name: 'Blaze', squad: [{ id: 'p9', name: 'Chris' }, { id: 'p10', name: 'Dan' }] },
        },
        series: {
          format: 'single',
          label: 'Single game',
          team1Wins: 1,
          team2Wins: 0,
          winnerTeamId: 1,
          games: [{
            gameNo: 1,
            score1: 45,
            score2: 42,
            winnerTeamId: 1,
            statistics: {
              sportId: 'boxCricket',
              scoringMode: 'ballByBall',
              oversLimit: 6,
              innings: [
                {
                  battingTeamId: 1,
                  bowlingTeamId: 2,
                  runs: 45,
                  wickets: 2,
                  overs: 6,
                  ballLog: [
                    { kind: 'runs', runs: 4, strikerId: 'p1', nonStrikerId: 'p2', bowlerId: 'p9' },
                    { kind: 'runs', runs: 6, strikerId: 'p1', nonStrikerId: 'p2', bowlerId: 'p9' },
                    { kind: 'wicket', runs: 0, strikerId: 'p1', dismissedPlayerId: 'p1', bowlerId: 'p9' },
                  ],
                },
                {
                  battingTeamId: 2,
                  bowlingTeamId: 1,
                  runs: 42,
                  wickets: 3,
                  overs: 5.4,
                  ballLog: [
                    { kind: 'runs', runs: 2, strikerId: 'p9', nonStrikerId: 'p10', bowlerId: 'p2' },
                    { kind: 'runs', runs: 4, strikerId: 'p9', nonStrikerId: 'p10', bowlerId: 'p2' },
                  ],
                },
              ],
              result: { winnerTeamId: 1 },
            },
          }],
        },
      },
    };

    const detail = buildCasualMatchDetail(match);
    expect(detail.games).toHaveLength(1);
    expect(detail.games[0].scoringMode).toBe('ballByBall');
    const alex = detail.games[0].scorecard1.batting.find((row) => String(row.name).includes('Alex') || row.id === 'p1');
    expect(alex?.runs).toBe(10);
    expect(detail.playerStats.batters.some((row) => row.runs === 10)).toBe(true);
    expect(detail.playerStats.bowlers.length).toBeGreaterThan(0);
  });

  it('uses series-level squads when game statistics omit teams', () => {
    const match = {
      sportId: 'boxCricket',
      score1: 10,
      score2: 4,
      team1: { id: 1, name: 'Aces', squad: [{ id: 'p1', name: 'Alex' }] },
      team2: { id: 2, name: 'Blaze', squad: [{ id: 'p9', name: 'Chris' }] },
      statistics: {
        sportId: 'boxCricket',
        teams: {
          team1: { id: 1, squad: [{ id: 'p1', name: 'Alex' }] },
          team2: { id: 2, squad: [{ id: 'p9', name: 'Chris' }] },
        },
        series: {
          winnerTeamId: 1,
          games: [{
            gameNo: 1,
            statistics: {
              sportId: 'boxCricket',
              scoringMode: 'ballByBall',
              oversLimit: 6,
              innings: [
                {
                  battingTeamId: 1,
                  bowlingTeamId: 2,
                  runs: 10,
                  wickets: 0,
                  overs: 1,
                  ballLog: [{ kind: 'runs', runs: 10, strikerId: 'p1', bowlerId: 'p9' }],
                },
                {
                  battingTeamId: 2,
                  bowlingTeamId: 1,
                  runs: 4,
                  wickets: 0,
                  overs: 1,
                  ballLog: [{ kind: 'runs', runs: 4, strikerId: 'p9', bowlerId: 'p1' }],
                },
              ],
              result: { winnerTeamId: 1 },
            },
          }],
        },
      },
    };

    const detail = buildCasualMatchDetail(match);
    expect(detail.playerStats.batters.find((row) => row.name === 'Alex')?.runs).toBe(10);
  });

  it('skips player stats for summary scoring mode', () => {
    const match = {
      sportId: 'boxCricket',
      statistics: {
        sportId: 'boxCricket',
        format: 'casualSeries',
        series: {
          format: 'single',
          games: [{
            gameNo: 1,
            statistics: {
              sportId: 'boxCricket',
              scoringMode: 'summary',
              oversLimit: 6,
              innings: [
                { battingTeamId: 1, bowlingTeamId: 2, runs: 40, wickets: 3, overs: 6 },
                { battingTeamId: 2, bowlingTeamId: 1, runs: 38, wickets: 4, overs: 6 },
              ],
              result: { winnerTeamId: 1 },
            },
          }],
        },
      },
      team1: { id: 1, name: 'Aces' },
      team2: { id: 2, name: 'Blaze' },
    };

    const detail = buildCasualMatchDetail(match);
    expect(detail.games[0].scoringMode).toBe('summary');
    expect(detail.playerStats).toBeNull();
  });
});

describe('buildUnifiedHistoryEntries', () => {
  it('merges and sorts tournaments with casual matches', () => {
    const entries = buildUnifiedHistoryEntries(
      [{ id: 't1', date: '2026-01-01', name: 'Old Cup' }],
      [{ id: 'c1', date: '2026-06-01', team1: {}, team2: {} }],
    );
    expect(entries).toHaveLength(2);
    expect(entries[0].type).toBe('casual');
    expect(entries[1].type).toBe('tournament');
  });
});
