import { cpSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const sourceDir = path.join(rootDir, 'documentation');
const targetDir = path.join(rootDir, 'docs');

if (!existsSync(sourceDir)) {
  process.exit(0);
}

mkdirSync(targetDir, { recursive: true });

for (const entry of readdirSync(sourceDir)) {
  if (!entry.endsWith('.md')) continue;
  cpSync(path.join(sourceDir, entry), path.join(targetDir, entry));
}
