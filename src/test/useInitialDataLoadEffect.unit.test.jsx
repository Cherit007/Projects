import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useInitialDataLoadEffect } from '../hooks/useInitialDataLoadEffect';
import { queryKeys } from '../config/queryKeys';
import { dedupeLiveTournaments, findActiveTournament } from '../utils/appHelpers';

const tournamentServiceMock = vi.hoisted(() => ({
  getTournamentSummaries: vi.fn(),
  getTournamentById: vi.fn(),
}));

vi.mock('../services/tournamentService', () => ({
  tournamentService: tournamentServiceMock,
}));

const ACTIVE_TOURNAMENT_CACHE_KEY = 'bfm:appwrite-active-tournament';

const buildTeams = () => ([
  { id: 1, name: 'Falcons', player1: 'A1', player: 'A1', player2: 'A2' },
  { id: 2, name: 'Tigers', player1: 'B1', player: 'B1', player2: 'B2' },
  { id: 3, name: 'Sharks', player1: 'C1', player: 'C1', player2: 'C2' },
]);

const buildCompletedSummary = () => ({
  id: 'cloud-complete-1',
  appwriteId: 'cloud-complete-1',
  legacyTournamentId: 'local-stale-1',
  name: 'Night Finals',
  date: '2026-03-29',
  teams: buildTeams(),
  teamsCount: 3,
  fixtures: [],
  bracket: [],
  finalMatch: null,
  champion: null,
  aiSummaries: [],
  swapHistory: [],
  format: '1',
  gameMode: 'doubles',
  tournamentFormat: 'league',
  status: 'completed',
  isSummary: true,
});

const buildCachedActive = () => ({
  id: 'local-stale-1',
  legacyTournamentId: 'local-stale-1',
  appwriteId: null,
  name: 'Night Finals',
  date: '2026-03-29',
  teams: buildTeams(),
  fixtures: [
    {
      id: 1,
      team1: buildTeams()[0],
      team2: buildTeams()[1],
      score1: null,
      score2: null,
      completed: false,
      round: 1,
    },
  ],
  bracket: [],
  champion: null,
  aiSummaries: [],
  swapHistory: [],
  format: '1',
  gameMode: 'doubles',
  tournamentFormat: 'league',
  status: 'active',
});

const createWrapper = (queryClient) => {
  const Wrapper = ({ children }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  Wrapper.displayName = 'QueryClientWrapper';
  return Wrapper;
};

const useInitialLoadHarness = ({
  queryClient,
  loadFromAppwrite = vi.fn(async () => ({
    playerDatabase: [],
    playerRatings: {},
    members: [],
    playerPhotos: {},
    templates: [],
    memberAccountLinks: [],
    activeTournament: null,
  })),
  resumeActiveTournament = vi.fn(),
}) => {
  const [loading, setLoading] = useState(false);
  const [members, setMembers] = useState([]);
  const [playerDatabase, setPlayerDatabase] = useState([]);
  const [playerRatings, setPlayerRatings] = useState({});
  const [tournamentHistory, setTournamentHistory] = useState([]);
  const [casualMatches, setCasualMatches] = useState([]);
  const [historyHydrated, setHistoryHydrated] = useState(false);
  const [casualHydrated, setCasualHydrated] = useState(false);
  const [activeTournamentLock, setActiveTournamentLock] = useState(null);

  useInitialDataLoadEffect({
    isConfigChecked: true,
    requiresAuth: false,
    authResolved: true,
    groupResolved: true,
    activeGroup: { id: 'group-1', name: 'Open Club' },
    activeGroupId: 'group-1',
    isAppwriteEnabled: true,
    queryClient,
    queryKeys,
    loadFromAppwrite,
    setLoading,
    setMembers,
    hydratePlayerPhotos: () => ({ urls: {}, refs: {} }),
    setPlayerPhotos: vi.fn(),
    setPlayerPhotoRefs: vi.fn(),
    setTournamentTemplates: vi.fn(),
    normalizeTournamentFormat: (value) => String(value || 'league').trim().toLowerCase(),
    normalizeTemplateTeams: (teams) => teams,
    setPlayerDatabase,
    setPlayerRatings,
    markRatingsPersisted: vi.fn(),
    setTournamentHistory,
    setCasualMatches,
    setHistoryHydrated,
    setCasualHydrated,
    setActiveTournamentLock,
    findActiveTournament,
    resumeActiveTournament,
    mergeMemberLinks: (loadedMembers) => loadedMembers,
    applyMemberAccountLinks: (loadedMembers) => loadedMembers,
  });

  return {
    loading,
    members,
    playerDatabase,
    playerRatings,
    tournamentHistory,
    casualMatches,
    historyHydrated,
    casualHydrated,
    activeTournamentLock,
    loadFromAppwrite,
    resumeActiveTournament,
  };
};

describe('useInitialDataLoadEffect', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    tournamentServiceMock.getTournamentSummaries.mockReset();
    tournamentServiceMock.getTournamentById.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('keeps a completed cloud summary visible and suppresses stale cached resume rows on bootstrap', async () => {
    localStorage.setItem(
      ACTIVE_TOURNAMENT_CACHE_KEY,
      JSON.stringify({
        ...buildCachedActive(),
        _cacheGroupId: 'group-1',
        _cachedAt: new Date('2026-03-29T12:00:00.000Z').toISOString(),
      })
    );

    const completedSummary = buildCompletedSummary();
    tournamentServiceMock.getTournamentSummaries.mockImplementation(async (_limit, _groupId, statuses = []) => (
      Array.isArray(statuses) && statuses.includes('completed')
        ? [completedSummary]
        : []
    ));
    tournamentServiceMock.getTournamentById.mockResolvedValue(null);

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    const { result } = renderHook(
      () => useInitialLoadHarness({ queryClient }),
      { wrapper: createWrapper(queryClient) }
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(tournamentServiceMock.getTournamentSummaries).toHaveBeenCalledWith(
      40,
      'group-1',
      ['active', 'scheduled', 'completed']
    );

    expect(result.current.tournamentHistory).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'Night Finals',
          status: 'completed',
        }),
      ])
    );
    expect(dedupeLiveTournaments(result.current.tournamentHistory)).toHaveLength(0);
    expect(result.current.resumeActiveTournament).not.toHaveBeenCalled();
  });
});
