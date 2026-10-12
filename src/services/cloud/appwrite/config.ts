import Constants, { ExecutionEnvironment } from 'expo-constants';

/**
 * Public client identifiers only. Anything here is bundled into the app, so a
 * privileged Appwrite API key must never be added.
 */
export const cloudConfig = {
  endpoint: process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT ?? '',
  projectId: process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID ?? '',
  databaseId: 'finance',
};

export const isAppwriteConfigured = Boolean(cloudConfig.endpoint && cloudConfig.projectId);

/**
 * Appwrite checks requests against the platforms registered in the console:
 * Expo Go identifies as Expo's own app, a build as this app's package.
 */
export function platformId(): string {
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
    return 'host.exp.exponent';
  }
  return Constants.expoConfig?.android?.package ?? Constants.expoConfig?.ios?.bundleIdentifier ?? '';
}

export const oauthScheme = `appwrite-callback-${cloudConfig.projectId}`;
