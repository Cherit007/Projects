import { useCallback } from 'react';
import { playerPhotoStorageService } from '../services/playerPhotoStorageService';
import { queueLocalStorageJson } from '../services/localStorageWriteService';
import { STORAGE_KEYS } from '../platform/storageKeys';
import { normalizePhotoInput } from '../utils/playerPhotos';

export const hydratePlayerPhotos = (rawPhotos = {}) => {
  const urls = {};
  const refs = {};
  Object.entries(rawPhotos || {}).forEach(([name, value]) => {
    if (!name) return;
    if (typeof value === 'string') {
      urls[name] = value;
      return;
    }

    if (value && typeof value === 'object' && value.fileId) {
      refs[name] = value;
      const storageUrl = playerPhotoStorageService.getPhotoUrl(value.fileId);
      if (storageUrl) urls[name] = storageUrl;
    }
  });
  return { urls, refs };
};

export const usePlayerPhotoActions = ({
  requiresAuth = false,
  isAppwriteEnabled = false,
  playerPhotos = {},
  playerPhotoRefs = {},
  setPlayerPhotos,
  setPlayerPhotoRefs,
  canEditOwnProfile = () => true,
  showToast = () => {},
  savePlayerPhotosToCloud = async () => {},
}) => {
  const updatePlayerPhoto = useCallback(async (playerName, photoInput) => {
    if (requiresAuth && !canEditOwnProfile(playerName)) {
      showToast('You can edit only your own linked profile photo', 'error');
      return { success: false, reason: 'Read-only access' };
    }
    const name = playerName?.trim();
    if (!name) return { success: false };

    const normalized = normalizePhotoInput(photoInput);
    const existingRef = playerPhotoRefs[name];

    try {
      if (isAppwriteEnabled && playerPhotoStorageService.isStorageEnabled()) {
        if (!normalized) {
          if (existingRef?.fileId) {
            await playerPhotoStorageService.deletePhoto(existingRef.fileId);
          }

          const updatedRefs = { ...playerPhotoRefs };
          delete updatedRefs[name];
          const updatedUrls = { ...playerPhotos };
          delete updatedUrls[name];

          setPlayerPhotoRefs(updatedRefs);
          setPlayerPhotos(updatedUrls);
          await savePlayerPhotosToCloud(updatedRefs);
          return { success: true };
        }

        if (/^data:image\//i.test(normalized)) {
          const uploaded = await playerPhotoStorageService.uploadPhoto({
            playerName: name,
            dataUrl: normalized,
          });

          if (existingRef?.fileId) {
            await playerPhotoStorageService.deletePhoto(existingRef.fileId);
          }

          const updatedRefs = {
            ...playerPhotoRefs,
            [name]: {
              fileId: uploaded.fileId,
              type: 'storage',
              updatedAt: new Date().toISOString(),
            },
          };
          const updatedUrls = {
            ...playerPhotos,
            [name]: uploaded.url,
          };
          setPlayerPhotoRefs(updatedRefs);
          setPlayerPhotos(updatedUrls);
          await savePlayerPhotosToCloud(updatedRefs);
          return { success: true };
        }
      }

      setPlayerPhotos((prev) => {
        const updated = { ...prev };
        if (normalized) updated[name] = normalized;
        else delete updated[name];
        if (isAppwriteEnabled) {
          savePlayerPhotosToCloud(updated).catch((saveError) => {
            console.error('Failed to save player photos to Appwrite:', saveError);
            queueLocalStorageJson(STORAGE_KEYS.PLAYER_PHOTOS, updated);
          });
        } else {
          queueLocalStorageJson(STORAGE_KEYS.PLAYER_PHOTOS, updated);
        }
        return updated;
      });
      return { success: true };
    } catch (error) {
      console.error('Failed to update player photo:', error);
      return { success: false, error };
    }
  }, [
    canEditOwnProfile,
    isAppwriteEnabled,
    playerPhotoRefs,
    playerPhotos,
    requiresAuth,
    savePlayerPhotosToCloud,
    setPlayerPhotoRefs,
    setPlayerPhotos,
    showToast,
  ]);

  return {
    updatePlayerPhoto,
  };
};
