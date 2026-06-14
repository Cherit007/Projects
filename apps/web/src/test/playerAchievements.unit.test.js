import { buildPlayerAchievements } from '../utils/playerAchievements';

describe('buildPlayerAchievements', () => {
  it('unlocks milestones based on ratings history and finals data', () => {
    const history = [];
    for (let i = 0; i < 105; i += 1) {
      const isWin = i < 100 || i % 2 === 0;
      history.push({
        result: isWin ? 'win' : 'loss',
        change: isWin ? 12 : -7,
        date: new Date(2026, 0, i + 1).toISOString(),
      });
    }

    const playerRatings = {
      Alex: { rating: 1200, matchesPlayed: 105, history },
    };

    const tournamentHistory = [
      {
        id: 1,
        date: '2026-02-01T10:00:00.000Z',
        finalMatch: {
          id: 'f1',
          team1: { player1: 'Alex', player2: 'Ben' },
          team2: { player1: 'Cara', player2: 'Dina' },
          score1: 21,
          score2: 18,
          completed: true,
        },
      },
      {
        id: 2,
        date: '2026-02-08T10:00:00.000Z',
        finalMatch: {
          id: 'f2',
          team1: { player1: 'Alex', player2: 'Ben' },
          team2: { player1: 'Cara', player2: 'Dina' },
          score1: 17,
          score2: 21,
          completed: true,
        },
      },
      {
        id: 3,
        date: '2026-02-15T10:00:00.000Z',
        finalMatch: {
          id: 'f3',
          team1: { player1: 'Alex', player2: 'Ben' },
          team2: { player1: 'Cara', player2: 'Dina' },
          score1: 21,
          score2: 19,
          completed: true,
        },
      },
    ];

    const achievements = buildPlayerAchievements({
      playerName: 'Alex',
      playerRatings,
      tournamentHistory,
      casualMatches: [],
    });

    expect(achievements.totalWins).toBeGreaterThanOrEqual(100);
    expect(achievements.longestWinStreak).toBeGreaterThanOrEqual(10);
    expect(achievements.giantKillerWins).toBeGreaterThanOrEqual(3);
    expect(achievements.finalsPlayed).toBe(3);
    expect(achievements.finalsWins).toBe(2);

    const byId = Object.fromEntries(achievements.badges.map(b => [b.id, b]));
    expect(byId['wins-100'].earned).toBe(true);
    expect(byId['streak-10'].earned).toBe(true);
    expect(byId['giant-killer'].earned).toBe(true);
    expect(byId['final-specialist'].earned).toBe(true);
    expect(byId['elo-1200'].earned).toBe(true);
    expect(byId['consistency-pro'].earned).toBe(true);
    expect(byId['clutch-finisher'].earned).toBe(false);
    expect(byId['marathon-player'].earned).toBe(false);
  });

  it('returns locked badges for new players', () => {
    const achievements = buildPlayerAchievements({
      playerName: 'Newbie',
      playerRatings: { Newbie: { rating: 1000, matchesPlayed: 0, history: [] } },
      tournamentHistory: [],
      casualMatches: [],
    });

    expect(achievements.badges.every(badge => badge.earned === false)).toBe(true);
    expect(achievements.totalWins).toBe(0);
    expect(achievements.longestWinStreak).toBe(0);
    expect(achievements.badges.every(badge => badge.icon)).toBe(true);
  });
});
