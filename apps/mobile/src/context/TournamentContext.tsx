import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { tournamentService } from '@fixture-maker/api/tournamentService';
import { getSportPlugin } from '@fixture-maker/domain/sports';
import { isAppwriteConfigured } from '@fixture-maker/config/appwrite/env';
import { nativeStorage, STORAGE_KEYS } from '@fixture-maker/storage/native';
import { ANALYTICS_EVENTS } from '@fixture-maker/analytics/events';
import { trackEvent } from '@fixture-maker/analytics/trackEvent';
import { useAppSession } from './AppSessionContext';
import { offlineOutboxService, isLikelyOfflineError } from '../services/offlineOutboxService';
import {
  applyMatchScore,
  buildActiveSnapshot,
  createEmptyTeams,
  createLocalTournamentId,
  generateLeagueFixtures,
  normalizeScore,
  validateTeamsForStart,
} from '../lib/tournamentDraft';
import type { FixtureMatch, TeamDraft, TournamentDraft } from '../types/tournament';

type CloudTournamentResult = {
  appwriteId?: string | null;
  id?: string | null;
};

type CreateTournamentFn = (
  tournamentData: Record<string, unknown>,
  groupId?: string | null,
) => Promise<CloudTournamentResult>;

type UpdateTournamentFn = (
  tournamentId: string,
  updates: Record<string, unknown>,
  groupId?: string | null,
) => Promise<CloudTournamentResult>;

const createTournamentOnCloud = tournamentService.createTournament as CreateTournamentFn;
const updateTournamentOnCloud = tournamentService.updateTournament as UpdateTournamentFn;

type TournamentContextValue = {
  tournamentName: string;
  setTournamentName: (value: string) => void;
  numTeams: number;
  setNumTeams: (value: number) => void;
  gameMode: string;
  setGameMode: (value: string) => void;
  tournamentFormat: string;
  setTournamentFormat: (value: string) => void;
  format: string;
  setFormat: (value: string) => void;
  teams: TeamDraft[];
  setTeams: React.Dispatch<React.SetStateAction<TeamDraft[]>>;
  fixtures: FixtureMatch[];
  pointsTable: Array<Record<string, unknown>>;
  standings: Array<{ name: string; points: number; played: number }>;
  activeTournament: TournamentDraft | null;
  loading: boolean;
  statusMessage: string;
  clearStatusMessage: () => void;
  prepareTeamEntry: () => { ok: boolean; message?: string };
  generateAndStart: () => Promise<{ ok: boolean; message?: string }>;
  saveMatchResult: (
    matchId: string | number,
    score1Input: string,
    score2Input: string,
  ) => Promise<{ ok: boolean; message?: string }>;
  resetTournament: () => void;
  loadTournamentFromHistory: (tournament: Record<string, unknown>) => Promise<void>;
};

const TournamentContext = createContext<TournamentContextValue | null>(null);

const defaultDraftState = () => ({
  tournamentName: '',
  numTeams: 4,
  gameMode: 'doubles',
  tournamentFormat: 'league',
  format: '1',
  teams: [] as TeamDraft[],
  fixtures: [] as FixtureMatch[],
  activeTournament: null as TournamentDraft | null,
});

export const TournamentProvider = ({ children }: { children: React.ReactNode }) => {
  const { sportId, activeGroup, setSportId } = useAppSession();
  const [state, setState] = useState(defaultDraftState);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const hydratedTournamentIdRef = useRef<string | null>(null);

  const persistLocal = useCallback(async (snapshot: TournamentDraft) => {
    await nativeStorage.setJson(STORAGE_KEYS.ACTIVE_TOURNAMENT_CACHE, snapshot);
    const history = await nativeStorage.getJson(STORAGE_KEYS.HISTORY, null);
    const list = Array.isArray(history) ? history : [];
    const withoutCurrent = list.filter((item) => {
      const entry = item as TournamentDraft;
      return entry.id !== snapshot.id && entry.appwriteId !== snapshot.appwriteId;
    });
    await nativeStorage.setJson(STORAGE_KEYS.HISTORY, [snapshot, ...withoutCurrent]);
  }, []);

  const hydrateFromStorage = useCallback(async () => {
    if (!activeGroup?.id) return;
    const cached = await nativeStorage.getJson(STORAGE_KEYS.ACTIVE_TOURNAMENT_CACHE, null);
    if (!cached || typeof cached !== 'object') return;
    const snapshot = cached as TournamentDraft;
    if (snapshot.status !== 'active') return;

    const snapshotId = String(snapshot.id || snapshot.appwriteId || '');
    if (hydratedTournamentIdRef.current === snapshotId && state.activeTournament?.id === snapshot.id) {
      return;
    }

    const fixtures = Array.isArray(snapshot.fixtures) ? snapshot.fixtures : [];
    const teams = Array.isArray(snapshot.teams) ? snapshot.teams : [];

    hydratedTournamentIdRef.current = snapshotId;

    setState((prev) => ({
      ...prev,
      tournamentName: snapshot.name || prev.tournamentName,
      gameMode: snapshot.gameMode || prev.gameMode,
      tournamentFormat: snapshot.tournamentFormat || prev.tournamentFormat,
      format: snapshot.format || prev.format,
      teams,
      fixtures,
      activeTournament: { ...snapshot, fixtures, teams },
      numTeams: teams.length || prev.numTeams,
    }));
    if (snapshot.sportId) {
      setSportId(snapshot.sportId);
    }
  }, [activeGroup?.id, setSportId, state.activeTournament?.id]);

  useEffect(() => {
    void hydrateFromStorage();
  }, [hydrateFromStorage]);

  const pointsTable = useMemo(() => {
    if (!state.fixtures.length || !state.teams.length) return [];
    const plugin = getSportPlugin(sportId);
    const rows = plugin.scoring.calculatePointsTable(state.teams, state.fixtures, {}) as Array<Record<string, unknown>>;
    return Array.isArray(rows) ? rows : [];
  }, [sportId, state.fixtures, state.teams]);

  const standings = useMemo(() => (
    pointsTable.map((row) => ({
      name: String(row.name || ''),
      points: Number(row.points || 0),
      played: Number(row.played || 0),
    }))
  ), [pointsTable]);

  const prepareTeamEntry = useCallback(() => {
    if (!state.tournamentName.trim()) {
      return { ok: false, message: 'Enter a tournament name.' };
    }
    if (state.numTeams < 3 || state.numTeams > 12) {
      return { ok: false, message: 'League tournaments need 3–12 teams.' };
    }

    const teams = state.teams.length === state.numTeams
      ? state.teams
      : createEmptyTeams(state.numTeams, state.gameMode, sportId);

    setState((prev) => ({ ...prev, teams }));
    return { ok: true };
  }, [sportId, state.gameMode, state.numTeams, state.teams, state.tournamentName]);

  const generateAndStart = useCallback(async () => {
    const validation = validateTeamsForStart(state.teams, state.gameMode);
    if (!validation.valid) {
      return { ok: false, message: validation.message };
    }

    setLoading(true);
    setStatusMessage('');
    try {
      const now = new Date().toISOString();
      const localId = state.activeTournament?.id || createLocalTournamentId();
      const { fixtures, bracket } = generateLeagueFixtures(
        state.teams,
        sportId,
        state.tournamentFormat,
        state.format,
      );

      if (!fixtures.length && !bracket.length) {
        return { ok: false, message: 'Could not generate fixtures for this format.' };
      }

      let snapshot: TournamentDraft = buildActiveSnapshot({
        id: localId,
        appwriteId: state.activeTournament?.appwriteId || null,
        name: state.tournamentName.trim(),
        sportId,
        gameMode: state.gameMode,
        tournamentFormat: state.tournamentFormat,
        format: state.format,
        teams: state.teams,
        fixtures,
        bracket,
        status: 'active',
        champion: null,
        createdAt: state.activeTournament?.createdAt || now,
        updatedAt: now,
      });

      if (isAppwriteConfigured() && activeGroup?.id) {
        try {
          const saved = await createTournamentOnCloud({
            legacyTournamentId: localId,
            name: snapshot.name,
            date: new Date().toLocaleDateString(),
            teams: snapshot.teams,
            fixtures: snapshot.fixtures,
            bracket: snapshot.bracket,
            format: snapshot.format,
            gameMode: snapshot.gameMode,
            tournamentFormat: snapshot.tournamentFormat,
            sportId: snapshot.sportId,
            status: 'active',
          }, activeGroup.id);

          snapshot = {
            ...snapshot,
            appwriteId: saved.appwriteId || saved.id || null,
          };
        } catch (error) {
          if (isLikelyOfflineError(error)) {
            await offlineOutboxService.enqueue({
              action: 'tournament.save',
              payload: { tournament: snapshot, groupId: activeGroup.id },
              dedupeKey: `tournament-save:${snapshot.id}`,
            });
          } else {
            throw error;
          }
        }
      }

      await persistLocal(snapshot);
      setState((prev) => ({
        ...prev,
        fixtures,
        activeTournament: snapshot,
      }));

      trackEvent(ANALYTICS_EVENTS.TOURNAMENT_CREATED, {
        sportId,
        status: 'active',
        tournamentFormat: state.tournamentFormat,
        teamCount: state.teams.length,
        platform: 'mobile',
      });

      setStatusMessage('Tournament started.');
      return { ok: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to start tournament';
      return { ok: false, message };
    } finally {
      setLoading(false);
    }
  }, [
    activeGroup?.id,
    persistLocal,
    sportId,
    state.activeTournament,
    state.format,
    state.gameMode,
    state.teams,
    state.tournamentFormat,
    state.tournamentName,
  ]);

  const saveMatchResult = useCallback(async (
    matchId: string | number,
    score1Input: string,
    score2Input: string,
  ) => {
    const score1 = normalizeScore(score1Input);
    const score2 = normalizeScore(score2Input);
    const plugin = getSportPlugin(sportId);
    const scoring = plugin.scoring as {
      validateMatchScore?: (
        score1: unknown,
        score2: unknown,
        ruleConfig: Record<string, unknown>,
      ) => { valid: boolean; message?: string; score1?: number; score2?: number };
    };
    const validator = scoring.validateMatchScore;
    const validation = typeof validator === 'function'
      ? validator(score1, score2, {})
      : { valid: score1 !== '' && score2 !== '' && score1 !== score2 };

    if (!validation.valid) {
      return { ok: false, message: validation.message || 'Invalid scores' };
    }

    const resolvedScore1 = validation.score1 ?? score1;
    const resolvedScore2 = validation.score2 ?? score2;
    const nextFixtures = applyMatchScore(
      state.fixtures,
      matchId,
      Number(resolvedScore1),
      Number(resolvedScore2),
    );

    setLoading(true);
    try {
      const snapshot = buildActiveSnapshot({
        ...(state.activeTournament || {
          id: createLocalTournamentId(),
          appwriteId: null,
          name: state.tournamentName,
          sportId,
          gameMode: state.gameMode,
          tournamentFormat: state.tournamentFormat,
          format: state.format,
          teams: state.teams,
          bracket: [],
          status: 'active',
          champion: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
        fixtures: nextFixtures,
        teams: state.teams,
      });

      if (isAppwriteConfigured() && activeGroup?.id && snapshot.appwriteId) {
        try {
          await updateTournamentOnCloud(snapshot.appwriteId, {
            fixtures: nextFixtures,
            teams: state.teams,
            status: 'active',
          }, activeGroup.id);
        } catch (error) {
          if (isLikelyOfflineError(error)) {
            await offlineOutboxService.enqueue({
              action: 'tournament.sync',
              payload: {
                tournamentId: snapshot.appwriteId,
                tournamentData: snapshot,
                groupId: activeGroup.id,
              },
              dedupeKey: `tournament-sync:${snapshot.appwriteId}`,
            });
          } else {
            throw error;
          }
        }
      }

      await persistLocal(snapshot);
      setState((prev) => ({
        ...prev,
        fixtures: nextFixtures,
        activeTournament: snapshot,
      }));

      trackEvent(ANALYTICS_EVENTS.MATCH_SCORED, {
        sportId,
        tournamentFormat: state.tournamentFormat,
        platform: 'mobile',
      });

      return { ok: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save score';
      return { ok: false, message };
    } finally {
      setLoading(false);
    }
  }, [
    activeGroup?.id,
    persistLocal,
    sportId,
    state.activeTournament,
    state.fixtures,
    state.format,
    state.gameMode,
    state.teams,
    state.tournamentFormat,
    state.tournamentName,
  ]);

  const resetTournament = useCallback(() => {
    setState(defaultDraftState());
    hydratedTournamentIdRef.current = null;
    void nativeStorage.removeItem(STORAGE_KEYS.ACTIVE_TOURNAMENT_CACHE);
  }, []);

  const loadTournamentFromHistory = useCallback(async (tournament: Record<string, unknown>) => {
    const fixtures = Array.isArray(tournament.fixtures) ? tournament.fixtures as FixtureMatch[] : [];
    const teams = Array.isArray(tournament.teams) ? tournament.teams as TeamDraft[] : [];
    const snapshot = {
      ...(tournament as TournamentDraft),
      fixtures,
      teams,
      status: String(tournament.status || 'active'),
    } as TournamentDraft;

    hydratedTournamentIdRef.current = String(snapshot.id || snapshot.appwriteId || '');
    await persistLocal(snapshot);

    setState((prev) => ({
      ...prev,
      tournamentName: snapshot.name || prev.tournamentName,
      gameMode: snapshot.gameMode || prev.gameMode,
      tournamentFormat: snapshot.tournamentFormat || prev.tournamentFormat,
      format: snapshot.format || prev.format,
      teams,
      fixtures,
      activeTournament: snapshot,
      numTeams: teams.length || prev.numTeams,
    }));

    if (snapshot.sportId) {
      setSportId(snapshot.sportId);
    }
  }, [persistLocal, setSportId]);

  const setTeams = useCallback((updater: React.SetStateAction<TeamDraft[]>) => {
    setState((prev) => ({
      ...prev,
      teams: typeof updater === 'function' ? updater(prev.teams) : updater,
    }));
  }, []);

  const value = useMemo(() => ({
    tournamentName: state.tournamentName,
    setTournamentName: (value: string) => setState((prev) => ({ ...prev, tournamentName: value })),
    numTeams: state.numTeams,
    setNumTeams: (value: number) => setState((prev) => ({ ...prev, numTeams: value })),
    gameMode: state.gameMode,
    setGameMode: (value: string) => setState((prev) => ({ ...prev, gameMode: value })),
    tournamentFormat: state.tournamentFormat,
    setTournamentFormat: (value: string) => setState((prev) => ({ ...prev, tournamentFormat: value })),
    format: state.format,
    setFormat: (value: string) => setState((prev) => ({ ...prev, format: value })),
    teams: state.teams,
    setTeams,
    fixtures: state.fixtures,
    pointsTable,
    standings,
    activeTournament: state.activeTournament,
    loading,
    statusMessage,
    clearStatusMessage: () => setStatusMessage(''),
    prepareTeamEntry,
    generateAndStart,
    saveMatchResult,
    resetTournament,
    loadTournamentFromHistory,
  }), [
    generateAndStart,
    loadTournamentFromHistory,
    loading,
    pointsTable,
    prepareTeamEntry,
    resetTournament,
    saveMatchResult,
    standings,
    statusMessage,
    state.activeTournament,
    state.fixtures,
    state.format,
    state.gameMode,
    state.numTeams,
    state.teams,
    state.tournamentFormat,
    state.tournamentName,
    setTeams,
  ]);

  return (
    <TournamentContext.Provider value={value}>
      {children}
    </TournamentContext.Provider>
  );
};

export const useTournament = () => {
  const context = useContext(TournamentContext);
  if (!context) {
    throw new Error('useTournament must be used within TournamentProvider');
  }
  return context;
};
