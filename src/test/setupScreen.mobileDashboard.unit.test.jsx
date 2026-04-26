import React, { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

const mobileBaseProps = {
  tournamentHistory: [],
  scheduledTournaments: [],
  activeLiveTournaments: [],
  onEditScheduledTournament: vi.fn(),
  onStartScheduledTournament: vi.fn(),
  onViewScheduledTournament: vi.fn(),
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
  onOpenUtilityDrawer: vi.fn(),
};

const MobileSetupHarness = ({
  initialView = 'home',
  initialName = 'Mobile Cup',
  initialNumTeams = 3,
  initialFormat = '1',
  initialGameMode = 'doubles',
  initialTournamentFormat = 'league',
  eloLeaderboard = [],
  ...overrides
}) => {
  const [mobileSetupView, setMobileSetupView] = useState(initialView);
  const [tournamentName, setTournamentName] = useState(initialName);
  const [numTeams, setNumTeams] = useState(initialNumTeams);
  const [format, setFormat] = useState(initialFormat);
  const [gameMode, setGameMode] = useState(initialGameMode);
  const [tournamentFormat, setTournamentFormat] = useState(initialTournamentFormat);

  return (
    <SetupScreen
      {...mobileBaseProps}
      {...overrides}
      tournamentName={tournamentName}
      setTournamentName={setTournamentName}
      numTeams={numTeams}
      setNumTeams={setNumTeams}
      format={format}
      setFormat={setFormat}
      gameMode={gameMode}
      setGameMode={setGameMode}
      tournamentFormat={tournamentFormat}
      setTournamentFormat={setTournamentFormat}
      onNext={vi.fn()}
      eloLeaderboard={eloLeaderboard}
      mobileSetupView={mobileSetupView}
      setMobileSetupView={setMobileSetupView}
    />
  );
};

describe('SetupScreen mobile dashboard views', () => {
  it('navigates from home to stats to full ELO and back', async () => {
    const user = userEvent.setup();

    render(
      <MobileSetupHarness
        eloLeaderboard={[
          { name: 'Alice', rating: 1180, matchesPlayed: 12, history: [{ change: 8, date: new Date().toISOString() }] },
          { name: 'Bob', rating: 1110, matchesPlayed: 9, history: [{ change: -4, date: new Date().toISOString() }] },
        ]}
      />
    );

    expect(screen.getByRole('heading', { name: 'Tournament' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Insights \+ History/i }));
    expect(screen.getByRole('heading', { name: 'Stats' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Full list/i }));
    expect(screen.getByRole('heading', { name: 'ELO Leaderboard' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Alice/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Back/i }));
    expect(screen.getByRole('heading', { name: 'Stats' })).toBeInTheDocument();
  });

  it('updates create screen selection groups as true single-select controls', async () => {
    const user = userEvent.setup();

    render(<MobileSetupHarness initialView="create" />);

    const singlesOption = screen.getByRole('radio', { name: /Singles/i });
    await user.click(singlesOption);
    expect(singlesOption).toHaveAttribute('aria-checked', 'true');

    const semiFinalOption = screen.getByRole('radio', { name: /Semi Final \+ Final/i });
    await user.click(semiFinalOption);
    expect(semiFinalOption).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByDisplayValue('4')).toBeDisabled();
    expect(screen.getByText(/2 semi finals lead to 1 final/i)).toBeInTheDocument();

    const fullKnockoutOption = screen.getByRole('radio', { name: /Full Knockout/i });
    await user.click(fullKnockoutOption);
    expect(screen.getByDisplayValue('8')).toBeDisabled();

    const leagueOption = screen.getByRole('radio', { name: /League \+ Final/i });
    await user.click(leagueOption);
    expect(screen.getByDisplayValue('3')).not.toBeDisabled();

    const twoMatchesOption = screen.getByRole('radio', { name: /2 Matches/i });
    await user.click(twoMatchesOption);
    expect(twoMatchesOption).toHaveAttribute('aria-checked', 'true');
  });

  it('switches live tabs and shows the correct tournament sections', async () => {
    const user = userEvent.setup();

    render(
      <MobileSetupHarness
        initialView="live"
        activeLiveTournaments={[
          {
            id: 'live-1',
            name: 'Sunday League',
            date: '2026-04-19',
            fixtures: [
              { id: 'm1', completed: true },
              { id: 'm2', completed: false, team1: { name: 'A' }, team2: { name: 'B' }, round: 2 },
            ],
          },
        ]}
        scheduledTournaments={[
          { id: 'sched-1', name: 'Friday Club Match', date: '2026-04-21', teams: [{ id: 1 }, { id: 2 }] },
        ]}
        tournamentHistory={[
          { id: 'done-1', name: 'Completed Cup', status: 'completed', champion: { name: 'Winners' }, date: '2026-04-12' },
        ]}
      />
    );

    expect(screen.getByText(/Sunday League/i)).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /Scheduled/i }));
    expect(screen.getByText(/Friday Club Match/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /WhatsApp/i })).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /Completed/i }));
    expect(screen.getByText(/Completed Cup/i)).toBeInTheDocument();
  });

  it('filters the ELO leaderboard by active time window', async () => {
    const user = userEvent.setup();
    const now = Date.now();

    render(
      <MobileSetupHarness
        initialView="elo"
        eloLeaderboard={[
          {
            name: 'Alice',
            rating: 1205,
            matchesPlayed: 14,
            history: [{ change: 12, newRating: 1205, date: new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString() }],
          },
          {
            name: 'Bob',
            rating: 1120,
            matchesPlayed: 11,
            history: [{ change: 9, newRating: 1120, date: new Date(now - 45 * 24 * 60 * 60 * 1000).toISOString() }],
          },
        ]}
      />
    );

    expect(screen.getByRole('button', { name: /Alice/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Bob/i })).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /This Week/i }));
    expect(screen.getByRole('button', { name: /Alice/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Bob/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /All Time/i }));
    expect(screen.getByRole('button', { name: /Bob/i })).toBeInTheDocument();
  });
});
