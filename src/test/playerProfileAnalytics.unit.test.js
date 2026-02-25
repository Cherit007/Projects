import { buildPlayerAdvancedProfile } from '../utils/playerProfileAnalytics';

describe('buildPlayerAdvancedProfile', () => {
  it('builds head-to-head, partner, format and venue stats', () => {
    const tournamentHistory = [
      {
        id: 1,
        name: 'North Court',
        gameMode: 'doubles',
        tournamentFormat: 'league',
        date: '2026-02-20T10:00:00.000Z',
        fixtures: [
          {
            id: 11,
            completed: true,
            team1: { player1: 'Alex', player2: 'Ben' },
            team2: { player1: 'Cara', player2: 'Dina' },
            score1: 21,
            score2: 17,
          },
          {
            id: 12,
            completed: true,
            team1: { player1: 'Alex', player2: 'Ben' },
            team2: { player1: 'Evan', player2: 'Finn' },
            score1: 16,
            score2: 21,
          },
        ],
        finalMatch: {
          id: 'f1',
          completed: true,
          team1: { player1: 'Alex', player2: 'Ben' },
          team2: { player1: 'Cara', player2: 'Dina' },
          score1: 21,
          score2: 19,
        },
      },
    ];

    const casualMatches = [
      {
        id: 'c1',
        matchType: 'singles',
        date: '2026-02-21T18:00:00.000Z',
        venue: 'Community Hall',
        team1: { player: 'Alex' },
        team2: { player: 'Gina' },
        score1: 21,
        score2: 18,
      },
    ];

    const stats = buildPlayerAdvancedProfile({
      playerName: 'Alex',
      tournamentHistory,
      casualMatches,
    });

    expect(stats.totalTrackedMatches).toBe(4);

    const benPartner = stats.preferredPartners.find(item => item.name === 'Ben');
    expect(benPartner).toBeTruthy();
    expect(benPartner.played).toBe(3);
    expect(benPartner.wins).toBe(2);

    const caraH2h = stats.headToHead.find(item => item.name === 'Cara');
    expect(caraH2h).toBeTruthy();
    expect(caraH2h.played).toBe(2);
    expect(caraH2h.wins).toBe(2);

    const doublesFormat = stats.winRateByFormat.find(item => item.name === 'Doubles');
    const casualSinglesFormat = stats.winRateByFormat.find(item => item.name === 'Casual Singles');
    expect(doublesFormat.played).toBe(3);
    expect(casualSinglesFormat.played).toBe(1);

    const venue = stats.performanceByVenue.find(item => item.name === 'North Court');
    expect(venue.played).toBe(3);

    expect(stats.performanceByVenue.length).toBeGreaterThan(0);
  });

  it('handles empty input safely', () => {
    const stats = buildPlayerAdvancedProfile({ playerName: '', tournamentHistory: [], casualMatches: [] });

    expect(stats.totalTrackedMatches).toBe(0);
    expect(stats.headToHead).toEqual([]);
    expect(stats.preferredPartners).toEqual([]);
    expect(stats.winRateByFormat).toEqual([]);
  });
});
