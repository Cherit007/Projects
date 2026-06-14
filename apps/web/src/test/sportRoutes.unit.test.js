import { describe, it, expect } from 'vitest';
import { APP_ROUTE_KEYS, buildAppHash, parseAppRoute } from '../utils/appRoutes';

describe('sport-aware app routes', () => {
  it('parses sport hub route', () => {
    expect(parseAppRoute('#/sports')).toEqual({
      routeKey: APP_ROUTE_KEYS.SPORT_HUB,
      sportId: null,
    });
  });

  it('parses sport home, teams, and live routes', () => {
    expect(parseAppRoute('#/sports/boxCricket')).toEqual({
      routeKey: APP_ROUTE_KEYS.SETUP,
      sportId: 'boxCricket',
    });
    expect(parseAppRoute('#/sports/badminton/teams')).toEqual({
      routeKey: APP_ROUTE_KEYS.TEAMS,
      sportId: 'badminton',
    });
    expect(parseAppRoute('#/sports/pickleball/live')).toEqual({
      routeKey: APP_ROUTE_KEYS.TOURNAMENT,
      sportId: 'pickleball',
    });
  });

  it('builds sport-scoped hashes', () => {
    expect(buildAppHash(APP_ROUTE_KEYS.SETUP, { sportId: 'boxCricket' })).toBe('#/sports/boxCricket');
    expect(buildAppHash(APP_ROUTE_KEYS.TEAMS, { sportId: 'badminton' })).toBe('#/sports/badminton/teams');
    expect(buildAppHash(APP_ROUTE_KEYS.TOURNAMENT, { sportId: 'pickleball' })).toBe('#/sports/pickleball/live');
  });

  it('redirects legacy setup hash to sport hub', () => {
    expect(parseAppRoute('#/setup').routeKey).toBe(APP_ROUTE_KEYS.SPORT_HUB);
  });
});
