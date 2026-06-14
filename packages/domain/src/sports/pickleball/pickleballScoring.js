import { parseRuleConfig } from '../ruleConfig.js';
import { pickleballSport } from '../pickleball.config.js';

export const resolvePickleballScoringRules = (ruleConfig) => {
  const parsed = parseRuleConfig(ruleConfig);
  return {
    pointCap: Number(parsed.pointCap) || pickleballSport.scoring.quickScores[0] || 11,
    winBy: Number(parsed.winBy) || 2,
    winByRule: parsed.winByRule === 'fixedCap' ? 'fixedCap' : 'winBy',
  };
};

/** @returns {{ valid: boolean, message?: string }} */
export const validatePickleballMatchScore = (score1, score2, ruleConfig) => {
  const s1 = Number(score1);
  const s2 = Number(score2);

  if (!Number.isFinite(s1) || !Number.isFinite(s2) || s1 < 0 || s2 < 0) {
    return { valid: false, message: 'Invalid scores' };
  }
  if (s1 === s2) {
    return { valid: false, message: 'Scores cannot be tied' };
  }

  const { pointCap, winBy, winByRule } = resolvePickleballScoringRules(ruleConfig);
  const winner = Math.max(s1, s2);
  const loser = Math.min(s1, s2);

  if (winByRule === 'fixedCap') {
    if (winner !== pointCap) {
      return { valid: false, message: `Winner must reach exactly ${pointCap} points` };
    }
    return { valid: true };
  }

  if (winner < pointCap) {
    return { valid: false, message: `Winner must reach at least ${pointCap} points` };
  }
  if (winner - loser < winBy) {
    return { valid: false, message: `Must win by ${winBy} points` };
  }

  return { valid: true };
};
