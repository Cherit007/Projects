// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ANALYTICS_EVENTS } from '@fixture-maker/analytics/events';
import {
  getAnalyticsAdapter,
  setAnalyticsAdapter,
  trackEvent,
} from '@fixture-maker/analytics/trackEvent';
import { createNoopAnalyticsAdapter } from '@fixture-maker/analytics/adapters/noop';

describe('analytics', () => {
  afterEach(() => {
    setAnalyticsAdapter(null);
  });

  it('exposes the event catalog', () => {
    expect(ANALYTICS_EVENTS.TOURNAMENT_CREATED).toBe('tournament_created');
    expect(ANALYTICS_EVENTS.MATCH_SCORED).toBe('match_scored');
  });

  it('forwards events to the active adapter', () => {
    const track = vi.fn();
    setAnalyticsAdapter({ track });
    trackEvent(ANALYTICS_EVENTS.MATCH_SCORED, { matchId: 'm1' });
    expect(track).toHaveBeenCalledWith(ANALYTICS_EVENTS.MATCH_SCORED, { matchId: 'm1' });
    expect(getAnalyticsAdapter()).toEqual({ track });
  });

  it('noop adapter accepts track calls', () => {
    const adapter = createNoopAnalyticsAdapter();
    expect(() => adapter.track('x', {})).not.toThrow();
  });
});
