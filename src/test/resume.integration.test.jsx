import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from '../App';
import { appStore } from '../store/appStore';
import { readPersistedHistory, seedPersistedHistory } from './storageTestHelpers';
import { clearAutoResumeSuppressedTournamentId } from '../utils/autoResumePreference';
import {
  flushQueuedLocalStorageWrites,
  resetLocalStorageWriteQueue,
} from '../services/localStorageWriteService';

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

const buildActiveTournament = ({
  firstMatchCompleted = false,
  id = 101,
  name = 'Resume Cup',
  date = '2026-03-01',
  teamsOverride = null,
} = {}) => {
  const teams = teamsOverride || buildTeams();
  return {
    id,
    name,
    date,
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
  const ASYNC_UI_TIMEOUT = 10000;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    clearAutoResumeSuppressedTournamentId();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  afterEach(() => {
    flushQueuedLocalStorageWrites();
    resetLocalStorageWriteQueue();
    localStorage.clear();
    sessionStorage.clear();
    clearAutoResumeSuppressedTournamentId();
    vi.restoreAllMocks();
  });

  it('after finishing match 1, Home + Resume returns to match 2', async () => {
    seedPersistedHistory([
      buildActiveTournament({ firstMatchCompleted: false, id: 102 }),
    ]);

    const user = userEvent.setup();
    renderApp();

    expect(await screen.findByText(/Match 1/i, {}, { timeout: ASYNC_UI_TIMEOUT })).toBeInTheDocument();
    const [score1Input, score2Input] = screen.getAllByPlaceholderText('0');
    await user.type(score1Input, '21');
    await user.type(score2Input, '15');
    await user.click(screen.getByRole('button', { name: /Submit & Continue/i }));

    expect(await screen.findByText(/Match 2/i, {}, { timeout: ASYNC_UI_TIMEOUT })).toBeInTheDocument();

    await user.click(screen.getAllByRole('button', { name: /^Home$/i })[0]);
    expect(await screen.findByPlaceholderText(
      /Summer Smash 2024/i,
      {},
      { timeout: ASYNC_UI_TIMEOUT }
    )).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Resume/i }));
    expect(await screen.findByText(/Match 2/i, {}, { timeout: ASYNC_UI_TIMEOUT })).toBeInTheDocument();
  }, 15000);

  it('after finishing match 1 and refreshing, app resumes at match 2 (not match 1)', async () => {
    seedPersistedHistory([
      buildActiveTournament({ firstMatchCompleted: false, id: 103 }),
    ]);

    const user = userEvent.setup();
    const firstRender = renderApp();

    expect(await screen.findByText(/Match 1/i, {}, { timeout: ASYNC_UI_TIMEOUT })).toBeInTheDocument();
    const [score1Input, score2Input] = screen.getAllByPlaceholderText('0');
    await user.type(score1Input, '21');
    await user.type(score2Input, '16');
    await user.click(screen.getByRole('button', { name: /Submit & Continue/i }));
    expect(await screen.findByText(/Match 2/i, {}, { timeout: ASYNC_UI_TIMEOUT })).toBeInTheDocument();

    firstRender.unmount();

    renderApp();
    expect(await screen.findByText(/Match 2/i, {}, { timeout: ASYNC_UI_TIMEOUT })).toBeInTheDocument();
  }, 15000);

  it('Delete & New clears live tournament and does not show resume after refresh', async () => {
    seedPersistedHistory([
      buildActiveTournament({ firstMatchCompleted: false, id: 104 }),
    ]);

    const user = userEvent.setup();
    const firstRender = renderApp();

    expect(await screen.findByText(/Match 1/i, {}, { timeout: ASYNC_UI_TIMEOUT })).toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: /Delete & New/i })[0]);
    await user.click(await screen.findByRole('button', { name: /Delete & Start New/i }));

    expect(await screen.findByPlaceholderText(
      /Summer Smash 2024/i,
      {},
      { timeout: ASYNC_UI_TIMEOUT }
    )).toBeInTheDocument();
    await waitFor(() => {
      expect(JSON.stringify(readPersistedHistory())).toBe('[]');
    });
    expect(screen.queryByRole('button', { name: /Resume/i })).not.toBeInTheDocument();

    firstRender.unmount();
    renderApp();
    expect(await screen.findByPlaceholderText(
      /Summer Smash 2024/i,
      {},
      { timeout: ASYNC_UI_TIMEOUT }
    )).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Resume/i })).not.toBeInTheDocument();
  }, 15000);

  it('resumes the selected live tournament when multiple resume rows are shown on home', async () => {
    seedPersistedHistory([
      buildActiveTournament({
        id: 101,
        name: 'Morning Cup',
        date: '2026-03-01',
        firstMatchCompleted: false,
      }),
      buildActiveTournament({
        id: 202,
        name: 'Evening Cup',
        date: '2026-03-02',
        firstMatchCompleted: true,
      }),
    ]);

    const user = userEvent.setup();
    renderApp();

    expect(await screen.findByPlaceholderText(
      /Summer Smash 2024/i,
      {},
      { timeout: ASYNC_UI_TIMEOUT }
    )).toBeInTheDocument();

    const liveRows = screen.getAllByText(/Cup/i)
      .map((node) => node.closest('.setup-live-row'))
      .filter(Boolean);
    expect(liveRows).toHaveLength(2);

    const eveningRow = liveRows.find((row) => within(row).queryByText('Evening Cup'));
    expect(eveningRow).not.toBeNull();

    await user.click(within(eveningRow).getByRole('button', { name: /Resume/i }));

    expect(await screen.findByRole(
      'heading',
      { name: /Evening Cup/i, level: 1 },
      { timeout: ASYNC_UI_TIMEOUT }
    )).toBeInTheDocument();
    expect(screen.getByText(/Match 2/i)).toBeInTheDocument();
  }, 15000);

  it('deleting one live tournament row should not remove another active tournament with the same name', async () => {
    seedPersistedHistory([
      buildActiveTournament({
        id: 301,
        name: 'Night Cup',
        date: '2026-03-01',
        firstMatchCompleted: false,
        teamsOverride: buildTeams().slice(0, 3),
      }),
      buildActiveTournament({
        id: 302,
        name: 'Night Cup',
        date: '2026-03-02',
        firstMatchCompleted: true,
        teamsOverride: [
          ...buildTeams(),
          { id: 4, emoji: '🦁', name: 'Lions', player1: 'D1', player: 'D1', player2: 'D2' },
        ],
      }),
    ]);

    const user = userEvent.setup();
    renderApp();

    expect(await screen.findByPlaceholderText(
      /Summer Smash 2024/i,
      {},
      { timeout: ASYNC_UI_TIMEOUT }
    )).toBeInTheDocument();

    const liveRows = screen.getAllByText('Night Cup')
      .map((node) => node.closest('.setup-live-row'))
      .filter(Boolean);
    expect(liveRows).toHaveLength(2);

    const fourTeamRow = liveRows.find((row) => within(row).queryByText(/4 teams/i));
    expect(fourTeamRow).not.toBeNull();

    await user.click(within(fourTeamRow).getByRole('button', { name: /^Delete$/i }));

    const dialog = await screen.findByRole('dialog', { name: /Delete Tournament/i });
    await user.click(within(dialog).getByRole('button', { name: /^Delete$/i }));

    await waitFor(() => {
      const history = readPersistedHistory();
      expect(history).toHaveLength(1);
      expect(history[0]?.id).toBe(301);
    });

    expect(screen.getAllByRole('button', { name: /Resume/i })).toHaveLength(1);
  }, 15000);

  it('auto-resumes and shows the next live match when match 1 is already completed', async () => {
    seedPersistedHistory([
      buildActiveTournament({ firstMatchCompleted: true, id: 109 }),
    ]);

    renderApp();

    expect(await screen.findByText(/LIVE NOW/i, {}, { timeout: ASYNC_UI_TIMEOUT })).toBeInTheDocument();
    expect(screen.getByText(/Match 2/i)).toBeInTheDocument();
  }, 15000);
});
