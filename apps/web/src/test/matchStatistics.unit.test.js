// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { serializeMatchStatistics, parseMatchStatistics } from '@fixture-maker/domain/sports/matchStatistics';

describe('matchStatistics', () => {
  it('round-trips JSON payloads', () => {
    const payload = {
      team1: { aces: 2 },
      team2: { aces: 1 },
    };
    const serialized = serializeMatchStatistics(payload);
    expect(parseMatchStatistics(serialized)).toEqual(payload);
  });

  it('returns empty string for invalid payloads', () => {
    expect(serializeMatchStatistics(null)).toBe('');
    expect(parseMatchStatistics('not-json')).toBeNull();
  });
});
