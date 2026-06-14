import { applyRandomOddPlayerSwapToLeagueFixtures } from './draft';

export const injectRotatingOddPlayer = ({
  fixtures: baseFixtures = [],
  oddPlayerName = '',
  teams: baseTeams = [],
} = {}) => {
  const oddName = (oddPlayerName || '').trim();
  if (!oddName) return baseFixtures;

  const randomOddPlayerAssignments = applyRandomOddPlayerSwapToLeagueFixtures({
    fixtures: baseFixtures,
    teams: baseTeams,
    oddPlayerName: oddName,
  });
  if (randomOddPlayerAssignments.ok) {
    return randomOddPlayerAssignments.fixtures;
  }

  const playCount = {};
  const allPlayers = new Set([oddName]);
  const bump = (name) => {
    if (!name) return;
    playCount[name] = (playCount[name] || 0) + 1;
  };
  const getCount = (name) => playCount[name] || 0;

  baseFixtures.forEach((fixture) => {
    [
      fixture?.team1?.player || fixture?.team1?.player1,
      fixture?.team1?.player2,
      fixture?.team2?.player || fixture?.team2?.player1,
      fixture?.team2?.player2,
    ].filter(Boolean).forEach((name) => allPlayers.add(name));
  });

  const evaluateOption = (players) => {
    const next = {};
    allPlayers.forEach((name) => {
      next[name] = getCount(name);
    });
    players.forEach((name) => {
      if (!name) return;
      next[name] = (next[name] || 0) + 1;
    });
    const values = Object.values(next);
    const max = Math.max(...values);
    const min = Math.min(...values);
    return {
      imbalance: max - min,
      oddAppearances: next[oddName] || 0,
    };
  };

  const totalPlayerSlots = baseFixtures.length * 4;
  const minOddAppearances = Math.max(1, Math.floor(totalPlayerSlots / Math.max(1, allPlayers.size)));
  const updatedFixtures = [];

  baseFixtures.forEach((fixture, index) => {
    const team1P1 = fixture?.team1?.player1 || fixture?.team1?.player;
    const team1P2 = fixture?.team1?.player2;
    const team2P1 = fixture?.team2?.player1 || fixture?.team2?.player;
    const team2P2 = fixture?.team2?.player2;
    const candidates = [
      { team: 'team1', slot: 'player1', name: team1P1 },
      { team: 'team1', slot: 'player2', name: team1P2 },
      { team: 'team2', slot: 'player1', name: team2P1 },
      { team: 'team2', slot: 'player2', name: team2P2 },
    ].filter((item) => item.name);

    if (candidates.length < 4) {
      updatedFixtures.push(fixture);
      return;
    }

    const makeFixture = (benchTarget = null) => {
      const updatedFixture = {
        ...fixture,
        team1: { ...fixture.team1 },
        team2: { ...fixture.team2 },
      };
      if (!benchTarget) return updatedFixture;
      if (benchTarget.team === 'team1') {
        updatedFixture.team1[benchTarget.slot] = oddName;
        if (benchTarget.slot === 'player1') {
          updatedFixture.team1.player = oddName;
        }
      } else {
        updatedFixture.team2[benchTarget.slot] = oddName;
        if (benchTarget.slot === 'player1') {
          updatedFixture.team2.player = oddName;
        }
      }
      return updatedFixture;
    };

    const oddPlayedSoFar = getCount(oddName);
    const remainingFixturesAfterThis = baseFixtures.length - index - 1;
    const oddStillNeeded = Math.max(0, minOddAppearances - oddPlayedSoFar);
    const mustUseOddNow = oddStillNeeded > remainingFixturesAfterThis;

    const optionFixtures = [
      ...(!mustUseOddNow ? [makeFixture(null)] : []),
      ...candidates.map((candidate) => makeFixture(candidate)),
    ];

    const scoredOptions = optionFixtures.map((candidateFixture) => {
      const playersInMatch = [
        candidateFixture.team1.player || candidateFixture.team1.player1,
        candidateFixture.team1.player2,
        candidateFixture.team2.player || candidateFixture.team2.player1,
        candidateFixture.team2.player2,
      ].filter(Boolean);
      const score = evaluateOption(playersInMatch);
      return { candidateFixture, playersInMatch, score };
    });

    scoredOptions.sort((a, b) => {
      if (a.score.imbalance !== b.score.imbalance) {
        return a.score.imbalance - b.score.imbalance;
      }
      if (!mustUseOddNow && a.score.oddAppearances !== b.score.oddAppearances) {
        return a.score.oddAppearances - b.score.oddAppearances;
      }
      return 0;
    });

    const best = scoredOptions.filter((option) => (
      option.score.imbalance === scoredOptions[0].score.imbalance
      && option.score.oddAppearances === scoredOptions[0].score.oddAppearances
    ));
    const selected = best[Math.floor(Math.random() * best.length)];

    selected.playersInMatch.forEach(bump);
    updatedFixtures.push(selected.candidateFixture);
  });

  return updatedFixtures;
};
