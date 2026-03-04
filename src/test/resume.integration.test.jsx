import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from '../App';
import { appStore } from '../store/appStore';

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

const buildTeams = () => ([
  { id: 1, emoji: '🦅', name: 'Falcons', player1: 'A1', player: 'A1', player2: 'A2' },
  { id: 2, emoji: '🐯', name: 'Tigers', player1: 'B1', player: 'B1', player2: 'B2' },
  { id: 3, emoji: '🦈', name: 'Sharks', player1: 'C1', player: 'C1', player2: 'C2' },
]);

const buildFixture = ({ id, team1, team2, completed = false, score1 = null, score2 = null, round = 1 }) => ({
  id,
  team1,
  team2,
  score1,
  score2,
  completed,
  round,
});

const buildActiveTournament = ({ firstMatchCompleted = false } = {}) => {
  const teams = buildTeams();
  return {
    id: 101,
    name: 'Resume Cup',
    date: '2026-03-01',
    teams,
    fixtures: [
      buildFixture({
        id: 1,
        team1: teams[0],
        team2: teams[1],
        completed: firstMatchCompleted,
        score1: firstMatchCompleted ? 21 : null,
        score2: firstMatchCompleted ? 15 : null,
        round: 1,
      }),
      buildFixture({
        id: 2,
        team1: teams[0],
        team2: teams[2],
        completed: false,
        score1: null,
        score2: null,
        round: 2,
      }),
    ],
    bracket: [],
    champion: null,
    format: '1',
    gameMode: 'doubles',
    tournamentFormat: 'league',
    aiSummaries: [],
    swapHistory: [],
    status: 'active',
  };
};

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

describe('Resume tournament integration', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('auto-resumes and shows the next live match when match 1 is already completed', async () => {
    localStorage.setItem('badminton_history', JSON.stringify([
      buildActiveTournament({ firstMatchCompleted: true }),
    ]));

    renderApp();

    expect(await screen.findByText(/LIVE NOW/i)).toBeInTheDocument();
    expect(screen.getByText(/Match 2/i)).toBeInTheDocument();
  });

  it('after finishing match 1, Home + Resume returns to match 2', async () => {
    localStorage.setItem('badminton_history', JSON.stringify([
      buildActiveTournament({ firstMatchCompleted: false }),
    ]));

    const user = userEvent.setup();
    renderApp();

    expect(await screen.findByText(/Match 1/i)).toBeInTheDocument();
    const [score1Input, score2Input] = screen.getAllByPlaceholderText('0');
    await user.type(score1Input, '21');
    await user.type(score2Input, '15');
    await user.click(screen.getByRole('button', { name: /Submit & Continue/i }));

    expect(await screen.findByText(/Match 2/i, {}, { timeout: 4000 })).toBeInTheDocument();

    await user.click(screen.getAllByRole('button', { name: /^Home$/i })[0]);
    expect(await screen.findByPlaceholderText(/Summer Smash 2024/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Resume/i }));
    expect(await screen.findByText(/Match 2/i)).toBeInTheDocument();
  });

  it('after finishing match 1 and refreshing, app resumes at match 2 (not match 1)', async () => {
    localStorage.setItem('badminton_history', JSON.stringify([
      buildActiveTournament({ firstMatchCompleted: false }),
    ]));

    const user = userEvent.setup();
    const firstRender = renderApp();

    expect(await screen.findByText(/Match 1/i)).toBeInTheDocument();
    const [score1Input, score2Input] = screen.getAllByPlaceholderText('0');
    await user.type(score1Input, '21');
    await user.type(score2Input, '16');
    await user.click(screen.getByRole('button', { name: /Submit & Continue/i }));
    expect(await screen.findByText(/Match 2/i, {}, { timeout: 4000 })).toBeInTheDocument();

    firstRender.unmount();

    renderApp();
    expect(await screen.findByText(/Match 2/i)).toBeInTheDocument();
  });

  it('Delete & New clears live tournament and does not show resume after refresh', async () => {
    localStorage.setItem('badminton_history', JSON.stringify([
      buildActiveTournament({ firstMatchCompleted: false }),
    ]));

    const user = userEvent.setup();
    const firstRender = renderApp();

    expect(await screen.findByText(/Match 1/i)).toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: /Delete & New/i })[0]);
    await user.click(await screen.findByRole('button', { name: /Delete & Start New/i }));

    expect(await screen.findByPlaceholderText(/Summer Smash 2024/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(localStorage.getItem('badminton_history')).toBe('[]');
    });
    expect(screen.queryByRole('button', { name: /Resume/i })).not.toBeInTheDocument();

    firstRender.unmount();
    renderApp();
    expect(await screen.findByPlaceholderText(/Summer Smash 2024/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Resume/i })).not.toBeInTheDocument();
  });
});
