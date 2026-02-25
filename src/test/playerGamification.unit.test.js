import { buildPlayerGamification } from '../utils/playerGamification';

describe('buildPlayerGamification', () => {
  it('calculates XP with match, upset, and streak bonuses', () => {
    const tournamentHistory = [
      {
        date: '2026-02-01T10:00:00.000Z',
        fixtures: [
          {
            id: 'm1',
            completed: true,
            team1: { player1: 'Alex', player2: 'Ben' },
            team2: { player1: 'Cara', player2: 'Dina' },
            score1: 21,
            score2: 18,
          },
          {
            id: 'm2',
            completed: true,
            team1: { player1: 'Alex', player2: 'Ben' },
            team2: { player1: 'Cara', player2: 'Dina' },
            score1: 21,
            score2: 19,
            upsetAlert: { title: 'Upset' },
          },
          {
            id: 'm3',
            completed: true,
            team1: { player1: 'Alex', player2: 'Ben' },
            team2: { player1: 'Cara', player2: 'Dina' },
            score1: 22,
            score2: 20,
          },
          {
            id: 'm4',
            completed: true,
            team1: { player1: 'Alex', player2: 'Ben' },
            team2: { player1: 'Cara', player2: 'Dina' },
            score1: 17,
            score2: 21,
          },
        ],
      },
    ];

    const result = buildPlayerGamification({
      playerName: 'Alex',
      tournamentHistory,
      casualMatches: [],
    });

    expect(result.matchesPlayed).toBe(4);
    expect(result.wins).toBe(3);
    expect(result.upsetWins).toBe(1);
    expect(result.streakBonusMatches).toBe(1);
    expect(result.totalXp).toBe(72);
    expect(result.level.name).toBe('Beginner');
  });

  it('moves player to higher levels based on accumulated XP', () => {
    const fixtures = Array.from({ length: 20 }, (_, index) => ({
      id: `m-${index + 1}`,
      completed: true,
      team1: { player1: 'Alex', player2: 'Ben' },
      team2: { player1: 'Cara', player2: 'Dina' },
      score1: 21,
      score2: 17,
      date: `2026-02-${String(index + 1).padStart(2, '0')}T10:00:00.000Z`,
    }));

    const result = buildPlayerGamification({
      playerName: 'Alex',
      tournamentHistory: [{ fixtures }],
      casualMatches: [],
    });

    expect(result.totalXp).toBeGreaterThanOrEqual(300);
    expect(['Pro', 'Elite', 'Legend']).toContain(result.level.name);
    expect(result.progressPercent).toBeGreaterThan(0);
  });
});
