import { beforeEach, describe, expect, it, vi } from 'vitest';

const databasesMock = {
  getDocument: vi.fn(),
  updateDocument: vi.fn(),
  createDocument: vi.fn(),
  deleteDocument: vi.fn(),
};

vi.mock('../appwrite.config', () => ({
  databases: databasesMock,
  DATABASE_ID: 'db1',
  COLLECTIONS: {
    APP_META: 'meta',
    SESSION_STATE: 'session',
  },
  ID: {
    custom: vi.fn((value) => `custom-${value}`),
  },
}));

import { appDataService } from '../services/appDataService';

describe('appDataService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('parses app meta document', async () => {
    databasesMock.getDocument.mockResolvedValueOnce({
      members: JSON.stringify([{ name: 'Alex' }]),
      templates: JSON.stringify([{ name: 'League 4' }]),
      playerPhotos: JSON.stringify({ Alex: { fileId: 'f1' } }),
      updatedAt: '2026-02-25T10:00:00.000Z',
    });

    const result = await appDataService.getAppMeta();

    expect(result.members).toHaveLength(1);
    expect(result.templates[0].name).toBe('League 4');
    expect(result.playerPhotos.Alex.fileId).toBe('f1');
  });

  it('creates session document when update gets 404', async () => {
    databasesMock.updateDocument.mockRejectedValueOnce({ code: 404 });
    databasesMock.createDocument.mockResolvedValueOnce({});

    const state = { step: 'tournament', tournamentName: 'Summer Cup' };
    const result = await appDataService.saveSessionState(state);

    expect(result).toEqual(state);
    expect(databasesMock.updateDocument).toHaveBeenCalledTimes(1);
    expect(databasesMock.createDocument).toHaveBeenCalledTimes(1);
  });

  it('clearSessionState returns true for missing doc', async () => {
    databasesMock.deleteDocument.mockRejectedValueOnce({ code: 404 });
    await expect(appDataService.clearSessionState()).resolves.toBe(true);
  });
});
