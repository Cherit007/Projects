import { render, screen } from '@testing-library/react';
import SetupScreen from '../components/SetupScreen';

vi.mock('../components/TemplateManager', () => ({
  default: () => <div data-testid="template-manager">template-manager</div>,
}));

vi.mock('../components/TournamentViewer', () => ({
  default: () => null,
}));

vi.mock('../components/PlayerProfileModal', () => ({
  default: () => null,
}));

vi.mock('../components/pairing/PairingAnalyticsModal', () => ({
  default: () => null,
}));

vi.mock('../components/rankings/FormPowerRankingsModal', () => ({
  default: () => null,
}));

const baseProps = {
  tournamentName: 'Mobile Cup',
  setTournamentName: vi.fn(),
  numTeams: 3,
  setNumTeams: vi.fn(),
  format: '1',
  setFormat: vi.fn(),
  gameMode: 'doubles',
  setGameMode: vi.fn(),
  tournamentFormat: 'league',
  setTournamentFormat: vi.fn(),
  onNext: vi.fn(),
  tournamentHistory: [],
  scheduledTournaments: [],
  activeLiveTournaments: [],
  onEditScheduledTournament: vi.fn(),
  onStartScheduledTournament: vi.fn(),
  onResumeActiveTournament: vi.fn(),
  onDeleteActiveTournament: vi.fn(),
  canDeleteLiveTournament: true,
  canDeleteActions: true,
  casualMatches: [],
  playerDatabase: [],
  teamNameDatabase: [],
  members: [],
  showHistory: false,
  setShowHistory: vi.fn(),
  showCasualHistory: false,
  setShowCasualHistory: vi.fn(),
  showAllTimeStats: false,
  setShowAllTimeStats: vi.fn(),
  showEloLeaderboard: false,
  setShowEloLeaderboard: vi.fn(),
  tournamentTemplates: [],
  onSaveTemplate: vi.fn(),
  onApplyTemplate: vi.fn(),
  onDeleteTemplate: vi.fn(),
  onDeleteTournament: vi.fn(),
  onDeleteCasualMatch: vi.fn(),
  allTimeStats: [],
  eloLeaderboard: [],
  playerRatings: {},
  canEditPlayerPhoto: vi.fn(() => false),
  pairingAnalytics: [],
  formPowerRankings: [],
  playerPhotos: {},
  onUpdatePlayerPhoto: vi.fn(),
  isAppwriteEnabled: false,
  historyHydrated: true,
  casualHydrated: true,
  historyHydrationPending: false,
  casualHydrationPending: false,
  getActionPending: vi.fn(() => false),
  syncStatus: { tone: 'saved', label: 'All changes saved', busy: false },
  isMobileViewport: true,
};

describe('SetupScreen mobile bottom sheets', () => {
  it('renders tournament history as explicit bottom sheet on mobile', () => {
    render(
      <SetupScreen
        {...baseProps}
        showHistory
        tournamentHistory={[{ id: 't1', name: 'Night Cup', date: 'Today', teams: [] }]}
      />
    );

    const dialog = screen.getByRole('dialog', { name: /Tournament History/i });
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveClass('mobile-bottom-sheet-shell');
  });

  it('renders casual history as explicit bottom sheet on mobile', () => {
    render(
      <SetupScreen
        {...baseProps}
        showCasualHistory
        casualMatches={[{ id: 'c1', team1: { player: 'A' }, team2: { player: 'B' }, score1: 21, score2: 18 }]}
      />
    );

    const dialog = screen.getByRole('dialog', { name: /Casual Match History/i });
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveClass('mobile-bottom-sheet-shell');
  });

  it('renders elo leaderboard as explicit bottom sheet on mobile', () => {
    render(
      <SetupScreen
        {...baseProps}
        showEloLeaderboard
        eloLeaderboard={[{ name: 'Alice', rating: 1200, matchesPlayed: 3, history: [{ change: 12 }] }]}
      />
    );

    const dialog = screen.getByRole('dialog', { name: /ELO Rating Leaderboard/i });
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveClass('mobile-bottom-sheet-shell');
  });
});

