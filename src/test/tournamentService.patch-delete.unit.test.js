// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  databasesMock,
  state,
  resetState,
  flags,
} = vi.hoisted(() => {
  const store = {
    tournaments: [],
    teams: [],
    matches: [],
    participants: [],
    players: [],
  };
  let uniqueCounter = 1;

  const runtimeFlags = {
    failSoftDeleteOnce: false,
  };

  const collectionMap = {
    v2_tournaments: 'tournaments',
    v2_tournament_teams: 'teams',
    v2_matches: 'matches',
    v2_match_players: 'participants',
    v2_players: 'players',
  };

  const getDocs = (collectionId) => {
    const key = collectionMap[collectionId];
    if (!key) return [];
    return store[key];
  };

  const cloneDocs = (docs) => docs.map((doc) => ({ ...doc }));

  const matchesEqual = (doc, field, expected) => {
    const left = field === '$id' ? doc.$id : doc?.[field];
    if (Array.isArray(expected)) {
      return expected.map((value) => String(value ?? '')).includes(String(left ?? ''));
    }
    return String(left ?? '') === String(expected ?? '');
  };

  const applyFilters = (docs, queries = []) => (
    docs.filter((doc) => (
      (queries || []).every((query) => {
        if (!query || query.op !== 'equal') return true;
        const [field, expected] = query.args || [];
        return matchesEqual(doc, field, expected);
      })
    ))
  );

  const databases = {
    listDocuments: vi.fn(async (_databaseId, collectionId, queries = []) => ({
      documents: cloneDocs(applyFilters(getDocs(collectionId), queries)),
    })),
    getDocument: vi.fn(async (_databaseId, collectionId, documentId) => {
      const row = getDocs(collectionId).find((item) => item.$id === documentId);
      if (!row) throw { code: 404, message: 'Not found' };
      return { ...row };
    }),
    createDocument: vi.fn(async (_databaseId, collectionId, documentId, payload) => {
      const id = String(documentId || `unique-${uniqueCounter++}`);
      const row = { $id: id, ...payload };
      getDocs(collectionId).push(row);
      return { ...row };
    }),
    updateDocument: vi.fn(async (_databaseId, collectionId, documentId, payload) => {
      if (
        collectionId === 'v2_tournaments'
        && payload?.status === 'deleted'
        && runtimeFlags.failSoftDeleteOnce
      ) {
        runtimeFlags.failSoftDeleteOnce = false;
        throw {
          code: 400,
          message: 'Invalid document structure: status enum mismatch',
        };
      }

      const docs = getDocs(collectionId);
      const index = docs.findIndex((item) => item.$id === documentId);
      if (index < 0) throw { code: 404, message: 'Not found' };
      docs[index] = { ...docs[index], ...payload };
      return { ...docs[index] };
    }),
    deleteDocument: vi.fn(async (_databaseId, collectionId, documentId) => {
      const docs = getDocs(collectionId);
      const filtered = docs.filter((item) => item.$id !== documentId);
      docs.splice(0, docs.length, ...filtered);
    }),
    upsertDocument: vi.fn(async (_databaseId, collectionId, documentId, payload) => {
      const docs = getDocs(collectionId);
      const index = docs.findIndex((item) => item.$id === documentId);
      if (index >= 0) {
        docs[index] = { ...docs[index], ...payload };
        return { ...docs[index] };
      }
      const row = { $id: documentId, ...payload };
      docs.push(row);
      return { ...row };
    }),
  };

  const reset = () => {
    store.tournaments = [];
    store.teams = [];
    store.matches = [];
    store.participants = [];
    store.players = [];
    uniqueCounter = 1;
    runtimeFlags.failSoftDeleteOnce = false;
    Object.values(databases).forEach((fn) => fn.mockClear());
  };

  return {
    databasesMock: databases,
    state: store,
    resetState: reset,
    flags: runtimeFlags,
  };
});

vi.mock('../appwrite.config', () => ({
  databases: databasesMock,
  DATABASE_ID: 'db1',
  COLLECTIONS: {
    TOURNAMENTS: 'legacy_tournaments',
    TOURNAMENTS_V2: 'v2_tournaments',
    TOURNAMENT_TEAMS_V2: 'v2_tournament_teams',
    MATCHES_V2: 'v2_matches',
    MATCH_PLAYERS_V2: 'v2_match_players',
    PLAYERS_V2: 'v2_players',
  },
  ID: {
    unique: vi.fn(() => ''),
  },
  Query: {
    equal: vi.fn((...args) => ({ op: 'equal', args })),
    orderDesc: vi.fn((...args) => ({ op: 'orderDesc', args })),
    orderAsc: vi.fn((...args) => ({ op: 'orderAsc', args })),
    limit: vi.fn((...args) => ({ op: 'limit', args })),
    cursorAfter: vi.fn((...args) => ({ op: 'cursorAfter', args })),
  },
}));

import { tournamentService } from '../services/tournamentService';

describe('tournamentService patch + delete edge cases', () => {
  beforeEach(() => {
    resetState();
  });

  it('reuses an existing tournament document when the legacy tournament id already exists', async () => {
    state.tournaments.push({
      $id: 't-existing',
      groupId: 'g-1',
      legacyTournamentId: 'legacy-1',
      name: 'Legacy Cup',
      dateLabel: '2026-03-03',
      status: 'active',
      gameMode: 'doubles',
      tournamentFormat: 'league',
      format: '1',
      oddPlayerEnabled: 'false',
      oddPlayerName: '',
      sourceCreatedAt: '2026-03-03T10:00:00.000Z',
      sourceUpdatedAt: '2026-03-03T10:05:00.000Z',
      $createdAt: '2026-03-03T10:00:00.000Z',
      $updatedAt: '2026-03-03T10:05:00.000Z',
    });

    const result = await tournamentService.createTournament({
      legacyTournamentId: 'legacy-1',
      name: 'Legacy Cup',
      date: '2026-03-03',
      teams: [],
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
    }, 'g-1');

    expect(result.id).toBe('t-existing');
    expect(result.appwriteId).toBe('t-existing');
    expect(state.tournaments).toHaveLength(1);
    expect(state.tournaments[0].status).toBe('completed');
    expect(databasesMock.upsertDocument).toHaveBeenCalledWith(
      'db1',
      'v2_tournaments',
      't-existing',
      expect.objectContaining({
        legacyTournamentId: 'legacy-1',
        status: 'completed',
      })
    );
  });

  it('derives completed summaries from the final match even when the tournament doc status is stale', async () => {
    state.tournaments.push({
      $id: 't-final',
      groupId: 'g-1',
      legacyTournamentId: 'legacy-final',
      name: 'Night Finals',
      dateLabel: '2026-03-10',
      status: 'active',
      gameMode: 'doubles',
      tournamentFormat: 'league',
      format: '1',
      oddPlayerEnabled: 'false',
      oddPlayerName: '',
      sourceCreatedAt: '2026-03-10T10:00:00.000Z',
      sourceUpdatedAt: '2026-03-10T18:15:00.000Z',
      $createdAt: '2026-03-10T10:00:00.000Z',
      $updatedAt: '2026-03-10T18:15:00.000Z',
    });
    state.teams.push(
      {
        $id: 'team-1',
        groupId: 'g-1',
        tournamentId: 't-final',
        legacyTournamentId: 'legacy-final',
        legacyTeamId: '1',
        teamNo: '1',
        teamName: 'Falcons',
        emoji: '🏸',
        player1Name: 'A1',
        player2Name: 'A2',
      },
      {
        $id: 'team-2',
        groupId: 'g-1',
        tournamentId: 't-final',
        legacyTournamentId: 'legacy-final',
        legacyTeamId: '2',
        teamNo: '2',
        teamName: 'Tigers',
        emoji: '🏸',
        player1Name: 'B1',
        player2Name: 'B2',
      }
    );
    state.matches.push({
      $id: 'match-final',
      groupId: 'g-1',
      tournamentId: 't-final',
      legacyTournamentId: 'legacy-final',
      legacyMatchId: 'final-1',
      matchKind: 'final',
      bracketRoundIndex: '',
      bracketMatchIndex: '',
      roundLabel: 'Final',
      roundNo: 'Final',
      sequenceNo: '4',
      nextLegacyMatchId: '',
      team1Id: 'team-1',
      team2Id: 'team-2',
      team1Name: 'Falcons',
      team2Name: 'Tigers',
      score1: '21',
      score2: '16',
      completed: 'true',
      completedAt: '2026-03-10T18:00:00.000Z',
      winnerSide: '1',
    });

    const completedSummaries = await tournamentService.getTournamentSummaries(20, 'g-1', ['completed']);
    const activeSummaries = await tournamentService.getTournamentSummaries(20, 'g-1', ['active']);

    expect(completedSummaries).toHaveLength(1);
    expect(completedSummaries[0]).toMatchObject({
      id: 't-final',
      status: 'completed',
      champion: expect.objectContaining({
        name: 'Falcons',
      }),
    });
    expect(activeSummaries).toHaveLength(0);
  });

  it('returns missingMatches when requested patch target is not found', async () => {
    state.tournaments.push({
      $id: 't-1',
      groupId: 'g-1',
      status: 'active',
      name: 'Club Open',
    });
    state.matches.push({
      $id: 'm-existing',
      groupId: 'g-1',
      tournamentId: 't-1',
      legacyTournamentId: 't-1',
      legacyMatchId: 'match-1',
      matchKind: 'league',
      bracketRoundIndex: '',
      bracketMatchIndex: '',
      roundLabel: 'Round 1',
      roundNo: '1',
      sequenceNo: '1',
      nextLegacyMatchId: '',
      team1Id: '',
      team2Id: '',
      team1Name: 'A',
      team2Name: 'B',
      score1: '',
      score2: '',
      completed: 'false',
      winnerSide: '',
    });

    const summary = await tournamentService.patchTournamentMatches('t-1', [{
      id: 'match-999',
      matchKind: 'league',
      team1: { name: 'A', player1: 'P1', player2: 'P2' },
      team2: { name: 'B', player1: 'P3', player2: 'P4' },
      score1: 21,
      score2: 18,
      completed: true,
    }], 'g-1');

    expect(summary).toEqual({
      updatedMatches: 0,
      updatedParticipants: 0,
      deletedParticipants: 0,
      missingMatches: 1,
    });
    expect(databasesMock.updateDocument).not.toHaveBeenCalled();
    expect(databasesMock.createDocument).not.toHaveBeenCalled();
  });

  it('falls back to hard delete when soft delete status update fails', async () => {
    state.tournaments.push({
      $id: 't-1',
      groupId: 'g-1',
      status: 'active',
      name: 'Fallback Cup',
    });
    state.teams.push(
      { $id: 'team-1', groupId: 'g-1', tournamentId: 't-1' },
      { $id: 'team-2', groupId: 'g-1', tournamentId: 't-1' }
    );
    state.matches.push(
      { $id: 'match-1', groupId: 'g-1', tournamentId: 't-1' },
      { $id: 'match-2', groupId: 'g-1', tournamentId: 't-1' }
    );
    state.participants.push(
      { $id: 'mp-1', groupId: 'g-1', matchId: 'match-1' },
      { $id: 'mp-2', groupId: 'g-1', matchId: 'match-2' }
    );
    flags.failSoftDeleteOnce = true;

    const result = await tournamentService.deleteTournament('t-1', 'g-1');

    expect(result).toBe(true);
    expect(state.tournaments).toHaveLength(0);
    expect(state.teams).toHaveLength(0);
    expect(state.matches).toHaveLength(0);
    expect(state.participants).toHaveLength(0);

    expect(databasesMock.updateDocument).toHaveBeenCalledWith(
      'db1',
      'v2_tournaments',
      't-1',
      expect.objectContaining({ status: 'deleted' })
    );

    const deleteCalls = databasesMock.deleteDocument.mock.calls.map((call) => call[1]);
    expect(deleteCalls).toEqual(expect.arrayContaining([
      'v2_match_players',
      'v2_matches',
      'v2_tournament_teams',
      'v2_tournaments',
    ]));
  });
});
