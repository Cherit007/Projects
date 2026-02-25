import { buildAiMatchSummary, detectNewlyUnlockedBadges } from '../utils/matchSummary';

describe('matchSummary utils', () => {
  it('detects newly unlocked badges only', () => {
    const beforeBadges = [
      { id: 'wins-100', title: '100 Wins', earned: false },
      { id: 'elo-1200', title: 'ELO 1200 Club', earned: true },
    ];
    const afterBadges = [
      { id: 'wins-100', title: '100 Wins', earned: true, icon: '💯' },
      { id: 'elo-1200', title: 'ELO 1200 Club', earned: true, icon: '📈' },
    ];

    const unlocks = detectNewlyUnlockedBadges(beforeBadges, afterBadges);

    expect(unlocks).toEqual([
      { id: 'wins-100', title: '100 Wins', icon: '💯' },
    ]);
  });

  it('builds summary with upset and badge updates', () => {
    const summary = buildAiMatchSummary({
      match: {
        id: 'm-1',
        round: 2,
        team1: { name: 'Falcons' },
        team2: { name: 'Sharks' },
        score1: 15,
        score2: 21,
      },
      tournamentName: 'Spring Open',
      tournamentFormat: 'league',
      prediction: { favorite: 'team1' },
      upsetAlert: { title: 'Upset', message: 'Underdog won' },
      pointsTable: [
        { name: 'Sharks', points: 6 },
        { name: 'Falcons', points: 4 },
      ],
      badgeUnlocks: [{ player: 'Alex', title: '10-Match Streak', icon: '🔥' }],
      isFinal: false,
    });

    expect(summary).toBeTruthy();
    expect(summary.title).toContain('Sharks def. Falcons 15-21');
    expect(summary.narrative).toContain('Upset alert');
    expect(summary.narrative).toContain('Badge updates');
    expect(summary.narrative).toContain('Alex: 10-Match Streak');
    expect(summary.tags).toContain('Upset');
    expect(summary.tags).toContain('Badges');
  });
});
