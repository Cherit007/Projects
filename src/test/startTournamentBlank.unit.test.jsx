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

const renderApp = () => {
  appStore.resetState();
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  );
};

describe('Start Tournament navigation', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    window.location.hash = '';
    window.history.replaceState({}, '', '/');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows team entry after Start Tournament and keeps #/teams', async () => {
    const user = userEvent.setup();
    renderApp();

    const nameInput = await screen.findByPlaceholderText(/Summer Smash 2024/i);
    await user.type(nameInput, 'Blank Check Cup');
    await user.click(screen.getByRole('button', { name: /Start Tournament/i }));

    expect(await screen.findByText(/Enter Team Details/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(window.location.hash).toBe('#/teams');
    });
    expect(screen.getAllByPlaceholderText('Team Name').length).toBeGreaterThan(0);
  });

  it('shows team entry on mobile after Start Tournament from create view', async () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query) => ({
        matches: String(query).includes('max-width'),
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    const user = userEvent.setup();
    renderApp();

    const createBtn = await screen.findByRole('button', { name: /\+ Create Tournament/i });
    await user.click(createBtn);

    const nameInput = await screen.findByPlaceholderText(/Summer Smash 2026/i);
    await user.type(nameInput, 'Mobile Blank Check');
    await user.click(screen.getByRole('button', { name: /Start Tournament/i }));

    expect(await screen.findByText(/Enter Team Details/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(window.location.hash).toBe('#/teams');
    });
  });
});
