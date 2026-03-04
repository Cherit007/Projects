import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  databasesMock,
  state,
  resetState,
} = vi.hoisted(() => {
  const store = {
    players: [],
    ratings: [],
  };
  let uniqueCounter = 1;

  const collectionMap = {
    v2_players: 'players',
    v2_ratings_current: 'ratings',
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
    createDocument: vi.fn(async (_databaseId, collectionId, documentId, payload) => {
      const id = String(documentId || `unique-${uniqueCounter++}`);
      const row = { $id: id, ...payload };
      getDocs(collectionId).push(row);
      return { ...row };
    }),
    updateDocument: vi.fn(async (_databaseId, collectionId, documentId, payload) => {
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
  };

  const reset = () => {
    store.players = [];
    store.ratings = [];
    uniqueCounter = 1;
    Object.values(databases).forEach((fn) => fn.mockClear());
  };

  return {
    databasesMock: databases,
    state: store,
    resetState: reset,
  };
});

vi.mock('../appwrite.config', () => ({
  databases: databasesMock,
  DATABASE_ID: 'db1',
  COLLECTIONS: {
    PLAYERS: 'legacy_players',
    RATINGS: 'legacy_ratings',
    PLAYERS_V2: 'v2_players',
    RATINGS_CURRENT_V2: 'v2_ratings_current',
  },
  ID: {
    unique: vi.fn(() => ''),
  },
  Query: {
    equal: vi.fn((...args) => ({ op: 'equal', args })),
    orderAsc: vi.fn((...args) => ({ op: 'orderAsc', args })),
    limit: vi.fn((...args) => ({ op: 'limit', args })),
    cursorAfter: vi.fn((...args) => ({ op: 'cursorAfter', args })),
  },
}));

import { playerService } from '../services/playerService';

describe('playerService ratings delta', () => {
  beforeEach(() => {
    resetState();
  });

  it('skips writes for empty delta payload', async () => {
    const result = await playerService.savePlayerRatingsDelta({}, 'g1');

    expect(result).toEqual({
      changedRatings: {},
      deletedPlayerNames: [],
    });
    expect(databasesMock.createDocument).not.toHaveBeenCalled();
    expect(databasesMock.updateDocument).not.toHaveBeenCalled();
    expect(databasesMock.deleteDocument).not.toHaveBeenCalled();
  });

  it('updates changed players and deletes only stale deleted players', async () => {
    state.players.push(
      { $id: 'p-alice', groupId: 'g1', displayName: 'Alice', normalizedName: 'alice' },
      { $id: 'p-bob', groupId: 'g1', displayName: 'Bob', normalizedName: 'bob' }
    );
    state.ratings.push(
      {
        $id: 'r-alice',
        groupId: 'g1',
        playerId: 'p-alice',
        playerName: 'Alice',
        rating: '1000',
        matchesPlayed: '1',
        lastResult: 'loss',
        lastChange: '-5',
        sourceUpdatedAt: '2026-03-01T09:00:00.000Z',
      },
      {
        $id: 'r-bob',
        groupId: 'g1',
        playerId: 'p-bob',
        playerName: 'Bob',
        rating: '1010',
        matchesPlayed: '2',
        lastResult: 'win',
        lastChange: '5',
        sourceUpdatedAt: '2026-03-01T09:00:00.000Z',
      }
    );

    const result = await playerService.savePlayerRatingsDelta({
      changedRatings: {
        Alice: {
          rating: 1030,
          matchesPlayed: 2,
          history: [
            {
              result: 'win',
              change: 30,
              date: '2026-03-02T10:00:00.000Z',
            },
          ],
        },
      },
      deletedPlayerNames: ['Alice', 'Bob'],
    }, 'g1');

    expect(result.deletedPlayerNames).toEqual(['bob']);
    expect(state.ratings.find((row) => row.$id === 'r-alice')?.rating).toBe('1030');
    expect(state.ratings.find((row) => row.$id === 'r-alice')?.matchesPlayed).toBe('2');
    expect(state.ratings.find((row) => row.$id === 'r-alice')?.lastResult).toBe('win');
    expect(state.ratings.find((row) => row.$id === 'r-bob')).toBeUndefined();

    expect(databasesMock.updateDocument).toHaveBeenCalled();
    expect(databasesMock.deleteDocument).toHaveBeenCalledWith('db1', 'v2_ratings_current', 'r-bob');
  });

  it('returns ratings map using latest sourceUpdatedAt and player-id fallback names', async () => {
    state.players.push(
      { $id: 'p-a', groupId: 'g1', displayName: 'Alice', normalizedName: 'alice' },
      { $id: 'p-c', groupId: 'g1', displayName: 'Chris', normalizedName: 'chris' }
    );
    state.ratings.push(
      {
        $id: 'r-a-old',
        groupId: 'g1',
        playerId: 'p-a',
        playerName: 'Alice',
        rating: '1000',
        matchesPlayed: '2',
        sourceUpdatedAt: '2026-03-01T10:00:00.000Z',
      },
      {
        $id: 'r-a-new',
        groupId: 'g1',
        playerId: 'p-a',
        playerName: 'Alice',
        rating: '1105',
        matchesPlayed: '3',
        sourceUpdatedAt: '2026-03-03T10:00:00.000Z',
      },
      {
        $id: 'r-c',
        groupId: 'g1',
        playerId: 'p-c',
        playerName: '',
        rating: '1200',
        matchesPlayed: '4',
        sourceUpdatedAt: '2026-03-02T10:00:00.000Z',
      }
    );

    const result = await playerService.getPlayerRatings('g1');

    expect(result.ratings.Alice.rating).toBe(1105);
    expect(result.ratings.Alice.matchesPlayed).toBe(3);
    expect(result.ratings.Chris.rating).toBe(1200);
    expect(result.ratings.Chris.matchesPlayed).toBe(4);
  });
});
