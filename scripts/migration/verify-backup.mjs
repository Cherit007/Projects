import fs from 'node:fs/promises';
import path from 'node:path';

import { loadManifest, parseArgs, sha256 } from './lib/appwriteMigrationCommon.mjs';

const args = parseArgs(process.argv.slice(2));
const backupDir = String(args['--dir'] || '').trim();

if (!backupDir) {
  console.error('Usage: node scripts/migration/verify-backup.mjs --dir <backup-directory>');
  process.exit(1);
}

const run = async () => {
  const resolved = path.resolve(backupDir);
  const manifest = await loadManifest(resolved);
  const entries = Object.entries(manifest.collections || {});
  if (entries.length === 0) {
    throw new Error('Manifest has no collection entries.');
  }

  let totalDocs = 0;
  for (const [alias, meta] of entries) {
    const filePath = path.join(resolved, meta.file);
    const payload = await fs.readFile(filePath, 'utf8');
    const lines = payload.split('\n').map((line) => line.trim()).filter(Boolean);
    const hash = sha256(payload);

    if (Number(lines.length) !== Number(meta.count)) {
      throw new Error(`[verify] ${alias}: count mismatch (manifest=${meta.count}, actual=${lines.length})`);
    }
    if (String(hash) !== String(meta.sha256)) {
      throw new Error(`[verify] ${alias}: sha256 mismatch`);
    }

    // Ensure every line is valid JSON.
    for (let i = 0; i < lines.length; i += 1) {
      try {
        JSON.parse(lines[i]);
      } catch (error) {
        throw new Error(`[verify] ${alias}: invalid JSON at line ${i + 1} (${error?.message || error})`);
      }
    }

    totalDocs += lines.length;
    console.log(`[verify] ${alias}: OK (${lines.length} documents)`);
  }

  console.log(`[verify] complete: ${entries.length} files, ${totalDocs} total documents`);
};

run().catch((error) => {
  console.error(error?.message || error);
  process.exitCode = 1;
});
