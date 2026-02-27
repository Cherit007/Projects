import { beforeEach, describe, expect, it, vi } from 'vitest';

const { databasesMock } = vi.hoisted(() => ({
  databasesMock: {
    getDocument: vi.fn(),
    updateDocument: vi.fn(),
    createDocument: vi.fn(),
    deleteDocument: vi.fn(),
  },
}));

vi.mock('../appwrite.config', () => ({
  databases: databasesMock,
  DATABASE_ID: 'db1',
  COLLECTIONS: {
    APP_META: 'meta',
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

  it('saves additional group metadata', async () => {
    databasesMock.getDocument.mockRejectedValueOnce({ code: 404 });
    databasesMock.createDocument.mockResolvedValueOnce({});

    const result = await appDataService.saveAppMeta({
      groups: [{ id: 'g1', name: 'Club Group' }],
      groupMembers: [{ id: 'm1', groupId: 'g1', userId: 'u1', role: 'admin' }],
      groupInvites: [{ id: 'i1', code: 'ABC123', groupId: 'g1' }],
    });

    expect(result.groups).toHaveLength(1);
    expect(databasesMock.createDocument).toHaveBeenCalledTimes(1);
  });
});
