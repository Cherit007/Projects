#!/usr/bin/env node
/**
 * Backfill sportId on v2_tournaments and tournament_templates.
 *
 * Usage:
 *   node scripts/migration/backfill-sport-id.mjs [--apply] [--group-id <id>]
 *
 * Requires Appwrite env vars (see scripts/migration/lib/appwriteMigrationCommon.mjs).
 * Add collection attributes first:
 *   v2_tournaments: sportId (string, optional), ruleConfigJson (string, optional)
 *   tournament_templates: sportId (string, optional)
 */
import { Query } from 'appwrite';
import {
  createDatabasesClient,
  envFirst,
  listAllDocuments,
  normalizedCollections,
  parseArgs,
  sleep,
} from './lib/appwriteMigrationCommon.mjs';

const args = parseArgs(process.argv.slice(2));
const apply = Boolean(args['--apply']);
const groupIdFilter = String(args['--group-id'] || '').trim();
const DEFAULT_SPORT_ID = 'badminton';

if (args['--help']) {
  console.log(
    'Usage: node scripts/migration/backfill-sport-id.mjs [options]\n\n' +
    'Sets sportId=badminton on tournaments/templates missing the field.\n\n' +
    'Options:\n' +
    '  --apply           Write updates (default: dry-run)\n' +
    '  --group-id <id>   Limit to one group\n' +
    '  --help            Show this help\n'
  );
  process.exit(0);
}

const toNonEmptyString = (value) => String(value ?? '').trim();

const listByGroup = async ({ databases, databaseId, collectionId }) => {
  const extraQueries = groupIdFilter ? [Query.equal('groupId', groupIdFilter)] : [];
  return listAllDocuments({
    databases,
    databaseId,
    collectionId,
    extraQueries,
  });
};

const run = async () => {
  const { databases, config } = createDatabasesClient();
  const collections = normalizedCollections();
  const templatesCollection = envFirst(
    'APPWRITE_COLLECTION_TOURNAMENT_TEMPLATES',
    'VITE_APPWRITE_COLLECTION_TOURNAMENT_TEMPLATES',
  );

  const tournamentDocs = await listByGroup({
    databases,
    databaseId: config.databaseId,
    collectionId: collections.tournamentsV2,
  });

  const templateDocs = templatesCollection
    ? await listByGroup({
      databases,
      databaseId: config.databaseId,
      collectionId: templatesCollection,
    })
    : [];

  const tournamentUpdates = tournamentDocs.filter((doc) => !toNonEmptyString(doc.sportId));
  const templateUpdates = templateDocs.filter((doc) => !toNonEmptyString(doc.sportId));

  console.log(`Tournaments missing sportId: ${tournamentUpdates.length}/${tournamentDocs.length}`);
  console.log(`Templates missing sportId: ${templateUpdates.length}/${templateDocs.length}`);

  if (!apply) {
    console.log('Dry run — pass --apply to write updates.');
    return;
  }

  for (const doc of tournamentUpdates) {
    await databases.updateDocument(
      config.databaseId,
      collections.tournamentsV2,
      doc.$id,
      { sportId: DEFAULT_SPORT_ID },
    );
    await sleep(50);
  }

  for (const doc of templateUpdates) {
    await databases.updateDocument(
      config.databaseId,
      templatesCollection,
      doc.$id,
      { sportId: DEFAULT_SPORT_ID },
    );
    await sleep(50);
  }

  console.log(`Backfilled ${tournamentUpdates.length} tournaments and ${templateUpdates.length} templates.`);
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
