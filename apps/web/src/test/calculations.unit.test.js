// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  calculateCumulativePlayerStats,
  calculatePlayerStats,
} from '@fixture-maker/domain/stats';
import {
  generateFixtures,
  generateKnockoutBracket,
} from '@fixture-maker/domain/fixture';
import { getPlayerLeaderboard } from '@fixture-maker/domain/scoring';

const createTeams = (count) =>
  Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    name: `Team ${index + 1}`,
    emoji: "🏸",
    player1: `P${index + 1}A`,
    player2: `P${index + 1}B`,
  }));

const getPairKey = (teamA, teamB) =>
  [teamA.id, teamB.id].sort((a, b) => a - b).join("-");

describe("generateFixtures", () => {
  it("creates a proper single round-robin schedule for even teams", () => {
    const teams = createTeams(4);
    const fixtures = generateFixtures(teams, "1");

    expect(fixtures).toHaveLength(6);
    expect(new Set(fixtures.map((m) => m.round))).toEqual(new Set([1, 2, 3]));

    const matchesByRound = fixtures.reduce((acc, match) => {
      acc[match.round] = acc[match.round] || [];
      acc[match.round].push(match);
      return acc;
    }, {});

    Object.values(matchesByRound).forEach((roundMatches) => {
      expect(roundMatches).toHaveLength(2);
      const teamsInRound = roundMatches.flatMap((m) => [m.team1.id, m.team2.id]);
      expect(new Set(teamsInRound).size).toBe(4);
    });

    const uniquePairs = new Set(
      fixtures.map((m) => getPairKey(m.team1, m.team2))
    );
    expect(uniquePairs.size).toBe(6);
  });

  it("handles odd team counts by distributing byes and still scheduling all pairs once", () => {
    const teams = createTeams(5);
    const fixtures = generateFixtures(teams, "1");

    expect(fixtures).toHaveLength(10);
    expect(new Set(fixtures.map((m) => m.round))).toEqual(new Set([1, 2, 3, 4, 5]));

    const matchesByRound = fixtures.reduce((acc, match) => {
      acc[match.round] = acc[match.round] || [];
      acc[match.round].push(match);
      return acc;
    }, {});

    Object.values(matchesByRound).forEach((roundMatches) => {
      expect(roundMatches).toHaveLength(2);
    });

    const teamAppearances = fixtures.reduce((acc, match) => {
      acc[match.team1.id] = (acc[match.team1.id] || 0) + 1;
      acc[match.team2.id] = (acc[match.team2.id] || 0) + 1;
      return acc;
    }, {});

    teams.forEach((team) => {
      expect(teamAppearances[team.id]).toBe(4);
    });

    const uniquePairs = new Set(
      fixtures.map((m) => getPairKey(m.team1, m.team2))
    );
    expect(uniquePairs.size).toBe(10);
  });

  it("creates two full cycles for 2 matches per pair", () => {
    const teams = createTeams(4);
    const fixtures = generateFixtures(teams, "2");

    expect(fixtures).toHaveLength(12);
    expect(Math.max(...fixtures.map((m) => m.round))).toBe(6);

    const pairCounts = fixtures.reduce((acc, match) => {
      const key = getPairKey(match.team1, match.team2);
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    Object.values(pairCounts).forEach((count) => {
      expect(count).toBe(2);
    });
  });
});

describe("generateKnockoutBracket", () => {
  it("creates 3-team play-in + final bracket", () => {
    const teams = createTeams(3);
    const bracket = generateKnockoutBracket(teams, "playInFinal");

    expect(bracket).toHaveLength(2);
    expect(bracket[0]).toHaveLength(1);
    expect(bracket[1]).toHaveLength(1);

    const playInMatch = bracket[0][0];
    const finalMatch = bracket[1][0];

    expect(playInMatch.round).toBe("playin");
    expect(playInMatch.nextMatchId).toBe(finalMatch.id);
    expect(playInMatch.team1).toBeTruthy();
    expect(playInMatch.team2).toBeTruthy();

    expect(finalMatch.round).toBe("final");
    expect(finalMatch.team1).toBeTruthy();
    expect(finalMatch.team2).toBeNull();
    expect(finalMatch.completed).toBe(false);
  });

  it("creates knockout bracket with byes for non-power-of-two team counts", () => {
    const teams = createTeams(5);
    const bracket = generateKnockoutBracket(teams, "knockoutByes");

    expect(bracket).toHaveLength(3);
    expect(bracket[0]).toHaveLength(4);
    expect(bracket[1]).toHaveLength(2);
    expect(bracket[2]).toHaveLength(1);

    const firstRound = bracket[0];
    const completedByes = firstRound.filter((m) => m.completed);
    expect(completedByes.length).toBe(3);
    completedByes.forEach((match) => {
      expect(Boolean(match.team1) !== Boolean(match.team2)).toBe(true);
    });

    const playMatch = firstRound.find((m) => !m.completed);
    expect(playMatch).toBeTruthy();
    expect(playMatch.team1).toBeTruthy();
    expect(playMatch.team2).toBeTruthy();
  });
});

describe("leaderboard/stat sorting stability", () => {
  it("uses deterministic tie-breaks for ELO leaderboard", () => {
    const leaderboard = getPlayerLeaderboard({
      Zara: { rating: 1100, matchesPlayed: 5, history: [] },
      Amy: { rating: 1100, matchesPlayed: 5, history: [] },
      Ben: { rating: 1100, matchesPlayed: 6, history: [] },
    });

    expect(leaderboard.map((entry) => entry.name)).toEqual(["Ben", "Amy", "Zara"]);
  });

  it("keeps player stats ordering stable on ties", () => {
    const fixtures = [
      {
        completed: true,
        team1: { id: 1, name: "Team A", emoji: "🏸", player1: "Amy", player2: "Bob" },
        team2: { id: 2, name: "Team B", emoji: "🏸", player1: "Cara", player2: "Dan" },
        score1: 21,
        score2: 18,
      },
      {
        completed: true,
        team1: { id: 3, name: "Team C", emoji: "🏸", player1: "Eli", player2: "Finn" },
        team2: { id: 4, name: "Team D", emoji: "🏸", player1: "Gio", player2: "Hana" },
        score1: 21,
        score2: 18,
      },
    ];
    const teams = [
      { id: 1, name: "Team A", emoji: "🏸", player1: "Amy", player2: "Bob" },
      { id: 2, name: "Team B", emoji: "🏸", player1: "Cara", player2: "Dan" },
      { id: 3, name: "Team C", emoji: "🏸", player1: "Eli", player2: "Finn" },
      { id: 4, name: "Team D", emoji: "🏸", player1: "Gio", player2: "Hana" },
    ];

    const stats = calculatePlayerStats(teams, fixtures);
    expect(stats[0].name).toBe("Amy");
    expect(stats[1].name).toBe("Bob");
  });

  it("keeps cumulative stats ordering stable on full ties", () => {
    const history = [
      {
        id: "t-1",
        fixtures: [
          {
            completed: true,
            team1: { player1: "Amy", player2: "Bob" },
            team2: { player1: "Cara", player2: "Dan" },
            score1: 21,
            score2: 18,
          },
        ],
      },
      {
        id: "t-2",
        fixtures: [
          {
            completed: true,
            team1: { player1: "Cara", player2: "Dan" },
            team2: { player1: "Amy", player2: "Bob" },
            score1: 21,
            score2: 18,
          },
        ],
      },
    ];

    const stats = calculateCumulativePlayerStats(history);
    expect(stats.map((entry) => entry.name).slice(0, 2)).toEqual(["Amy", "Bob"]);
  });

  it("includes box cricket casual matches with squad players and batting stats", () => {
    const stats = calculateCumulativePlayerStats({
      tournamentHistory: [],
      casualMatches: [{
        sportId: "boxCricket",
        completedAt: "2026-06-01T12:00:00.000Z",
        winner: "team1",
        team1: {
          id: 1,
          name: "Aces",
          squad: [{ id: "p1", name: "Alex" }, { id: "p2", name: "Ben" }],
        },
        team2: {
          id: 2,
          name: "Blaze",
          squad: [{ id: "p9", name: "Chris" }],
        },
        score1: 45,
        score2: 42,
        statistics: {
          sportId: "boxCricket",
          format: "casualSeries",
          teams: {
            team1: { id: 1, name: "Aces", squad: [{ id: "p1", name: "Alex" }, { id: "p2", name: "Ben" }] },
            team2: { id: 2, name: "Blaze", squad: [{ id: "p9", name: "Chris" }] },
          },
          series: {
            format: "single",
            winnerTeamId: 1,
            games: [{
              gameNo: 1,
              score1: 45,
              score2: 42,
              winnerTeamId: 1,
              statistics: {
                sportId: "boxCricket",
                scoringMode: "ballByBall",
                oversLimit: 6,
                innings: [
                  {
                    battingTeamId: 1,
                    bowlingTeamId: 2,
                    runs: 45,
                    wickets: 2,
                    overs: 6,
                    ballLog: [{ kind: "runs", runs: 10, strikerId: "p1", nonStrikerId: "p2", bowlerId: "p9" }],
                  },
                  {
                    battingTeamId: 2,
                    bowlingTeamId: 1,
                    runs: 42,
                    wickets: 3,
                    overs: 6,
                    ballLog: [{ kind: "runs", runs: 4, strikerId: "p9", nonStrikerId: "p10", bowlerId: "p2" }],
                  },
                ],
                result: { winnerTeamId: 1 },
              },
            }],
          },
        },
      }],
    });

    expect(stats.find((entry) => entry.name === "Alex")).toMatchObject({
      matchesPlayed: 1,
      matchesWon: 1,
      cricketRuns: 10,
    });
    expect(stats.find((entry) => entry.name === "Chris")).toMatchObject({
      matchesPlayed: 1,
      matchesWon: 0,
      cricketRuns: 4,
    });
  });

  it("includes casual matches in cumulative all-time stats without inflating tournament counts", () => {
    const stats = calculateCumulativePlayerStats({
      tournamentHistory: [
        {
          id: "t-1",
          fixtures: [
            {
              completed: true,
              team1: { player1: "Amy", player2: "Bob" },
              team2: { player1: "Cara", player2: "Dan" },
              score1: 21,
              score2: 18,
            },
          ],
          bracket: [],
          finalMatch: null,
        },
      ],
      casualMatches: [
        {
          completed: true,
          team1: { player1: "Amy", player2: "" },
          team2: { player1: "Eli", player2: "" },
          score1: 21,
          score2: 16,
        },
      ],
    });

    const amy = stats.find((entry) => entry.name === "Amy");
    const eli = stats.find((entry) => entry.name === "Eli");

    expect(amy).toMatchObject({
      matchesPlayed: 2,
      matchesWon: 2,
      tournamentsPlayed: 1,
    });
    expect(eli).toMatchObject({
      matchesPlayed: 1,
      matchesWon: 0,
      tournamentsPlayed: 0,
    });
  });

  it('drops stats for casual matches removed from history (delete simulation)', () => {
    const match = {
      completed: true,
      team1: { player1: 'Amy', player2: '' },
      team2: { player1: 'Eli', player2: '' },
      score1: 21,
      score2: 16,
    };
    const withMatch = calculateCumulativePlayerStats({ tournamentHistory: [], casualMatches: [match] });
    const withoutMatch = calculateCumulativePlayerStats({ tournamentHistory: [], casualMatches: [] });
    expect(withMatch.find((entry) => entry.name === 'Eli')?.matchesPlayed).toBe(1);
    expect(withoutMatch.find((entry) => entry.name === 'Eli')).toBeUndefined();
  });
});
