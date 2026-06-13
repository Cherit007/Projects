import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from '../App';
import { appStore } from '../store/appStore';
import { readPersistedHistory, seedPersistedHistory } from './storageTestHelpers';

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

const ASYNC_UI_TIMEOUT = 10000;
const TEAM_FIXTURES = [
  { teamName: 'Falcons', player1: 'A1', player2: 'A2' },
  { teamName: 'Tigers', player1: 'B1', player2: 'B2' },
  { teamName: 'Sharks', player1: 'C1', player2: 'C2' },
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
    </QueryClientProvider>
  );
};

const readHistory = () => readPersistedHistory();

const waitForHomeScreen = async () => (
  screen.findByPlaceholderText(/Summer Smash 2024/i, {}, { timeout: ASYNC_UI_TIMEOUT })
);

const startTournament = async (user, tournamentName = 'League Night 1st Tournament') => {
  const tournamentNameInput = await waitForHomeScreen();
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

  await user.click(screen.getByRole('button', { name: /Generate Tournament/i }));
  expect(await screen.findByRole(
    'button',
    { name: /Submit & Continue/i },
    { timeout: ASYNC_UI_TIMEOUT }
  )).toBeInTheDocument();
};

const submitLiveMatch = async (user, score1, score2, expectedNextLabel) => {
  const [score1Input, score2Input] = screen.getAllByPlaceholderText('0');
  await user.type(score1Input, String(score1));
  await user.type(score2Input, String(score2));
  const submitButton = await screen.findByRole(
    'button',
    { name: /Submit & Continue/i },
    { timeout: ASYNC_UI_TIMEOUT }
  );
  await user.click(submitButton);

  if (expectedNextLabel) {
    expect(await screen.findByText(expectedNextLabel, {}, { timeout: ASYNC_UI_TIMEOUT })).toBeInTheDocument();
  }
};

const openFinalAndDeclareChampion = async (user, score1 = 21, score2 = 18) => {
  expect(await screen.findByText(/All league matches completed!/i, {}, { timeout: ASYNC_UI_TIMEOUT })).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: /Open Final/i }));

  const [score1Input, score2Input] = await screen.findAllByPlaceholderText('0', {}, { timeout: ASYNC_UI_TIMEOUT });
  await user.type(score1Input, String(score1));
  await user.type(score2Input, String(score2));
  await user.click(screen.getByRole('button', { name: /Declare Champion/i }));

  expect(await screen.findByText(/Tournament Complete!/i, {}, { timeout: ASYNC_UI_TIMEOUT })).toBeInTheDocument();
};

describe('Tournament workflow integration', () => {
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

  it('keeps the user on home after refresh so the tournament can be resumed manually', async () => {
    const user = userEvent.setup();
    const firstRender = renderApp();

    await startTournament(user);
    await submitLiveMatch(user, 21, 16, /Match 2/i);

    await waitFor(() => {
      const [activeTournament] = readHistory();
      expect(activeTournament?.status).toBe('active');
      expect(activeTournament?.fixtures?.[0]?.completed).toBe(true);
    });

    await user.click(screen.getAllByRole('button', { name: /^Home$/i })[0]);
    expect(await waitForHomeScreen()).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Resume/i })).toBeInTheDocument();

    firstRender.unmount();
    renderApp();

    expect(await waitForHomeScreen()).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Resume/i }));
    expect(await screen.findByText(/Match 2/i, {}, { timeout: ASYNC_UI_TIMEOUT })).toBeInTheDocument();
  }, 20000);

  it('completes a resumed tournament and starts the next tournament with the same teams', async () => {
    const user = userEvent.setup();
    renderApp();

    await startTournament(user);
    await submitLiveMatch(user, 21, 16, /Match 2/i);

    await user.click(screen.getAllByRole('button', { name: /^Home$/i })[0]);
    expect(await waitForHomeScreen()).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Resume/i }));
    expect(await screen.findByText(/Match 2/i, {}, { timeout: ASYNC_UI_TIMEOUT })).toBeInTheDocument();

    await submitLiveMatch(user, 21, 19, /Match 3/i);
    await submitLiveMatch(user, 22, 20, null);
    await openFinalAndDeclareChampion(user, 21, 17);

    await user.click(screen.getByRole('button', { name: /Next Tournament/i }));
    expect(await screen.findByText(/Start Next Tournament/i, {}, { timeout: ASYNC_UI_TIMEOUT })).toBeInTheDocument();
    expect(screen.getByDisplayValue('League Night 2nd Tournament')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^OK$/i }));
    expect(screen.getByText(/League Night 2nd Tournament/i)).toBeInTheDocument();
    expect(await screen.findByRole(
      'button',
      { name: /Submit & Continue/i },
      { timeout: ASYNC_UI_TIMEOUT }
    )).toBeInTheDocument();

    await waitFor(() => {
      const history = readHistory();
      expect(history).toHaveLength(2);
      expect(history.find((entry) => entry.name === 'League Night 1st Tournament')?.status).toBe('completed');
      expect(history.find((entry) => entry.name === 'League Night 2nd Tournament')?.status).toBe('active');
    });
  }, 25000);

  it('does not show Resume after a tournament is fully completed and the app refreshes', async () => {
    const user = userEvent.setup();
    const firstRender = renderApp();

    await startTournament(user, 'Championship 1st Tournament');
    await submitLiveMatch(user, 21, 16, /Match 2/i);
    await submitLiveMatch(user, 21, 19, /Match 3/i);
    await submitLiveMatch(user, 22, 20, null);
    await openFinalAndDeclareChampion(user, 21, 15);
    await waitFor(() => {
      expect(readHistory()[0]?.status).toBe('completed');
    });

    await user.click(screen.getAllByRole('button', { name: /^Home$/i })[0]);
    expect(await waitForHomeScreen()).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Resume/i })).not.toBeInTheDocument();

    firstRender.unmount();
    renderApp();

    expect(await waitForHomeScreen()).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Resume/i })).not.toBeInTheDocument();
  }, 25000);

  it('opens the next tournament in team edit mode with the previous roster prefilled', async () => {
    const user = userEvent.setup();
    renderApp();

    await startTournament(user, 'Edit Flow 1st Tournament');
    await submitLiveMatch(user, 21, 16, /Match 2/i);
    await submitLiveMatch(user, 21, 19, /Match 3/i);
    await submitLiveMatch(user, 22, 20, null);
    await openFinalAndDeclareChampion(user, 21, 14);

    await user.click(screen.getByRole('button', { name: /Next Tournament/i }));
    expect(await screen.findByText(/Start Next Tournament/i, {}, { timeout: ASYNC_UI_TIMEOUT })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^Edit$/i }));

    expect(await screen.findByText(/Enter Team Details/i, {}, { timeout: ASYNC_UI_TIMEOUT })).toBeInTheDocument();
    const teamNameInputs = screen.getAllByPlaceholderText('Team Name');
    const player1Inputs = screen.getAllByPlaceholderText('Player 1 Name');
    const player2Inputs = screen.getAllByPlaceholderText('Player 2 Name');

    TEAM_FIXTURES.forEach((team, index) => {
      expect(teamNameInputs[index]).toHaveValue(team.teamName);
      expect(player1Inputs[index]).toHaveValue(team.player1);
      expect(player2Inputs[index]).toHaveValue(team.player2);
    });
  }, 25000);
});
