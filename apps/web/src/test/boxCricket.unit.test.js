// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  buildBoxCricketMatchStatistics,
  validateBoxCricketMatchScore,
  isCasualSeriesComplete,
  buildCasualSeriesStatistics,
  formatCasualSeriesScoreLine,
  getCasualSeriesConfig,
} from '@fixture-maker/domain/sports/boxCricket/boxCricketScoring';
import {
  createEmptySquadTeam,
  isSquadTeamValid,
  serializeSquad,
  parseSquadJson,
} from '@fixture-maker/domain/sports/boxCricket/squadUtils';
import { calculateBoxCricketStandings } from '@fixture-maker/domain/sports/boxCricket/BoxCricketRankingEngine';
import { getSportPlugin, BoxCricketPlugin } from '@fixture-maker/domain/sports';

describe('box cricket squad utils', () => {
  it('creates squad teams with default slots', () => {
    const team = createEmptySquadTeam(1);
    expect(team.squad).toHaveLength(6);
    expect(team.emoji).toBe('🏏');
  });

  it('validates minimum squad size', () => {
    const team = createEmptySquadTeam(1);
    expect(isSquadTeamValid(team)).toBe(false);
    team.name = 'A';
    team.squad = team.squad.map((player, index) => ({
      ...player,
      name: `Player ${index + 1}`,
    }));
    expect(isSquadTeamValid(team)).toBe(true);
  });

  it('round-trips squad JSON', () => {
    const json = serializeSquad([
      { id: '1', name: 'Rahul', role: 'captain' },
      { id: '2', name: 'Sam', role: 'player' },
    ]);
    expect(parseSquadJson(json)).toHaveLength(2);
  });
});

describe('box cricket scoring', () => {
  const team1 = { id: 1, name: 'A' };
  const team2 = { id: 2, name: 'B' };

  it('builds innings statistics payload', () => {
    const statistics = buildBoxCricketMatchStatistics({
      team1,
      team2,
      innings1: { runs: 52, wickets: 3, overs: 6 },
      innings2: { runs: 48, wickets: 5, overs: 6 },
      ruleConfig: {},
    });
    expect(statistics.sportId).toBe('boxCricket');
    expect(statistics.innings[0].runs).toBe(52);
    expect(statistics.result.winnerTeamId).toBe(1);
  });

  it('rejects tied innings when super over is disabled', () => {
    const statistics = buildBoxCricketMatchStatistics({
      team1,
      team2,
      innings1: { runs: 50, wickets: 2, overs: 6 },
      innings2: { runs: 50, wickets: 4, overs: 6 },
      ruleConfig: { superOverEnabled: false },
    });
    const result = validateBoxCricketMatchScore(50, 50, { superOverEnabled: false }, { statistics });
    expect(result.valid).toBe(false);
  });

  it('accepts super over statistics when runs differ', () => {
    const statistics = buildBoxCricketMatchStatistics({
      team1,
      team2,
      innings1: { runs: 12, wickets: 1, overs: 1 },
      innings2: { runs: 10, wickets: 2, overs: 1 },
      ruleConfig: {},
      superOver: true,
    });
    const result = validateBoxCricketMatchScore(12, 10, {}, { statistics });
    expect(result.valid).toBe(true);
  });
});

describe('box cricket casual series', () => {
  const team1 = { id: 1, name: 'A' };
  const team2 = { id: 2, name: 'B' };

  it('detects best-of-3 completion at 2 wins', () => {
    expect(isCasualSeriesComplete(1, 1, 'bo3')).toBe(false);
    expect(isCasualSeriesComplete(2, 0, 'bo3')).toBe(true);
    expect(isCasualSeriesComplete(0, 2, 'bo3')).toBe(true);
  });

  it('builds casual series statistics payload', () => {
    const games = [
      { gameNo: 1, score1: 40, score2: 35, winnerTeamId: 1 },
      { gameNo: 2, score1: 30, score2: 42, winnerTeamId: 2 },
      { gameNo: 3, score1: 45, score2: 41, winnerTeamId: 1 },
    ];
    const statistics = buildCasualSeriesStatistics({
      team1,
      team2,
      seriesFormat: 'bo3',
      games,
      team1Wins: 2,
      team2Wins: 1,
    });
    expect(statistics.format).toBe('casualSeries');
    expect(statistics.series.team1Wins).toBe(2);
    expect(statistics.series.games).toHaveLength(3);
    expect(getCasualSeriesConfig('bo3').winsRequired).toBe(2);
  });

  it('formats series score line for history', () => {
    const statistics = buildCasualSeriesStatistics({
      team1: { id: 1, name: 'A' },
      team2: { id: 2, name: 'B' },
      seriesFormat: 'bo3',
      games: [],
      team1Wins: 2,
      team2Wins: 1,
    });
    expect(formatCasualSeriesScoreLine(statistics, 'A', 'B')).toContain('A 2–1 B');
  });
});

describe('box cricket plugin', () => {
  it('registers plugin and sorts by NRR', () => {
    expect(getSportPlugin('boxCricket')).toBe(BoxCricketPlugin);
    const teams = [
      { id: 1, name: 'A', emoji: '🏏' },
      { id: 2, name: 'B', emoji: '🏏' },
    ];
    const fixtures = [{
      completed: true,
      team1: teams[0],
      team2: teams[1],
      score1: 60,
      score2: 50,
      statistics: buildBoxCricketMatchStatistics({
        team1: teams[0],
        team2: teams[1],
        innings1: { runs: 60, wickets: 2, overs: 6 },
        innings2: { runs: 50, wickets: 4, overs: 6 },
        ruleConfig: {},
      }),
    }];
    const table = calculateBoxCricketStandings(teams, fixtures, {});
    expect(table[0].name).toBe('A');
    expect(table[0].netRunRate).toBeGreaterThan(table[1].netRunRate);
  });
});
