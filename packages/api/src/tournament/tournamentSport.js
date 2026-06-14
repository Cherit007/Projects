import { DEFAULT_SPORT_ID, resolveSportId } from '@fixture-maker/domain/sports/sportId.js';
import { parseRuleConfig, serializeRuleConfig } from '@fixture-maker/domain/sports/ruleConfig.js';

export { DEFAULT_SPORT_ID, resolveSportId, parseRuleConfig, serializeRuleConfig };

export const resolveTournamentSportId = (payload, existing) => (
  resolveSportId(payload?.sportId ?? existing?.sportId)
);

export const resolveTournamentRuleConfig = (payload, existing) => {
  if (payload?.ruleConfig !== undefined) {
    return parseRuleConfig(payload.ruleConfig);
  }
  if (existing?.ruleConfig !== undefined) {
    return parseRuleConfig(existing.ruleConfig);
  }
  return parseRuleConfig(existing?.ruleConfigJson);
};
