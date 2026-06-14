import { calculatePointsTable } from '../../scoring/index.js';
import { resolvePickleballScoringRules } from './pickleballScoring.js';
import { pickleballSport } from '../pickleball.config.js';

const pairTeamIds = (teamAId, teamBId) => {
  const left = String(teamAId ?? '');
  const right = String(teamBId ?? '');
  return left <= right ? `${left}|${right}` : `${right}|${left}`;
};

/** @returns {Map<string, Record<string, number>>} */
export const buildHeadToHeadIndex = (fixtures = []) => {
  const index = new Map();
  fixtures.forEach((match) => {
    if (!match?.completed) return;
    const team1Id = match?.team1?.id;
    const team2Id = match?.team2?.id;
    if (team1Id == null || team2Id == null) return;
    const score1 = Number(match.score1);
    const score2 = Number(match.score2);
    if (!Number.isFinite(score1) || !Number.isFinite(score2) || score1 === score2) return;

    const key = pairTeamIds(team1Id, team2Id);
    const bucket = index.get(key) || {};
    const winnerId = score1 > score2 ? String(team1Id) : String(team2Id);
    bucket[winnerId] = (bucket[winnerId] || 0) + 1;
    index.set(key, bucket);
  });
  return index;
};

const resolveHeadToHead = (teamA, teamB, headToHeadIndex) => {
  const key = pairTeamIds(teamA?.id, teamB?.id);
  const bucket = headToHeadIndex.get(key);
  if (!bucket) return 0;
  const aWins = bucket[String(teamA?.id ?? '')] || 0;
  const bWins = bucket[String(teamB?.id ?? '')] || 0;
  if (aWins === bWins) return 0;
  return aWins > bWins ? 1 : -1;
};

export const calculatePickleballStandings = (teams, fixtures, ruleConfig) => {
  const { pointCap } = resolvePickleballScoringRules(ruleConfig);
  const scoringConfig = {
    ...pickleballSport.scoring,
    ...(ruleConfig && typeof ruleConfig === 'object' ? ruleConfig : {}),
  };
  const table = calculatePointsTable(teams, fixtures, scoringConfig);
  const headToHeadIndex = buildHeadToHeadIndex(fixtures);

  return [...table].sort((teamA, teamB) => {
    if (teamB.points !== teamA.points) return teamB.points - teamA.points;
    if (teamB.netMatchRate !== teamA.netMatchRate) return teamB.netMatchRate - teamA.netMatchRate;
    if (teamB.scoreDiff !== teamA.scoreDiff) return teamB.scoreDiff - teamA.scoreDiff;

    const headToHead = resolveHeadToHead(teamA, teamB, headToHeadIndex);
    if (headToHead !== 0) return -headToHead;

    const aWinRate = teamA.played > 0 ? teamA.won / teamA.played : 0;
    const bWinRate = teamB.played > 0 ? teamB.won / teamB.played : 0;
    if (bWinRate !== aWinRate) return bWinRate - aWinRate;

    const aPointEfficiency = teamA.played > 0 ? teamA.scoreFor / teamA.played : 0;
    const bPointEfficiency = teamB.played > 0 ? teamB.scoreFor / teamB.played : 0;
    if (bPointEfficiency !== aPointEfficiency) return bPointEfficiency - aPointEfficiency;

    if (pointCap && teamB.scoreFor !== teamA.scoreFor) return teamB.scoreFor - teamA.scoreFor;
    return String(teamA.name || '').localeCompare(String(teamB.name || ''));
  });
};
