import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, vi } from 'vitest';

const appDataServiceMock = vi.hoisted(() => ({
  getAppMeta: vi.fn(async () => ({ activeTournament: null })),
  saveAppMeta: vi.fn(async () => ({})),
}));

const tournamentServiceMock = vi.hoisted(() => ({
  getTournamentSummaries: vi.fn(async () => []),
}));

vi.mock('../services/appDataService', () => ({
  appDataService: appDataServiceMock,
}));

vi.mock('../services/tournamentService', () => ({
  tournamentService: tournamentServiceMock,
}));

import { useTournamentActions } from '../hooks/useTournamentActions';

const makeTeams = () => ([
  { id: 1, emoji: '🦅', name: 'Falcons', player1: 'A1', player: 'A1', player2: 'A2' },
  { id: 2, emoji: '🐯', name: 'Tigers', player1: 'B1', player: 'B1', player2: 'B2' },
  { id: 3, emoji: '🦈', name: 'Sharks', player1: 'C1', player: 'C1', player2: 'C2' },
]);

const makeCompletedFixtures = (teams) => ([
  {
    id: 1,
    team1: teams[0],
    team2: teams[1],
    score1: 21,
    score2: 17,
    completed: true,
    round: 1,
  },
  {
    id: 2,
    team1: teams[0],
    team2: teams[2],
    score1: 19,
    score2: 21,
    completed: true,
    round: 2,
  },
  {
    id: 3,
    team1: teams[1],
    team2: teams[2],
    score1: 21,
    score2: 15,
    completed: true,
    round: 3,
  },
]);

const createHarness = ({
  isAppwriteEnabled = false,
  saveTournamentResult = null,
  activeGroup = null,
} = {}) => {
  const teams = makeTeams();
  const state = {
    tournamentName: 'League Night 1st Tournament',
    numTeams: teams.length,
    format: '1',
    gameMode: 'doubles',
    tournamentFormat: 'league',
    teams,
    fixtures: makeCompletedFixtures(teams),
    bracket: [],
    champion: teams[0],
    playerDatabase: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'],
    members: [],
    playerRatings: {
      A1: { rating: 1000, matchesPlayed: 0, history: [] },
      A2: { rating: 1000, matchesPlayed: 0, history: [] },
      B1: { rating: 1000, matchesPlayed: 0, history: [] },
      B2: { rating: 1000, matchesPlayed: 0, history: [] },
      C1: { rating: 1000, matchesPlayed: 0, history: [] },
      C2: { rating: 1000, matchesPlayed: 0, history: [] },
    },
    tournamentHistory: [],
    casualMatches: [],
    aiMatchSummaries: [{ matchId: 'final' }],
    swapHistory: [{ id: 'swap-1' }],
    currentTournamentId: 'active-old-id',
  };

  const setField = (key, valueOrUpdater) => {
    const nextValue = typeof valueOrUpdater === 'function'
      ? valueOrUpdater(state[key])
      : valueOrUpdater;
    state[key] = nextValue;
    return nextValue;
  };

  const showToast = vi.fn();
  const setTournamentName = vi.fn((value) => setField('tournamentName', value));
  const setNumTeams = vi.fn((value) => setField('numTeams', value));
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
  const setActiveTournamentLock = vi.fn();

  const saveTournamentMutation = {
    mutateAsync: vi.fn(async (payload) => (
      saveTournamentResult || payload
    )),
  };
  const deleteTournamentMutation = { mutateAsync: vi.fn(async () => true) };
  const saveRatingsMutation = { mutateAsync: vi.fn(async (payload) => payload) };
  const savePlayerDatabaseMutation = { mutateAsync: vi.fn(async (payload) => payload) };
  const createCasualMatchMutation = { mutateAsync: vi.fn(async (payload) => payload) };
  const deleteCasualMatchMutation = { mutateAsync: vi.fn(async () => true) };

  const buildProps = () => ({
    assertCanOperate: () => true,
    assertCanDelete: () => true,
    confirmAction: vi.fn(async () => true),
    showToast,
    isAppwriteEnabled,
    activeGroup,
    updatePlayerDatabase: vi.fn(),
    tournamentName: state.tournamentName,
    setTournamentName,
    numTeams: state.numTeams,
    setNumTeams,
    format: state.format,
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
    setActiveTournamentLock,
    syncCurrentTournament: vi.fn(async () => null),
    patchTournamentMatches: vi.fn(async () => ({
      updatedMatches: 0,
      updatedParticipants: 0,
      deletedParticipants: 0,
      missingMatches: 0,
    })),
    markRatingsPersisted: vi.fn(),
    buildRatingsDelta: vi.fn(() => ({ changedRatings: {}, deletedPlayerNames: [] })),
    saveTournamentMutation,
    deleteTournamentMutation,
    saveRatingsMutation,
    savePlayerDatabaseMutation,
    createCasualMatchMutation,
    deleteCasualMatchMutation,
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
    setStep,
    setActiveTournamentLock,
    saveTournamentMutation,
  };
};

describe('Next tournament flow', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    appDataServiceMock.getAppMeta.mockReset();
    appDataServiceMock.saveAppMeta.mockReset();
    tournamentServiceMock.getTournamentSummaries.mockReset();
    appDataServiceMock.getAppMeta.mockResolvedValue({ activeTournament: null });
    appDataServiceMock.saveAppMeta.mockResolvedValue({});
    tournamentServiceMock.getTournamentSummaries.mockResolvedValue([]);
  });

  it('resets completed state and generates a fresh fixture list', async () => {
    const h = createHarness();

    await act(async () => {
      const started = await h.result.current.startNextTournament({
        tournamentNameOverride: 'League Night 2nd Tournament',
      });
      expect(started).toBe(true);
    });
    h.sync();

    expect(h.state.tournamentName).toBe('League Night 2nd Tournament');
    expect(h.state.champion).toBe(null);
    expect(h.state.aiMatchSummaries).toEqual([]);
    expect(h.state.swapHistory).toEqual([]);
    expect(h.state.currentTournamentId).toMatch(/^local-/);
    expect(h.state.fixtures.length).toBeGreaterThan(0);
    expect(h.state.fixtures.every((match) => match.completed === false)).toBe(true);
    expect(h.setStep).toHaveBeenCalledWith('tournament');
  });

  it('allows starting team setup even when another tournament is already live', async () => {
    const h = createHarness();
    h.state.tournamentHistory = [
      {
        id: 'existing-live',
        appwriteId: 'existing-live',
        name: 'Existing Live',
        status: 'active',
        champion: null,
      },
    ];
    h.sync();

    await act(async () => {
      await h.result.current.handleStartTournament('3');
    });

    expect(h.setStep).toHaveBeenCalledWith('teams');
    expect(h.showToast).not.toHaveBeenCalledWith(
      expect.stringMatching(/already in progress/i),
      'error'
    );
  });

  it('creates a new cloud tournament on next start (does not reuse old id)', async () => {
    const h = createHarness({
      isAppwriteEnabled: true,
      saveTournamentResult: {
        id: 'new-tournament-id',
        appwriteId: 'new-tournament-id',
      },
    });

    await act(async () => {
      const started = await h.result.current.startNextTournament({
        tournamentNameOverride: 'League Night 2nd Tournament',
      });
      expect(started).toBe(true);
    });
    h.sync();

    await waitFor(() => {
      expect(h.saveTournamentMutation.mutateAsync).toHaveBeenCalledTimes(1);
    });

    const payload = h.saveTournamentMutation.mutateAsync.mock.calls[0][0];
    expect(payload.appwriteId).toBeUndefined();
    expect(payload.name).toBe('League Night 2nd Tournament');
    expect(Array.isArray(payload.fixtures)).toBe(true);
    expect(payload.fixtures.every((match) => match.completed === false)).toBe(true);
    expect(h.setActiveTournamentLock).toHaveBeenCalledWith(null);
  });

  it('waits for the previous cloud lock clear before creating the next tournament', async () => {
    let resolveClearLock = null;
    const clearLockPromise = new Promise((resolve) => {
      resolveClearLock = resolve;
    });
    appDataServiceMock.saveAppMeta
      .mockImplementationOnce(() => clearLockPromise)
      .mockResolvedValue({});

    const h = createHarness({
      isAppwriteEnabled: true,
      activeGroup: { id: 'group-1', name: 'Open Club' },
      saveTournamentResult: {
        id: 'new-tournament-id',
        appwriteId: 'new-tournament-id',
      },
    });

    let startPromise = null;
    await act(async () => {
      startPromise = h.result.current.startNextTournament({
        tournamentNameOverride: 'League Night 2nd Tournament',
      });
    });

    expect(appDataServiceMock.saveAppMeta).toHaveBeenCalledWith(
      { activeTournament: null },
      { groupId: 'group-1' }
    );
    expect(h.saveTournamentMutation.mutateAsync).not.toHaveBeenCalled();

    resolveClearLock({});

    await act(async () => {
      await startPromise;
    });
    h.sync();

    await waitFor(() => {
      expect(h.saveTournamentMutation.mutateAsync).toHaveBeenCalledTimes(1);
    });
  });

  it('resolves the resumed tournament cloud id by name and teams before completion', async () => {
    const h = createHarness({
      isAppwriteEnabled: true,
      activeGroup: { id: 'group-1', name: 'Open Club' },
      saveTournamentResult: {
        id: 'cloud-live-2',
        appwriteId: 'cloud-live-2',
      },
    });
    h.state.tournamentName = 'League Night 2nd Tournament';
    h.state.currentTournamentId = 'local-2';
    h.state.champion = null;
    h.state.tournamentHistory = [
      {
        id: 'local-2',
        legacyTournamentId: 'local-2',
        appwriteId: null,
        name: 'League Night 2nd Tournament',
        date: '2026-03-09T10:00:00.000Z',
        teams: h.state.teams,
        fixtures: h.state.fixtures,
        bracket: [],
        champion: null,
        format: '1',
        gameMode: 'doubles',
        tournamentFormat: 'league',
        status: 'active',
      },
    ];
    tournamentServiceMock.getTournamentSummaries.mockResolvedValue([
      {
        id: 'cloud-live-2',
        appwriteId: 'cloud-live-2',
        legacyTournamentId: '',
        name: 'League Night 2nd Tournament',
        date: '2026-03-09T10:05:00.000Z',
        teams: h.state.teams,
        teamsCount: h.state.teams.length,
        fixtures: [],
        bracket: [],
        finalMatch: null,
        champion: null,
        aiSummaries: [],
        swapHistory: [],
        format: '1',
        gameMode: 'doubles',
        tournamentFormat: 'league',
        status: 'active',
        isSummary: true,
      },
    ]);
    h.sync();

    await act(async () => {
      const saved = await h.result.current.saveFinalResult(
        21,
        18,
        [h.state.teams[0], h.state.teams[1]]
      );
      expect(saved).toBe(true);
    });
    h.sync();

    await waitFor(() => {
      expect(h.saveTournamentMutation.mutateAsync).toHaveBeenCalled();
    });

    const payload = h.saveTournamentMutation.mutateAsync.mock.calls.at(-1)[0];
    expect(payload.appwriteId).toBe('cloud-live-2');

    const matchingByName = h.state.tournamentHistory.filter(
      (entry) => entry?.name === 'League Night 2nd Tournament'
    );
    expect(matchingByName).toHaveLength(1);
    expect(matchingByName[0].status).toBe('completed');
  });

  it('finalizing uses the existing cloud id and replaces active history entry', async () => {
    const h = createHarness({
      isAppwriteEnabled: true,
      saveTournamentResult: {
        id: 'cloud-live-1',
        appwriteId: 'cloud-live-1',
      },
    });
    h.state.currentTournamentId = null;
    h.state.champion = null;
    h.state.tournamentHistory = [
      {
        id: 'cloud-live-1',
        appwriteId: 'cloud-live-1',
        name: h.state.tournamentName,
        date: '2026-03-09T10:00:00.000Z',
        teams: h.state.teams,
        fixtures: h.state.fixtures,
        bracket: [],
        champion: null,
        format: '1',
        gameMode: 'doubles',
        tournamentFormat: 'league',
        status: 'active',
      },
    ];
    h.sync();

    await act(async () => {
      const saved = await h.result.current.saveFinalResult(
        21,
        18,
        [h.state.teams[0], h.state.teams[1]]
      );
      expect(saved).toBe(true);
    });
    h.sync();

    await waitFor(() => {
      expect(h.saveTournamentMutation.mutateAsync).toHaveBeenCalled();
    });

    const payload = h.saveTournamentMutation.mutateAsync.mock.calls.at(-1)[0];
    expect(payload.appwriteId).toBe('cloud-live-1');
    expect(payload.status).toBe('completed');

    const matchingByName = h.state.tournamentHistory.filter(
      (entry) => entry?.name === h.state.tournamentName
    );
    expect(matchingByName).toHaveLength(1);
    expect(matchingByName[0].status).toBe('completed');
    expect(matchingByName[0].champion).toBeTruthy();
  });

  it('keeps completed history isolated from next tournament team edits', async () => {
    const h = createHarness({ isAppwriteEnabled: false });
    h.state.champion = null;
    h.state.currentTournamentId = null;
    h.sync();

    await act(async () => {
      const saved = await h.result.current.saveFinalResult(
        21,
        18,
        [h.state.teams[0], h.state.teams[1]]
      );
      expect(saved).toBe(true);
    });
    h.sync();

    expect(h.state.tournamentHistory).toHaveLength(1);
    const completedSnapshot = h.state.tournamentHistory[0];
    expect(completedSnapshot.status).toBe('completed');
    expect(completedSnapshot.teams[0].name).toBe('Falcons');

    await act(async () => {
      const started = await h.result.current.startNextTournament({
        editTeams: true,
        tournamentNameOverride: 'League Night 2nd Tournament',
      });
      expect(started).toBe(true);
    });
    h.sync();

    h.state.teams[0].name = 'Mutated Live Team';
    if (Array.isArray(h.state.fixtures) && h.state.fixtures[0]?.team1) {
      h.state.fixtures[0].team1.name = 'Mutated Fixture Team';
    }

    expect(h.state.tournamentHistory).toHaveLength(1);
    expect(h.state.tournamentHistory[0].teams[0].name).toBe('Falcons');
    expect(h.state.tournamentHistory[0].champion?.name).toBe('Falcons');
  });

  it('waits for the pending cloud create instead of creating a duplicate', async () => {
    let resolveCreate = null;
    const createPromise = new Promise((resolve) => {
      resolveCreate = resolve;
    });
    const h = createHarness({
      isAppwriteEnabled: true,
      saveTournamentResult: createPromise,
    });

    await act(async () => {
      const started = await h.result.current.startNextTournament({
        tournamentNameOverride: 'League Night 2nd Tournament',
      });
      expect(started).toBe(true);
    });
    h.sync();

    const firstMatch = h.state.fixtures.find((match) => !match.completed);
    expect(firstMatch).toBeTruthy();

    const savePromise = act(async () => {
      const saved = await h.result.current.saveMatchResult(firstMatch.id, 21, 18);
      expect(saved).toBe(true);
    });

    resolveCreate({ id: 'cloud-live-1', appwriteId: 'cloud-live-1' });
    await savePromise;
    h.sync();

    await waitFor(() => {
      expect(h.saveTournamentMutation.mutateAsync).toHaveBeenCalledTimes(1);
    });
    expect(h.state.tournamentHistory).toHaveLength(1);
    expect(h.state.tournamentHistory[0].appwriteId).toBe('cloud-live-1');
  });
});
