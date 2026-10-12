import { makeRedirectUri } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import {
  AppwriteException,
  OAuthProvider,
  Permission,
  Query,
  Role,
  type Models,
} from 'react-native-appwrite';

import type { SyncedTable } from '../../../data/local/migrations';
import { SessionExpiredError, type CloudBackend, type CloudUser, type RemoteRow } from '../backend';
import { appwrite } from './client';
import { cloudConfig, oauthScheme } from './config';

WebBrowser.maybeCompleteAuthSession();

const PAGE_SIZE = 100;

type AppwriteRow = Models.DefaultRow & Record<string, unknown>;

function toUser(user: Models.User<Models.Preferences>): CloudUser {
  return { id: user.$id, name: user.name, email: user.email };
}

/** Maps Appwrite's 401 to the backend-neutral error. */
async function call<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (err) {
    if (err instanceof AppwriteException && err.code === 401) {
      throw new SessionExpiredError();
    }
    throw err;
  }
}

function toRemoteRow(row: AppwriteRow): RemoteRow {
  const values: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (!key.startsWith('$') && key !== 'deleted') {
      values[key] = value;
    }
  }
  return { id: row.$id, deleted: row.deleted === true, serverUpdatedAt: row.$updatedAt, values };
}

/**
 * Appwrite Cloud: Google sign-in through Appwrite Auth, data in TablesDB
 * (database `finance`, created by scripts/setup-appwrite.mjs). Row-level
 * permissions keep each user's rows private.
 */
export function createAppwriteBackend(): CloudBackend {
  const { account, tables } = appwrite();

  return {
    auth: {
      async currentUser() {
        try {
          return toUser(await account.get());
        } catch {
          return null;
        }
      },

      async signInWithGoogle() {
        // Expo Go returns to exp://; a build returns to the appwrite-callback scheme.
        const redirect = makeRedirectUri({ scheme: oauthScheme, preferLocalhost: true });
        const loginUrl = account.createOAuth2Token({
          provider: OAuthProvider.Google,
          success: redirect,
          failure: redirect,
        });
        if (!loginUrl) {
          throw new Error('Could not start Google sign-in.');
        }
        const result = await WebBrowser.openAuthSessionAsync(loginUrl.toString(), redirect);
        if (result.type !== 'success') {
          return null;
        }
        const params = new URL(result.url).searchParams;
        const userId = params.get('userId');
        const secret = params.get('secret');
        if (!userId || !secret) {
          throw new Error('Google sign-in was cancelled or failed.');
        }
        await account.createSession({ userId, secret });
        return toUser(await account.get());
      },

      async signOut() {
        await account.deleteSession({ sessionId: 'current' });
      },
    },

    sync: {
      pullChanges: (table: SyncedTable, since: string | null) =>
        call(async () => {
          const rows: RemoteRow[] = [];
          let lastId: string | undefined;
          for (;;) {
            const queries = [Query.orderAsc('$updatedAt'), Query.orderAsc('$id'), Query.limit(PAGE_SIZE)];
            if (since) {
              queries.push(Query.greaterThanEqual('$updatedAt', since));
            }
            if (lastId) {
              queries.push(Query.cursorAfter(lastId));
            }
            const page = await tables.listRows<AppwriteRow>({
              databaseId: cloudConfig.databaseId,
              tableId: table,
              queries,
              total: false,
            });
            rows.push(...page.rows.map(toRemoteRow));
            if (page.rows.length < PAGE_SIZE) {
              return rows;
            }
            lastId = page.rows[page.rows.length - 1].$id;
          }
        }),

      push: ({ table, id, userId, deleted, values }) =>
        call(async () => {
          const owner = Role.user(userId);
          await tables.upsertRow({
            databaseId: cloudConfig.databaseId,
            tableId: table,
            rowId: id,
            data: { ...values, deleted },
            permissions: [Permission.read(owner), Permission.update(owner), Permission.delete(owner)],
          });
        }),
    },
  };
}
