import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from '../App';
import { appStore } from '../store/appStore';
import { readPersistedHistory } from './storageTestHelpers';
import { enterSportWorkspace } from './sportNavigationTestHelpers';

vi.mock('../hooks/useAppwriteSync', () => ({
  useAppwriteSync: () => ({
    isAppwriteEnabled: false,
    isConfigChecked: true,
    isSyncing: false,
    queuedWritesCount: 0,
    currentTournamentId: null,
    setCurrentTournamentId: vi.fn(),
    loadFromAppwrite: vi.fn(async () => null),
    saveTournamentToAppwrite: vi.fn(async (payload) => payload),
    deleteTournamentFromAppwrite: vi.fn(async () => true),
    saveRatingsToAppwrite: vi.fn(async (payload) => payload),
    savePlayerDatabaseToAppwrite: vi.fn(async (payload) => payload),
    saveMembersToAppwrite: vi.fn(async (payload) => payload),
    saveTemplatesToAppwrite: vi.fn(async (payload) => payload),
    savePlayerPhotosToAppwrite: vi.fn(async (payload) => payload),
    saveCasualMatchToAppwrite: vi.fn(async (payload) => payload),
    deleteCasualMatchFromAppwrite: vi.fn(async () => true),
    syncCurrentTournament: vi.fn(async () => null),
    patchTournamentMatches: vi.fn(async () => ({
      updatedMatches: 0,
      updatedParticipants: 0,
      deletedParticipants: 0,
      missingMatches: 0,
    })),
    flushOfflineOutbox: vi.fn(async () => ({ flushedCount: 0, remainingCount: 0 })),
  }),
}));

const ASYNC_UI_TIMEOUT = 15000;

const TEAM_FIXTURES = [
  { teamName: 'Aces', player1: 'Amy', player2: 'Alex' },
  { teamName: 'Dinks', player1: 'Dan', player2: 'Dana' },
  { teamName: 'Smash', player1: 'Sam', player2: 'Sky' },
];

const renderApp = () => {
  appStore.resetState();

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>,
  );
};

const startPickleballTournament = async (user, tournamentName = 'Pickleball Night') => {
  const tournamentNameInput = await enterSportWorkspace(user, 'Pickleball', ASYNC_UI_TIMEOUT);
  await user.clear(tournamentNameInput);
  await user.type(tournamentNameInput, tournamentName);
  await user.click(screen.getByRole('button', { name: /Start Tournament/i }));

  expect(await screen.findByText(/Enter Team Details/i, {}, { timeout: ASYNC_UI_TIMEOUT })).toBeInTheDocument();

  const teamNameInputs = screen.getAllByPlaceholderText('Team Name');
  const player1Inputs = screen.getAllByPlaceholderText('Player 1 Name');
  const player2Inputs = screen.getAllByPlaceholderText('Player 2 Name');

  for (let index = 0; index < TEAM_FIXTURES.length; index += 1) {
    const team = TEAM_FIXTURES[index];
    await user.type(teamNameInputs[index], team.teamName);
    await user.type(player1Inputs[index], team.player1);
    await user.type(player2Inputs[index], team.player2);
  }

  const generateButton = screen.getByRole('button', { name: /Generate Tournament/i });
  await waitFor(() => expect(generateButton).toBeEnabled(), { timeout: ASYNC_UI_TIMEOUT });
  await user.click(generateButton);

  expect(await screen.findByRole(
    'button',
    { name: /Submit & Continue/i },
    { timeout: ASYNC_UI_TIMEOUT },
  )).toBeInTheDocument();
};

const submitCurrentPickleballMatch = async (user, score1, score2) => {
  const [score1Input, score2Input] = screen.getAllByPlaceholderText('0');
  await user.type(score1Input, String(score1));
  await user.type(score2Input, String(score2));
  await user.click(screen.getByRole('button', { name: /Submit & Continue/i }));
  expect(await screen.findByText(/Saved/i, {}, { timeout: ASYNC_UI_TIMEOUT })).toBeInTheDocument();
};

describe('Pickleball workflow integration', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    window.scrollTo = vi.fn();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('creates a pickleball tournament, scores a match, and updates standings', async () => {
    const user = userEvent.setup();
    renderApp();

    await startPickleballTournament(user);
    await submitCurrentPickleballMatch(user, 11, 8);

    await waitFor(() => {
      const [activeTournament] = readPersistedHistory();
      const completedMatch = activeTournament?.fixtures?.find((match) => match.completed);
      expect(completedMatch).toBeTruthy();
      expect(activeTournament?.sportId).toBe('pickleball');
      expect(Math.max(Number(completedMatch.score1), Number(completedMatch.score2))).toBe(11);
    });

    await user.click(screen.getByRole('button', { name: /^Table$/i }));
    expect(await screen.findByText('League table', {}, { timeout: ASYNC_UI_TIMEOUT })).toBeInTheDocument();
    expect(screen.getByText('Aces')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^Reports$/i }));
    expect(await screen.findByText('Ranked by match wins', {}, { timeout: ASYNC_UI_TIMEOUT })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Top players' })).toBeInTheDocument();
  }, 30000);
});
