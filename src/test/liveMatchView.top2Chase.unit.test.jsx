import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LiveMatchView from '../components/LiveMatchView';

vi.mock('../components/PlayerAvatar', () => ({
  default: ({ name }) => <span data-testid="avatar">{name}</span>,
}));

vi.mock('../components/predictions/MatchPredictionCard', () => ({
  default: () => null,
}));

vi.mock('../components/live/LiveNarrativePanel', () => ({
  default: () => null,
}));

const teams = [
  { id: 1, name: 'Falcons', emoji: '🦅', player1: 'Amy', player2: 'Ben' },
  { id: 2, name: 'Tigers', emoji: '🐯', player1: 'Cara', player2: 'Dan' },
  { id: 3, name: 'Sharks', emoji: '🦈', player1: 'Eve', player2: 'Finn' },
  { id: 4, name: 'Wolves', emoji: '🐺', player1: 'Gus', player2: 'Hana' },
];

const pointsTable = [
  { ...teams[0], played: 2, won: 2, lost: 0, points: 4, scoreDiff: 20, netMatchRate: 10 },
  { ...teams[1], played: 2, won: 1, lost: 1, points: 2, scoreDiff: 2, netMatchRate: 1 },
  { ...teams[2], played: 2, won: 1, lost: 1, points: 2, scoreDiff: -2, netMatchRate: -1 },
  { ...teams[3], played: 2, won: 0, lost: 2, points: 0, scoreDiff: -20, netMatchRate: -10 },
];

const fixtures = [
  { id: 1, completed: true, team1: teams[0], team2: teams[3], score1: 21, score2: 10 },
  { id: 2, completed: true, team1: teams[0], team2: teams[2], score1: 21, score2: 12 },
  { id: 3, completed: true, team1: teams[1], team2: teams[3], score1: 21, score2: 15 },
  { id: 4, completed: true, team1: teams[2], team2: teams[1], score1: 21, score2: 18 },
  { id: 5, completed: false, team1: teams[2], team2: teams[3] },
  { id: 6, completed: false, team1: teams[0], team2: teams[1] },
];

const currentMatch = {
  id: 5,
  team1: teams[2],
  team2: teams[3],
  completed: false,
};

describe('LiveMatchView Top 2 chase', () => {
  it('shows Points to Top 2 for both teams before scores are entered', () => {
    render(
      <LiveMatchView
        currentMatch={currentMatch}
        onSaveScore={vi.fn()}
        pointsTable={pointsTable}
        fixtures={fixtures}
        nextMatches={[]}
      />
    );

    expect(screen.getByText('Points to Top 2')).toBeInTheDocument();
    expect(screen.getByText(/Sharks: need .* for Top 2/i)).toBeInTheDocument();
    expect(screen.getByText(/Wolves: need .* for Top 2/i)).toBeInTheDocument();
    expect(screen.queryByText('Enter scores to preview Top 2 movement')).not.toBeInTheDocument();
  });

  it('updates Top 2 watch after scores are typed', async () => {
    const user = userEvent.setup();
    render(
      <LiveMatchView
        currentMatch={currentMatch}
        onSaveScore={vi.fn()}
        pointsTable={pointsTable}
        fixtures={fixtures}
        nextMatches={[]}
      />
    );

    const team1Score = screen.getByLabelText(/Sharks score/i);
    const team2Score = screen.getByLabelText(/Wolves score/i);
    await user.clear(team1Score);
    await user.type(team1Score, '21');
    await user.clear(team2Score);
    await user.type(team2Score, '10');

    expect(screen.getByText(/Sharks wins → moves to rank #/i)).toBeInTheDocument();
  });
});
