import { describe, expect, it } from 'vitest';
import { buildDashboardDerivedData } from '../utils/dashboardAnalytics';

describe('buildDashboardDerivedData sport scope', () => {
  const badmintonCasual = {
    sportId: 'badminton',
    completed: true,
    score1: 21,
    score2: 16,
    team1: { player1: 'Alice', player2: 'Amy' },
    team2: { player1: 'Bob', player2: 'Ben' },
  };

  const boxCricketCasual = {
    sportId: 'boxCricket',
    completed: true,
    score1: 45,
    score2: 38,
    team1: { name: 'Red', player1: 'Carol' },
    team2: { name: 'Blue', player1: 'Dave' },
  };

  it('derives ELO only from matches in the selected sport', () => {
    const global = buildDashboardDerivedData({
      tournamentHistory: [],
      casualMatches: [badmintonCasual, boxCricketCasual],
      playerRatings: {
        Alice: { rating: 1200, matchesPlayed: 5, history: [{}] },
        Carol: { rating: 1100, matchesPlayed: 3, history: [{}] },
      },
    });

    const badmintonScoped = buildDashboardDerivedData({
      tournamentHistory: [],
      casualMatches: [badmintonCasual, boxCricketCasual],
      playerRatings: {
        Alice: { rating: 1200, matchesPlayed: 5, history: [{}] },
        Carol: { rating: 1100, matchesPlayed: 3, history: [{}] },
      },
      sportId: 'badminton',
    });

    const boxCricketScoped = buildDashboardDerivedData({
      tournamentHistory: [],
      casualMatches: [badmintonCasual, boxCricketCasual],
      playerRatings: {
        Alice: { rating: 1200, matchesPlayed: 5, history: [{}] },
      },
      sportId: 'boxCricket',
    });

    expect(global.eloLeaderboard.map((entry) => entry.name)).toContain('Alice');
    expect(badmintonScoped.eloLeaderboard.map((entry) => entry.name)).toContain('Alice');
    expect(badmintonScoped.eloLeaderboard.map((entry) => entry.name)).not.toContain('Carol');
    expect(boxCricketScoped.eloLeaderboard).toEqual([]);
    expect(boxCricketScoped.cumulativeAllTimeStats.length).toBeGreaterThan(0);
  });
});
