import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI
    ? [['list'], ['html', { open: 'never' }]]
    : [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173',
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
    env: {
      VITE_APPWRITE_ENDPOINT: 'http://127.0.0.1:9999/v1',
      VITE_APPWRITE_PROJECT_ID: 'e2e-project',
      VITE_APPWRITE_DATABASE_ID: 'e2e-db',
      VITE_APPWRITE_COLLECTION_V2_TOURNAMENTS: 'e2e_tournaments',
      VITE_APPWRITE_COLLECTION_V2_TOURNAMENT_TEAMS: 'e2e_tournament_teams',
      VITE_APPWRITE_COLLECTION_V2_MATCHES: 'e2e_matches',
      VITE_APPWRITE_COLLECTION_V2_MATCH_PLAYERS: 'e2e_match_players',
      VITE_APPWRITE_COLLECTION_V2_PLAYERS: 'e2e_players',
      VITE_APPWRITE_COLLECTION_V2_RATINGS_CURRENT: 'e2e_ratings_current',
      VITE_APPWRITE_COLLECTION_GROUPS: 'e2e_groups',
      VITE_APPWRITE_COLLECTION_GROUP_MEMBERS: 'e2e_group_members',
      VITE_APPWRITE_COLLECTION_GROUP_INVITES: 'e2e_group_invites',
      VITE_APPWRITE_COLLECTION_GROUP_JOIN_REQUESTS: 'e2e_group_join_requests',
      VITE_APPWRITE_COLLECTION_APP_META: '',
      VITE_APPWRITE_COLLECTION_GROUP_ACTIVE_LOCKS: '',
    },
  },
});
