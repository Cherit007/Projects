import { buildHomeNarratives } from '../utils/homeNarratives';

describe('home narrative builder', () => {
  it('builds streak, rivalry, form, and upset narrative blocks from mixed data', () => {
    const tournamentHistory = [
      {
        name: 'Spring Smash',
        date: '2026-03-01',
        fixtures: [
          {
            completed: true,
            score1: 21,
            score2: 17,
            team1: { name: 'Falcons', player1: 'Alice', player2: 'Ben' },
            team2: { name: 'Comets', player1: 'Cara', player2: 'Dev' },
          },
          {
            completed: true,
            score1: 21,
            score2: 14,
            team1: { name: 'Falcons', player1: 'Alice', player2: 'Ben' },
            team2: { name: 'Comets', player1: 'Cara', player2: 'Dev' },
          },
        ],
      },
    ];

    const casualMatches = [
      {
        date: '2026-03-02T08:00:00.000Z',
        score1: 15,
        score2: 21,
        team1: { player1: 'Alice', player2: 'Ben' },
        team2: { player1: 'Cara', player2: 'Dev' },
      },
    ];

    const eloLeaderboard = [
      {
        name: 'Alice',
        rating: 1220,
        history: [{ change: 8 }, { change: 12 }, { change: -4 }, { change: 9 }],
      },
      {
        name: 'Cara',
        rating: 1140,
        history: [{ change: -6 }, { change: -4 }, { change: 2 }],
      },
    ];

    const playerRatings = {
      Alice: { rating: 1320 },
      Ben: { rating: 1300 },
      Cara: { rating: 980 },
      Dev: { rating: 970 },
    };

    const activeLiveTournaments = [
      {
        name: 'Tonight Live',
        fixtures: [
          {
            completed: false,
            team1: { name: 'Falcons', player1: 'Alice', player2: 'Ben' },
            team2: { name: 'Rockets', player1: 'Cara', player2: 'Dev' },
          },
        ],
      },
    ];

    const result = buildHomeNarratives({
      tournamentHistory,
      casualMatches,
      eloLeaderboard,
      playerRatings,
      activeLiveTournaments,
    });

    expect(result.streakLeaders.length).toBeGreaterThan(0);
    expect(result.streakLeaders.some((entry) => entry.name === 'Alice')).toBe(true);

    expect(result.rivalries.length).toBeGreaterThan(0);
    expect(result.rivalries[0].games).toBeGreaterThanOrEqual(2);

    expect(result.formWatch.length).toBeGreaterThan(0);
    expect(result.formWatch[0]).toHaveProperty('name');
    expect(result.formWatch[0]).toHaveProperty('delta');

    expect(result.upsetWatch.length).toBeGreaterThan(0);
    expect(result.upsetWatch[0].matchup).toContain('vs');
    expect(result.upsetWatch[0].underdogProbability).toBeLessThanOrEqual(0.45);
  });
});

