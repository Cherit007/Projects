import { Client, Databases, Account, Storage, ID, Query } from 'appwrite';
import {
  APPWRITE_DATABASE_ID,
  APPWRITE_ENDPOINT,
  APPWRITE_PROJECT_ID,
  BUCKETS,
  COLLECTIONS,
  isAppwriteConfigured,
} from '@fixture-maker/config/appwrite/env';

const client = new Client()
  .setEndpoint(APPWRITE_ENDPOINT)
  .setProject(APPWRITE_PROJECT_ID);

export const databases = new Databases(client);
export const account = new Account(client);
export const storage = new Storage(client);

export {
  client,
  ID,
  Query,
  COLLECTIONS,
  BUCKETS,
  isAppwriteConfigured,
};

export const DATABASE_ID = APPWRITE_DATABASE_ID;
