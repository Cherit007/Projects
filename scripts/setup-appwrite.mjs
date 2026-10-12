#!/usr/bin/env node
// One-time Appwrite setup: creates the `finance` database and the synced tables.
// Safe to re-run; anything that already exists is left alone.
//
//   APPWRITE_API_KEY=<server key> npm run setup:appwrite
//
// The API key is a server secret. Pass it in the shell only; never put it in
// .env files or anything prefixed with EXPO_PUBLIC_, which is bundled into the app.

import { readFileSync } from 'node:fs';
import { AppwriteException, Client, Permission, Role, TablesDB } from 'node-appwrite';

try {
  process.loadEnvFile('.env.local');
} catch {
  // Values can also come from the shell.
}

const endpoint = process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT;
const projectId = process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID;
const apiKey = process.env.APPWRITE_API_KEY;
const databaseId = 'finance';

if (!endpoint || !projectId || !apiKey) {
  console.error(
    'Missing configuration. Set EXPO_PUBLIC_APPWRITE_ENDPOINT and EXPO_PUBLIC_APPWRITE_PROJECT_ID in .env.local,\n' +
      'and pass APPWRITE_API_KEY in the shell (needs databases.read/write, tables.read/write, columns.read/write).',
  );
  process.exit(1);
}

const schema = JSON.parse(readFileSync(new URL('../src/services/cloud/schema.json', import.meta.url), 'utf8'));
const tables = new TablesDB(new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey));

const isCode = (err, code) => err instanceof AppwriteException && err.code === code;

async function ensure(label, get, create) {
  try {
    await get();
    console.log(`  ✓ ${label}`);
  } catch (err) {
    if (!isCode(err, 404)) {
      throw err;
    }
    await create();
    console.log(`  + ${label}`);
  }
}

async function createColumn(tableId, key, spec) {
  const base = { databaseId, tableId, key, required: false };
  const [kind, size] = spec.split(':');
  switch (kind) {
    case 'text':
      try {
        return await tables.createVarcharColumn({ ...base, size: Number(size) });
      } catch (err) {
        // Older Appwrite servers only know the legacy string column.
        if (isCode(err, 404) || isCode(err, 400)) {
          return tables.createStringColumn({ ...base, size: Number(size) });
        }
        throw err;
      }
    case 'int':
      return tables.createIntegerColumn(base);
    case 'bool':
      return tables.createBooleanColumn({ ...base, xdefault: false });
    default:
      throw new Error(`Unknown column type "${spec}" for ${tableId}.${key}`);
  }
}

console.log(`Appwrite project ${projectId}`);

await ensure(
  `database ${databaseId}`,
  () => tables.get({ databaseId }),
  () => tables.create({ databaseId, name: 'Finance' }),
);

for (const [tableId, columns] of Object.entries(schema)) {
  await ensure(
    `table ${tableId}`,
    () => tables.getTable({ databaseId, tableId }),
    () =>
      tables.createTable({
        databaseId,
        tableId,
        name: tableId,
        // Any signed-in user may add rows; each row is then readable only by its owner.
        permissions: [Permission.create(Role.users())],
        rowSecurity: true,
      }),
  );

  for (const [key, spec] of Object.entries({ ...columns, deleted: 'bool' })) {
    await ensure(
      `  ${tableId}.${key}`,
      () => tables.getColumn({ databaseId, tableId, key }),
      () => createColumn(tableId, key, spec),
    );
  }
}

console.log('Done. Columns may take a few seconds to become available in the console.');
