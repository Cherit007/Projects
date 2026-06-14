// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  resolvePickleballScoringRules,
  validatePickleballMatchScore,
} from '@fixture-maker/domain/sports/pickleball/pickleballScoring';

describe('pickleball scoring', () => {
  it('defaults to 11-point win-by-2 rules', () => {
    expect(resolvePickleballScoringRules({})).toEqual({
      pointCap: 11,
      winBy: 2,
      winByRule: 'winBy',
    });
  });

  it('accepts a valid 11-9 win', () => {
    expect(validatePickleballMatchScore(11, 9, {})).toEqual({ valid: true });
  });

  it('rejects a tie', () => {
    expect(validatePickleballMatchScore(10, 10, {}).valid).toBe(false);
  });

  it('rejects winner below point cap', () => {
    expect(validatePickleballMatchScore(10, 8, {}).valid).toBe(false);
  });

  it('rejects win-by-one at cap', () => {
    expect(validatePickleballMatchScore(11, 10, {}).valid).toBe(false);
  });

  it('accepts extended win-by-two beyond cap', () => {
    expect(validatePickleballMatchScore(13, 11, {})).toEqual({ valid: true });
  });

  it('enforces fixed cap mode', () => {
    const ruleConfig = { pointCap: 15, winByRule: 'fixedCap' };
    expect(validatePickleballMatchScore(15, 10, ruleConfig)).toEqual({ valid: true });
    expect(validatePickleballMatchScore(16, 14, ruleConfig).valid).toBe(false);
  });
});
