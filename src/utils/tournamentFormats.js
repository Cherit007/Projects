export const TOURNAMENT_FORMAT_OPTIONS = [
  { value: 'league', label: '🏁 League + Final' },
  { value: 'knockoutByes', label: '🏆 Knockout + Byes' },
  { value: 'semiFinal', label: '🎯 Semi Final + Final' },
  { value: 'doubleElim4', label: '🔁 Second Chance (5 games)' },
  { value: 'fullKnockout', label: '⚔️ Full Knockout' },
];

/** Minimum teams for formats that allow choosing a count (league / knockout+byes). */
export const MIN_NUM_TEAMS = 3;
export const DEFAULT_NUM_TEAMS = MIN_NUM_TEAMS;

export const TOURNAMENT_FORMAT_HINTS = {
  league: 'Round-robin, top 2 advance to final',
  knockoutByes: '3+ teams: knockout bracket with automatic byes',
  semiFinal: '4 teams: 2 semi finals lead to 1 final',
  doubleElim4: '4 teams: random openers, winners + losers paths, then final (5 games)',
  fullKnockout: '8 teams: quarter finals, semis, then final',
};

export const TOURNAMENT_FORMAT_LABELS = {
  league: 'League + Final',
  knockoutByes: 'Knockout + Byes',
  semiFinal: 'Semi Final + Final',
  doubleElim4: 'Second Chance (5 games)',
  fullKnockout: 'Full Knockout',
  playInFinal: 'Knockout + Byes',
};

export const getTournamentFormatLabel = (format) => (
  TOURNAMENT_FORMAT_LABELS[format] || 'Tournament'
);

export const getFixedTeamCountForFormat = (format) => {
  if (format === 'semiFinal' || format === 'doubleElim4') return 4;
  if (format === 'fullKnockout') return 8;
  return null;
};

export const isTeamCountLockedForFormat = (format) => (
  format === 'semiFinal' || format === 'doubleElim4' || format === 'fullKnockout'
);

export const getMaxTeamsForFormat = (format) => {
  if (format === 'league') return 12;
  if (format === 'knockoutByes') return 16;
  return getFixedTeamCountForFormat(format) || 16;
};

export const resolveFormatTeamCount = (format, numTeams) => {
  const fixed = getFixedTeamCountForFormat(format);
  if (fixed) return fixed;
  const parsed = parseInt(numTeams, 10);
  const fallback = Number.isFinite(parsed) ? parsed : MIN_NUM_TEAMS;
  const max = getMaxTeamsForFormat(format);
  return Math.max(MIN_NUM_TEAMS, Math.min(max, fallback));
};

const makeTeamLabels = (count) => (
  Array.from({ length: count }, (_, index) => String.fromCharCode(65 + index))
);

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

const buildLeagueFlow = (teamCount, matchesPerPair = 1) => {
  const teams = makeTeamLabels(teamCount);
  const rounds = buildRoundRobinRounds(teams);
  const pairCount = (teamCount * (teamCount - 1)) / 2;
  const totalMatches = pairCount * matchesPerPair;
  const stages = rounds.map((matches, index) => ({
    title: `League round ${index + 1}`,
    matches,
    note: index === 0 && teamCount % 2 === 1
      ? 'Odd team count: one team sits out each round.'
      : null,
  }));

  stages.push({
    title: 'Points table',
    matches: ['Rank all teams by wins / points'],
    note: 'Top 2 qualify for the final.',
  });
  stages.push({
    title: 'Final',
    matches: ['1st place vs 2nd place'],
    note: 'Winner is champion.',
  });

  return {
    title: TOURNAMENT_FORMAT_LABELS.league,
    summary: 'Every team plays every other team. Top 2 on the table meet in the final.',
    exampleLabel: `${teamCount} teams · ${totalMatches} league match${totalMatches === 1 ? '' : 'es'}${matchesPerPair > 1 ? ` (${matchesPerPair} per pair)` : ''} → final`,
    stages,
  };
};

const buildKnockoutFlow = (teamCount) => {
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

  const stages = [
    {
      title: getKnockoutRoundTitle(0, totalRounds, teamCount),
      matches: firstMatches,
      note: byeCount > 0
        ? `${byeCount} bye${byeCount === 1 ? '' : 's'} auto-advance into the next round.`
        : 'No byes — every team plays in round 1.',
    },
  ];

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
      matches,
      note: roundIndex === totalRounds - 1 ? 'Winner is champion.' : null,
    });
    advancing = nextAdvancing;
  }

  return {
    title: TOURNAMENT_FORMAT_LABELS.knockoutByes,
    summary: 'Single-elimination bracket. Extra bracket slots become automatic byes.',
    exampleLabel: `${teamCount} teams · bracket size ${bracketSize}${byeCount > 0 ? ` · ${byeCount} bye${byeCount === 1 ? '' : 's'}` : ''}`,
    stages,
  };
};

const buildSemiFinalFlow = () => {
  const teams = makeTeamLabels(4);
  return {
    title: TOURNAMENT_FORMAT_LABELS.semiFinal,
    summary: 'Compact 4-team knockout: two semis, then one final. Three matches total.',
    exampleLabel: '4 teams · 3 matches',
    stages: [
      {
        title: 'Semi-finals',
        matches: [`${teams[0]} vs ${teams[1]}`, `${teams[2]} vs ${teams[3]}`],
        note: 'Losers are eliminated.',
      },
      {
        title: 'Final',
        matches: [`W(${teams[0]}/${teams[1]}) vs W(${teams[2]}/${teams[3]})`],
        note: 'Winner is champion.',
      },
    ],
  };
};

const buildDoubleElim4Flow = () => {
  const teams = makeTeamLabels(4);
  return {
    title: TOURNAMENT_FORMAT_LABELS.doubleElim4,
    summary: '4-team short double-elim. Opener losers get one more match before the championship final.',
    exampleLabel: '4 teams · 5 matches',
    stages: [
      {
        title: 'Opening matches',
        matches: [`${teams[0]} vs ${teams[1]}`, `${teams[2]} vs ${teams[3]}`],
        note: 'Pairings are randomized when you generate.',
      },
      {
        title: 'Winners final · Losers match',
        matches: [
          `W(${teams[0]}/${teams[1]}) vs W(${teams[2]}/${teams[3]})`,
          `L(${teams[0]}/${teams[1]}) vs L(${teams[2]}/${teams[3]})`,
        ],
        note: 'Losers get a second chance instead of being eliminated immediately.',
      },
      {
        title: 'Championship final',
        matches: ['Winners-final winner vs Losers-match winner'],
        note: 'Winner is champion.',
      },
    ],
  };
};

const buildFullKnockoutFlow = () => {
  const flow = buildKnockoutFlow(8);
  return {
    ...flow,
    title: TOURNAMENT_FORMAT_LABELS.fullKnockout,
    summary: 'Classic 8-team single-elimination: quarters → semis → final. Seven matches total.',
    exampleLabel: '8 teams · 7 matches',
  };
};

/**
 * Build a flowchart guide for the selected format + team count.
 */
export const buildTournamentFormatFlow = ({
  format = 'league',
  numTeams = DEFAULT_NUM_TEAMS,
  matchesPerPair = 1,
} = {}) => {
  const teamCount = resolveFormatTeamCount(format, numTeams);
  const pairCount = Math.max(1, parseInt(matchesPerPair, 10) || 1);

  if (format === 'semiFinal') return buildSemiFinalFlow();
  if (format === 'doubleElim4') return buildDoubleElim4Flow();
  if (format === 'fullKnockout') return buildFullKnockoutFlow();
  if (format === 'knockoutByes' || format === 'playInFinal') return buildKnockoutFlow(teamCount);
  return buildLeagueFlow(teamCount, pairCount);
};
