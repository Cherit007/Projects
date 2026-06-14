import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { hydratePlayerPhotos, usePlayerPhotoActions } from '../hooks/usePlayerPhotoActions';
import { STORAGE_KEYS } from '../platform/storageKeys';

vi.mock('../services/playerPhotoStorageService', () => ({
  playerPhotoStorageService: {
    isStorageEnabled: vi.fn(() => false),
    getPhotoUrl: vi.fn((fileId) => `https://cdn.example/${fileId}`),
    uploadPhoto: vi.fn(),
    deletePhoto: vi.fn(),
  },
}));

describe('hydratePlayerPhotos', () => {
  it('maps string values to urls', () => {
    expect(hydratePlayerPhotos({ Alice: 'data:image/png;base64,abc' })).toEqual({
      urls: { Alice: 'data:image/png;base64,abc' },
      refs: {},
    });
  });

  it('maps storage refs to urls and refs', () => {
    const result = hydratePlayerPhotos({
      Bob: { fileId: 'file-1', type: 'storage' },
    });
    expect(result.refs).toEqual({ Bob: { fileId: 'file-1', type: 'storage' } });
    expect(result.urls.Bob).toBe('https://cdn.example/file-1');
  });
});

describe('usePlayerPhotoActions', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('queues local photo updates in local mode', async () => {
    const setPlayerPhotos = vi.fn((updater) => {
      if (typeof updater === 'function') {
        return updater({});
      }
      return updater;
    });

    const { result } = renderHook(() => usePlayerPhotoActions({
      requiresAuth: false,
      isAppwriteEnabled: false,
      playerPhotos: {},
      playerPhotoRefs: {},
      setPlayerPhotos,
      setPlayerPhotoRefs: vi.fn(),
      showToast: vi.fn(),
      savePlayerPhotosToCloud: vi.fn(),
    }));

    await act(async () => {
      await result.current.updatePlayerPhoto('Alice', 'data:image/png;base64,abc');
    });

    expect(setPlayerPhotos).toHaveBeenCalled();
    expect(localStorage.getItem(STORAGE_KEYS.PLAYER_PHOTOS)).toContain('Alice');
  });

  it('blocks edits when auth requires own profile', async () => {
    const showToast = vi.fn();
    const { result } = renderHook(() => usePlayerPhotoActions({
      requiresAuth: true,
      isAppwriteEnabled: false,
      playerPhotos: {},
      playerPhotoRefs: {},
      setPlayerPhotos: vi.fn(),
      setPlayerPhotoRefs: vi.fn(),
      canEditOwnProfile: () => false,
      showToast,
      savePlayerPhotosToCloud: vi.fn(),
    }));

    const response = await act(async () => result.current.updatePlayerPhoto('Alice', 'data:image/png;base64,abc'));

    expect(response.success).toBe(false);
    expect(showToast).toHaveBeenCalledWith(
      'You can edit only your own linked profile photo',
      'error'
    );
  });
});
