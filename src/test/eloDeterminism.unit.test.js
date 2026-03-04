// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { deriveRatingsFromHistory } from '../utils/appHelpers';

const match = ({
  id,
  date,
  team1,
  team2,
  score1,
  score2,
}) => ({
  id,
  completed: true,
  date,
  team1,
  team2,
  score1,
  score2,
});

describe('elo determinism', () => {
  it('produces identical ratings regardless of tournament/casual list order', () => {
    const t1 = {
      id: 't1',
      date: '2026-03-01T09:00:00.000Z',
      fixtures: [
        match({
          id: 'm1',
          date: '2026-03-01T09:10:00.000Z',
          team1: { player1: 'Amy', player2: 'Bob' },
          team2: { player1: 'Cara', player2: 'Dan' },
          score1: 21,
          score2: 18,
        }),
      ],
      bracket: [],
      finalMatch: null,
    };

    const t2 = {
      id: 't2',
      date: '2026-03-02T09:00:00.000Z',
      fixtures: [
        match({
          id: 'm2',
          date: '2026-03-02T09:10:00.000Z',
          team1: { player1: 'Cara', player2: 'Dan' },
          team2: { player1: 'Amy', player2: 'Bob' },
          score1: 21,
          score2: 19,
        }),
      ],
      bracket: [],
      finalMatch: null,
    };

    const casualOlder = match({
      id: 'c1',
      date: '2026-03-03T09:00:00.000Z',
      team1: { player1: 'Amy', player2: '' },
      team2: { player1: 'Cara', player2: '' },
      score1: 21,
      score2: 17,
    });
    const casualNewer = match({
      id: 'c2',
      date: '2026-03-04T09:00:00.000Z',
      team1: { player1: 'Dan', player2: '' },
      team2: { player1: 'Bob', player2: '' },
      score1: 21,
      score2: 15,
    });

    const resultA = deriveRatingsFromHistory({
      history: [t1, t2],
      casual: [casualOlder, casualNewer],
    });
    const resultB = deriveRatingsFromHistory({
      history: [t2, t1],
      casual: [casualNewer, casualOlder],
    });

    const simplify = (ratings) => Object.fromEntries(
      Object.entries(ratings || {}).map(([playerName, snapshot]) => [
        playerName,
        {
          rating: snapshot?.rating,
          matchesPlayed: snapshot?.matchesPlayed,
          deltas: (snapshot?.history || []).map((entry) => Number(entry?.change || 0)),
        },
      ])
    );

    expect(simplify(resultA)).toEqual(simplify(resultB));
  });
});
