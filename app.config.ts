import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Extends app.json. Google sign-in returns to the app through the
 * `appwrite-callback-<project id>` scheme, which depends on the environment.
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const projectId = process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID;
  return {
    ...config,
    name: config.name ?? 'FinanceTracker',
    slug: config.slug ?? 'FinanceTracker',
    scheme: ['financetracker', ...(projectId ? [`appwrite-callback-${projectId}`] : [])],
  };
};
