// @vitest-environment node
import { describe, it, expect } from "vitest";
import { generateFixtures, generateKnockoutBracket } from "../utils/calculations";

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
