import 'dotenv/config';

import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Client, Databases, Query } from 'appwrite';

export const nowIso = () => new Date().toISOString();

export const parseArgs = (argv = []) => {
  const parsed = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;

    if (token.includes('=')) {
      const [key, ...rest] = token.split('=');
      parsed[key] = rest.join('=');
      continue;
    }

    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      parsed[token] = true;
      continue;
    }

    parsed[token] = next;
    i += 1;
  }
  return parsed;
};

export const envFirst = (...keys) => {
  for (const key of keys) {
    const value = process.env[key];
    if (value && String(value).trim()) return String(value).trim();
  }
  return '';
};

export const requireEnv = (label, ...keys) => {
  const value = envFirst(...keys);
  if (!value) {
    throw new Error(`Missing required environment variable for ${label}. Checked: ${keys.join(', ')}`);
  }
  return value;
};

export const appwriteConfig = () => ({
  endpoint: requireEnv('Appwrite endpoint', 'APPWRITE_ENDPOINT', 'VITE_APPWRITE_ENDPOINT'),
  projectId: requireEnv('Appwrite project id', 'APPWRITE_PROJECT_ID', 'VITE_APPWRITE_PROJECT_ID'),
  databaseId: requireEnv('Appwrite database id', 'APPWRITE_DATABASE_ID', 'VITE_APPWRITE_DATABASE_ID'),
  apiKey: requireEnv('Appwrite API key', 'APPWRITE_API_KEY'),
});

export const legacyCollections = () => ({
  tournaments: envFirst('APPWRITE_COLLECTION_TOURNAMENTS', 'VITE_APPWRITE_COLLECTION_TOURNAMENTS'),
  casualMatches: envFirst('APPWRITE_COLLECTION_CASUAL_MATCHES', 'VITE_APPWRITE_COLLECTION_CASUAL_MATCHES'),
  players: envFirst('APPWRITE_COLLECTION_PLAYERS', 'VITE_APPWRITE_COLLECTION_PLAYERS'),
  ratings: envFirst('APPWRITE_COLLECTION_RATINGS', 'VITE_APPWRITE_COLLECTION_RATINGS'),
  appMeta: envFirst('APPWRITE_COLLECTION_APP_META', 'VITE_APPWRITE_COLLECTION_APP_META'),
});

export const normalizedCollections = () => ({
  playersV2: requireEnv('normalized players collection', 'APPWRITE_COLLECTION_V2_PLAYERS'),
  tournamentsV2: requireEnv('normalized tournaments collection', 'APPWRITE_COLLECTION_V2_TOURNAMENTS'),
  tournamentTeamsV2: requireEnv('normalized tournament teams collection', 'APPWRITE_COLLECTION_V2_TOURNAMENT_TEAMS'),
  matchesV2: requireEnv('normalized matches collection', 'APPWRITE_COLLECTION_V2_MATCHES'),
  matchPlayersV2: requireEnv('normalized match players collection', 'APPWRITE_COLLECTION_V2_MATCH_PLAYERS'),
  ratingsCurrentV2: requireEnv('normalized ratings current collection', 'APPWRITE_COLLECTION_V2_RATINGS_CURRENT'),
});

export const createDatabasesClient = () => {
  const cfg = appwriteConfig();
  const client = new Client()
    .setEndpoint(cfg.endpoint)
    .setProject(cfg.projectId);

  // Web SDK does not expose setKey(); use header for server-side migration scripts.
  client.headers['X-Appwrite-Key'] = cfg.apiKey;

  return {
    databases: new Databases(client),
    config: cfg,
  };
};

export const appwriteAuthHeaders = ({ config }) => ({
  'Content-Type': 'application/json',
  'X-Appwrite-Project': config.projectId,
  'X-Appwrite-Key': config.apiKey,
});

export const fetchCollectionAttributes = async ({ config, collectionId }) => {
  const endpointBase = config.endpoint.replace(/\/+$/, '');
  const url = `${endpointBase}/databases/${encodeURIComponent(config.databaseId)}/collections/${encodeURIComponent(collectionId)}/attributes?limit=100`;
  const response = await fetch(url, {
    method: 'GET',
    headers: appwriteAuthHeaders({ config }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.message || `${response.status} ${response.statusText}`;
    throw new Error(`Failed to fetch attributes for collection "${collectionId}": ${message}`);
  }

  return Array.isArray(payload?.attributes) ? payload.attributes : [];
};

export const ensureDir = async (dirPath) => {
  await fs.mkdir(dirPath, { recursive: true });
};

export const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

export const normalizeName = (value) => String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();

export const makeDeterministicId = (prefix, seed) => {
  const normalizedPrefix = String(prefix || 'id').replace(/[^a-z0-9]/gi, '').slice(0, 3).toLowerCase() || 'id';
  const hash = crypto.createHash('sha1').update(String(seed)).digest('hex').slice(0, 32);
  return `${normalizedPrefix}_${hash}`;
};

export const safeJsonParse = (value, fallback) => {
  if (value === undefined || value === null || value === '') return fallback;
  try {
    return JSON.parse(value);
  } catch (_error) {
    return fallback;
  }
};

export const chunk = (items = [], size = 100) => {
  const result = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
};

export const sleep = (ms) => new Promise((resolve) => {
  setTimeout(resolve, ms);
});

export const listAllDocuments = async ({
  databases,
  databaseId,
  collectionId,
  extraQueries = [],
  pageSize = 100,
}) => {
  const all = [];
  let cursor = '';

  // Cursor pagination avoids offset-scan cost on large collections.
  while (true) {
    const queries = [
      Query.limit(pageSize),
      Query.orderAsc('$id'),
      ...extraQueries,
      ...(cursor ? [Query.cursorAfter(cursor)] : []),
    ];

    const response = await databases.listDocuments(databaseId, collectionId, queries);
    const docs = response?.documents || [];
    if (docs.length === 0) break;

    all.push(...docs);
    if (docs.length < pageSize) break;
    cursor = docs[docs.length - 1].$id;
  }

  return all;
};

export const writeNdjson = async ({ filePath, docs }) => {
  const lines = (docs || []).map((doc) => JSON.stringify(doc));
  const payload = lines.join('\n') + (lines.length > 0 ? '\n' : '');
  await fs.writeFile(filePath, payload, 'utf8');
  return {
    lineCount: lines.length,
    sha256: sha256(payload),
  };
};

export const readNdjson = async (filePath) => {
  try {
    const payload = await fs.readFile(filePath, 'utf8');
    const lines = payload.split('\n').map((line) => line.trim()).filter(Boolean);
    return lines.map((line) => JSON.parse(line));
  } catch (error) {
    if (error?.code === 'ENOENT') return [];
    throw error;
  }
};

export const loadManifest = async (backupDir) => {
  const manifestPath = path.join(backupDir, 'manifest.json');
  const payload = await fs.readFile(manifestPath, 'utf8');
  return JSON.parse(payload);
};
