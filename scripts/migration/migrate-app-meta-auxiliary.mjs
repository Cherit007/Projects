import fs from 'node:fs/promises';
import path from 'node:path';

import {
  chunk,
  createDatabasesClient,
  envFirst,
  listAllDocuments,
  nowIso,
  parseArgs,
  sleep,
} from './lib/appwriteMigrationCommon.mjs';

const args = parseArgs(process.argv.slice(2));
const apply = Boolean(args['--apply']);
const groupId = String(args['--group-id'] || 'default-group').trim();
const metaDocId = String(args['--meta-doc-id'] || 'global-app-meta').trim();
const reportDir = path.resolve(String(args['--report-dir'] || 'migration-reports'));

if (args['--help']) {
  console.log(
    'Usage: node scripts/migration/migrate-app-meta-auxiliary.mjs [options]\n\n' +
    'Copies templates, roster members, and player photo refs from app_meta into V2 collections.\n' +
    'Does NOT delete app_meta data.\n\n' +
    'Options:\n' +
    '  --apply                  Write migrated docs (default: dry-run)\n' +
    '  --group-id <id>          Target group id (default: default-group)\n' +
    '  --meta-doc-id <id>       Source app_meta document id (default: global-app-meta)\n' +
    '  --report-dir <path>      Summary output directory\n' +
    '  --help                   Show this help\n'
  );
  process.exit(0);
}

const parseJson = (value, fallback) => {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
};

const auxiliaryCollections = () => ({
  templates: envFirst('APPWRITE_COLLECTION_TOURNAMENT_TEMPLATES', 'VITE_APPWRITE_COLLECTION_TOURNAMENT_TEMPLATES'),
  roster: envFirst('APPWRITE_COLLECTION_GROUP_ROSTER', 'VITE_APPWRITE_COLLECTION_GROUP_ROSTER'),
  playersV2: envFirst('APPWRITE_COLLECTION_V2_PLAYERS', 'VITE_APPWRITE_COLLECTION_V2_PLAYERS'),
  appMeta: envFirst('APPWRITE_COLLECTION_APP_META', 'VITE_APPWRITE_COLLECTION_APP_META'),
});

const buildTemplateDocId = (legacyTemplateId) => (
  String(legacyTemplateId || '').replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 36)
    || `template-${Date.now()}`
);

const buildRosterDocId = (legacyMemberId) => (
  String(legacyMemberId || '').replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 36)
    || `member-${Date.now()}`
);

const normalizeName = (value) => String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();

const run = async () => {
  const collections = auxiliaryCollections();
  if (!collections.appMeta) {
    throw new Error('APP_META collection id is required.');
  }
  if (!collections.templates && !collections.roster && !collections.playersV2) {
    throw new Error('Configure at least one target collection (templates, roster, or v2_players).');
  }

  const { databases, config } = createDatabasesClient();
  const metaDoc = await databases.getDocument(config.databaseId, collections.appMeta, metaDocId);
  const templates = parseJson(metaDoc.templates, []);
  const members = parseJson(metaDoc.members, []);
  const memberAccountLinks = parseJson(metaDoc.memberAccountLinks, {});
  const playerPhotos = parseJson(metaDoc.playerPhotos, {});

  const applyMemberLinks = (member) => {
    const byId = memberAccountLinks?.byId || {};
    const byName = memberAccountLinks?.byName || {};
    const linkFromId = member?.id ? byId[member.id] : null;
    const linkFromName = member?.name
      ? byName[String(member.name).trim().toLowerCase()]
      : null;
    const source = linkFromId || linkFromName || {};
    return {
      ...member,
      linkedAccountId: member?.linkedAccountId || source.linkedAccountId || '',
      linkedEmail: member?.linkedEmail || source.linkedEmail || '',
    };
  };

  const summary = {
    generatedAt: nowIso(),
    mode: apply ? 'apply' : 'dry-run',
    groupId,
    metaDocId,
    counts: {
      templates: templates.length,
      members: members.length,
      playerPhotos: Object.keys(playerPhotos || {}).length,
      templatesWritten: 0,
      rosterWritten: 0,
      playerPhotosUpdated: 0,
    },
  };

  const now = nowIso();

  if (collections.templates && templates.length > 0) {
    for (const template of templates) {
      const legacyTemplateId = String(template?.id || `template-${Date.now()}`);
      const payload = {
        groupId,
        legacyTemplateId,
        name: String(template?.name || 'Untitled Template'),
        gameMode: String(template?.gameMode || 'doubles'),
        tournamentFormat: String(template?.tournamentFormat || 'league'),
        format: String(template?.format || '1'),
        numTeams: String(Number(template?.numTeams) || 3),
        teamsJson: JSON.stringify(Array.isArray(template?.teams) ? template.teams : []),
        sourceCreatedAt: String(template?.createdAt || now),
        sourceUpdatedAt: String(template?.updatedAt || now),
        migratedAt: now,
      };
      if (apply) {
        await databases.upsertDocument(
          config.databaseId,
          collections.templates,
          buildTemplateDocId(legacyTemplateId),
          payload
        );
        await sleep(20);
      }
      summary.counts.templatesWritten += 1;
    }
  }

  if (collections.roster && members.length > 0) {
    for (const member of members.map(applyMemberLinks)) {
      const legacyMemberId = String(member?.id || `member-${Date.now()}`);
      const payload = {
        groupId,
        legacyMemberId,
        name: String(member?.name || ''),
        phone: String(member?.phone || ''),
        linkedAccountId: String(member?.linkedAccountId || ''),
        linkedEmail: String(member?.linkedEmail || ''),
        sourceUpdatedAt: now,
        migratedAt: now,
      };
      if (apply) {
        await databases.upsertDocument(
          config.databaseId,
          collections.roster,
          buildRosterDocId(legacyMemberId),
          payload
        );
        await sleep(20);
      }
      summary.counts.rosterWritten += 1;
    }
  }

  if (collections.playersV2 && Object.keys(playerPhotos || {}).length > 0) {
    const playerDocs = await listAllDocuments({
      databases,
      databaseId: config.databaseId,
      collectionId: collections.playersV2,
    });
    const byNormalized = new Map();
    playerDocs.forEach((doc) => {
      const normalized = normalizeName(doc?.normalizedName || doc?.displayName);
      if (normalized) byNormalized.set(normalized, doc);
    });

    for (const [rawName, value] of Object.entries(playerPhotos)) {
      const displayName = String(rawName || '').trim();
      const normalized = normalizeName(displayName);
      const fileId = typeof value === 'string' ? '' : String(value?.fileId || '').trim();
      if (!normalized || !fileId) continue;
      const existing = byNormalized.get(normalized);
      if (!existing?.$id) continue;
      if (apply) {
        await databases.updateDocument(
          config.databaseId,
          collections.playersV2,
          existing.$id,
          {
            photoFileId: fileId,
            photoUpdatedAt: now,
            migratedAt: now,
          }
        );
        await sleep(20);
      }
      summary.counts.playerPhotosUpdated += 1;
    }
  }

  await fs.mkdir(reportDir, { recursive: true });
  const reportPath = path.join(reportDir, `migrate-app-meta-auxiliary-${Date.now()}.json`);
  await fs.writeFile(reportPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');

  console.log(JSON.stringify(summary, null, 2));
  console.log(`Report written to ${reportPath}`);
  if (!apply) {
    console.log('Dry run only. Re-run with --apply to write migrated documents.');
  }
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
