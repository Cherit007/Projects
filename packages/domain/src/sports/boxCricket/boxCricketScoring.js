import { parseRuleConfig } from '../ruleConfig.js';
import { boxCricketSport } from '../boxCricket.config.js';
import { normalizeSquad } from './squadUtils.js';

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
    ...(Array.isArray(inningsInput.ballLog) && inningsInput.ballLog.length
      ? { ballLog: inningsInput.ballLog, scoringMode: inningsInput.scoringMode || 'ballByBall' }
      : {}),
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
  const isBallByBall = entry?.scoringMode === 'ballByBall' || Array.isArray(entry?.ballLog);
  if (!Number.isFinite(overs) || overs <= 0) {
    return { valid: false, message: 'Overs must be greater than 0' };
  }
  if (!isBallByBall && overs > oversLimit) {
    return { valid: false, message: `Overs must be at most ${oversLimit}` };
  }
  if (isBallByBall && overs > oversLimit + 0.001) {
    return { valid: false, message: `Overs must be at most ${oversLimit}` };
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
  battingFirstTeamId = null,
  toss = null,
}) => {
  const rules = resolveBoxCricketRules(ruleConfig);
  const team1BatsFirst = battingFirstTeamId == null
    || String(battingFirstTeamId) === String(team1?.id);

  const firstInningsTeam = team1BatsFirst ? team1 : team2;
  const firstBowlingTeam = team1BatsFirst ? team2 : team1;
  const secondInningsTeam = team1BatsFirst ? team2 : team1;
  const secondBowlingTeam = team1BatsFirst ? team1 : team2;

  const innings = [
    buildInningsEntry({
      battingTeamId: firstInningsTeam?.id,
      bowlingTeamId: firstBowlingTeam?.id,
      inningsInput: innings1,
      rules,
      phase: superOver ? 'superOver' : 'normal',
    }),
    buildInningsEntry({
      battingTeamId: secondInningsTeam?.id,
      bowlingTeamId: secondBowlingTeam?.id,
      inningsInput: innings2,
      rules,
      phase: superOver ? 'superOver' : 'normal',
    }),
  ];

  const team1Runs = team1BatsFirst ? innings[0].runs : innings[1].runs;
  const team2Runs = team1BatsFirst ? innings[1].runs : innings[0].runs;
  const isTie = team1Runs === team2Runs;

  return {
    sportId: 'boxCricket',
    version: 1,
    format: superOver ? 'superOver' : 'singleInnings',
    oversLimit: superOver ? SUPER_OVER_OVERS : rules.oversLimit,
    ballType: rules.ballType,
    ...(toss?.tossWinnerTeamId ? {
      toss: {
        winnerTeamId: toss.tossWinnerTeamId,
        electedTo: toss.electedTo,
        battingFirstTeamId: battingFirstTeamId ?? team1?.id,
      },
    } : {}),
    specialRules: {
      powerplayOvers: rules.powerplayOvers,
      lastManStanding: rules.lastManStanding,
      retiredOutAllowed: rules.retiredOutAllowed,
      bonusRunsPerWicket: rules.bonusRunsPerWicket,
      penaltyRunsPerWide: rules.penaltyRunsPerWide,
    },
    innings,
    teams: {
      team1: {
        id: team1?.id,
        name: team1?.name || '',
        squad: normalizeSquad(team1?.squad),
      },
      team2: {
        id: team2?.id,
        name: team2?.name || '',
        squad: normalizeSquad(team2?.squad),
      },
    },
    result: {
      winnerTeamId: team1Runs > team2Runs
        ? team1?.id
        : team2Runs > team1Runs
          ? team2?.id
          : null,
      marginType: isTie ? 'tie' : 'runs',
      marginValue: Math.abs(team1Runs - team2Runs),
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

export const CASUAL_SERIES_FORMATS = Object.freeze({
  single: { id: 'single', label: 'Single game', maxGames: 1, winsRequired: 1 },
  bo3: { id: 'bo3', label: 'Best of 3', maxGames: 3, winsRequired: 2 },
  bo5: { id: 'bo5', label: 'Best of 5', maxGames: 5, winsRequired: 3 },
});

export const getCasualSeriesConfig = (seriesFormat) => (
  CASUAL_SERIES_FORMATS[seriesFormat] || CASUAL_SERIES_FORMATS.single
);

export const isCasualSeriesComplete = (team1Wins, team2Wins, seriesFormat) => {
  const { winsRequired } = getCasualSeriesConfig(seriesFormat);
  return team1Wins >= winsRequired || team2Wins >= winsRequired;
};

export const buildCasualSeriesStatistics = ({
  team1,
  team2,
  seriesFormat,
  games = [],
  team1Wins = 0,
  team2Wins = 0,
}) => {
  const config = getCasualSeriesConfig(seriesFormat);
  const winnerTeamId = team1Wins === team2Wins
    ? null
    : (team1Wins > team2Wins ? team1?.id : team2?.id);

  return {
    sportId: 'boxCricket',
    version: 1,
    format: 'casualSeries',
    teams: {
      team1: {
        id: team1?.id,
        name: team1?.name || '',
        squad: normalizeSquad(team1?.squad),
      },
      team2: {
        id: team2?.id,
        name: team2?.name || '',
        squad: normalizeSquad(team2?.squad),
      },
    },
    series: {
      format: config.id,
      label: config.label,
      winsRequired: config.winsRequired,
      maxGames: config.maxGames,
      team1Wins,
      team2Wins,
      winnerTeamId,
      games,
    },
  };
};

export const formatCasualSeriesScoreLine = (statistics, team1Name = 'Team 1', team2Name = 'Team 2') => {
  const series = statistics?.series;
  if (!series) return null;
  const { team1Wins, team2Wins, label } = series;
  if (series.format === 'single') {
    const game = series.games?.[0];
    if (game) return `${game.score1} - ${game.score2}`;
    return `${team1Wins} - ${team2Wins}`;
  }
  return `${team1Name} ${team1Wins}–${team2Wins} ${team2Name} (${label})`;
};
