import fs from 'node:fs/promises';
import path from 'node:path';

import {
  createDatabasesClient,
  ensureDir,
  legacyCollections,
  listAllDocuments,
  nowIso,
  parseArgs,
  writeNdjson,
} from './lib/appwriteMigrationCommon.mjs';

const args = parseArgs(process.argv.slice(2));
const timestamp = nowIso().replace(/[:.]/g, '-');
const outputDir = path.resolve(String(args['--out'] || path.join('backups', timestamp)));

const run = async () => {
  const { databases, config } = createDatabasesClient();
  const collections = legacyCollections();
  const tasks = Object.entries(collections).filter(([, collectionId]) => Boolean(collectionId));

  if (tasks.length === 0) {
    throw new Error('No legacy collection IDs were found. Set APPWRITE_COLLECTION_* (or VITE_APPWRITE_COLLECTION_*).');
  }

  await ensureDir(outputDir);

  const manifest = {
    generatedAt: nowIso(),
    endpoint: config.endpoint,
    projectId: config.projectId,
    databaseId: config.databaseId,
    collections: {},
  };

  for (const [alias, collectionId] of tasks) {
    const docs = await listAllDocuments({
      databases,
      databaseId: config.databaseId,
      collectionId,
    });

    const fileName = `${alias}.ndjson`;
    const filePath = path.join(outputDir, fileName);
    const result = await writeNdjson({ filePath, docs });

    manifest.collections[alias] = {
      collectionId,
      file: fileName,
      count: result.lineCount,
      sha256: result.sha256,
    };

    console.log(`[backup] ${alias}: ${result.lineCount} documents`);
  }

  const manifestPath = path.join(outputDir, 'manifest.json');
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
  console.log(`[backup] manifest written: ${manifestPath}`);
  console.log(`[backup] completed: ${outputDir}`);
};

run().catch((error) => {
  console.error('[backup] failed:', error?.message || error);
  process.exitCode = 1;
});
