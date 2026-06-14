import { expoPublicEnvBySuffix } from './expoPublicEnv.js';

const fromImportMeta = (key) => {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env?.[key] != null && import.meta.env[key] !== '') {
      return import.meta.env[key];
    }
  } catch {
    // import.meta unavailable (e.g. some RN bundles)
  }
  return undefined;
};

const fromProcessEnv = (key) => {
  if (typeof process !== 'undefined' && process.env) {
    const direct = process.env[key];
    if (direct != null && direct !== '') return direct;
  }

  if (key.startsWith('VITE_')) {
    const suffix = key.slice('VITE_'.length);
    const expoValue = expoPublicEnvBySuffix[suffix];
    if (expoValue != null && expoValue !== '') return expoValue;
  }

  return undefined;
};

/** Read Vite (`VITE_*`) or Expo (`EXPO_PUBLIC_*`) env vars with optional fallback. */
export const readEnv = (key, fallback = '') => (
  fromImportMeta(key) ?? fromProcessEnv(key) ?? fallback
);

export const isDevEnv = () => {
  try {
    if (import.meta.env?.DEV) return true;
  } catch {
    // ignore
  }
  return process.env.NODE_ENV !== 'production';
};
