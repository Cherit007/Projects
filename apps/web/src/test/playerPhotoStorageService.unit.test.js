import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { storageMock } = vi.hoisted(() => ({
  storageMock: {
    getFileView: vi.fn(),
    createFile: vi.fn(),
    deleteFile: vi.fn(),
  },
}));

vi.mock('@fixture-maker/api/appwrite/client', () => ({
  storage: storageMock,
  BUCKETS: { PLAYER_PHOTOS: 'player-photos' },
  ID: { unique: vi.fn(() => 'id-123') },
}));

import { playerPhotoStorageService } from '../services/playerPhotoStorageService';

describe('playerPhotoStorageService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns file view url', () => {
    storageMock.getFileView.mockReturnValueOnce('https://cdn.example.com/file');
    expect(playerPhotoStorageService.getPhotoUrl('f1')).toBe('https://cdn.example.com/file');
  });

  it('uploads photo and returns metadata', async () => {
    const blob = new Blob(['hello'], { type: 'image/png' });
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      blob: async () => blob,
    });
    storageMock.createFile.mockResolvedValueOnce({
      $id: 'file-1',
      name: 'alex.png',
      sizeOriginal: 5,
    });
    storageMock.getFileView.mockReturnValueOnce('https://cdn.example.com/file-1');

    const result = await playerPhotoStorageService.uploadPhoto({
      playerName: 'Alex',
      dataUrl: 'data:image/png;base64,AAAA',
    });

    expect(storageMock.createFile).toHaveBeenCalledTimes(1);
    expect(result.fileId).toBe('file-1');
    expect(result.url).toContain('file-1');
  });

  it('treats 404 delete as success', async () => {
    storageMock.deleteFile.mockRejectedValueOnce({ code: 404 });
    await expect(playerPhotoStorageService.deletePhoto('missing')).resolves.toBe(true);
  });
});
