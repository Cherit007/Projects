import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from '../App';
import { appStore } from '../store/appStore';

vi.mock('../hooks/useAppwriteSync', () => ({
  useAppwriteSync: () => ({
    isAppwriteEnabled: false,
    isConfigChecked: true,
    isSyncing: false,
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
    syncCurrentTournament: vi.fn(async () => null),
  }),
}));

describe('App integration flows', () => {
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
    renderApp();

    expect(await screen.findByPlaceholderText(/Summer Smash 2024/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Start Tournament/i })).toBeInTheDocument();
  });

  it('runs setup -> team entry validation workflow', async () => {
    const user = userEvent.setup();
    renderApp();

    const nameInput = await screen.findByPlaceholderText(/Summer Smash 2024/i);
    await user.type(nameInput, 'Integration Cup');
    await user.click(screen.getByRole('button', { name: /Start Tournament/i }));

    expect(await screen.findByText(/Enter Team Details/i)).toBeInTheDocument();

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
  });
});
