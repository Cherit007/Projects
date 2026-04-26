import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useTournamentActions } from '../hooks/useTournamentActions';

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

  const buildProps = () => ({
    assertCanOperate: vi.fn(() => true),
    assertCanDelete: vi.fn(() => true),
    confirmAction: vi.fn(async () => true),
    showToast: vi.fn(),
    isAppwriteEnabled: false,
    activeGroup: null,
    updatePlayerDatabase: vi.fn((name) => {
      const normalized = String(name || '').trim();
      if (!normalized) return;
      if (!state.playerDatabase.includes(normalized)) {
        state.playerDatabase = [...state.playerDatabase, normalized];
      }
    }),
    tournamentName: state.tournamentName,
    setTournamentName: vi.fn((value) => setField('tournamentName', value)),
    setNumTeams: vi.fn((value) => setField('numTeams', value)),
    format: state.format,
    gameMode: state.gameMode,
    tournamentFormat: state.tournamentFormat,
    setStep: vi.fn(),
    setLoading: vi.fn(),
    teams: state.teams,
    setTeams: vi.fn((value) => setField('teams', value)),
    fixtures: state.fixtures,
    setFixtures: vi.fn((value) => setField('fixtures', value)),
    bracket: state.bracket,
    setBracket: vi.fn((value) => setField('bracket', value)),
    champion: state.champion,
    setChampion: vi.fn((value) => setField('champion', value)),
    setPlayerDatabase: vi.fn((value) => setField('playerDatabase', value)),
    members: state.members,
    playerRatings: state.playerRatings,
    setPlayerRatings: vi.fn((value) => setField('playerRatings', value)),
    tournamentHistory: state.tournamentHistory,
    setTournamentHistory: vi.fn((value) => setField('tournamentHistory', value)),
    casualMatches: state.casualMatches,
    setCasualMatches: vi.fn((value) => setField('casualMatches', value)),
    setShowCasualMatch: vi.fn(),
    aiMatchSummaries: state.aiMatchSummaries,
    setAiMatchSummaries: vi.fn((value) => setField('aiMatchSummaries', value)),
    swapHistory: state.swapHistory,
    setSwapHistory: vi.fn((value) => setField('swapHistory', value)),
    currentTournamentId: state.currentTournamentId,
    setCurrentTournamentId: vi.fn((value) => setField('currentTournamentId', value)),
    setActiveTournamentLock: vi.fn(),
    syncCurrentTournament: vi.fn(async () => null),
    patchTournamentMatches: vi.fn(async () => ({
      updatedMatches: 0,
      updatedParticipants: 0,
      deletedParticipants: 0,
      missingMatches: 0,
    })),
    saveTournamentTransactionToAppwrite: vi.fn(async () => null),
    markRatingsPersisted: vi.fn(),
    buildRatingsDelta: vi.fn(() => ({ changedRatings: {}, deletedPlayerNames: [] })),
    saveTournamentMutation: { mutateAsync: vi.fn(async (payload) => payload) },
    deleteTournamentMutation: { mutateAsync: vi.fn(async () => true) },
    saveRatingsMutation: { mutateAsync: vi.fn(async (payload) => payload) },
    savePlayerDatabaseMutation: { mutateAsync: vi.fn(async (payload) => payload) },
    createCasualMatchMutation: { mutateAsync: vi.fn(async (payload) => payload) },
    deleteCasualMatchMutation: { mutateAsync: vi.fn(async () => true) },
  });

  const hook = renderHook((props) => useTournamentActions(props), {
    initialProps: buildProps(),
  });

  return {
    state,
    result: hook.result,
    rerender: () => hook.rerender(buildProps()),
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
