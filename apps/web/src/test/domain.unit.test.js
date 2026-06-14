// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  generateFixtures,
  generateKnockoutBracket,
  FixtureEngine,
} from '@fixture-maker/domain/fixture';
import {
  calculatePointsTable,
  calculateNewElo,
  ScoringEngine,
} from '@fixture-maker/domain/scoring';
import { calculatePlayerStats } from '@fixture-maker/domain/stats';
import { predictMatchOutcome } from '@fixture-maker/domain/predictions';
import { buildAiMatchSummary } from '@fixture-maker/domain/narrative';
import { calculatePlayerStats, calculateCumulativePlayerStats } from '@fixture-maker/domain/stats';
import {
  DEFAULT_SPORT_ID,
  getSport,
  listSports,
  getSportScoringConfig,
  getSportPlugin,
  BadmintonPlugin,
  PickleballPlugin,
} from '@fixture-maker/domain/sports';

const createTeams = (count) =>
  Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    name: `Team ${index + 1}`,
    emoji: '🏸',
    player1: `P${index + 1}A`,
    player2: `P${index + 1}B`,
  }));

describe('FixtureEngine', () => {
  it('dispatches league generation by tournament format', () => {
    const teams = createTeams(4);
    const result = FixtureEngine.generateFixturesByFormat(teams, {
      tournamentFormat: 'league',
      format: '1',
    });

    expect(result.kind).toBe('league');
    expect(result.fixtures).toHaveLength(6);
    expect(result.bracket).toBeUndefined();
  });

  it('dispatches knockout generation by format variant', () => {
    const teams = createTeams(3);
    const result = FixtureEngine.generateFixturesByFormat(teams, {
      tournamentFormat: 'knockout',
      format: 'playInFinal',
    });

    expect(result.kind).toBe('knockout');
    expect(result.bracket).toHaveLength(2);
    expect(result.fixtures).toBeUndefined();
  });
});

describe('ScoringEngine config', () => {
  it('uses configurable pointsPerWin for standings', () => {
    const teams = createTeams(2);
    const fixtures = [
      {
        completed: true,
        team1: teams[0],
        team2: teams[1],
        score1: 21,
        score2: 18,
      },
    ];

    const table = calculatePointsTable(teams, fixtures, { pointsPerWin: 3 });
    expect(table[0].points).toBe(3);
    expect(table[1].points).toBe(0);
  });

  it('uses configurable kFactor for ELO updates', () => {
    const withDefaultK = calculateNewElo(1000, 1000, 1);
    const withLowK = calculateNewElo(1000, 1000, 1, { kFactor: 8 });

    expect(withLowK).toBe(1004);
    expect(withDefaultK).toBe(1016);
  });

  it('exposes badminton defaults on ScoringEngine', () => {
    expect(ScoringEngine.config.pointsPerWin).toBe(2);
    expect(ScoringEngine.config.kFactor).toBe(32);
  });
});

describe('Phase 2.3 domain modules', () => {
  it('calculates per-tournament player stats', () => {
    const teams = createTeams(2);
    const fixtures = [
      {
        completed: true,
        team1: teams[0],
        team2: teams[1],
        score1: 21,
        score2: 18,
      },
    ];

    const stats = calculatePlayerStats(teams, fixtures);
    expect(stats).toHaveLength(4);
    expect(stats[0].matchesWon).toBeGreaterThan(0);
  });

  it('predicts match outcomes from domain predictions module', () => {
    const prediction = predictMatchOutcome({
      match: {
        team1: { player1: 'Amy', player2: 'Bob' },
        team2: { player1: 'Cara', player2: 'Dan' },
      },
      playerRatings: {
        Amy: { rating: 1100, history: [] },
        Bob: { rating: 1100, history: [] },
        Cara: { rating: 1000, history: [] },
        Dan: { rating: 1000, history: [] },
      },
    });

    expect(prediction.favorite).toBe('team1');
  });

  it('builds AI match summaries from domain narrative module', () => {
    const summary = buildAiMatchSummary({
      match: {
        id: 1,
        round: 1,
        team1: { name: 'A' },
        team2: { name: 'B' },
        score1: 21,
        score2: 19,
      },
    });

    expect(summary?.title).toContain('A def. B');
  });
});

describe('domain re-exports parity', () => {
  it('generateFixtures matches league path on FixtureEngine', () => {
    const teams = createTeams(4);
    expect(generateFixtures(teams, '1')).toEqual(
      FixtureEngine.generateLeagueFixtures(teams, '1')
    );
  });

  it('generateKnockoutBracket matches knockout path on FixtureEngine', () => {
    const teams = createTeams(5);
    const bracket = generateKnockoutBracket(teams, 'knockoutByes');
    expect(bracket).toHaveLength(3);
  });
});

describe('Sport registry', () => {
  it('defaults to badminton', () => {
    expect(DEFAULT_SPORT_ID).toBe('badminton');
    expect(getSport().id).toBe('badminton');
    expect(getSport('unknown').id).toBe('badminton');
  });

  it('lists all registered sports', () => {
    const sports = listSports();
    expect(sports.map((sport) => sport.id)).toEqual(['badminton', 'pickleball', 'boxCricket']);
    expect(sports.find((sport) => sport.id === 'pickleball')?.available).toBe(true);
    expect(sports.find((sport) => sport.id === 'badminton')?.available).toBe(true);
  });

  it('exposes sport-specific scoring and modes', () => {
    expect(getSportScoringConfig('badminton').quickScores).toEqual([21, 15, 11]);
    expect(getSportScoringConfig('pickleball').quickScores).toEqual([11, 15, 21]);
    expect(getSport('pickleball').gameModes.map((mode) => mode.value)).toEqual(['doubles', 'singles', 'mixed']);
    expect(getSport('boxCricket').participantModel).toBe('squad');
    expect(getSport('boxCricket').available).toBe(true);
  });
});

describe('Sport plugins', () => {
  it('resolves badminton plugin by default', () => {
    expect(getSportPlugin('unknown').id).toBe('badminton');
    expect(getSportPlugin('badminton')).toBe(BadmintonPlugin);
  });

  it('matches legacy standings output for badminton', () => {
    const teams = createTeams(2);
    const fixtures = [{
      completed: true,
      team1: teams[0],
      team2: teams[1],
      score1: 21,
      score2: 18,
    }];
    const legacy = calculatePointsTable(teams, fixtures);
    const plugin = getSportPlugin('badminton').scoring.calculatePointsTable(teams, fixtures);
    expect(plugin).toEqual(legacy);
  });

  it('resolves pickleball plugin and validates scores', () => {
    expect(getSportPlugin('pickleball')).toBe(PickleballPlugin);
    const validator = PickleballPlugin.scoring.validateMatchScore;
    expect(validator(11, 9, {})).toEqual({ valid: true });
    expect(validator(11, 10, {}).valid).toBe(false);
  });
});
