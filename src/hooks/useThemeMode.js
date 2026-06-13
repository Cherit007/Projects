import { useCallback, useEffect, useState } from 'react';
import { queueLocalStorageValue } from '../services/localStorageWriteService';
import { webStorage } from '../platform/storage';
import { STORAGE_KEYS } from '../platform/storageKeys';

const normalizeThemeMode = (value) => (
  value === 'light' || value === 'dark' ? value : 'dark'
);

export const useThemeMode = () => {
  const [themeMode, setThemeModeState] = useState(() => (
    normalizeThemeMode(webStorage.getItem(STORAGE_KEYS.THEME_MODE))
  ));

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.body.setAttribute('data-theme', themeMode);
    }
    queueLocalStorageValue(STORAGE_KEYS.THEME_MODE, themeMode);
  }, [themeMode]);

  const setThemeMode = useCallback((valueOrUpdater) => {
    setThemeModeState((prev) => {
      const nextValue = typeof valueOrUpdater === 'function'
        ? valueOrUpdater(prev)
        : valueOrUpdater;
      return normalizeThemeMode(nextValue);
    });
  }, []);

  const toggleThemeMode = useCallback(() => {
    setThemeMode((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, [setThemeMode]);

  return {
    themeMode,
    setThemeMode,
    toggleThemeMode,
  };
};
