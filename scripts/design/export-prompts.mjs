#!/usr/bin/env node
/** Export one .txt prompt file per mockup for manual paste into Gemini web chat. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildFullPrompt,
  ensureDir,
  filterMockups,
  loadManifest,
  parseCliArgs,
} from './mockupConstants.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROMPTS_DIR = path.join(__dirname, 'prompts');

const run = async () => {
  const args = parseCliArgs(process.argv.slice(2));
  const manifest = await loadManifest();
  const mockups = filterMockups(manifest.mockups, args);

  await ensureDir(PROMPTS_DIR);

  for (const mockup of mockups) {
    const txtPath = path.join(PROMPTS_DIR, `${mockup.id}.txt`);
    const body = [
      `# ${mockup.filename}`,
      `# Platform: ${mockup.platform} | Screen: ${mockup.screen}`,
      `# Aspect: ${mockup.aspectRatio}`,
      '',
      buildFullPrompt(mockup),
      '',
    ].join('\n');
    await fs.writeFile(txtPath, body, 'utf8');
    console.log(`wrote ${path.relative(process.cwd(), txtPath)}`);
  }
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
