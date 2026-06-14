/** @type {import('./types.js').SportConfig} */
export const pickleballSport = {
  id: 'pickleball',
  name: 'Pickleball',
  icon: '🏓',
  available: true,
  participantModel: 'pair',
  gameModes: [
    { value: 'doubles', label: 'Doubles', icon: '🏓', description: '2 players per team' },
    { value: 'singles', label: 'Singles', icon: '👤', description: '1 player per team' },
    { value: 'mixed', label: 'Mixed Doubles', icon: '⚡', description: 'Mixed doubles' },
  ],
  formats: [
    { value: 'league', label: 'League + Final', icon: '🏁' },
    { value: 'knockoutByes', label: 'Knockout + Byes', icon: '🏆' },
    { value: 'semiFinal', label: 'Semi Final + Final', icon: '🎯' },
    { value: 'fullKnockout', label: 'Full Knockout', icon: '⚔️' },
  ],
  matchesPerPair: [
    { value: '1', label: '1 Match' },
    { value: '2', label: '2 Matches' },
  ],
  formatHints: {
    league: 'Round-robin — top 2 advance to the final',
    knockoutByes: '3+ teams — knockout bracket with automatic byes',
    semiFinal: '4 teams — 2 semis lead to 1 final',
    fullKnockout: '8 teams — quarters, semis, then final',
  },
  gameModeLabels: {
    doubles: 'Doubles',
    singles: 'Singles',
    mixed: 'Mixed Doubles',
  },
  formatLabels: {
    league: 'League + Final',
    knockoutByes: 'Knockout + Byes',
    semiFinal: 'Semi Final + Final',
    fullKnockout: 'Full Knockout',
  },
  scoring: {
    pointsPerWin: 2,
    kFactor: 32,
    defaultRating: 1000,
    quickScores: [11, 15, 21],
    winRuleCopy: 'Win by 2',
  },
  narrativeCopy: {
    streakLeaders: 'Kitchen streaks',
    rivalries: 'Repeat matchups',
    formWatch: 'Rating movers',
    upsetWatch: 'Dink upset watch',
  },
};
