import { buildPairingAnalytics } from '../utils/pairingAnalytics';

describe('buildPairingAnalytics', () => {
  it('computes best doubles combos and pairing recommendations', () => {
    const tournamentHistory = [
      {
        id: 1,
        name: 'Sunday League',
        gameMode: 'doubles',
        fixtures: [
          {
            id: 1,
            completed: true,
            team1: { player1: 'Alex', player2: 'Ben' },
            team2: { player1: 'Cara', player2: 'Dina' },
            score1: 21,
            score2: 17,
          },
          {
            id: 2,
            completed: true,
            team1: { player1: 'Alex', player2: 'Ben' },
            team2: { player1: 'Evan', player2: 'Finn' },
            score1: 21,
            score2: 18,
          },
          {
            id: 3,
            completed: true,
            team1: { player1: 'Cara', player2: 'Dina' },
            team2: { player1: 'Evan', player2: 'Finn' },
            score1: 21,
            score2: 19,
          },
        ],
      },
    ];

    const casualMatches = [
      {
        id: 'c1',
        matchType: 'doubles',
        team1: { player1: 'Alex', player2: 'Ben' },
        team2: { player1: 'Cara', player2: 'Dina' },
        score1: 21,
        score2: 16,
      },
      {
        id: 'c2',
        matchType: 'doubles',
        team1: { player1: 'Alex', player2: 'Dina' },
        team2: { player1: 'Cara', player2: 'Ben' },
        score1: 18,
        score2: 21,
      },
    ];

    const playerRatings = {
      Alex: { rating: 1060 },
      Ben: { rating: 1040 },
      Cara: { rating: 1020 },
      Dina: { rating: 1000 },
      Evan: { rating: 990 },
      Finn: { rating: 985 },
    };

    const analytics = buildPairingAnalytics({ tournamentHistory, casualMatches, playerRatings });

    expect(analytics.totalDoublesMatches).toBe(5);
    expect(analytics.totalTrackedPairs).toBeGreaterThan(3);
    expect(analytics.bestCombinations.length).toBeGreaterThan(0);

    const alexBen = analytics.pairStats.find(item => item.pairLabel === 'Alex + Ben');
    expect(alexBen).toBeTruthy();
    expect(alexBen.played).toBe(3);
    expect(alexBen.wins).toBe(3);
    expect(alexBen.chemistryScore).toBeGreaterThan(70);

    expect(analytics.whoShouldPair.length).toBeGreaterThan(0);
    expect(analytics.whoShouldPair[0].recommendationScore).toBeGreaterThan(0);

    expect(Array.isArray(analytics.rotationSuggestions)).toBe(true);
  });

  it('returns empty-safe structure for no doubles data', () => {
    const analytics = buildPairingAnalytics({ tournamentHistory: [], casualMatches: [], playerRatings: {} });

    expect(analytics.totalDoublesMatches).toBe(0);
    expect(analytics.bestCombinations).toEqual([]);
    expect(analytics.whoShouldPair).toEqual([]);
    expect(analytics.rotationSuggestions).toEqual([]);
  });
});
