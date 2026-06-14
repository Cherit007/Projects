import { render, screen } from '@testing-library/react';
import AppViewRouter from '../components/AppViewRouter';

vi.mock('../components/SetupScreen', () => ({
  default: (props) => <div data-testid="setup-screen">setup:{props.step}</div>,
}));

vi.mock('../components/Teamentry', () => ({
  default: (props) => <div data-testid="team-entry">teams:{props.step}</div>,
}));

vi.mock('../components/Tournamentview', () => ({
  default: (props) => <div data-testid="tournament-view">tournament:{props.step}</div>,
}));

vi.mock('../components/CasualMatch', () => ({
  default: () => <div data-testid="casual-match">casual</div>,
}));

vi.mock('../components/AuthScreen', () => ({
  default: () => <div data-testid="auth-screen">auth</div>,
}));

vi.mock('../components/GroupAccessScreen', () => ({
  default: () => <div data-testid="group-access-screen">group-access</div>,
}));

vi.mock('../components/GroupHeader', () => ({
  default: ({ role }) => <div data-testid="group-header">header:{role}</div>,
}));

vi.mock('../components/ViewerDashboard', () => ({
  default: () => <div data-testid="viewer-dashboard">viewer</div>,
}));

vi.mock('../components/GroupRequestsCenter', () => ({
  default: () => <div data-testid="group-requests-center">requests</div>,
}));

const baseProps = {
  isConfigChecked: true,
  authResolved: true,
  groupResolved: true,
  requiresAuth: false,
  currentUser: null,
  isGuestViewer: false,
  activeGroup: null,
  groupRole: null,
  showRequestCenter: false,
  isViewerMode: false,
  authLoading: false,
  availableGroups: [],
  publicGroups: [],
  requestedGroupIds: [],
  unreadRequestCount: 0,
  pendingJoinRequests: [],
  recentJoinReviews: [],
  inviteLoading: false,
  onLogin: vi.fn(),
  onRegister: vi.fn(),
  onContinueAsViewer: vi.fn(),
  onCreateGroup: vi.fn(),
  onRequestAccess: vi.fn(),
  onWatchGroup: vi.fn(),
  onSelectGroup: vi.fn(),
  onOpenProfile: vi.fn(),
  onBackToGroups: vi.fn(),
  onOpenRequestCenter: vi.fn(),
  onLogout: vi.fn(),
  onCloseRequestCenter: vi.fn(),
  onApproveRequest: vi.fn(),
  onRejectRequest: vi.fn(),
  viewerDashboardProps: {},
  setupScreenProps: { step: 'setup' },
  teamEntryProps: { step: 'none' },
  tournamentViewProps: { step: 'none' },
  casualMatchProps: {},
  showCasualMatch: false,
  appModals: <div data-testid="app-modals">modals</div>,
};

describe('AppViewRouter integration workflows', () => {
  it('shows loading shell while config/auth/group resolution is pending', () => {
    render(<AppViewRouter {...baseProps} isConfigChecked={false} />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('routes unauthenticated user to auth screen when auth is required', async () => {
    render(<AppViewRouter {...baseProps} requiresAuth currentUser={null} isGuestViewer={false} />);
    expect(await screen.findByTestId('auth-screen')).toBeInTheDocument();
  });

  it('routes user without selected group to group access screen', async () => {
    render(<AppViewRouter {...baseProps} requiresAuth currentUser={{ $id: 'u1' }} activeGroup={null} />);
    expect(await screen.findByTestId('group-access-screen')).toBeInTheDocument();
  });

  it('renders admin request center workflow', async () => {
    render(
      <AppViewRouter
        {...baseProps}
        requiresAuth
        currentUser={{ $id: 'u1' }}
        activeGroup={{ id: 'g1', name: 'Club' }}
        groupRole="admin"
        showRequestCenter
      />
    );

    expect(await screen.findByTestId('group-header')).toHaveTextContent('header:admin');
    expect(screen.getByTestId('group-requests-center')).toBeInTheDocument();
    expect(screen.getByTestId('app-modals')).toBeInTheDocument();
  });

  it('renders viewer dashboard workflow in read-only mode', async () => {
    render(
      <AppViewRouter
        {...baseProps}
        requiresAuth
        currentUser={{ $id: 'u1' }}
        activeGroup={{ id: 'g1', name: 'Club' }}
        groupRole="viewer"
        isViewerMode
      />
    );

    expect(await screen.findByTestId('group-header')).toHaveTextContent('header:viewer');
    expect(screen.getByTestId('viewer-dashboard')).toBeInTheDocument();
  });

  it('renders setup workflow in default app mode', async () => {
    render(<AppViewRouter {...baseProps} />);

    expect(await screen.findByTestId('setup-screen')).toHaveTextContent('setup:setup');
    expect(screen.queryByTestId('team-entry')).not.toBeInTheDocument();
    expect(screen.queryByTestId('tournament-view')).not.toBeInTheDocument();
  });

  it('renders team entry workflow when step is teams', async () => {
    render(<AppViewRouter {...baseProps} setupScreenProps={{ step: 'none' }} teamEntryProps={{ step: 'teams' }} tournamentViewProps={{ step: 'none' }} />);

    expect(await screen.findByTestId('team-entry')).toHaveTextContent('teams:teams');
  });

  it('renders tournament workflow and casual modal when active', async () => {
    render(
      <AppViewRouter
        {...baseProps}
        setupScreenProps={{ step: 'none' }}
        teamEntryProps={{ step: 'none' }}
        tournamentViewProps={{ step: 'tournament' }}
        showCasualMatch
      />
    );

    expect(await screen.findByTestId('tournament-view')).toHaveTextContent('tournament:tournament');
    expect(screen.getByTestId('casual-match')).toBeInTheDocument();
  });

  it('uses explicit routeKey over inferred step props', async () => {
    render(
      <AppViewRouter
        {...baseProps}
        routeKey="teams"
        setupScreenProps={{ step: 'setup' }}
        teamEntryProps={{ step: 'teams' }}
        tournamentViewProps={{ step: 'none' }}
      />
    );

    expect(await screen.findByTestId('team-entry')).toBeInTheDocument();
    expect(screen.queryByTestId('setup-screen')).not.toBeInTheDocument();
  });
});
