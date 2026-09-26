/**
 * IPL-style playoff brackets.
 * Teams must already be ordered by seed: index 0 = 1st, index 1 = 2nd, ...
 *
 * 4 teams:
 *   Qualifier 1: 1 vs 2 → winner Final, loser Qualifier 2
 *   Eliminator:  3 vs 4 → winner Qualifier 2
 *   Qualifier 2: Q1 loser vs Elim winner → winner Final
 *   Final: Q1 winner vs Q2 winner
 *
 * 3 teams:
 *   Eliminator: 2 vs 3 → winner Final
 *   Final: 1 vs Eliminator winner
 */

const cloneTeam = (team, seed) => (
  team
    ? {
        ...team,
        seed,
        name: team.name || `Team ${seed}`,
      }
    : null
);

export const generateIplPlayoffBracket = (seededTeams = []) => {
  const pool = (Array.isArray(seededTeams) ? seededTeams : []).filter(Boolean);
  if (pool.length === 3) {
    const [first, second, third] = pool.map((team, index) => cloneTeam(team, index + 1));
    return [
      [
        {
          id: 1,
          team1: second,
          team2: third,
          score1: null,
          score2: null,
          completed: false,
          round: 'eliminator',
          label: 'Eliminator (2 vs 3)',
          nextMatchId: 2,
          nextMatchSlot: 'team2',
        },
      ],
      [
        {
          id: 2,
          team1: first,
          team2: null,
          score1: null,
          score2: null,
          completed: false,
          round: 'final',
          label: 'Final (1 vs Eliminator winner)',
          nextMatchId: null,
        },
      ],
    ];
  }

  if (pool.length !== 4) {
    return [];
  }

  const [first, second, third, fourth] = pool.map((team, index) => cloneTeam(team, index + 1));

  return [
    [
      {
        id: 1,
        team1: first,
        team2: second,
        score1: null,
        score2: null,
        completed: false,
        round: 'qualifier1',
        label: 'Qualifier 1 (1 vs 2)',
        nextMatchId: 4,
        nextMatchSlot: 'team1',
        loserNextMatchId: 3,
        loserNextMatchSlot: 'team1',
      },
      {
        id: 2,
        team1: third,
        team2: fourth,
        score1: null,
        score2: null,
        completed: false,
        round: 'eliminator',
        label: 'Eliminator (3 vs 4)',
        nextMatchId: 3,
        nextMatchSlot: 'team2',
      },
    ],
    [
      {
        id: 3,
        team1: null,
        team2: null,
        score1: null,
        score2: null,
        completed: false,
        round: 'qualifier2',
        label: 'Qualifier 2',
        nextMatchId: 4,
        nextMatchSlot: 'team2',
      },
    ],
    [
      {
        id: 4,
        team1: null,
        team2: null,
        score1: null,
        score2: null,
        completed: false,
        round: 'final',
        label: 'Final',
        nextMatchId: null,
      },
    ],
  ];
};

export const orderTeamsBySeedMap = (teams = [], seedByTeamId = {}) => {
  const list = Array.isArray(teams) ? teams.filter(Boolean) : [];
  return [...list].sort((left, right) => {
    const leftSeed = Number(seedByTeamId[String(left.id)] || 0);
    const rightSeed = Number(seedByTeamId[String(right.id)] || 0);
    return leftSeed - rightSeed;
  });
};

/** Flatten bracket rounds into a single ordered match list. */
export const flattenBracketMatches = (bracket = []) => (
  (Array.isArray(bracket) ? bracket : []).flatMap((round) => (
    Array.isArray(round) ? round.filter(Boolean) : []
  ))
);

/**
 * Matches that are ready to score: both sides filled and not completed.
 * Used to drive the same Live score page as league fixtures.
 */
export const getPlayableBracketMatches = (bracket = []) => (
  flattenBracketMatches(bracket).filter((match) => (
    Boolean(match?.team1 && match?.team2) && !match.completed
  ))
);

export const getCompletedBracketMatches = (bracket = []) => (
  flattenBracketMatches(bracket).filter((match) => Boolean(match?.completed))
);

export const getOrdinalLabel = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  const mod10 = n % 10;
  if (mod10 === 1) return `${n}st`;
  if (mod10 === 2) return `${n}nd`;
  if (mod10 === 3) return `${n}rd`;
  return `${n}th`;
};

/**
 * Pick a landing index for the spin wheel.
 * Uses crypto when available for better randomness in UI.
 */
export const pickSpinIndex = (segmentCount, random = Math.random) => {
  const count = Math.max(0, Number(segmentCount) || 0);
  if (count <= 0) return 0;
  return Math.min(count - 1, Math.floor(random() * count));
};

/**
 * Compute final wheel rotation (degrees) so segment `landingIndex` stops under the top pointer.
 * Segments are drawn clockwise starting at -90deg (top).
 */
export const computeWheelRotation = ({
  segmentCount,
  landingIndex,
  currentRotation = 0,
  extraSpins = 5,
} = {}) => {
  const count = Math.max(1, Number(segmentCount) || 1);
  const index = Math.max(0, Math.min(count - 1, Number(landingIndex) || 0));
  const segmentAngle = 360 / count;
  // Center of segment index, measured clockwise from top.
  const targetCenterFromTop = index * segmentAngle + segmentAngle / 2;
  const normalize = (deg) => {
    const value = deg % 360;
    return value < 0 ? value + 360 : value;
  };
  const currentMod = normalize(currentRotation);
  const desiredMod = normalize(360 - targetCenterFromTop);
  let delta = desiredMod - currentMod;
  if (delta < 0) delta += 360;
  const spins = Math.max(3, Number(extraSpins) || 5);
  return currentRotation + spins * 360 + delta;
};

/**
 * Ball travels the outer track opposite the wheel and settles under the top marker.
 */
export const computeBallOrbit = ({
  currentAngle = 0,
  extraSpins = 7,
} = {}) => {
  const normalize = (deg) => {
    const value = deg % 360;
    return value < 0 ? value + 360 : value;
  };
  const spins = Math.max(2, Number(extraSpins) || 7);
  const currentMod = normalize(currentAngle);
  let delta = -currentMod;
  if (delta === 0) delta = -360;
  if (delta > 0) delta -= 360;
  return currentAngle + delta - spins * 360;
};
