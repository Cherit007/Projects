import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TournamentView from '../components/Tournamentview';

vi.mock('../components/LiveMatchView', () => ({
  default: () => <div data-testid="live-view">LIVE VIEW</div>,
}));

vi.mock('../components/MatchCard', () => ({
  default: () => <div data-testid="match-card">MATCH CARD</div>,
}));

vi.mock('../components/FinalMatchCard', () => ({
  default: () => <div data-testid="final-view">FINAL VIEW</div>,
}));

vi.mock('../components/BracketView', () => ({
  default: () => <div data-testid="bracket-view">BRACKET VIEW</div>,
}));

vi.mock('../components/Bracketmatchmodal', () => ({
  default: () => null,
}));

vi.mock('../components/PlayerProfileModal', () => ({
  default: () => null,
}));

vi.mock('../components/MatchSummaryFeed', () => ({
  default: () => <div data-testid="match-summary-feed">SUMMARY FEED</div>,
}));

vi.mock('../components/TournamentAwards', () => ({
  default: () => <div data-testid="tournament-awards">AWARDS</div>,
}));

vi.mock('../components/AutocompleteInput', () => ({
  default: () => <input aria-label="autocomplete-input" />,
}));

const teams = [
  { id: 1, emoji: '🦅', name: 'Falcons', player1: 'A1', player: 'A1', player2: 'A2' },
  { id: 2, emoji: '🐯', name: 'Tigers', player1: 'B1', player: 'B1', player2: 'B2' },
  { id: 3, emoji: '🦈', name: 'Sharks', player1: 'C1', player: 'C1', player2: 'C2' },
];

const calculatePointsTable = (inputTeams = []) => inputTeams.map((team, index) => ({
  ...team,
  played: 1,
  won: index === 0 ? 1 : 0,
  lost: index === 0 ? 0 : 1,
  points: index === 0 ? 2 : 0,
  scoreDiff: index === 0 ? 3 : -3,
  netMatchRate: index === 0 ? 3 : -3,
}));

const baseProps = {
  tournamentName: 'Command Cup',
  setTournamentName: vi.fn(),
  format: '1',
  tournamentFormat: 'league',
  fixtures: [
    {
      id: 1,
      round: 1,
      completed: false,
      score1: null,
      score2: null,
      team1: teams[0],
      team2: teams[1],
    },
  ],
  bracket: [],
  teams,
  champion: null,
  members: [],
  playerDatabase: [],
  playerRatings: {},
  gameMode: 'doubles',
  tournamentHistory: [],
  currentTournamentId: null,
  casualMatches: [],
  aiMatchSummaries: [],
  oddPlayerEnabled: false,
  oddPlayerName: '',
  playerPhotos: {},
  onUpdatePlayerPhoto: vi.fn(),
  canEditPlayerPhoto: vi.fn(() => false),
  onSaveMatchResult: vi.fn(async () => true),
  onPrioritizeMatch: vi.fn(),
  onSaveBracketResult: vi.fn(async () => true),
  onSaveFinalResult: vi.fn(async () => true),
  onSwapTeamMember: vi.fn(() => true),
  swapHistory: [],
  onGoHome: vi.fn(),
  onResetTournament: vi.fn(),
  onRerunTournament: vi.fn(),
  onStartNextTournament: vi.fn(),
  calculatePointsTable,
  calculatePlayerStats: vi.fn(() => []),
  getPlayerLeaderboard: vi.fn(() => [{ name: 'A1', rating: 1020, matchesPlayed: 1, history: [] }]),
  getActionPending: vi.fn(() => false),
  syncStatus: { tone: 'syncing', label: 'Syncing...', busy: true },
};

describe('TournamentView command bar and sync state', () => {
  it('shows sync chip and supports mobile command bar navigation in league mode', async () => {
    const user = userEvent.setup();
    const onGoHome = vi.fn();

    render(<TournamentView {...baseProps} onGoHome={onGoHome} />);

    expect(screen.getByText('Syncing...')).toBeInTheDocument();
    expect(screen.getByText('LIVE VIEW')).toBeInTheDocument();

    const commandBar = document.querySelector('.tour-command-bar');
    expect(commandBar).toBeTruthy();
    const command = within(commandBar);

    await user.click(command.getByRole('button', { name: /Table/i }));
    expect(screen.getByText(/Points Table/i)).toBeInTheDocument();

    await user.click(command.getByRole('button', { name: /Final/i }));
    expect(screen.getByText(/Complete all league matches first/i)).toBeInTheDocument();

    await user.click(command.getByRole('button', { name: /^Home$/i }));
    expect(onGoHome).toHaveBeenCalledTimes(1);
  });

  it('switches secondary command button to ELO for knockout formats', async () => {
    const user = userEvent.setup();
    render(
      <TournamentView
        {...baseProps}
        tournamentFormat="semiFinal"
        fixtures={[]}
        bracket={[[{ id: 'k1', completed: false, team1: teams[0], team2: teams[1] }]]}
      />
    );

    const commandBar = document.querySelector('.tour-command-bar');
    expect(commandBar).toBeTruthy();
    const command = within(commandBar);

    const eloButton = command.getByRole('button', { name: /^ELO$/i });
    expect(eloButton).toBeInTheDocument();
    await user.click(eloButton);

    expect(screen.getByText(/ELO Leaderboard/i)).toBeInTheDocument();
  });
});
