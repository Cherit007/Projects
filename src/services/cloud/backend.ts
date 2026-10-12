import type { SyncedTable } from '../../data/local/migrations';

/**
 * The contract between the app and whichever cloud service stores the data.
 * The sync engine, sign-in UI and local database only use these types; each
 * backend (Appwrite today, e.g. a REST API over Postgres later) implements
 * them in its own folder. See docs/architecture.md for the server rules.
 */

export interface CloudUser {
  id: string;
  name: string;
  email: string;
}

/** A row as stored in the cloud. */
export interface RemoteRow {
  id: string;
  /** True for a tombstone: the row was deleted on some device. */
  deleted: boolean;
  /**
   * When the server last stored this row, assigned by the server (not the
   * device). Used only as the pull cursor.
   */
  serverUpdatedAt: string;
  /** Column values as JSON (booleans as true/false), keyed by local column name. */
  values: Record<string, unknown>;
}

export interface PushRow {
  table: SyncedTable;
  id: string;
  /** Owner of the row; only they may read or change it. */
  userId: string;
  deleted: boolean;
  /** Column values as JSON; for a tombstone only `updated_at`. */
  values: Record<string, unknown>;
}

export interface SyncBackend {
  /**
   * Every row of the signed-in user's table with `serverUpdatedAt` at or after
   * `since` (all rows when null), oldest first, tombstones included.
   */
  pullChanges(table: SyncedTable, since: string | null): Promise<RemoteRow[]>;
  /** Creates or replaces the row with this id. */
  push(row: PushRow): Promise<void>;
}

export interface AuthBackend {
  /** The signed-in user, or null when there is no valid session. */
  currentUser(): Promise<CloudUser | null>;
  /** Runs the Google sign-in flow. Returns null if the user cancelled. */
  signInWithGoogle(): Promise<CloudUser | null>;
  signOut(): Promise<void>;
}

export interface CloudBackend {
  auth: AuthBackend;
  sync: SyncBackend;
}

/** Thrown by a backend when the session has expired or was revoked. */
export class SessionExpiredError extends Error {
  constructor(message = 'Your session has expired. Please sign in again.') {
    super(message);
    this.name = 'SessionExpiredError';
  }
}
