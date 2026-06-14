import { storage, BUCKETS, ID } from '../appwrite/client.js';

const isStorageEnabled = () => Boolean(BUCKETS.PLAYER_PHOTOS);

const buildFileName = (playerName = 'player') => {
  const safeName = String(playerName || 'player').trim().toLowerCase().replace(/[^a-z0-9-_]+/g, '-');
  return `${safeName || 'player'}-${Date.now()}.png`;
};

const getPhotoUrl = (fileId) => {
  if (!isStorageEnabled() || !fileId) return '';
  try {
    const url = storage.getFileView(BUCKETS.PLAYER_PHOTOS, fileId);
    return typeof url === 'string' ? url : String(url);
  } catch {
    return '';
  }
};

const dataUrlToFile = async (dataUrl, playerName) => {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  return new File([blob], buildFileName(playerName), {
    type: blob.type || 'image/png',
  });
};

const uploadPhoto = async ({ playerName, dataUrl }) => {
  if (!isStorageEnabled()) throw new Error('Player photo storage bucket is not configured');
  const file = await dataUrlToFile(dataUrl, playerName);
  const result = await storage.createFile(BUCKETS.PLAYER_PHOTOS, ID.unique(), file);
  return {
    fileId: result.$id,
    url: getPhotoUrl(result.$id),
    fileName: result.name,
    sizeOriginal: result.sizeOriginal,
  };
};

const deletePhoto = async (fileId) => {
  if (!isStorageEnabled() || !fileId) return true;
  try {
    await storage.deleteFile(BUCKETS.PLAYER_PHOTOS, fileId);
    return true;
  } catch (error) {
    if (error?.code === 404) return true;
    throw error;
  }
};

export const playerPhotoStorageService = {
  isStorageEnabled,
  getPhotoUrl,
  uploadPhoto,
  deletePhoto,
};
