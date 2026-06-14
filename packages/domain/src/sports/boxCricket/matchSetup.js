/**
 * Toss and batting-order helpers for box cricket.
 */

/** @typedef {'bat'|'bowl'} TossDecision */

/**
 * @param {{ id: unknown }} team1
 * @param {{ id: unknown }} team2
 * @param {{ tossWinnerTeamId: unknown, electedTo: TossDecision }} toss
 */
export const resolveBattingOrder = (team1, team2, toss) => {
  const t1Id = team1?.id;
  const t2Id = team2?.id;
  const winnerIsTeam1 = String(toss.tossWinnerTeamId) === String(t1Id);
  const winnerBatsFirst = toss.electedTo === 'bat';

  const firstBattingTeam = winnerBatsFirst
    ? (winnerIsTeam1 ? team1 : team2)
    : (winnerIsTeam1 ? team2 : team1);
  const secondBattingTeam = String(firstBattingTeam?.id) === String(t1Id) ? team2 : team1;

  return {
    firstBattingTeam,
    firstBowlingTeam: secondBattingTeam,
    secondBattingTeam,
    secondBowlingTeam: firstBattingTeam,
    battingFirstTeamId: firstBattingTeam?.id,
  };
};

/**
 * Map chronological innings inputs to team1 / team2 slots.
 */
export const mapChronologicalInningsToTeams = (
  team1,
  team2,
  firstInningsInput,
  secondInningsInput,
  battingFirstTeamId,
) => {
  const team1BattedFirst = String(battingFirstTeamId) === String(team1?.id);
  return {
    team1Innings: team1BattedFirst ? firstInningsInput : secondInningsInput,
    team2Innings: team1BattedFirst ? secondInningsInput : firstInningsInput,
  };
};

export const isTossComplete = (toss) => (
  Boolean(toss?.tossWinnerTeamId) && (toss.electedTo === 'bat' || toss.electedTo === 'bowl')
);
