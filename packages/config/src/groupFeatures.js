import { readEnv } from './readEnv.js';

/** Groups UI and selection are disabled by default; set VITE_/EXPO_PUBLIC_GROUPS_ENABLED=true to restore. */
export const areGroupsEnabled = () => {
  const raw = String(readEnv('VITE_GROUPS_ENABLED', '')).trim().toLowerCase();
  return raw === 'true' || raw === '1';
};
