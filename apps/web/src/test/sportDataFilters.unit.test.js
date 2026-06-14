import { describe, it, expect } from 'vitest';
import { filterBySport, buildSportHubSummary } from '../utils/sportDataFilters';

describe('sportDataFilters', () => {
  const history = [
    { id: 1, sportId: 'badminton', fixtures: [{ id: 'a' }, { id: 'b' }] },
    { id: 2, sportId: 'boxCricket', fixtures: [{ id: 'c' }] },
    { id: 3, fixtures: [{ id: 'd' }] },
  ];

  it('filters records by sport', () => {
    expect(filterBySport(history, 'boxCricket')).toHaveLength(1);
    expect(filterBySport(history, 'badminton')).toHaveLength(2);
  });

  it('infers box cricket from statistics when sportId is missing', () => {
    const casual = [{
      team1: { squad: [{ id: 'p1', name: 'Alex' }] },
      team2: { squad: [{ id: 'p2', name: 'Ben' }] },
      statistics: { sportId: 'boxCricket', series: { games: [] } },
    }];
    expect(filterBySport(casual, 'boxCricket')).toHaveLength(1);
    expect(filterBySport(casual, 'badminton')).toHaveLength(0);
  });

  it('builds sport hub summary counts', () => {
    const summary = buildSportHubSummary({
      sportId: 'boxCricket',
      tournamentHistory: history,
      casualMatches: [{ sportId: 'boxCricket' }, { sportId: 'badminton' }],
      activeLiveTournaments: [{ sportId: 'boxCricket' }],
      scheduledTournaments: [],
    });
    expect(summary.completedTournaments).toBe(1);
    expect(summary.casualMatches).toBe(1);
    expect(summary.liveTournaments).toBe(1);
    expect(summary.totalMatches).toBe(2);
  });
});
