import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');

export const SHARED_STYLE_SUFFIX = `Cross-platform sports tournament app UI, designed for iOS and Android native mobile AND responsive web from the same design system. Dark mode default, deep navy background (#030913), glassmorphism cards with soft cyan glow borders (#49d8ff), modern system sans-serif typography (SF Pro / Roboto style), 16px rounded corners, cyan-teal gradient primary buttons, 44pt minimum touch targets, safe area padding top and bottom, professional league admin aesthetic, high fidelity UI mockup, flat screen only no device bezel unless filename says device-frame, no watermark.`;

export const DEFAULT_GEMINI_CHAT_URL = 'https://gemini.google.com/app/3c92073cbf174a38';

export const parseCliArgs = (argv = []) => {
  const args = {
    dryRun: false,
    force: false,
    login: false,
    interactive: false,
    priority: null,
    only: [],
    delayMs: 8000,
    mode: 'api',
    model: null,
  };

  for (const token of argv) {
    if (token === '--dry-run') args.dryRun = true;
    else if (token === '--force') args.force = true;
    else if (token === '--login') args.login = true;
    else if (token === '--interactive') args.interactive = true;
    else if (token.startsWith('--priority=')) args.priority = Number(token.split('=')[1]);
    else if (token.startsWith('--only=')) args.only = token.slice('--only='.length).split(',').map((v) => v.trim()).filter(Boolean);
    else if (token.startsWith('--delay-ms=')) args.delayMs = Number(token.split('=')[1]);
    else if (token.startsWith('--mode=')) args.mode = token.split('=')[1];
    else if (token.startsWith('--model=')) args.model = token.split('=')[1];
  }

  return args;
};

export const loadManifest = async () => {
  const manifestPath = path.join(__dirname, 'mockup-manifest.json');
  const raw = await fs.readFile(manifestPath, 'utf8');
  return JSON.parse(raw);
};

export const resolveOutputDir = (manifest) => (
  path.resolve(REPO_ROOT, manifest.outputDir || 'docs/design/mockups')
);

export const buildFullPrompt = (mockup) => (
  `${String(mockup.prompt || '').trim()}\n\n${SHARED_STYLE_SUFFIX}`
);

export const filterMockups = (mockups, args) => {
  let list = [...mockups];
  if (args.only.length > 0) {
    list = list.filter((item) => args.only.includes(item.id) || args.only.includes(item.filename));
  }
  if (Number.isFinite(args.priority)) {
    list = list.filter((item) => item.priority <= args.priority);
  }
  return list;
};

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const ensureDir = async (dirPath) => {
  await fs.mkdir(dirPath, { recursive: true });
};

export const fileExists = async (filePath) => {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
};
