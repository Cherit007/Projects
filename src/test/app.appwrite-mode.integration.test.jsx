import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import { appStore } from '../store/appStore';

const {
  authServiceMock,
  groupServiceMock,
  tournamentServiceMock,
  casualMatchServiceMock,
} = vi.hoisted(() => ({
  authServiceMock: {
    getCurrentUser: vi.fn(async () => ({
      $id: 'u-appwrite',
      email: 'cloud-user@example.com',
      name: 'Cloud User',
    })),
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    updateName: vi.fn(),
  },
  groupServiceMock: {
    getAllGroups: vi.fn(async () => ([
      { id: 'g-public', name: 'Open Club', role: 'viewer' },
    ])),
    getUserGroups: vi.fn(async () => []),
    getUserPendingRequestGroupIds: vi.fn(async () => []),
    createGroup: vi.fn(),
    requestGroupAccess: vi.fn(),
    approveJoinRequest: vi.fn(),
    rejectJoinRequest: vi.fn(),
    updateGroupMemberRole: vi.fn(),
    removeGroupMember: vi.fn(),
    getPendingRequestsForAdmin: vi.fn(),
    getRecentReviewedRequestsForAdmin: vi.fn(),
    getGroupMembersForAdmin: vi.fn(),
  },
  tournamentServiceMock: {
    getAllTournaments: vi.fn(async () => []),
    getTournamentSummaries: vi.fn(async () => []),
    getTournamentById: vi.fn(async () => null),
    createTournament: vi.fn(),
    updateTournament: vi.fn(),
    patchTournamentMatches: vi.fn(),
    deleteTournament: vi.fn(),
  },
  casualMatchServiceMock: {
    getAllCasualMatches: vi.fn(async () => []),
    createCasualMatch: vi.fn(),
    deleteCasualMatch: vi.fn(),
    getMatchesByPlayer: vi.fn(async () => []),
  },
}));

vi.mock('../hooks/useAppwriteSync', () => ({
  useAppwriteSync: () => ({
    isAppwriteEnabled: true,
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

vi.mock('../services/authService', () => ({
  authService: authServiceMock,
}));

vi.mock('../services/groupService', () => ({
  groupService: groupServiceMock,
}));

vi.mock('../services/tournamentService', () => ({
  tournamentService: tournamentServiceMock,
}));

vi.mock('../services/casualmatchservice', () => ({
  casualMatchService: casualMatchServiceMock,
}));

describe('App integration in Appwrite-auth mode', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    appStore.resetState();
    Object.values(authServiceMock).forEach((fn) => fn.mockClear?.());
    Object.values(groupServiceMock).forEach((fn) => fn.mockClear?.());
    Object.values(tournamentServiceMock).forEach((fn) => fn.mockClear?.());
    Object.values(casualMatchServiceMock).forEach((fn) => fn.mockClear?.());
    authServiceMock.getCurrentUser.mockResolvedValue({
      $id: 'u-appwrite',
      email: 'cloud-user@example.com',
      name: 'Cloud User',
    });
    groupServiceMock.getAllGroups.mockResolvedValue([
      { id: 'g-public', name: 'Open Club', role: 'viewer' },
    ]);
    groupServiceMock.getUserGroups.mockResolvedValue([]);
    groupServiceMock.getUserPendingRequestGroupIds.mockResolvedValue([]);
  });

  it('boots into Group Hub when auth is required and no active group is selected', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    );

    expect(await screen.findByRole('heading', { name: /Group Hub/i })).toBeInTheDocument();
    expect(screen.getByText(/Signed in as Cloud User/i)).toBeInTheDocument();
    expect(groupServiceMock.getAllGroups).toHaveBeenCalled();
    expect(groupServiceMock.getUserGroups).toHaveBeenCalled();
    expect(screen.queryByText(/Local mode/i)).not.toBeInTheDocument();
  });
});
