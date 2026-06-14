import { calculatePointsTable } from '../../scoring/index.js';
import { boxCricketSport } from '../boxCricket.config.js';
import { buildHeadToHeadIndex } from '../pickleball/PickleballRankingEngine.js';
import { resolveBoxCricketRules } from './boxCricketScoring.js';

const oversToDecimal = (value) => {
  const overs = Number(value);
  if (!Number.isFinite(overs) || overs <= 0) return 0;
  return overs;
};

const extractInningsForTeam = (fixtures, teamId) => {
  let runsScored = 0;
  let runsConceded = 0;
  let oversFaced = 0;
  let oversBowled = 0;

  fixtures.forEach((match) => {
    if (!match?.completed) return;
    const stats = match?.statistics;
    if (stats?.sportId !== 'boxCricket' || !Array.isArray(stats.innings)) {
      const score1 = Number(match.score1);
      const score2 = Number(match.score2);
      if (!Number.isFinite(score1) || !Number.isFinite(score2)) return;
      if (String(match.team1?.id) === String(teamId)) {
        runsScored += score1;
        runsConceded += score2;
        oversFaced += 1;
        oversBowled += 1;
      } else if (String(match.team2?.id) === String(teamId)) {
        runsScored += score2;
        runsConceded += score1;
        oversFaced += 1;
        oversBowled += 1;
      }
      return;
    }

    stats.innings.forEach((innings) => {
      const runs = Number(innings?.runs) || 0;
      const overs = oversToDecimal(innings?.overs);
      if (String(innings?.battingTeamId) === String(teamId)) {
        runsScored += runs;
        oversFaced += overs;
      }
      if (String(innings?.bowlingTeamId) === String(teamId)) {
        runsConceded += runs;
        oversBowled += overs;
      }
    });
  });

  const runRateFor = (runs, overs) => (overs > 0 ? runs / overs : 0);
  const netRunRate = runRateFor(runsScored, oversFaced) - runRateFor(runsConceded, oversBowled);

  return {
    runsScored,
    runsConceded,
    oversFaced,
    oversBowled,
    netRunRate: Number(netRunRate.toFixed(3)),
  };
};

export const calculateBoxCricketStandings = (teams, fixtures, ruleConfig) => {
  const rules = resolveBoxCricketRules(ruleConfig);
  const table = calculatePointsTable(teams, fixtures, {
    ...boxCricketSport.scoring,
    pointsPerWin: rules.pointsPerWin,
  }).map((team) => {
    const nrr = extractInningsForTeam(fixtures, team.id);
    return {
      ...team,
      netRunRate: nrr.netRunRate,
      runsScored: nrr.runsScored,
      runsConceded: nrr.runsConceded,
    };
  });

  const headToHeadIndex = buildHeadToHeadIndex(fixtures);

  return [...table].sort((teamA, teamB) => {
    if (teamB.points !== teamA.points) return teamB.points - teamA.points;
    if (teamB.netRunRate !== teamA.netRunRate) return teamB.netRunRate - teamA.netRunRate;
    if (teamB.scoreDiff !== teamA.scoreDiff) return teamB.scoreDiff - teamA.scoreDiff;

    const key = `${Math.min(Number(teamA.id), Number(teamB.id))}|${Math.max(Number(teamA.id), Number(teamB.id))}`;
    const bucket = headToHeadIndex.get(key);
    if (bucket) {
      const aWins = bucket[String(teamA.id)] || 0;
      const bWins = bucket[String(teamB.id)] || 0;
      if (bWins !== aWins) return bWins - aWins;
    }

    if (teamB.won !== teamA.won) return teamB.won - teamA.won;
    return String(teamA.name || '').localeCompare(String(teamB.name || ''));
  });
};
