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

const normalizePlayerName = (value = '') => String(value || '').trim();

const shuffleWithRandom = (items = [], random = Math.random) => {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
};

const buildNormalizedOddPlayerTeams = (teams = []) => (
  (Array.isArray(teams) ? teams : []).map((team, index) => {
    const player1 = normalizePlayerName(team?.player || team?.player1);
    const player2 = normalizePlayerName(team?.player2);
    return {
      ...team,
      id: team?.id ?? index + 1,
      name: team?.name?.trim() ? team.name : `Team ${index + 1}`,
      player1,
      player: player1,
      player2,
    };
  })
);

export const buildRandomOddPlayerSwapRound = ({
  teams = [],
  oddPlayerName = '',
  eligibleTeamIds = null,
  random = Math.random,
} = {}) => {
  const normalizedOddPlayer = normalizePlayerName(oddPlayerName);
  if (!normalizedOddPlayer) {
    return {
      ok: false,
      reason: 'Odd player name is required',
    };
  }

  const normalizedTeams = buildNormalizedOddPlayerTeams(teams);
  if (normalizedTeams.length !== 3) {
    return {
      ok: false,
      reason: 'Random odd-player mode needs exactly 3 doubles teams',
    };
  }

  const activePool = normalizedTeams.flatMap((team) => [team.player1, team.player2]);
  if (activePool.some((playerName) => !playerName)) {
    return {
      ok: false,
      reason: 'Each doubles team must have two players before odd-player randomization can run',
    };
  }

  const uniquePlayers = new Set(
    [...activePool, normalizedOddPlayer].map((playerName) => playerName.toLowerCase())
  );
  if (uniquePlayers.size !== 7) {
    return {
      ok: false,
      reason: 'Odd-player mode needs 7 unique players across the three teams plus the extra player',
    };
  }

  const shuffledActivePool = shuffleWithRandom(activePool, random);
  const formedTeams = normalizedTeams.map((team, index) => {
    const player1 = shuffledActivePool[index * 2];
    const player2 = shuffledActivePool[(index * 2) + 1];
    return {
      ...team,
      player1,
      player: player1,
      player2,
    };
  });

  const eligibleTeamIdSet = eligibleTeamIds instanceof Set
    ? eligibleTeamIds
    : new Set(
        (Array.isArray(eligibleTeamIds) ? eligibleTeamIds : [])
          .map((teamId) => String(teamId ?? '').trim())
          .filter(Boolean)
      );
  const eligibleTeams = eligibleTeamIdSet.size > 0
    ? formedTeams.filter((team) => eligibleTeamIdSet.has(String(team.id)))
    : formedTeams;
  if (eligibleTeams.length === 0) {
    return {
      ok: false,
      reason: 'No eligible teams available for odd-player swap selection',
    };
  }

  const selectedTeam = eligibleTeams[Math.floor(random() * eligibleTeams.length)];
  const selectedTeamIndex = formedTeams.findIndex((team) => String(team.id) === String(selectedTeam.id));
  const selectedSlot = Math.floor(random() * 2) === 0 ? 'player1' : 'player2';
  const sittingOutPlayer = normalizePlayerName(selectedTeam?.[selectedSlot]);

  const swappedTeams = formedTeams.map((team, index) => {
    if (index !== selectedTeamIndex) return { ...team };
    const nextPlayer1 = selectedSlot === 'player1' ? normalizedOddPlayer : team.player1;
    const nextPlayer2 = selectedSlot === 'player2' ? normalizedOddPlayer : team.player2;
    return {
      ...team,
      player1: nextPlayer1,
      player: nextPlayer1,
      player2: nextPlayer2,
    };
  });

  return {
    ok: true,
    oddPlayerName: normalizedOddPlayer,
    sittingOutPlayer,
    selectedTeamId: selectedTeam?.id ?? null,
    selectedTeamName: selectedTeam?.name || '',
    selectedSlot,
    teams: swappedTeams,
  };
};

export const applyRandomOddPlayerSwapToLeagueFixtures = ({
  fixtures = [],
  teams = [],
  oddPlayerName = '',
  random = Math.random,
} = {}) => {
  const normalizedFixtures = Array.isArray(fixtures) ? fixtures : [];
  if (normalizedFixtures.length === 0) {
    return {
      ok: true,
      fixtures: [],
    };
  }

  const normalizedTeams = buildNormalizedOddPlayerTeams(teams);
  const assignmentsById = (roundTeams = []) => new Map(
    roundTeams.map((team) => [String(team.id), team])
  );

  const nextFixtures = normalizedFixtures.map((fixture) => {
    const roundResult = buildRandomOddPlayerSwapRound({
      teams: normalizedTeams,
      oddPlayerName,
      eligibleTeamIds: [fixture?.team1?.id, fixture?.team2?.id],
      random,
    });
    if (!roundResult.ok) return { failed: true, roundResult, fixture };

    const roundTeamsById = assignmentsById(roundResult.teams);
    const team1Id = String(fixture?.team1?.id ?? '');
    const team2Id = String(fixture?.team2?.id ?? '');

    return {
      ...fixture,
      team1: roundTeamsById.get(team1Id) || fixture.team1,
      team2: roundTeamsById.get(team2Id) || fixture.team2,
      oddPlayerMeta: {
        activeOddPlayerName: roundResult.oddPlayerName,
        sittingOutPlayerName: roundResult.sittingOutPlayer,
        swapTeamId: roundResult.selectedTeamId,
        swapTeamName: roundResult.selectedTeamName,
        swapSlot: roundResult.selectedSlot,
      },
      roundTeams: roundResult.teams.map((team) => ({ ...team })),
    };
  });

  const failedFixture = nextFixtures.find((fixture) => fixture?.failed);
  if (failedFixture) {
    return {
      ok: false,
      reason: failedFixture.roundResult?.reason || 'Unable to build odd-player fixture assignments',
      fixtures,
    };
  }

  return {
    ok: true,
    fixtures: nextFixtures,
  };
};

/**
 * Move the odd player from the current host team to the other team in a live match.
 * Restores the sitting-out player on the old host so that team's pairing plays intact.
 */
export const reassignOddPlayerHostOnMatch = ({
  match = null,
  targetTeamId = null,
  sitOutSlot = null,
  sitOutPlayerName = null,
} = {}) => {
  if (!match || match.completed) {
    return { ok: false, reason: 'Odd-player host can only change on an incomplete match' };
  }

  const meta = match.oddPlayerMeta && typeof match.oddPlayerMeta === 'object'
    ? match.oddPlayerMeta
    : null;
  const oddPlayerName = normalizePlayerName(meta?.activeOddPlayerName);
  if (!oddPlayerName) {
    return { ok: false, reason: 'This match has no odd-player assignment to move' };
  }

  const team1Id = String(match.team1?.id ?? '');
  const team2Id = String(match.team2?.id ?? '');
  const targetId = String(targetTeamId ?? '').trim();
  if (!targetId || (targetId !== team1Id && targetId !== team2Id)) {
    return { ok: false, reason: 'Odd player can only join one of the two teams in this match' };
  }

  const currentHostId = String(meta.swapTeamId ?? '');
  const getSideKey = (teamId) => {
    if (String(teamId) === team1Id) return 'team1';
    if (String(teamId) === team2Id) return 'team2';
    return null;
  };

  const findSlotWithPlayer = (side, playerName) => {
    const needle = normalizePlayerName(playerName).toLowerCase();
    if (!needle || !side) return null;
    const p1 = normalizePlayerName(side.player1 || side.player).toLowerCase();
    const p2 = normalizePlayerName(side.player2).toLowerCase();
    if (p1 === needle) return 'player1';
    if (p2 === needle) return 'player2';
    return null;
  };

  const setSideSlot = (side, slot, playerName) => {
    const next = { ...side };
    const value = normalizePlayerName(playerName);
    if (slot === 'player1') {
      next.player1 = value;
      next.player = value;
    } else if (slot === 'player2') {
      next.player2 = value;
    }
    return next;
  };

  const hostKey = getSideKey(currentHostId)
    || (findSlotWithPlayer(match.team1, oddPlayerName) ? 'team1' : null)
    || (findSlotWithPlayer(match.team2, oddPlayerName) ? 'team2' : null);
  if (!hostKey) {
    return { ok: false, reason: 'Could not find the odd player in this match lineup' };
  }

  const targetKey = getSideKey(targetId);
  if (!targetKey) {
    return { ok: false, reason: 'Target team is not part of this match' };
  }

  const sittingOutPlayerName = normalizePlayerName(meta.sittingOutPlayerName);
  const working = {
    team1: { ...match.team1 },
    team2: { ...match.team2 },
  };

  const oddSlot = findSlotWithPlayer(working[hostKey], oddPlayerName)
    || (meta.swapSlot === 'player2' ? 'player2' : 'player1');

  // 1) Restore sitting-out player onto the current host (that team's pair plays intact).
  if (sittingOutPlayerName) {
    working[hostKey] = setSideSlot(working[hostKey], oddSlot, sittingOutPlayerName);
  }

  // 2) Choose which player sits out on the target team.
  let resolvedSitOutSlot = sitOutSlot === 'player1' || sitOutSlot === 'player2'
    ? sitOutSlot
    : null;
  if (!resolvedSitOutSlot && sitOutPlayerName) {
    resolvedSitOutSlot = findSlotWithPlayer(working[targetKey], sitOutPlayerName);
  }
  if (!resolvedSitOutSlot) {
    resolvedSitOutSlot = 'player1';
  }

  const newSittingOutPlayer = normalizePlayerName(
    resolvedSitOutSlot === 'player1'
      ? (working[targetKey].player1 || working[targetKey].player)
      : working[targetKey].player2
  );
  if (!newSittingOutPlayer) {
    return { ok: false, reason: 'Target team has no player available to sit out' };
  }
  if (newSittingOutPlayer.toLowerCase() === oddPlayerName.toLowerCase()) {
    return { ok: true, match, unchanged: true };
  }

  // 3) Put odd player onto the target team.
  working[targetKey] = setSideSlot(working[targetKey], resolvedSitOutSlot, oddPlayerName);

  const targetTeam = working[targetKey];
  const nextMeta = {
    ...meta,
    activeOddPlayerName: oddPlayerName,
    sittingOutPlayerName: newSittingOutPlayer,
    swapTeamId: targetTeam?.id ?? targetId,
    swapTeamName: targetTeam?.name || meta.swapTeamName || '',
    swapSlot: resolvedSitOutSlot,
  };

  const nextRoundTeams = Array.isArray(match.roundTeams)
    ? match.roundTeams.map((team) => {
      const teamId = String(team?.id ?? '');
      if (teamId === team1Id) return { ...working.team1 };
      if (teamId === team2Id) return { ...working.team2 };
      return { ...team };
    })
    : match.roundTeams;

  const unchanged = (
    String(nextMeta.swapTeamId) === String(meta.swapTeamId)
    && String(nextMeta.sittingOutPlayerName).toLowerCase() === String(meta.sittingOutPlayerName || '').toLowerCase()
    && String(nextMeta.swapSlot) === String(meta.swapSlot)
  );

  return {
    ok: true,
    unchanged,
    match: {
      ...match,
      team1: working.team1,
      team2: working.team2,
      oddPlayerMeta: nextMeta,
      ...(Array.isArray(nextRoundTeams) ? { roundTeams: nextRoundTeams } : {}),
    },
  };
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
