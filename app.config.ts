import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Extends app.json. Google sign-in returns to the app through the
 * `appwrite-callback-<project id>` scheme, which depends on the environment.
 * APPLE_TEAM_ID (not EXPO_PUBLIC_, so never bundled) signs local iOS builds.
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const projectId = process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID;
  const appleTeamId = process.env.APPLE_TEAM_ID;
  return {
    ...config,
    name: config.name ?? 'Many Tracker',
    slug: config.slug ?? 'many-tracker',
    scheme: ['financetracker', ...(projectId ? [`appwrite-callback-${projectId}`] : [])],
    ios: { ...config.ios, ...(appleTeamId ? { appleTeamId } : {}) },
  };
};
