import { describe, it, expect } from 'vitest';
import { inferCasualMatchSportId, isBoxCricketCasualMatch } from '@fixture-maker/domain/sports';

describe('inferCasualMatchSportId', () => {
  it('uses explicit sportId when present', () => {
    expect(inferCasualMatchSportId({ sportId: 'pickleball' })).toBe('pickleball');
  });

  it('infers box cricket from statistics payload', () => {
    const match = {
      statistics: {
        sportId: 'boxCricket',
        series: { games: [] },
      },
    };
    expect(inferCasualMatchSportId(match)).toBe('boxCricket');
    expect(isBoxCricketCasualMatch(match)).toBe(true);
  });

  it('defaults to badminton for legacy doubles casual matches', () => {
    expect(inferCasualMatchSportId({
      team1: { player1: 'Amy', player2: 'Bob' },
      team2: { player1: 'Cara', player2: 'Dan' },
    })).toBe('badminton');
  });
});
