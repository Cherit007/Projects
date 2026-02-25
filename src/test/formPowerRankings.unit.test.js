import { buildFormPowerRankings } from '../utils/formPowerRankings';

describe('buildFormPowerRankings', () => {
  it('computes form, trends, weighted ELO and period leaderboards', () => {
    const now = Date.now();
    const daysAgo = (n) => new Date(now - n * 24 * 60 * 60 * 1000).toISOString();

    const playerRatings = {
      Alex: {
        rating: 1080,
        matchesPlayed: 8,
        history: [
          { result: 'win', change: 11, newRating: 1020, date: daysAgo(20) },
          { result: 'win', change: 10, newRating: 1030, date: daysAgo(9) },
          { result: 'loss', change: -8, newRating: 1022, date: daysAgo(6) },
          { result: 'win', change: 12, newRating: 1034, date: daysAgo(3) },
          { result: 'win', change: 14, newRating: 1048, date: daysAgo(1) },
        ],
      },
      Ben: {
        rating: 1015,
        matchesPlayed: 7,
        history: [
          { result: 'loss', change: -9, newRating: 1005, date: daysAgo(25) },
          { result: 'loss', change: -8, newRating: 997, date: daysAgo(12) },
          { result: 'win', change: 10, newRating: 1007, date: daysAgo(8) },
          { result: 'loss', change: -7, newRating: 1000, date: daysAgo(2) },
        ],
      },
    };

    const rankings = buildFormPowerRankings(playerRatings);

    expect(rankings.leaderboard.length).toBe(2);
    expect(rankings.leaderboard[0].name).toBe('Alex');
    expect(rankings.leaderboard[0].last5Form).toContain('W');
    expect(rankings.leaderboard[0].weightedElo).toBeGreaterThan(1000);
    expect(['up', 'down', 'flat']).toContain(rankings.leaderboard[0].trend);

    expect(rankings.weeklyLeaderboard.length).toBeGreaterThan(0);
    expect(rankings.monthlyLeaderboard.length).toBeGreaterThanOrEqual(rankings.weeklyLeaderboard.length);

    const weeklyAlex = rankings.weeklyLeaderboard.find(item => item.name === 'Alex');
    expect(weeklyAlex).toBeTruthy();
    expect(weeklyAlex.matches).toBeGreaterThan(0);
  });

  it('returns empty-safe rankings when no players exist', () => {
    const rankings = buildFormPowerRankings({});

    expect(rankings.leaderboard).toEqual([]);
    expect(rankings.weeklyLeaderboard).toEqual([]);
    expect(rankings.monthlyLeaderboard).toEqual([]);
  });
});
