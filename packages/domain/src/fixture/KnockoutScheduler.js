const getNextPowerOfTwo = (value) => {
  let power = 1;
  while (power < value) power *= 2;
  return power;
};

const getKnockoutRoundLabel = (roundIndex, totalRounds, isPlayInRound) => {
  if (isPlayInRound && roundIndex === 0) return 'playin';

  const roundsFromFinal = totalRounds - roundIndex;
  if (roundsFromFinal === 1) return 'final';
  if (roundsFromFinal === 2) return 'semi';
  if (roundsFromFinal === 3) return 'quarter';
  if (roundsFromFinal === 4) return 'round16';
  return `round${roundIndex + 1}`;
};

const autoAdvanceByeWinners = (bracket) => {
  let changed = true;

  while (changed) {
    changed = false;

    for (let roundIndex = 0; roundIndex < bracket.length; roundIndex++) {
      for (let matchIndex = 0; matchIndex < bracket[roundIndex].length; matchIndex++) {
        const match = bracket[roundIndex][matchIndex];
        if (!match || match.completed) continue;

        const hasTeam1 = Boolean(match.team1);
        const hasTeam2 = Boolean(match.team2);

        // Auto-advance only for non-final rounds; finals must be played.
        if (((hasTeam1 && !hasTeam2) || (!hasTeam1 && hasTeam2)) && match.nextMatchId) {
          const winner = hasTeam1 ? match.team1 : match.team2;
          match.score1 = hasTeam1 ? 1 : 0;
          match.score2 = hasTeam1 ? 0 : 1;
          match.completed = true;

          if (match.nextMatchId) {
            for (let nextRoundIndex = roundIndex + 1; nextRoundIndex < bracket.length; nextRoundIndex++) {
              const nextMatch = bracket[nextRoundIndex].find(m => m.id === match.nextMatchId);
              if (!nextMatch) continue;
              if (!nextMatch.team1) {
                nextMatch.team1 = winner;
              } else if (!nextMatch.team2) {
                nextMatch.team2 = winner;
              }
              break;
            }
          }

          changed = true;
        }
      }
    }
  }

  return bracket;
};

const generateKnockoutBracketWithByes = (teams) => {
  const shuffledTeams = [...teams].sort(() => Math.random() - 0.5);
  const bracketSize = getNextPowerOfTwo(shuffledTeams.length);
  const totalRounds = Math.log2(bracketSize);
  const firstRoundMatches = bracketSize / 2;
  const matchesToPlayInFirstRound = shuffledTeams.length - firstRoundMatches;
  const isPlayInRound = shuffledTeams.length === 3;

  let matchId = 1;
  const roundSizes = Array.from({ length: totalRounds }, (_, roundIndex) =>
    bracketSize / Math.pow(2, roundIndex + 1)
  );
  const bracket = roundSizes.map((size, roundIndex) =>
    Array.from({ length: size }, () => ({
      id: matchId++,
      team1: null,
      team2: null,
      score1: null,
      score2: null,
      completed: false,
      round: getKnockoutRoundLabel(roundIndex, totalRounds, isPlayInRound),
      nextMatchId: null,
    }))
  );

  // First round: only the required matches are played, remaining teams get byes.
  let teamCursor = 0;
  for (let i = 0; i < firstRoundMatches; i++) {
    const match = bracket[0][i];
    if (i < matchesToPlayInFirstRound) {
      match.team1 = shuffledTeams[teamCursor++] || null;
      match.team2 = shuffledTeams[teamCursor++] || null;
    } else {
      match.team1 = shuffledTeams[teamCursor++] || null;
      match.team2 = null;
    }
  }

  // Wire next match ids (binary tree progression).
  for (let roundIndex = 0; roundIndex < bracket.length - 1; roundIndex++) {
    for (let matchIndex = 0; matchIndex < bracket[roundIndex].length; matchIndex++) {
      const nextMatch = bracket[roundIndex + 1][Math.floor(matchIndex / 2)];
      bracket[roundIndex][matchIndex].nextMatchId = nextMatch?.id || null;
    }
  }

  return autoAdvanceByeWinners(bracket);
};

/** Generate knockout bracket for the given format variant. */
export const generateKnockoutBracket = (teams, format) => {
  if (format === 'knockoutByes') {
    return generateKnockoutBracketWithByes(teams);
  }

  if (format === 'playInFinal') {
    const shuffledTeams = [...teams].sort(() => Math.random() - 0.5);
    const bracket = [
      [
        { id: 1, team1: shuffledTeams[0], team2: shuffledTeams[1], score1: null, score2: null, completed: false, round: 'playin', nextMatchId: 2 }
      ],
      [
        { id: 2, team1: shuffledTeams[2], team2: null, score1: null, score2: null, completed: false, round: 'final' }
      ]
    ];
    return autoAdvanceByeWinners(bracket);
  } else if (format === 'semiFinal') {
    return generateKnockoutBracketWithByes(teams.slice(0, 4));
  } else if (format === 'fullKnockout') {
    return generateKnockoutBracketWithByes(teams.slice(0, 8));
  }
};

export const updateBracket = (bracket, matchId, score1, score2) => {
  const updatedBracket = JSON.parse(JSON.stringify(bracket));
  let matchFound = false;
  let winner = null;

  for (let roundIndex = 0; roundIndex < updatedBracket.length; roundIndex++) {
    for (let matchIndex = 0; matchIndex < updatedBracket[roundIndex].length; matchIndex++) {
      const match = updatedBracket[roundIndex][matchIndex];
      if (match.id === matchId) {
        match.score1 = score1;
        match.score2 = score2;
        match.completed = true;
        winner = score1 > score2 ? match.team1 : match.team2;
        matchFound = true;

        if (match.nextMatchId) {
          for (let nextRoundIndex = roundIndex + 1; nextRoundIndex < updatedBracket.length; nextRoundIndex++) {
            for (let nextMatchIndex = 0; nextMatchIndex < updatedBracket[nextRoundIndex].length; nextMatchIndex++) {
              const nextMatch = updatedBracket[nextRoundIndex][nextMatchIndex];
              if (nextMatch.id === match.nextMatchId) {
                if (nextMatch.team1 === null) {
                  nextMatch.team1 = winner;
                } else if (nextMatch.team2 === null) {
                  nextMatch.team2 = winner;
                }
              }
            }
          }
        }
        break;
      }
    }
    if (matchFound) break;
  }

  return updatedBracket;
};
