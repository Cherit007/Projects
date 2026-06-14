import { parseRuleConfig } from '../ruleConfig.js';
import { boxCricketSport } from '../boxCricket.config.js';

const SUPER_OVER_OVERS = 1;
const SUPER_OVER_MAX_WICKETS = 2;

export const resolveBoxCricketRules = (ruleConfig) => {
  const parsed = parseRuleConfig(ruleConfig);
  const defaults = boxCricketSport.defaultRuleConfig || {};
  return {
    oversLimit: Number(parsed.oversLimit) || defaults.oversLimit || 6,
    maxWickets: Number(parsed.maxWickets) || defaults.maxWickets || 10,
    ballType: parsed.ballType === 'tennis' ? 'tennis' : 'standard',
    superOverEnabled: parsed.superOverEnabled !== false,
    powerplayOvers: Math.max(0, Number(parsed.powerplayOvers) || 0),
    bonusRunsPerWicket: Math.max(0, Number(parsed.bonusRunsPerWicket) || 0),
    penaltyRunsPerWide: Math.max(0, Number(parsed.penaltyRunsPerWide) || 0),
    lastManStanding: Boolean(parsed.lastManStanding),
    retiredOutAllowed: Boolean(parsed.retiredOutAllowed),
    pointsPerWin: Number(parsed.pointsPerWin) || boxCricketSport.scoring.pointsPerWin || 2,
    pointsPerTie: Number(parsed.pointsPerTie) || 1,
  };
};

const parseInningsInput = (entry = {}) => ({
  runs: Number(entry.runs),
  wickets: Number(entry.wickets),
  overs: Number(entry.overs),
});

const effectiveMaxWickets = (rules, inningsInput) => {
  if (!rules.lastManStanding) return rules.maxWickets;
  const wickets = Number(inningsInput?.wickets);
  if (!Number.isFinite(wickets)) return rules.maxWickets;
  return Math.min(rules.maxWickets, wickets + 1);
};

/** Applies powerplay multiplier to raw runs for storage/display totals. */
export const applyPowerplayRuns = (rawRuns, oversFaced, rules) => {
  const runs = Number(rawRuns);
  const overs = Number(oversFaced);
  if (!Number.isFinite(runs) || runs < 0) return 0;
  if (!rules.powerplayOvers || !Number.isFinite(overs) || overs <= 0) return runs;
  const powerplayShare = Math.min(overs, rules.powerplayOvers) / overs;
  const baseRuns = runs / (1 + powerplayShare);
  return Math.round(baseRuns + (baseRuns * powerplayShare * 2));
};

const buildInningsEntry = ({
  battingTeamId,
  bowlingTeamId,
  inningsInput,
  rules,
  phase = 'normal',
}) => {
  const rawRuns = Number(inningsInput.runs);
  const adjustedRuns = phase === 'superOver'
    ? rawRuns
    : applyPowerplayRuns(rawRuns, inningsInput.overs, rules);
  const bonusRuns = phase === 'superOver'
    ? 0
    : Math.max(0, Number(inningsInput.wickets) || 0) * rules.bonusRunsPerWicket;
  const totalRuns = adjustedRuns + bonusRuns;

  return {
    battingTeamId,
    bowlingTeamId,
    runs: totalRuns,
    rawRuns,
    wickets: Number(inningsInput.wickets),
    overs: Number(inningsInput.overs),
    phase,
    lastManStanding: rules.lastManStanding,
    extras: {
      wides: 0,
      noBalls: 0,
      byes: 0,
      legByes: 0,
      penalty: 0,
      powerplayOvers: rules.powerplayOvers,
      bonusRuns,
    },
  };
};

/** @returns {{ valid: boolean, message?: string }} */
export const validateBoxCricketInnings = (entry, rules, { phase = 'normal' } = {}) => {
  const { runs, wickets, overs } = parseInningsInput(entry);
  const maxWickets = phase === 'superOver' ? SUPER_OVER_MAX_WICKETS : effectiveMaxWickets(rules, entry);
  const oversLimit = phase === 'superOver' ? SUPER_OVER_OVERS : rules.oversLimit;

  if (!Number.isFinite(runs) || runs < 0) {
    return { valid: false, message: 'Runs must be zero or more' };
  }
  if (!Number.isFinite(wickets) || wickets < 0 || wickets > maxWickets) {
    return { valid: false, message: `Wickets must be between 0 and ${maxWickets}` };
  }
  if (!Number.isFinite(overs) || overs <= 0 || overs > oversLimit) {
    return { valid: false, message: `Overs must be greater than 0 and at most ${oversLimit}` };
  }
  return { valid: true };
};

export const buildBoxCricketMatchStatistics = ({
  team1,
  team2,
  innings1,
  innings2,
  ruleConfig,
  superOver,
}) => {
  const rules = resolveBoxCricketRules(ruleConfig);
  const innings = [
    buildInningsEntry({
      battingTeamId: team1?.id,
      bowlingTeamId: team2?.id,
      inningsInput: innings1,
      rules,
      phase: superOver ? 'superOver' : 'normal',
    }),
    buildInningsEntry({
      battingTeamId: team2?.id,
      bowlingTeamId: team1?.id,
      inningsInput: innings2,
      rules,
      phase: superOver ? 'superOver' : 'normal',
    }),
  ];

  const runs1 = innings[0].runs;
  const runs2 = innings[1].runs;
  const isTie = runs1 === runs2;

  return {
    sportId: 'boxCricket',
    version: 1,
    format: superOver ? 'superOver' : 'singleInnings',
    oversLimit: superOver ? SUPER_OVER_OVERS : rules.oversLimit,
    ballType: rules.ballType,
    specialRules: {
      powerplayOvers: rules.powerplayOvers,
      lastManStanding: rules.lastManStanding,
      retiredOutAllowed: rules.retiredOutAllowed,
      bonusRunsPerWicket: rules.bonusRunsPerWicket,
      penaltyRunsPerWide: rules.penaltyRunsPerWide,
    },
    innings,
    result: {
      winnerTeamId: runs1 > runs2
        ? team1?.id
        : runs2 > runs1
          ? team2?.id
          : null,
      marginType: isTie ? 'tie' : 'runs',
      marginValue: Math.abs(runs1 - runs2),
      method: superOver ? 'superOver' : 'normal',
    },
  };
};

export const isBoxCricketInningsTied = (innings1, innings2, ruleConfig) => {
  const statistics = buildBoxCricketMatchStatistics({
    team1: { id: 1 },
    team2: { id: 2 },
    innings1,
    innings2,
    ruleConfig,
    superOver: false,
  });
  return statistics.result.marginType === 'tie';
};

/** @returns {{ valid: boolean, message?: string, score1?: number, score2?: number, statistics?: Object }} */
export const validateBoxCricketMatchSubmission = (score1, score2, ruleConfig, extras = {}) => {
  const rules = resolveBoxCricketRules(ruleConfig);
  const statistics = extras?.statistics?.sportId === 'boxCricket'
    ? extras.statistics
    : null;

  if (statistics?.innings?.length === 2) {
    const innings1 = statistics.innings[0];
    const innings2 = statistics.innings[1];
    const phase = statistics.format === 'superOver' ? 'superOver' : 'normal';
    const firstCheck = validateBoxCricketInnings(innings1, rules, { phase });
    if (!firstCheck.valid) return firstCheck;
    const secondCheck = validateBoxCricketInnings(innings2, rules, { phase });
    if (!secondCheck.valid) return secondCheck;

    const runs1 = Number(innings1.runs);
    const runs2 = Number(innings2.runs);
    if (runs1 === runs2) {
      if (phase === 'superOver') {
        return { valid: false, message: 'Super over cannot tie — adjust runs' };
      }
      if (rules.superOverEnabled) {
        return { valid: false, message: 'Innings tied — complete the super over' };
      }
      return { valid: false, message: 'Innings cannot tie with super over disabled' };
    }
    return {
      valid: true,
      score1: runs1,
      score2: runs2,
      statistics,
    };
  }

  const s1 = Number(score1);
  const s2 = Number(score2);
  if (!Number.isFinite(s1) || !Number.isFinite(s2) || s1 < 0 || s2 < 0) {
    return { valid: false, message: 'Invalid runs' };
  }
  if (s1 === s2) {
    return { valid: false, message: rules.superOverEnabled ? 'Runs tied — use super over' : 'Runs cannot tie' };
  }
  return { valid: true, score1: s1, score2: s2 };
};

/** @returns {{ valid: boolean, message?: string }} */
export const validateBoxCricketMatchScore = (score1, score2, ruleConfig, extras = {}) => {
  const result = validateBoxCricketMatchSubmission(score1, score2, ruleConfig, extras);
  if (!result.valid) {
    return { valid: false, message: result.message || 'Invalid score' };
  }
  return { valid: true };
};

export const getBoxCricketRulesSummary = (ruleConfig) => {
  const rules = resolveBoxCricketRules(ruleConfig);
  const parts = [
    `${rules.oversLimit}-over`,
    rules.ballType === 'tennis' ? 'tennis ball' : 'standard ball',
  ];
  if (rules.powerplayOvers > 0) parts.push(`${rules.powerplayOvers}-over powerplay`);
  if (rules.lastManStanding) parts.push('LMS');
  if (rules.superOverEnabled) parts.push('super over');
  return parts.join(' · ');
};
