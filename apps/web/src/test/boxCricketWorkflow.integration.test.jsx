import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
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

const SQUAD_FIXTURES = [
  {
    name: 'Blazers',
    players: ['Rahul', 'Sam', 'Dev', 'Kiran'],
  },
  {
    name: 'Strikers',
    players: ['Amit', 'Neel', 'Vik', 'Jo'],
  },
  {
    name: 'Royals',
    players: ['Mo', 'Ali', 'Jay', 'Ren'],
  },
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

const fillSquadTeams = async (user, teams) => {
  const teamNameInputs = screen.getAllByPlaceholderText('Team Name');
  for (let teamIndex = 0; teamIndex < teams.length; teamIndex += 1) {
    await user.type(teamNameInputs[teamIndex], teams[teamIndex].name);
  }

  for (let teamIndex = 0; teamIndex < teams.length; teamIndex += 1) {
    const teamSection = teamNameInputs[teamIndex].closest('.rounded-2xl');
    await user.click(within(teamSection).getByRole('button', { name: /Edit squad/i }));
    const playerInputs = await within(teamSection).findAllByPlaceholderText('Player name', {}, { timeout: ASYNC_UI_TIMEOUT });
    for (let playerIndex = 0; playerIndex < 4; playerIndex += 1) {
      await user.type(playerInputs[playerIndex], teams[teamIndex].players[playerIndex]);
    }
  }
};

const startBoxCricketTournament = async (user, tournamentName = 'Box Cricket Cup') => {
  const tournamentNameInput = await enterSportWorkspace(user, 'Box Cricket', ASYNC_UI_TIMEOUT);
  await user.clear(tournamentNameInput);
  await user.type(tournamentNameInput, tournamentName);
  await user.click(screen.getByRole('button', { name: /Start Tournament/i }));

  expect(await screen.findByText(/Enter Squad Details/i, {}, { timeout: ASYNC_UI_TIMEOUT })).toBeInTheDocument();
  await fillSquadTeams(user, SQUAD_FIXTURES);
  const generateButton = screen.getByRole('button', { name: /Generate Tournament/i });
  await waitFor(() => expect(generateButton).toBeEnabled(), { timeout: ASYNC_UI_TIMEOUT });
  await user.click(generateButton);

  await screen.findByText(/Toss won by/i, {}, { timeout: ASYNC_UI_TIMEOUT });
  const tossWinnerSection = screen.getByText(/Toss won by/i).closest('.box-cricket-toss-section');
  await user.click(within(tossWinnerSection).getAllByRole('button')[0]);
  await user.click(screen.getByRole('button', { name: /Bat first/i }));

  expect(await screen.findByText(/How do you want to score/i, {}, { timeout: ASYNC_UI_TIMEOUT })).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: /Runs & wickets/i }));
  await user.click(screen.getByRole('button', { name: /Start match/i }));

  expect(await screen.findByRole('button', { name: /Submit Result/i }, { timeout: ASYNC_UI_TIMEOUT })).toBeInTheDocument();
};

const submitCurrentBoxCricketInnings = async (user, team1Runs, team2Runs) => {
  const title = screen.getByRole('heading', { name: / vs /i });
  const [team1Name, team2Name] = title.textContent.split(' vs ').map((part) => part.trim());
  await user.type(screen.getByRole('textbox', { name: `${team1Name} runs` }), String(team1Runs));
  await user.type(screen.getByRole('textbox', { name: `${team2Name} runs` }), String(team2Runs));
  await user.click(screen.getByRole('button', { name: /Submit Result/i }));
  expect(await screen.findByText(/Saved/i, {}, { timeout: ASYNC_UI_TIMEOUT })).toBeInTheDocument();
  return { team1Name, team2Name };
};

describe('Box cricket workflow integration', () => {
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

  it('creates a box cricket tournament, scores an innings match, and updates the NRR table', async () => {
    const user = userEvent.setup();
    renderApp();

    await startBoxCricketTournament(user);

    const liveHeading = await screen.findByRole('heading', { name: / vs /i }, { timeout: ASYNC_UI_TIMEOUT });
    expect(SQUAD_FIXTURES.some(({ name }) => liveHeading.textContent.includes(name))).toBe(true);

    const { team1Name } = await submitCurrentBoxCricketInnings(user, 54, 48);

    await waitFor(() => {
      const [activeTournament] = readPersistedHistory();
      const completedMatch = activeTournament?.fixtures?.find((match) => match.completed);
      expect(completedMatch).toBeTruthy();
      expect(completedMatch?.statistics?.sportId).toBe('boxCricket');
      const winnerRuns = Math.max(Number(completedMatch.score1), Number(completedMatch.score2));
      expect(winnerRuns).toBe(54);
    });

    await user.click(screen.getByRole('button', { name: /^Table$/i }));
    expect(await screen.findByText('League table', {}, { timeout: ASYNC_UI_TIMEOUT })).toBeInTheDocument();
    expect(screen.getByText('NRR')).toBeInTheDocument();
    expect(screen.getByText(team1Name)).toBeInTheDocument();
  }, 30000);
});
