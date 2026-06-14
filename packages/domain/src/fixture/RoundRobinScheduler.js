export const buildRoundRobinRounds = (teams) => {
  const participants = [...teams];
  if (participants.length % 2 !== 0) {
    participants.push(null); // BYE for odd team counts
  }

  const totalRounds = participants.length - 1;
  const matchesPerRound = participants.length / 2;
  const rounds = [];

  let rotating = [...participants];
  for (let roundIndex = 0; roundIndex < totalRounds; roundIndex++) {
    const roundMatches = [];

    for (let matchIndex = 0; matchIndex < matchesPerRound; matchIndex++) {
      const teamA = rotating[matchIndex];
      const teamB = rotating[rotating.length - 1 - matchIndex];

      if (teamA && teamB) {
        roundMatches.push([teamA, teamB]);
      }
    }

    rounds.push(roundMatches);

    // Circle method: keep first team fixed, rotate the rest.
    const fixed = rotating[0];
    const rest = rotating.slice(1);
    rest.unshift(rest.pop());
    rotating = [fixed, ...rest];
  }

  return rounds;
};

/** Generate fixtures in true round-robin order for league tournaments. */
export const generateFixtures = (teams, format) => {
  const matchesPerPair = Math.max(1, parseInt(format, 10) || 1);
  const baseRounds = buildRoundRobinRounds(teams);
  const newFixtures = [];
  let matchId = 1;

  for (let cycle = 0; cycle < matchesPerPair; cycle++) {
    baseRounds.forEach((roundMatches, roundIndex) => {
      roundMatches.forEach(([teamA, teamB]) => {
        const isReturnLeg = cycle % 2 === 1;
        newFixtures.push({
          id: matchId++,
          team1: isReturnLeg ? teamB : teamA,
          team2: isReturnLeg ? teamA : teamB,
          score1: null,
          score2: null,
          completed: false,
          round: cycle * baseRounds.length + roundIndex + 1,
        });
      });
    });
  }

  return newFixtures;
};
