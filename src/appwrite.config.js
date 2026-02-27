import { Client, Databases, Account, Storage, ID, Query } from 'appwrite';

// Appwrite Configuration
const APPWRITE_ENDPOINT = import.meta.env.VITE_APPWRITE_ENDPOINT || 'https://nyc.cloud.appwrite.io/v1';
const APPWRITE_PROJECT_ID = import.meta.env.VITE_APPWRITE_PROJECT_ID;
const APPWRITE_DATABASE_ID = import.meta.env.VITE_APPWRITE_DATABASE_ID;

// Collection IDs
export const COLLECTIONS = {
  TOURNAMENTS: import.meta.env.VITE_APPWRITE_COLLECTION_TOURNAMENTS,
  PLAYERS: import.meta.env.VITE_APPWRITE_COLLECTION_PLAYERS,
  RATINGS: import.meta.env.VITE_APPWRITE_COLLECTION_RATINGS,
  CASUAL_MATCHES: import.meta.env.VITE_APPWRITE_COLLECTION_CASUAL_MATCHES,
  APP_META: import.meta.env.VITE_APPWRITE_COLLECTION_APP_META || '',
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
  return !!(APPWRITE_PROJECT_ID && APPWRITE_DATABASE_ID && 
           COLLECTIONS.TOURNAMENTS && COLLECTIONS.PLAYERS && 
           COLLECTIONS.RATINGS && COLLECTIONS.CASUAL_MATCHES);
};

// Database ID export
export const DATABASE_ID = APPWRITE_DATABASE_ID;
