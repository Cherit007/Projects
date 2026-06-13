import {
  buildLiveTopTwoWatch,
  getTeamQualificationStatus,
} from '../utils/qualificationScenarios';

const currentMatch = {
  id: 1,
  completed: false,
  team1: { id: 'rovers', name: 'Rovers' },
  team2: { id: 'blues', name: 'Blues' },
};

const standings = [
  {
    id: 'champions',
    name: 'Champions',
    points: 6,
    played: 3,
    won: 3,
    lost: 0,
    scoreFor: 63,
    scoreAgainst: 55,
    scoreDiff: 8,
    netMatchRate: 8 / 3,
  },
  {
    id: 'aces',
    name: 'Aces',
    points: 4,
    played: 2,
    won: 2,
    lost: 0,
    scoreFor: 45,
    scoreAgainst: 40,
    scoreDiff: 5,
    netMatchRate: 2.5,
  },
  {
    id: 'rovers',
    name: 'Rovers',
    points: 2,
    played: 1,
    won: 1,
    lost: 0,
    scoreFor: 18,
    scoreAgainst: 20,
    scoreDiff: -2,
    netMatchRate: -2,
  },
  {
    id: 'blues',
    name: 'Blues',
    points: 0,
    played: 2,
    won: 0,
    lost: 2,
    scoreFor: 30,
    scoreAgainst: 42,
    scoreDiff: -12,
    netMatchRate: -6,
  },
];

describe('qualification scenarios', () => {
  it('shows the minimum winning margin needed to reach Top 2 during a live match', () => {
    const watch = buildLiveTopTwoWatch({
      standings,
      currentMatch,
      nextMatches: [],
    });

    expect(watch.headline).toBe('Win = 2 league pts; margin decides tie-breaks');
    expect(watch.lines[0]).toContain('Rovers: #3 with 2 pts');
    expect(watch.lines[0]).toContain('win by 8+ to reach Top 2 now');
    expect(watch.lines[1]).toBe('Blues: out of Top 2 reach on league points.');
  });

  it('projects typed live scores into Top 2 guidance', () => {
    const watch = buildLiveTopTwoWatch({
      standings,
      currentMatch,
      nextMatches: [],
      score1: '21',
      score2: '13',
    });

    expect(watch.headline).toBe('Rovers by 8 -> projected #2');
    expect(watch.lines[0]).toBe('Rovers: projected Top 2 (#2), not qualified yet.');
    expect(watch.lines[1]).toBe('Blues: projected out of Top 2 reach on league points.');
  });

  it('separates qualified teams from teams that are out', () => {
    expect(getTeamQualificationStatus({
      team: standings[0],
      standings,
      remainingMatches: [],
      rank: 1,
    }).label).toBe('Qualified');

    expect(getTeamQualificationStatus({
      team: standings[2],
      standings,
      remainingMatches: [],
      rank: 3,
    }).label).toBe('Out');
  });
});
