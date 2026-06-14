/** @type {import('./types.js').SportConfig} */
export const boxCricketSport = {
  id: 'boxCricket',
  name: 'Box Cricket',
  icon: '🏏',
  available: true,
  participantModel: 'squad',
  squad: {
    minPlayers: 3,
    maxPlayers: 11,
    defaultSlots: 6,
  },
  defaultRuleConfig: {
    oversLimit: 6,
    maxWickets: 10,
    ballType: 'standard',
    superOverEnabled: true,
    powerplayOvers: 0,
    bonusRunsPerWicket: 0,
    penaltyRunsPerWide: 1,
    lastManStanding: false,
    retiredOutAllowed: false,
    pointsPerWin: 2,
    pointsPerTie: 1,
  },
  gameModes: [
    { value: 'team', label: 'Team', icon: '🏏', description: 'Squad vs squad' },
  ],
  formats: [
    { value: 'casual', label: 'Casual Match', icon: '🤝' },
    { value: 'league', label: 'League + Final', icon: '🏁' },
    { value: 'knockoutByes', label: 'Knockout + Byes', icon: '🏆' },
  ],
  matchesPerPair: [
    { value: '1', label: '1 Match' },
  ],
  formatHints: {
    casual: 'One-off match — pick teams, squads, and score (summary or ball-by-ball)',
    league: 'Round-robin — top teams advance (formats TBD)',
    knockoutByes: 'Knockout bracket with byes (formats TBD)',
  },
  gameModeLabels: {
    team: 'Team',
  },
  formatLabels: {
    casual: 'Casual Match',
    league: 'League + Final',
    knockoutByes: 'Knockout + Byes',
  },
  scoring: {
    pointsPerWin: 2,
    kFactor: 32,
    defaultRating: 1000,
    quickScores: [],
  },
};
