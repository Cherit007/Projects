import { webStorage } from '../platform/storage';
import { STORAGE_KEYS } from '../platform/storageKeys';

export const readPersistedHistory = () => webStorage.getJson(STORAGE_KEYS.HISTORY, []);

export const seedPersistedHistory = (history) => {
  webStorage.setJson(STORAGE_KEYS.HISTORY, history);
};
