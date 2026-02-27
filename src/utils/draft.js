export const parsePlayerPool = (rawValue = '') => {
  const seen = new Set();
  return String(rawValue)
    .split(/[\n,]+/)
    .map((name) => name.trim())
    .filter((name) => {
      if (!name) return false;
      const key = name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

export const runSnakeDraft = ({
  teams = [],
  gameMode = 'doubles',
  playerPool = [],
  captains = [],
}) => {
  const slotsPerTeam = gameMode === 'singles' ? 1 : 2;
  const requiredPlayers = teams.length * slotsPerTeam;
  if (!Array.isArray(teams) || teams.length === 0) {
    return { ok: false, reason: 'No teams available for draft' };
  }

  const normalizedPool = parsePlayerPool(playerPool.join(','));
  if (normalizedPool.length < requiredPlayers) {
    return {
      ok: false,
      reason: `Need at least ${requiredPlayers} players for ${teams.length} teams`,
    };
  }

  const normalizedCaptains = parsePlayerPool(captains.join(','));
  if (normalizedCaptains.length > 0 && normalizedCaptains.length !== teams.length) {
    return {
      ok: false,
      reason: `Provide exactly ${teams.length} captains or leave captains empty`,
    };
  }

  const poolSet = new Set(normalizedPool.map((name) => name.toLowerCase()));
  for (const captain of normalizedCaptains) {
    if (!poolSet.has(captain.toLowerCase())) {
      return { ok: false, reason: `Captain "${captain}" is not in player pool` };
    }
  }

  const remaining = [...normalizedPool];
  const drafted = teams.map((team, index) => ({
    ...team,
    player: '',
    player1: '',
    player2: slotsPerTeam === 2 ? '' : team.player2 || '',
    name: team.name?.trim() ? team.name : `Team ${index + 1}`,
  }));
  const picksNeeded = drafted.map(() => slotsPerTeam);

  if (normalizedCaptains.length === teams.length) {
    normalizedCaptains.forEach((captain, index) => {
      drafted[index].player1 = captain;
      drafted[index].player = captain;
      picksNeeded[index] -= 1;
      const captainIndex = remaining.findIndex((name) => name.toLowerCase() === captain.toLowerCase());
      if (captainIndex >= 0) remaining.splice(captainIndex, 1);
    });
  }

  let round = 0;
  while (picksNeeded.some((count) => count > 0)) {
    const order = round % 2 === 0
      ? Array.from({ length: drafted.length }, (_, i) => i)
      : Array.from({ length: drafted.length }, (_, i) => drafted.length - 1 - i);

    order.forEach((teamIndex) => {
      if (picksNeeded[teamIndex] <= 0) return;
      const next = remaining.shift();
      if (!next) return;
      if (!drafted[teamIndex].player1) {
        drafted[teamIndex].player1 = next;
        drafted[teamIndex].player = next;
      } else if (slotsPerTeam === 2 && !drafted[teamIndex].player2) {
        drafted[teamIndex].player2 = next;
      }
      picksNeeded[teamIndex] -= 1;
    });
    round += 1;
  }

  return { ok: true, teams: drafted };
};

