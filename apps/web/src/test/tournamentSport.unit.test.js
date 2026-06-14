// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  resolveTournamentSportId,
  resolveTournamentRuleConfig,
  parseRuleConfig,
  serializeRuleConfig,
} from '../services/tournament/tournamentSport';

describe('tournamentSport helpers', () => {
  it('defaults missing sportId to badminton', () => {
    expect(resolveTournamentSportId({}, {})).toBe('badminton');
    expect(resolveTournamentSportId({ sportId: 'pickleball' }, {})).toBe('pickleball');
  });

  it('round-trips ruleConfig through JSON', () => {
    const ruleConfig = { pointCap: 21, winBy: 2 };
    const json = serializeRuleConfig(ruleConfig);
    expect(parseRuleConfig(json)).toEqual(ruleConfig);
    expect(resolveTournamentRuleConfig({ ruleConfig }, {})).toEqual(ruleConfig);
  });
});
