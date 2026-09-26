export const TOURNAMENT_FORMAT_OPTIONS = [
  { value: 'league', label: '🏁 League + Final' },
  { value: 'knockoutByes', label: '🏆 Knockout + Byes' },
  { value: 'semiFinal', label: '🎯 Semi Final + Final' },
  { value: 'iplPlayoffs', label: '🏏 IPL Playoffs' },
  { value: 'fullKnockout', label: '⚔️ Full Knockout' },
];

/** Minimum teams for formats that allow choosing a count (league / knockout+byes). */
export const MIN_NUM_TEAMS = 3;
export const DEFAULT_NUM_TEAMS = MIN_NUM_TEAMS;
export const IPL_MIN_TEAMS = 3;
export const IPL_MAX_TEAMS = 4;

export const TOURNAMENT_FORMAT_HINTS = {
  league: 'Round-robin, top 2 advance to final',
  knockoutByes: '3+ teams: knockout bracket with automatic byes',
  semiFinal: '4 teams: 2 semi finals lead to 1 final',
  iplPlayoffs: '3–4 teams: IPL-style Qualifier / Eliminator playoffs (spin or manual seeds)',
  doubleElim4: '3–4 teams: IPL-style Qualifier / Eliminator playoffs (spin or manual seeds)',
  fullKnockout: '8 teams: quarter finals, semis, then final',
};

export const TOURNAMENT_FORMAT_LABELS = {
  league: 'League + Final',
  knockoutByes: 'Knockout + Byes',
  semiFinal: 'Semi Final + Final',
  iplPlayoffs: 'IPL Playoffs',
  doubleElim4: 'IPL Playoffs',
  fullKnockout: 'Full Knockout',
  playInFinal: 'Knockout + Byes',
};

export const getTournamentFormatLabel = (format) => (
  TOURNAMENT_FORMAT_LABELS[format] || 'Tournament'
);

export const getFixedTeamCountForFormat = (format) => {
  if (format === 'semiFinal') return 4;
  if (format === 'fullKnockout') return 8;
  return null;
};

export const isTeamCountLockedForFormat = (format) => (
  format === 'semiFinal' || format === 'fullKnockout'
);

export const getMaxTeamsForFormat = (format) => {
  if (format === 'league') return 12;
  if (format === 'knockoutByes') return 16;
  if (format === 'iplPlayoffs' || format === 'doubleElim4') return IPL_MAX_TEAMS;
  return getFixedTeamCountForFormat(format) || 16;
};

export const getMinTeamsForFormat = (format) => {
  if (format === 'iplPlayoffs' || format === 'doubleElim4') return IPL_MIN_TEAMS;
  return MIN_NUM_TEAMS;
};

export const resolveFormatTeamCount = (format, numTeams) => {
  const fixed = getFixedTeamCountForFormat(format);
  if (fixed) return fixed;
  const parsed = parseInt(numTeams, 10);
  const fallback = Number.isFinite(parsed) ? parsed : getMinTeamsForFormat(format);
  const min = getMinTeamsForFormat(format);
  const max = getMaxTeamsForFormat(format);
  return Math.max(min, Math.min(max, fallback));
};

const makeTeamLabels = (count) => (
  Array.from({ length: count }, (_, index) => String.fromCharCode(65 + index))
);

const ODD_PLAYER_LABEL = 'Z';

const getNextPowerOfTwo = (value) => {
  let power = 1;
  while (power < value) power *= 2;
  return power;
};

const buildRoundRobinRounds = (teams) => {
  const participants = [...teams];
  if (participants.length % 2 !== 0) {
    participants.push(null);
  }

  const totalRounds = participants.length - 1;
  const matchesPerRound = participants.length / 2;
  const rounds = [];
  let rotating = [...participants];

  for (let roundIndex = 0; roundIndex < totalRounds; roundIndex += 1) {
    const roundMatches = [];
    for (let matchIndex = 0; matchIndex < matchesPerRound; matchIndex += 1) {
      const teamA = rotating[matchIndex];
      const teamB = rotating[rotating.length - 1 - matchIndex];
      if (teamA && teamB) {
        roundMatches.push(`${teamA} vs ${teamB}`);
      } else if (teamA || teamB) {
        roundMatches.push(`${teamA || teamB} — bye`);
      }
    }
    rounds.push(roundMatches);
    const fixed = rotating[0];
    const rest = rotating.slice(1);
    rest.unshift(rest.pop());
    rotating = [fixed, ...rest];
  }

  return rounds;
};

const getKnockoutRoundTitle = (roundIndex, totalRounds, teamCount) => {
  if (teamCount === 3 && roundIndex === 0) return 'Play-in';
  const roundsFromFinal = totalRounds - roundIndex;
  if (roundsFromFinal === 1) return 'Final';
  if (roundsFromFinal === 2) return 'Semi-finals';
  if (roundsFromFinal === 3) return 'Quarter-finals';
  if (roundsFromFinal === 4) return 'Round of 16';
  return `Round ${roundIndex + 1}`;
};

const annotateMatchWithOddPlayer = (matchLabel, includeOddPlayer) => {
  if (!includeOddPlayer) return matchLabel;
  if (String(matchLabel).includes('bye')) return matchLabel;
  return `${matchLabel} · ${ODD_PLAYER_LABEL} rotates in`;
};

const buildOddPlayerSetupStage = (teamCount, format) => {
  const rosterSize = teamCount * 2;
  const isLeague = format === 'league';
  return {
    title: 'Odd player setup',
    matches: [
      `${teamCount} teams · ${rosterSize} roster players + odd ${ODD_PLAYER_LABEL}`,
      `Total pool: ${rosterSize + 1} players`,
    ],
    note: isLeague
      ? `Each league match reshuffles active pairs, swaps ${ODD_PLAYER_LABEL} into one playing slot, and benches one player.`
      : `Guide preview: before each knockout match, ${ODD_PLAYER_LABEL} can rotate into one active side while one player sits.`,
  };
};

const buildLeagueFlow = (teamCount, matchesPerPair = 1, includeOddPlayer = false) => {
  const teams = makeTeamLabels(teamCount);
  const rounds = buildRoundRobinRounds(teams);
  const pairCount = (teamCount * (teamCount - 1)) / 2;
  const totalMatches = pairCount * matchesPerPair;
  const stages = [];

  if (includeOddPlayer) {
    stages.push(buildOddPlayerSetupStage(teamCount, 'league'));
  }

  rounds.forEach((matches, index) => {
    stages.push({
      title: `League round ${index + 1}`,
      matches: matches.map((match) => annotateMatchWithOddPlayer(match, includeOddPlayer)),
      note: includeOddPlayer
        ? `For each fixture: reshuffle the ${teamCount * 2} roster players, bring ${ODD_PLAYER_LABEL} in, one player sits out.`
        : (index === 0 && teamCount % 2 === 1
          ? 'Odd team count: one team sits out each round.'
          : null),
    });
  });

  stages.push({
    title: 'Points table',
    matches: ['Rank all teams by wins / points'],
    note: 'Top 2 qualify for the final.',
  });

  if (includeOddPlayer) {
    stages.push({
      title: 'Final with odd player check',
      matches: [
        '1st place vs 2nd place',
        `If ${ODD_PLAYER_LABEL} leads individual points → joins a finalist team`,
      ],
      note: `${ODD_PLAYER_LABEL} replaces the lower individual-points player on the finalist side they’ve played with more.`,
    });
  } else {
    stages.push({
      title: 'Final',
      matches: ['1st place vs 2nd place'],
      note: 'Winner is champion.',
    });
  }

  return {
    title: TOURNAMENT_FORMAT_LABELS.league,
    summary: includeOddPlayer
      ? `League with odd-player rotation. Extra player ${ODD_PLAYER_LABEL} rotates into fixtures; may join the final on top individual points.`
      : 'Every team plays every other team. Top 2 on the table meet in the final.',
    exampleLabel: includeOddPlayer
      ? `${teamCount} teams + odd ${ODD_PLAYER_LABEL} · ${totalMatches} league match${totalMatches === 1 ? '' : 'es'} → final`
      : `${teamCount} teams · ${totalMatches} league match${totalMatches === 1 ? '' : 'es'}${matchesPerPair > 1 ? ` (${matchesPerPair} per pair)` : ''} → final`,
    stages,
  };
};

const buildKnockoutFlow = (teamCount, includeOddPlayer = false) => {
  const teams = makeTeamLabels(teamCount);
  const bracketSize = getNextPowerOfTwo(teamCount);
  const totalRounds = Math.log2(bracketSize);
  const firstRoundSlots = bracketSize / 2;
  const playCount = teamCount - firstRoundSlots;
  const byeCount = firstRoundSlots - playCount;

  let cursor = 0;
  let advancing = [];
  const firstMatches = [];

  for (let index = 0; index < firstRoundSlots; index += 1) {
    if (index < playCount) {
      const left = teams[cursor++];
      const right = teams[cursor++];
      firstMatches.push(`${left} vs ${right}`);
      advancing.push(`W(${left}/${right})`);
    } else {
      const byeTeam = teams[cursor++];
      firstMatches.push(`${byeTeam} — bye`);
      advancing.push(byeTeam);
    }
  }

  const stages = [];
  if (includeOddPlayer) {
    stages.push(buildOddPlayerSetupStage(teamCount, 'knockoutByes'));
  }

  stages.push({
    title: getKnockoutRoundTitle(0, totalRounds, teamCount),
    matches: firstMatches.map((match) => annotateMatchWithOddPlayer(match, includeOddPlayer)),
    note: [
      byeCount > 0
        ? `${byeCount} bye${byeCount === 1 ? '' : 's'} auto-advance into the next round.`
        : 'No byes — every team plays in round 1.',
      includeOddPlayer ? `${ODD_PLAYER_LABEL} can rotate into one playing side before each contested match.` : null,
    ].filter(Boolean).join(' '),
  });

  for (let roundIndex = 1; roundIndex < totalRounds; roundIndex += 1) {
    const nextAdvancing = [];
    const matches = [];
    for (let index = 0; index < advancing.length; index += 2) {
      const left = advancing[index];
      const right = advancing[index + 1];
      matches.push(`${left} vs ${right}`);
      nextAdvancing.push(`W(${left} / ${right})`);
    }
    stages.push({
      title: getKnockoutRoundTitle(roundIndex, totalRounds, teamCount),
      matches: matches.map((match) => annotateMatchWithOddPlayer(match, includeOddPlayer)),
      note: roundIndex === totalRounds - 1
        ? (includeOddPlayer
          ? `Winner is champion. ${ODD_PLAYER_LABEL} only plays if rotated into a finalist side beforehand.`
          : 'Winner is champion.')
        : (includeOddPlayer ? `${ODD_PLAYER_LABEL} may rotate again before this round’s matches.` : null),
    });
    advancing = nextAdvancing;
  }

  return {
    title: TOURNAMENT_FORMAT_LABELS.knockoutByes,
    summary: includeOddPlayer
      ? `Knockout bracket with optional odd-player rotation (${ODD_PLAYER_LABEL}) on contested matches.`
      : 'Single-elimination bracket. Extra bracket slots become automatic byes.',
    exampleLabel: includeOddPlayer
      ? `${teamCount} teams + odd ${ODD_PLAYER_LABEL} · bracket size ${bracketSize}`
      : `${teamCount} teams · bracket size ${bracketSize}${byeCount > 0 ? ` · ${byeCount} bye${byeCount === 1 ? '' : 's'}` : ''}`,
    stages,
  };
};

const buildSemiFinalFlow = (includeOddPlayer = false) => {
  const teams = makeTeamLabels(4);
  const stages = [];
  if (includeOddPlayer) {
    stages.push(buildOddPlayerSetupStage(4, 'semiFinal'));
  }
  stages.push(
    {
      title: 'Semi-finals',
      matches: [
        annotateMatchWithOddPlayer(`${teams[0]} vs ${teams[1]}`, includeOddPlayer),
        annotateMatchWithOddPlayer(`${teams[2]} vs ${teams[3]}`, includeOddPlayer),
      ],
      note: includeOddPlayer
        ? `Losers are eliminated. ${ODD_PLAYER_LABEL} can rotate into one side of each semi.`
        : 'Losers are eliminated.',
    },
    {
      title: 'Final',
      matches: [
        annotateMatchWithOddPlayer(
          `W(${teams[0]}/${teams[1]}) vs W(${teams[2]}/${teams[3]})`,
          includeOddPlayer
        ),
      ],
      note: includeOddPlayer
        ? `Winner is champion. ${ODD_PLAYER_LABEL} may rotate into the final pairing if selected.`
        : 'Winner is champion.',
    }
  );

  return {
    title: TOURNAMENT_FORMAT_LABELS.semiFinal,
    summary: includeOddPlayer
      ? `4-team knockout with odd-player ${ODD_PLAYER_LABEL} rotation on each contested match.`
      : 'Compact 4-team knockout: two semis, then one final. Three matches total.',
    exampleLabel: includeOddPlayer ? `4 teams + odd ${ODD_PLAYER_LABEL} · 3 matches` : '4 teams · 3 matches',
    stages,
  };
};

const buildIplPlayoffsFlow = (teamCount = 4, includeOddPlayer = false) => {
  const count = teamCount === 3 ? 3 : 4;
  const teams = makeTeamLabels(count);
  const stages = [];

  stages.push({
    title: 'Seed positions',
    matches: ['Spin wheel or set manual seeds (1st → last)'],
    note: 'Last remaining team receives the final position automatically.',
  });

  if (includeOddPlayer) {
    stages.push(buildOddPlayerSetupStage(count, 'iplPlayoffs'));
  }

  if (count === 3) {
    stages.push(
      {
        title: 'Eliminator',
        matches: [annotateMatchWithOddPlayer(`${teams[1]} vs ${teams[2]}`, includeOddPlayer)],
        note: '2nd vs 3rd. Loser is out.',
      },
      {
        title: 'Final',
        matches: [annotateMatchWithOddPlayer(`${teams[0]} vs Eliminator winner`, includeOddPlayer)],
        note: '1st place waits in the final (bye advantage).',
      }
    );
  } else {
    stages.push(
      {
        title: 'Qualifier 1 · Eliminator',
        matches: [
          annotateMatchWithOddPlayer(`${teams[0]} vs ${teams[1]}`, includeOddPlayer),
          annotateMatchWithOddPlayer(`${teams[2]} vs ${teams[3]}`, includeOddPlayer),
        ],
        note: 'Q1 winner → Final. Q1 loser → Qualifier 2. Eliminator winner → Qualifier 2.',
      },
      {
        title: 'Qualifier 2',
        matches: [annotateMatchWithOddPlayer('Q1 loser vs Eliminator winner', includeOddPlayer)],
        note: 'Winner reaches the Final. Loser is out.',
      },
      {
        title: 'Final',
        matches: [annotateMatchWithOddPlayer('Q1 winner vs Q2 winner', includeOddPlayer)],
        note: 'Winner is champion.',
      }
    );
  }

  return {
    title: TOURNAMENT_FORMAT_LABELS.iplPlayoffs,
    summary: count === 3
      ? 'IPL-style mini playoffs: 2nd vs 3rd eliminator, then 1st plays the winner in the final.'
      : 'IPL-style playoffs: Qualifier 1, Eliminator, Qualifier 2, then Final.',
    exampleLabel: includeOddPlayer
      ? `${count} teams + odd ${ODD_PLAYER_LABEL} · seeded playoffs`
      : `${count} teams · seeded IPL playoffs`,
    stages,
  };
};

const buildFullKnockoutFlow = (includeOddPlayer = false) => {
  const flow = buildKnockoutFlow(8, includeOddPlayer);
  return {
    ...flow,
    title: TOURNAMENT_FORMAT_LABELS.fullKnockout,
    summary: includeOddPlayer
      ? `8-team knockout with odd-player ${ODD_PLAYER_LABEL} rotation on contested matches.`
      : 'Classic 8-team single-elimination: quarters → semis → final. Seven matches total.',
    exampleLabel: includeOddPlayer ? `8 teams + odd ${ODD_PLAYER_LABEL} · 7 matches` : '8 teams · 7 matches',
  };
};

/**
 * Build a flowchart guide for the selected format + team count.
 */
export const buildTournamentFormatFlow = ({
  format = 'league',
  numTeams = DEFAULT_NUM_TEAMS,
  matchesPerPair = 1,
  includeOddPlayer = false,
} = {}) => {
  const teamCount = resolveFormatTeamCount(format, numTeams);
  const pairCount = Math.max(1, parseInt(matchesPerPair, 10) || 1);
  const withOdd = Boolean(includeOddPlayer);
  const normalized = format === 'doubleElim4' ? 'iplPlayoffs' : format;

  if (normalized === 'semiFinal') return buildSemiFinalFlow(withOdd);
  if (normalized === 'iplPlayoffs') return buildIplPlayoffsFlow(teamCount, withOdd);
  if (normalized === 'fullKnockout') return buildFullKnockoutFlow(withOdd);
  if (normalized === 'knockoutByes' || normalized === 'playInFinal') return buildKnockoutFlow(teamCount, withOdd);
  return buildLeagueFlow(teamCount, pairCount, withOdd);
};
