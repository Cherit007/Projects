import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { matchesTournamentId } from '../utils/appHelpers';
import { useFixtureActions } from '../hooks/tournament/useFixtureActions';

const createHarness = () => {
  const teams = [
    { id: 1, emoji: '🦅', name: 'Falcons', player1: 'A1', player: 'A1', player2: 'A2' },
    { id: 2, emoji: '🐯', name: 'Tigers', player1: 'B1', player: 'B1', player2: 'B2' },
    { id: 3, emoji: '🦈', name: 'Sharks', player1: 'C1', player: 'C1', player2: 'C2' },
  ];

  const state = {
    tournamentName: 'Odd Player Cup',
    numTeams: teams.length,
    format: '1',
    gameMode: 'doubles',
    tournamentFormat: 'league',
    teams,
    fixtures: [],
    bracket: [],
    champion: null,
    members: [],
    playerDatabase: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'Z9'],
    playerRatings: {},
    tournamentHistory: [],
    casualMatches: [],
    aiMatchSummaries: [],
    swapHistory: [],
    currentTournamentId: null,
  };

  const setField = (key, valueOrUpdater) => {
    const nextValue = typeof valueOrUpdater === 'function'
      ? valueOrUpdater(state[key])
      : valueOrUpdater;
    state[key] = nextValue;
    return nextValue;
  };

  const buildFixtureProps = () => ({
    assertCanOperate: vi.fn(() => true),
    showToast: vi.fn(),
    isAppwriteEnabled: false,
    tournamentName: state.tournamentName,
    tournamentFormat: state.tournamentFormat,
    format: state.format,
    gameMode: state.gameMode,
    teams: state.teams,
    playerRatings: state.playerRatings,
    tournamentHistory: state.tournamentHistory,
    setNumTeams: vi.fn((value) => setField('numTeams', value)),
    setStep: vi.fn(),
    setLoading: vi.fn(),
    setFixtures: vi.fn((value) => setField('fixtures', value)),
    setBracket: vi.fn((value) => setField('bracket', value)),
    setPlayerRatings: vi.fn((value) => setField('playerRatings', value)),
    setAiMatchSummaries: vi.fn((value) => setField('aiMatchSummaries', value)),
    setSwapHistory: vi.fn((value) => setField('swapHistory', value)),
    setCurrentTournamentId: vi.fn((value) => setField('currentTournamentId', value)),
    setTournamentHistory: vi.fn((value) => setField('tournamentHistory', value)),
    updatePlayerDatabase: vi.fn((name) => {
      const normalized = String(name || '').trim();
      if (!normalized) return;
      if (!state.playerDatabase.includes(normalized)) {
        state.playerDatabase = [...state.playerDatabase, normalized];
      }
    }),
    saveTournamentMutation: { mutateAsync: vi.fn(async (payload) => payload) },
    deleteTournamentMutation: { mutateAsync: vi.fn(async () => true) },
    createTournamentRunIdRef: { current: 0 },
    pendingCreateRef: { current: null },
    localTournamentIdRef: { current: null },
    cloudIdWarningShownRef: { current: false },
    cloudIdRecoveryInFlightRef: { current: false },
    normalizeTournamentId: (value) => String(value || '').trim(),
    createLocalTournamentId: () => `local-${Date.now()}`,
    matchesTournamentId,
    upsertTournamentHistory: vi.fn((history, entry) => [...history, entry]),
    persistActiveTournamentCache: vi.fn(),
    updateActiveTournamentLock: vi.fn(),
    clearActiveTournamentLockIfMatches: vi.fn(async () => false),
    resolveSyncTournamentIdForWrite: vi.fn(() => null),
    buildActiveTournamentSnapshot: vi.fn(() => ({})),
  });

  const hook = renderHook((props) => useFixtureActions(props), {
    initialProps: buildFixtureProps(),
  });

  return {
    state,
    result: hook.result,
    rerender: () => hook.rerender(buildFixtureProps()),
  };
};

describe('odd-player tournament generation', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    sessionStorage.clear();
  });

  it('generates league fixtures with random odd-player swap metadata', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const harness = createHarness();

    await act(async () => {
      const created = await harness.result.current.generateFixtures({
        teamsOverride: harness.state.teams,
        oddPlayerEnabled: true,
        oddPlayerName: 'Z9',
      });
      expect(created).toBe(true);
    });
    harness.rerender();

    expect(harness.state.fixtures).toHaveLength(3);
    expect(harness.state.fixtures.every((fixture) => fixture.oddPlayerMeta?.activeOddPlayerName === 'Z9')).toBe(true);
    expect(harness.state.fixtures.every((fixture) => fixture.oddPlayerMeta?.sittingOutPlayerName)).toBe(true);
    expect(harness.state.fixtures.every((fixture) => fixture.roundTeams?.length === 3)).toBe(true);
    expect(
      harness.state.fixtures.every((fixture) => (
        [fixture.team1.player1, fixture.team1.player2, fixture.team2.player1, fixture.team2.player2]
          .filter(Boolean)
          .includes('Z9')
      ))
    ).toBe(true);
  });
});
