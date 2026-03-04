import { Client, Databases, Account, Storage, ID, Query } from 'appwrite';

// Appwrite Configuration
const APPWRITE_ENDPOINT = import.meta.env.VITE_APPWRITE_ENDPOINT || 'https://nyc.cloud.appwrite.io/v1';
const APPWRITE_PROJECT_ID = import.meta.env.VITE_APPWRITE_PROJECT_ID;
const APPWRITE_DATABASE_ID = import.meta.env.VITE_APPWRITE_DATABASE_ID;

// Collection IDs
export const COLLECTIONS = {
  // Legacy collections (kept for fallback / non-migrated features only)
  TOURNAMENTS: import.meta.env.VITE_APPWRITE_COLLECTION_TOURNAMENTS,
  PLAYERS: import.meta.env.VITE_APPWRITE_COLLECTION_PLAYERS,
  RATINGS: import.meta.env.VITE_APPWRITE_COLLECTION_RATINGS,
  CASUAL_MATCHES: import.meta.env.VITE_APPWRITE_COLLECTION_CASUAL_MATCHES,
  APP_META: import.meta.env.VITE_APPWRITE_COLLECTION_APP_META || '',

  // Normalized V2 collections (source of truth after migration)
  TOURNAMENTS_V2: import.meta.env.VITE_APPWRITE_COLLECTION_V2_TOURNAMENTS || '',
  TOURNAMENT_TEAMS_V2: import.meta.env.VITE_APPWRITE_COLLECTION_V2_TOURNAMENT_TEAMS || '',
  MATCHES_V2: import.meta.env.VITE_APPWRITE_COLLECTION_V2_MATCHES || '',
  MATCH_PLAYERS_V2: import.meta.env.VITE_APPWRITE_COLLECTION_V2_MATCH_PLAYERS || '',
  PLAYERS_V2: import.meta.env.VITE_APPWRITE_COLLECTION_V2_PLAYERS || '',
  RATINGS_CURRENT_V2: import.meta.env.VITE_APPWRITE_COLLECTION_V2_RATINGS_CURRENT || '',

  // Normalized group/access collections (replaces app_meta JSON envelope for group domain)
  GROUPS: import.meta.env.VITE_APPWRITE_COLLECTION_GROUPS || '',
  GROUP_MEMBERS: import.meta.env.VITE_APPWRITE_COLLECTION_GROUP_MEMBERS || '',
  GROUP_INVITES: import.meta.env.VITE_APPWRITE_COLLECTION_GROUP_INVITES || '',
  GROUP_JOIN_REQUESTS: import.meta.env.VITE_APPWRITE_COLLECTION_GROUP_JOIN_REQUESTS || '',
  GROUP_ACTIVE_LOCKS: import.meta.env.VITE_APPWRITE_COLLECTION_GROUP_ACTIVE_LOCKS || '',
};

export const BUCKETS = {
  PLAYER_PHOTOS: import.meta.env.VITE_APPWRITE_BUCKET_PLAYER_PHOTOS || '',
};

// Initialize Appwrite Client
const client = new Client()
  .setEndpoint(APPWRITE_ENDPOINT)
  .setProject(APPWRITE_PROJECT_ID);

// Initialize Services
export const databases = new Databases(client);
export const account = new Account(client);
export const storage = new Storage(client);

// Export for direct use
export { client, ID, Query };

// Helper function to check if Appwrite is configured
export const isAppwriteConfigured = () => {
  return !!(
    APPWRITE_PROJECT_ID
    && APPWRITE_DATABASE_ID
    && COLLECTIONS.TOURNAMENTS_V2
    && COLLECTIONS.TOURNAMENT_TEAMS_V2
    && COLLECTIONS.MATCHES_V2
    && COLLECTIONS.MATCH_PLAYERS_V2
    && COLLECTIONS.PLAYERS_V2
    && COLLECTIONS.RATINGS_CURRENT_V2
  );
};

// Database ID export
export const DATABASE_ID = APPWRITE_DATABASE_ID;
