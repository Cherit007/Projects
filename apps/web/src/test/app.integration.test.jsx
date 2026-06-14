import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from '../App';
import { appStore } from '../store/appStore';
import { enterSportWorkspace, waitForSportHub, waitForSportHome } from './sportNavigationTestHelpers';

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

describe('App integration flows', () => {
  const ASYNC_UI_TIMEOUT = 10000;

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
      </QueryClientProvider>
    );
  };

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loads setup screen in local mode', async () => {
    const user = userEvent.setup();
    renderApp();

    await waitForSportHub(ASYNC_UI_TIMEOUT);
    await enterSportWorkspace(user, 'Badminton', ASYNC_UI_TIMEOUT);
    expect(screen.getByRole('button', { name: /Start Tournament/i })).toBeInTheDocument();
  }, 15000);

  it('runs setup -> team entry validation workflow', async () => {
    const user = userEvent.setup();
    renderApp();

    const nameInput = await enterSportWorkspace(user, 'Badminton', ASYNC_UI_TIMEOUT);
    await user.type(nameInput, 'Integration Cup');
    await user.click(screen.getByRole('button', { name: /Start Tournament/i }));

    expect(await screen.findByText(
      /Enter Team Details/i,
      {},
      { timeout: ASYNC_UI_TIMEOUT }
    )).toBeInTheDocument();

    const generateButton = screen.getByRole('button', { name: /Generate Tournament/i });
    expect(generateButton).toBeDisabled();

    const teamNameInputs = screen.getAllByPlaceholderText('Team Name');
    const player1Inputs = screen.getAllByPlaceholderText('Player 1 Name');
    const player2Inputs = screen.getAllByPlaceholderText('Player 2 Name');

    for (let i = 0; i < teamNameInputs.length; i += 1) {
      await user.type(teamNameInputs[i], `Team ${i + 1}`);
      await user.type(player1Inputs[i], `P${i + 1}A`);
      await user.type(player2Inputs[i], `P${i + 1}B`);
    }

    expect(generateButton).not.toBeDisabled();
  }, 15000);

  it('runs full local feature flow: start -> generate -> submit -> table -> home -> resume', async () => {
    const user = userEvent.setup();
    renderApp();

    const tournamentNameInput = await enterSportWorkspace(user, 'Badminton', ASYNC_UI_TIMEOUT);
    expect(screen.getByText(/Local mode/i)).toBeInTheDocument();
    await user.clear(tournamentNameInput);
    await user.type(tournamentNameInput, 'Full Flow Cup');
    await user.click(screen.getByRole('button', { name: /Start Tournament/i }));

    expect(await screen.findByText(
      /Enter Team Details/i,
      {},
      { timeout: ASYNC_UI_TIMEOUT }
    )).toBeInTheDocument();
    const teamNameInputs = screen.getAllByPlaceholderText('Team Name');
    const player1Inputs = screen.getAllByPlaceholderText('Player 1 Name');
    const player2Inputs = screen.getAllByPlaceholderText('Player 2 Name');

    for (let i = 0; i < teamNameInputs.length; i += 1) {
      await user.type(teamNameInputs[i], `Flow Team ${i + 1}`);
      await user.type(player1Inputs[i], `Flow${i + 1}A`);
      await user.type(player2Inputs[i], `Flow${i + 1}B`);
    }

    await user.click(screen.getByRole('button', { name: /Generate Tournament/i }));
    expect(await screen.findByRole(
      'button',
      { name: /Submit & Continue/i },
      { timeout: ASYNC_UI_TIMEOUT }
    )).toBeInTheDocument();

    const [score1Input, score2Input] = screen.getAllByPlaceholderText('0');
    await user.type(score1Input, '21');
    await user.type(score2Input, '18');
    await user.click(screen.getByRole('button', { name: /Submit & Continue/i }));
    expect(await screen.findByText(/Match 2/i, {}, { timeout: 5000 })).toBeInTheDocument();

    const tableButtons = screen.getAllByRole('button', { name: /^Table$/i });
    await user.click(tableButtons[0]);
    expect(await screen.findByText(/League table/i)).toBeInTheDocument();

    const homeButtons = screen.getAllByRole('button', { name: /^Home$/i });
    await user.click(homeButtons[0]);
    expect(await waitForSportHome(ASYNC_UI_TIMEOUT)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Resume/i }));
    expect(await screen.findByRole('button', { name: /Submit & Continue/i })).toBeInTheDocument();
    expect(screen.getByText(/Match 2/i)).toBeInTheDocument();
  }, 15000);
});
