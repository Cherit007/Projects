import { predictMatchOutcome, getUpsetAlert } from '@fixture-maker/domain/predictions';

describe('match predictions', () => {
  it('predicts stronger team as favorite using ELO + form + H2H', () => {
    const match = {
      team1: { name: 'Falcons', player1: 'Alex', player2: 'Ben' },
      team2: { name: 'Sharks', player1: 'Cara', player2: 'Dina' },
    };

    const playerRatings = {
      Alex: {
        rating: 1120,
        history: [
          { result: 'win', change: 12, newRating: 1090, date: '2026-02-20T10:00:00.000Z' },
          { result: 'win', change: 10, newRating: 1100, date: '2026-02-22T10:00:00.000Z' },
        ],
      },
      Ben: {
        rating: 1100,
        history: [
          { result: 'win', change: 9, newRating: 1088, date: '2026-02-20T10:00:00.000Z' },
        ],
      },
      Cara: {
        rating: 995,
        history: [{ result: 'loss', change: -8, newRating: 1002, date: '2026-02-21T10:00:00.000Z' }],
      },
      Dina: {
        rating: 990,
        history: [{ result: 'loss', change: -6, newRating: 996, date: '2026-02-21T10:00:00.000Z' }],
      },
    };

    const tournamentHistory = [
      {
        fixtures: [
          {
            id: 1,
            completed: true,
            team1: { player1: 'Alex', player2: 'Ben' },
            team2: { player1: 'Cara', player2: 'Dina' },
            score1: 21,
            score2: 15,
          },
        ],
      },
    ];

    const prediction = predictMatchOutcome({
      match,
      playerRatings,
      tournamentHistory,
      casualMatches: [],
    });

    expect(prediction.favorite).toBe('team1');
    expect(prediction.team1Probability).toBeGreaterThan(0.65);
    expect(prediction.h2h.sampleSize).toBe(1);
  });

  it('raises upset alert when underdog leads', () => {
    const prediction = {
      team1Probability: 0.72,
      team2Probability: 0.28,
      upsetThreshold: 0.4,
    };

    const alert = getUpsetAlert({
      prediction,
      score1: '15',
      score2: '21',
      team1Name: 'Fav Team',
      team2Name: 'Underdogs',
    });

    expect(alert).toBeTruthy();
    expect(alert.title).toContain('Upset');
    expect(alert.message).toContain('Underdogs');
  });

  it('does not raise upset alert when favorite leads', () => {
    const prediction = {
      team1Probability: 0.72,
      team2Probability: 0.28,
      upsetThreshold: 0.4,
    };

    const alert = getUpsetAlert({
      prediction,
      score1: '21',
      score2: '15',
      team1Name: 'Fav Team',
      team2Name: 'Underdogs',
    });

    expect(alert).toBeNull();
  });
});
