import React from 'react';
import { listSports } from '@fixture-maker/domain/sports';
import { describe, expect, it } from 'vitest';

describe('mobile sport registry', () => {
  it('exposes sport id for picker keys', () => {
    const sports = listSports().filter((sport) => sport.available);
    expect(sports.length).toBeGreaterThan(0);
    for (const sport of sports) {
      expect(typeof sport.id).toBe('string');
      expect(sport.id.length).toBeGreaterThan(0);
      expect(Array.isArray(sport.formats)).toBe(true);
      expect(Array.isArray(sport.gameModes)).toBe(true);
    }
  });
});
