import { render, screen, within } from '@testing-library/react';
import SetupScreen from '../components/SetupScreen';

vi.mock('../components/TemplateManager', () => ({
  default: () => <div data-testid="template-manager">template-manager</div>,
}));

vi.mock('../components/TournamentViewer', () => ({
  default: () => <div data-testid="tournament-viewer">tournament-viewer</div>,
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
  tournamentName: 'Dashboard Cup',
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
  onRecordCasualMatch: vi.fn(),
  tournamentHistory: [],
  scheduledTournaments: [],
  activeLiveTournaments: [],
  onEditScheduledTournament: vi.fn(),
  onStartScheduledTournament: vi.fn(),
  onShareScheduledTournament: vi.fn(),
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
};

const getDashboardCard = (label) => screen.getByText(label).closest('.setup-dashboard-card');

describe('SetupScreen dashboard metrics and sync status', () => {
  it('shows sync chip and computes dashboard metrics from tournaments + casual matches', () => {
    const history = [
      {
        id: 't1',
        status: 'completed',
        champion: { name: 'Winners' },
        fixtures: [
          { id: 'm1', completed: true },
          { id: 'm2', completed: false },
        ],
        bracket: [[{ id: 'b1', completed: true }]],
        finalMatch: { id: 'f1', completed: true },
      },
      {
        id: 't2',
        status: 'active',
        champion: null,
        fixtures: [{ id: 'm3', completed: true }],
        bracket: [],
        finalMatch: null,
      },
    ];

    render(
      <SetupScreen
        {...baseProps}
        tournamentHistory={history}
        casualMatches={[{ id: 'c1' }, { id: 'c2' }]}
        scheduledTournaments={[{ id: 's1' }, { id: 's2' }]}
        activeLiveTournaments={[{ id: 'l1' }]}
        eloLeaderboard={[{ name: 'Alice', rating: 1260, matchesPlayed: 10, history: [] }]}
        syncStatus={{ tone: 'syncing', label: 'Syncing...', busy: true }}
      />
    );

    expect(screen.getByText(/Syncing.../i)).toBeInTheDocument();

    expect(within(getDashboardCard('Completed Tournaments')).getByText('1')).toBeInTheDocument();
    expect(within(getDashboardCard('Casual Matches')).getByText('2')).toBeInTheDocument();
    expect(within(getDashboardCard('Total Matches Played')).getByText('6')).toBeInTheDocument();
    expect(screen.queryByText('Live Now')).not.toBeInTheDocument();
    expect(screen.queryByText('Scheduled')).not.toBeInTheDocument();

    const topEloCard = getDashboardCard('Alice (Top ELO)');
    expect(within(topEloCard).getByText('1260')).toBeInTheDocument();
  });

  it('handles empty edge cases with zero values and pending top ELO', () => {
    render(
      <SetupScreen
        {...baseProps}
        tournamentHistory={[]}
        casualMatches={[]}
        scheduledTournaments={[]}
        activeLiveTournaments={[]}
        eloLeaderboard={[]}
        syncStatus={{ tone: 'queued', label: '2 queued', busy: true }}
      />
    );

    expect(screen.getByText('2 queued')).toBeInTheDocument();
    expect(within(getDashboardCard('Completed Tournaments')).getByText('0')).toBeInTheDocument();
    expect(within(getDashboardCard('Casual Matches')).getByText('0')).toBeInTheDocument();
    expect(within(getDashboardCard('Total Matches Played')).getByText('0')).toBeInTheDocument();
    expect(screen.queryByText('Live Now')).not.toBeInTheDocument();
    expect(screen.queryByText('Scheduled')).not.toBeInTheDocument();

    const topEloCard = getDashboardCard('Top ELO Pending');
    expect(within(topEloCard).getByText('--')).toBeInTheDocument();
  });

  it('shows WhatsApp action for scheduled tournaments and triggers share callback', async () => {
    const user = (await import('@testing-library/user-event')).default.setup();
    const onShareScheduledTournament = vi.fn();

    render(
      <SetupScreen
        {...baseProps}
        onShareScheduledTournament={onShareScheduledTournament}
        scheduledTournaments={[
          {
            id: 'sched-1',
            name: 'Friday Club Match',
            date: '2026-03-06 7:00 PM',
            teams: [{ id: 1 }, { id: 2 }, { id: 3 }],
          },
        ]}
      />
    );

    const shareButton = screen.getByRole('button', { name: /whatsapp/i });
    await user.click(shareButton);
    expect(onShareScheduledTournament).toHaveBeenCalledTimes(1);
    expect(onShareScheduledTournament.mock.calls[0][0]).toMatchObject({
      id: 'sched-1',
      name: 'Friday Club Match',
    });
  });
});
