import { act, renderHook } from '@testing-library/react';
import { useTournamentActions } from '../hooks/useTournamentActions';

const makeBaseTeams = () => ([
  { id: 1, emoji: '🦅', name: 'Falcons', player1: 'A1', player: 'A1', player2: 'A2' },
  { id: 2, emoji: '🐯', name: 'Tigers', player1: 'B1', player: 'B1', player2: 'B2' },
  { id: 3, emoji: '🦈', name: 'Sharks', player1: 'C1', player: 'C1', player2: 'C2' },
]);

const makeMatch = ({ id, team1, team2, completed = false, score1 = null, score2 = null, round = 1 }) => ({
  id,
  team1,
  team2,
  score1,
  score2,
  completed,
  round,
});

const buildBaseState = (overrides = {}) => {
  const teams = overrides.teams || makeBaseTeams();
  const fixtures = overrides.fixtures || [
    makeMatch({ id: 1, team1: teams[0], team2: teams[1], completed: false, round: 1 }),
    makeMatch({ id: 2, team1: teams[0], team2: teams[2], completed: false, round: 2 }),
  ];

  return {
    tournamentName: 'Swap Cup',
    numTeams: teams.length,
    format: '1',
    gameMode: 'doubles',
    tournamentFormat: 'league',
    teams,
    fixtures,
    bracket: [],
    champion: null,
    playerDatabase: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'Z9'],
    members: [],
    playerRatings: {
      A1: { rating: 1000, matchesPlayed: 3, history: [] },
      A2: { rating: 1000, matchesPlayed: 3, history: [] },
      B1: { rating: 1000, matchesPlayed: 3, history: [] },
      B2: { rating: 1000, matchesPlayed: 3, history: [] },
      C1: { rating: 1000, matchesPlayed: 3, history: [] },
      C2: { rating: 1000, matchesPlayed: 3, history: [] },
    },
    tournamentHistory: [],
    casualMatches: [],
    aiMatchSummaries: [],
    swapHistory: [],
    currentTournamentId: null,
    ...overrides,
  };
};

const createHookHarness = (stateOverrides = {}, propOverrides = {}) => {
  const state = buildBaseState(stateOverrides);

  const setField = (key, valueOrUpdater) => {
    const next = typeof valueOrUpdater === 'function'
      ? valueOrUpdater(state[key])
      : valueOrUpdater;
    state[key] = next;
    return next;
  };

  const showToast = vi.fn();
  const assertCanOperate = vi.fn(() => true);
  const assertCanDelete = vi.fn(() => true);
  const queryClient = { invalidateQueries: vi.fn(async () => {}) };
  const queryKeys = {
    appwriteData: vi.fn(() => ['appwrite', 'bootstrap', 'nogroup']),
    casualMatches: vi.fn(() => ['casual-matches', 'nogroup']),
  };

  const updatePlayerDatabase = vi.fn((name) => {
    const value = String(name || '').trim();
    if (!value) return;
    if (!state.playerDatabase.includes(value)) {
      state.playerDatabase = [...state.playerDatabase, value];
    }
  });

  const setTournamentName = vi.fn((value) => setField('tournamentName', value));
  const setNumTeams = vi.fn((value) => setField('numTeams', value));
  const setFormat = vi.fn((value) => setField('format', value));
  const setStep = vi.fn();
  const setLoading = vi.fn();
  const setTeams = vi.fn((value) => setField('teams', value));
  const setFixtures = vi.fn((value) => setField('fixtures', value));
  const setBracket = vi.fn((value) => setField('bracket', value));
  const setChampion = vi.fn((value) => setField('champion', value));
  const setPlayerDatabase = vi.fn((value) => setField('playerDatabase', value));
  const setPlayerRatings = vi.fn((value) => setField('playerRatings', value));
  const setTournamentHistory = vi.fn((value) => setField('tournamentHistory', value));
  const setCasualMatches = vi.fn((value) => setField('casualMatches', value));
  const setShowCasualMatch = vi.fn();
  const setAiMatchSummaries = vi.fn((value) => setField('aiMatchSummaries', value));
  const setSwapHistory = vi.fn((value) => setField('swapHistory', value));
  const setCurrentTournamentId = vi.fn((value) => setField('currentTournamentId', value));

  const syncCurrentTournament = vi.fn(async () => null);
  const saveTournamentMutation = { mutateAsync: vi.fn(async (payload) => payload) };
  const deleteTournamentMutation = { mutateAsync: vi.fn(async () => true) };
  const savePlayerDatabaseMutation = { mutateAsync: vi.fn(async (payload) => payload) };
  const saveRatingsMutation = { mutateAsync: vi.fn(async (payload) => payload) };
  const createCasualMatchMutation = { mutateAsync: vi.fn(async (payload) => payload) };
  const deleteCasualMatchMutation = { mutateAsync: vi.fn(async () => true) };

  const buildProps = () => ({
    assertCanOperate,
    assertCanDelete,
    showToast,
    isAppwriteEnabled: false,
    activeGroup: null,
    queryClient,
    queryKeys,
    updatePlayerDatabase,
    tournamentName: state.tournamentName,
    setTournamentName,
    numTeams: state.numTeams,
    setNumTeams,
    format: state.format,
    setFormat,
    gameMode: state.gameMode,
    tournamentFormat: state.tournamentFormat,
    setStep,
    setLoading,
    teams: state.teams,
    setTeams,
    fixtures: state.fixtures,
    setFixtures,
    bracket: state.bracket,
    setBracket,
    champion: state.champion,
    setChampion,
    setPlayerDatabase,
    members: state.members,
    playerRatings: state.playerRatings,
    setPlayerRatings,
    tournamentHistory: state.tournamentHistory,
    setTournamentHistory,
    casualMatches: state.casualMatches,
    setCasualMatches,
    setShowCasualMatch,
    aiMatchSummaries: state.aiMatchSummaries,
    setAiMatchSummaries,
    swapHistory: state.swapHistory,
    setSwapHistory,
    currentTournamentId: state.currentTournamentId,
    setCurrentTournamentId,
    syncCurrentTournament,
    saveTournamentMutation,
    deleteTournamentMutation,
    savePlayerDatabaseMutation,
    saveRatingsMutation,
    createCasualMatchMutation,
    deleteCasualMatchMutation,
    ...propOverrides,
  });

  const hook = renderHook((props) => useTournamentActions(props), {
    initialProps: buildProps(),
  });

  const sync = () => hook.rerender(buildProps());

  return {
    state,
    result: hook.result,
    sync,
    showToast,
    assertCanOperate,
    updatePlayerDatabase,
  };
};

describe('Swap feature use cases', () => {
  it('allows A -> B replacement and keeps completed matches unchanged', () => {
    const teams = makeBaseTeams();
    const fixtures = [
      makeMatch({ id: 1, team1: teams[0], team2: teams[1], completed: true, score1: 21, score2: 16, round: 1 }),
      makeMatch({ id: 2, team1: teams[0], team2: teams[2], completed: false, round: 2 }),
    ];
    const h = createHookHarness({ teams, fixtures });

    let success;
    act(() => {
      success = h.result.current.swapTeamMember({
        teamId: 1,
        currentPlayerName: 'A1',
        replacementPlayerName: 'Z9',
      });
    });
    h.sync();

    expect(success).toBe(true);
    expect(h.state.teams[0].player1).toBe('Z9');
    expect(h.state.teams[0].player).toBe('Z9');
    expect(h.state.fixtures[0].team1.player1).toBe('A1');
    expect(h.state.fixtures[1].team1.player1).toBe('Z9');
    expect(h.state.swapHistory).toHaveLength(1);
    expect(h.state.swapHistory[0]).toMatchObject({
      teamName: 'Falcons',
      fromPlayer: 'A1',
      toPlayer: 'Z9',
    });
    expect(h.state.playerRatings.Z9).toBeDefined();
  });

  it('blocks invalid self swap A -> A', () => {
    const h = createHookHarness();

    let success;
    act(() => {
      success = h.result.current.swapTeamMember({
        teamId: 1,
        currentPlayerName: 'A1',
        replacementPlayerName: 'A1',
      });
    });

    expect(success).toBe(false);
    expect(h.showToast).toHaveBeenCalledWith('Replacement must be different from current player', 'error');
  });

  it('blocks swap when tournament flow is completed', () => {
    const h = createHookHarness({ champion: { id: 1, name: 'Falcons' } });

    let success;
    act(() => {
      success = h.result.current.swapTeamMember({
        teamId: 1,
        currentPlayerName: 'A1',
        replacementPlayerName: 'Z9',
      });
    });

    expect(success).toBe(false);
    expect(h.showToast).toHaveBeenCalledWith('Swap is blocked. Tournament or match flow is already completed.', 'error');
  });

  it('supports chain swaps and resolves latest active player', () => {
    const h = createHookHarness();

    act(() => {
      const first = h.result.current.swapTeamMember({
        teamId: 1,
        currentPlayerName: 'A1',
        replacementPlayerName: 'B9',
      });
      expect(first).toBe(true);
    });
    h.sync();

    act(() => {
      const second = h.result.current.swapTeamMember({
        teamId: 1,
        currentPlayerName: 'B9',
        replacementPlayerName: 'C9',
      });
      expect(second).toBe(true);
    });
    h.sync();

    act(() => {
      const third = h.result.current.swapTeamMember({
        teamId: 1,
        currentPlayerName: 'C9',
        replacementPlayerName: 'D9',
      });
      expect(third).toBe(true);
    });
    h.sync();

    expect(h.state.teams[0].player1).toBe('D9');
    expect(h.state.fixtures[0].team1.player1).toBe('D9');
    expect(h.state.swapHistory).toHaveLength(3);
    expect(h.state.swapHistory.map((entry) => `${entry.fromPlayer}->${entry.toPlayer}`)).toEqual([
      'A1->B9',
      'B9->C9',
      'C9->D9',
    ]);
  });

  it('allows swap back A -> B -> A', () => {
    const h = createHookHarness();

    act(() => {
      const first = h.result.current.swapTeamMember({
        teamId: 1,
        currentPlayerName: 'A1',
        replacementPlayerName: 'B9',
      });
      expect(first).toBe(true);
    });
    h.sync();

    act(() => {
      const second = h.result.current.swapTeamMember({
        teamId: 1,
        currentPlayerName: 'B9',
        replacementPlayerName: 'A1',
      });
      expect(second).toBe(true);
    });
    h.sync();

    expect(h.state.teams[0].player1).toBe('A1');
    expect(h.state.swapHistory).toHaveLength(2);
  });

  it('blocks swap when player is not present in selected team', () => {
    const h = createHookHarness();

    let success;
    act(() => {
      success = h.result.current.swapTeamMember({
        teamId: 1,
        currentPlayerName: 'UNKNOWN',
        replacementPlayerName: 'Z9',
      });
    });

    expect(success).toBe(false);
    expect(h.showToast).toHaveBeenCalledWith('Player not found in selected team', 'error');
  });

  it('blocks swap when target team is missing', () => {
    const h = createHookHarness();

    let success;
    act(() => {
      success = h.result.current.swapTeamMember({
        teamId: 999,
        currentPlayerName: 'A1',
        replacementPlayerName: 'Z9',
      });
    });

    expect(success).toBe(false);
    expect(h.showToast).toHaveBeenCalledWith('Team not found', 'error');
  });

  it('should block replacement when new player already exists in same team (use case)', () => {
    const h = createHookHarness();

    let success;
    act(() => {
      success = h.result.current.swapTeamMember({
        teamId: 1,
        currentPlayerName: 'A1',
        replacementPlayerName: 'A2',
      });
    });

    expect(success).toBe(false);
  });

  it('should block replacement when new player is in live opponent team (use case)', () => {
    const h = createHookHarness({
      fixtures: [
        makeMatch({
          id: 1,
          team1: makeBaseTeams()[0],
          team2: makeBaseTeams()[1],
          completed: false,
          round: 1,
        }),
      ],
    });

    let success;
    act(() => {
      success = h.result.current.swapTeamMember({
        teamId: 1,
        currentPlayerName: 'A1',
        replacementPlayerName: 'B1',
      });
    });

    expect(success).toBe(false);
  });
});
