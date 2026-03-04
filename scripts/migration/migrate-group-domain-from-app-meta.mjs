import fs from 'node:fs/promises';
import path from 'node:path';

import {
  chunk,
  createDatabasesClient,
  envFirst,
  fetchCollectionAttributes,
  listAllDocuments,
  makeDeterministicId,
  nowIso,
  parseArgs,
  safeJsonParse,
  sleep,
} from './lib/appwriteMigrationCommon.mjs';

const args = parseArgs(process.argv.slice(2));
const apply = Boolean(args['--apply']);
const batchSize = Math.max(1, Number(args['--batch-size'] || 100));
const explicitMetaDocId = String(args['--meta-doc-id'] || 'global-app-meta').trim();
const includeAllMetaDocs = Boolean(args['--all-meta']);
const onlyGroupId = String(args['--group-id'] || '').trim();
const lockGroupIdArg = String(args['--lock-group-id'] || '').trim();
const invitesRevokedTypeOverride = String(args['--invites-revoked-type'] || '').trim().toLowerCase();
const reportDir = path.resolve(String(args['--report-dir'] || 'migration-reports'));

if (args['--help']) {
  console.log(
    'Usage: node scripts/migration/migrate-group-domain-from-app-meta.mjs [options]\n\n' +
    'Options:\n' +
    '  --apply                  Apply writes (default is dry-run)\n' +
    '  --batch-size <n>         Upsert batch size (default: 100)\n' +
    '  --meta-doc-id <id>       Source app_meta doc id (default: global-app-meta)\n' +
    '  --all-meta               Scan all app_meta documents (ignore --meta-doc-id)\n' +
    '  --group-id <id>          Migrate only one group id\n' +
    '  --lock-group-id <id>     Force active lock assignment to this group id\n' +
    '  --invites-revoked-type <type>  Force revoked type: string|boolean|integer\n' +
    '  --report-dir <path>      Summary output directory (default: migration-reports)\n' +
    '  --help                   Show this help\n'
  );
  process.exit(0);
}

const toText = (value) => String(value || '').trim();
const toRole = (value, fallback = 'member') => {
  const normalized = toText(value).toLowerCase();
  if (normalized === 'admin' || normalized === 'member' || normalized === 'viewer') return normalized;
  return fallback;
};
const toStatus = (value, fallback = 'pending') => {
  const normalized = toText(value).toLowerCase();
  if (normalized === 'pending' || normalized === 'approved' || normalized === 'rejected') return normalized;
  return fallback;
};
const parseBoolean = (value) => {
  if (typeof value === 'boolean') return value;
  const normalized = toText(value).toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes';
};
const parseTimestamp = (value) => {
  const raw = toText(value);
  if (!raw) return '';
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : '';
};
const pickTimestamp = (...values) => {
  for (const value of values) {
    const ts = parseTimestamp(value);
    if (ts) return ts;
  }
  return nowIso();
};

const parseInvitesEnvelope = (value) => {
  const parsed = safeJsonParse(value, []);
  if (Array.isArray(parsed)) {
    return {
      invites: parsed,
      joinRequests: [],
      activeTournament: null,
    };
  }
  if (parsed && typeof parsed === 'object') {
    return {
      invites: Array.isArray(parsed.invites) ? parsed.invites : [],
      joinRequests: Array.isArray(parsed.joinRequests) ? parsed.joinRequests : [],
      activeTournament: parsed.activeTournament || null,
    };
  }
  return {
    invites: [],
    joinRequests: [],
    activeTournament: null,
  };
};

const hashGroupId = (value) => {
  let hash = 0;
  const input = String(value || '');
  for (let index = 0; index < input.length; index += 1) {
    hash = ((hash << 5) - hash) + input.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
};

const buildActiveLockDocId = (groupId) => `lock-${hashGroupId(groupId)}`;

const getCollectionIds = () => {
  const source = {
    appMeta: envFirst('APPWRITE_COLLECTION_APP_META', 'VITE_APPWRITE_COLLECTION_APP_META'),
  };
  const target = {
    groups: envFirst('APPWRITE_COLLECTION_GROUPS', 'VITE_APPWRITE_COLLECTION_GROUPS'),
    groupMembers: envFirst('APPWRITE_COLLECTION_GROUP_MEMBERS', 'VITE_APPWRITE_COLLECTION_GROUP_MEMBERS'),
    groupInvites: envFirst('APPWRITE_COLLECTION_GROUP_INVITES', 'VITE_APPWRITE_COLLECTION_GROUP_INVITES'),
    groupJoinRequests: envFirst('APPWRITE_COLLECTION_GROUP_JOIN_REQUESTS', 'VITE_APPWRITE_COLLECTION_GROUP_JOIN_REQUESTS'),
    groupActiveLocks: envFirst('APPWRITE_COLLECTION_GROUP_ACTIVE_LOCKS', 'VITE_APPWRITE_COLLECTION_GROUP_ACTIVE_LOCKS'),
  };

  if (!source.appMeta) {
    throw new Error('Missing source app_meta collection id (APPWRITE_COLLECTION_APP_META or VITE_APPWRITE_COLLECTION_APP_META).');
  }

  const missingTargets = Object.entries(target)
    .filter(([, value]) => !value)
    .map(([key]) => key);
  if (missingTargets.length > 0) {
    throw new Error(`Missing target group collection ids: ${missingTargets.join(', ')}`);
  }

  return { source, target };
};

const fetchAttributeMap = async ({ config, targetCollections }) => {
  const entries = await Promise.all(
    Object.entries(targetCollections).map(async ([alias, collectionId]) => {
      const attrs = await fetchCollectionAttributes({ config, collectionId });
      const byKey = new Map(attrs.map((attr) => [toText(attr?.key), attr]));
      return [alias, byKey];
    })
  );
  return new Map(entries);
};

const assertRequiredAttributes = (attrMap) => {
  const has = (alias, key) => Boolean(attrMap.get(alias)?.has(key));
  const required = {
    groups: ['name', 'creatorId', 'createdAt'],
    groupMembers: ['groupId', 'userId', 'role', 'email', 'name', 'joinedAt', 'invitedBy'],
    groupInvites: ['groupId', 'code', 'role', 'createdBy', 'createdAt', 'expiresAt', 'revoked'],
    groupJoinRequests: ['groupId', 'userId', 'name', 'email', 'status', 'createdAt'],
    groupActiveLocks: ['groupId', 'updatedAt'],
  };

  for (const [alias, keys] of Object.entries(required)) {
    const missing = keys.filter((key) => !has(alias, key));
    if (missing.length > 0) {
      throw new Error(`[preflight] ${alias} is missing attributes: ${missing.join(', ')}`);
    }
  }

  if (!has('groupActiveLocks', 'activeTournamentJson') && !has('groupActiveLocks', 'activeTournament')) {
    throw new Error('[preflight] groupActiveLocks must have either activeTournamentJson or activeTournament attribute.');
  }
};

const readMetaDocuments = async ({
  databases,
  databaseId,
  appMetaCollectionId,
}) => {
  if (includeAllMetaDocs) {
    return listAllDocuments({
      databases,
      databaseId,
      collectionId: appMetaCollectionId,
    });
  }

  if (explicitMetaDocId) {
    try {
      const doc = await databases.getDocument(databaseId, appMetaCollectionId, explicitMetaDocId);
      return [doc];
    } catch (error) {
      if (error?.code !== 404) throw error;
      console.warn(`[group-migration] meta doc "${explicitMetaDocId}" not found, scanning full collection...`);
    }
  }

  return listAllDocuments({
    databases,
    databaseId,
    collectionId: appMetaCollectionId,
  });
};

const choosePreferredMembership = (current, incoming) => {
  const currentRole = toRole(current?.data?.role);
  const incomingRole = toRole(incoming?.data?.role);
  if (currentRole !== 'admin' && incomingRole === 'admin') return incoming;

  const currentJoined = Date.parse(toText(current?.data?.joinedAt) || 0);
  const incomingJoined = Date.parse(toText(incoming?.data?.joinedAt) || 0);
  if (Number.isFinite(incomingJoined) && incomingJoined > (Number.isFinite(currentJoined) ? currentJoined : 0)) {
    return incoming;
  }

  return current;
};

const choosePreferredJoinRequest = (current, incoming) => {
  const currentReviewed = Date.parse(toText(current?.data?.reviewedAt) || toText(current?.data?.createdAt) || 0);
  const incomingReviewed = Date.parse(toText(incoming?.data?.reviewedAt) || toText(incoming?.data?.createdAt) || 0);
  if (Number.isFinite(incomingReviewed) && incomingReviewed > (Number.isFinite(currentReviewed) ? currentReviewed : 0)) {
    return incoming;
  }
  return current;
};

const choosePreferredLock = (current, incoming) => {
  const currentUpdated = Date.parse(toText(current?.data?.updatedAt) || 0);
  const incomingUpdated = Date.parse(toText(incoming?.data?.updatedAt) || 0);
  if (Number.isFinite(incomingUpdated) && incomingUpdated > (Number.isFinite(currentUpdated) ? currentUpdated : 0)) {
    return incoming;
  }
  return current;
};

const buildRows = ({ metaDocs, attrMap }) => {
  const groupRowsById = new Map();
  const memberRowsByKey = new Map();
  const inviteRowsById = new Map();
  const requestRowsByKey = new Map();
  const lockRowsByGroupId = new Map();
  const knownGroupIds = new Set();

  const warnings = [];
  const skipped = {
    groups: 0,
    groupMembers: 0,
    groupInvites: 0,
    groupJoinRequests: 0,
    groupActiveLocks: 0,
  };

  const lockPayloadField = attrMap.get('groupActiveLocks')?.has('activeTournamentJson')
    ? 'activeTournamentJson'
    : 'activeTournament';
  const detectedRevokedType = toText(attrMap.get('groupInvites')?.get('revoked')?.type).toLowerCase();
  const invitesRevokedType = ['string', 'boolean', 'integer'].includes(invitesRevokedTypeOverride)
    ? invitesRevokedTypeOverride
    : (['string', 'boolean', 'integer'].includes(detectedRevokedType) ? detectedRevokedType : 'string');

  const prunePayload = (alias, payload) => {
    const attrs = attrMap.get(alias);
    if (!attrs) return payload;
    const pruned = {};
    Object.entries(payload || {}).forEach(([key, value]) => {
      if (attrs.has(key)) pruned[key] = value;
    });
    return pruned;
  };

  const normalizeRevokedValue = (value) => {
    const parsed = parseBoolean(value);
    if (invitesRevokedType === 'string') return parsed ? 'true' : 'false';
    if (invitesRevokedType === 'integer') return parsed ? 1 : 0;
    return parsed;
  };

  const shouldIncludeGroup = (groupId) => !onlyGroupId || groupId === onlyGroupId;

  for (const metaDoc of metaDocs) {
    const groups = safeJsonParse(metaDoc.groups, []);
    const members = safeJsonParse(metaDoc.groupMembers, []);
    const invitesEnvelope = parseInvitesEnvelope(metaDoc.groupInvites);
    const invites = invitesEnvelope.invites;
    const joinRequestsDirect = safeJsonParse(metaDoc.groupJoinRequests, null);
    const joinRequests = Array.isArray(joinRequestsDirect) ? joinRequestsDirect : invitesEnvelope.joinRequests;
    const activeTournament = invitesEnvelope.activeTournament;

    (Array.isArray(groups) ? groups : []).forEach((group, index) => {
      const candidateGroupId = toText(group?.id) || makeDeterministicId('grp', `${metaDoc.$id}|${group?.name}|${index}`);
      if (!shouldIncludeGroup(candidateGroupId)) return;

      const row = {
        id: candidateGroupId,
        data: prunePayload('groups', {
          name: toText(group?.name) || `Group ${candidateGroupId}`,
          creatorId: toText(group?.creatorId),
          createdAt: pickTimestamp(group?.createdAt, metaDoc.$createdAt, metaDoc.$updatedAt),
        }),
      };
      knownGroupIds.add(candidateGroupId);
      groupRowsById.set(candidateGroupId, row);
    });

    (Array.isArray(members) ? members : []).forEach((member, index) => {
      const groupId = toText(member?.groupId);
      const userId = toText(member?.userId);
      if (!groupId || !userId || !shouldIncludeGroup(groupId)) {
        skipped.groupMembers += 1;
        return;
      }

      const row = {
        id: toText(member?.id) || makeDeterministicId('mem', `${metaDoc.$id}|${groupId}|${userId}|${index}`),
        data: prunePayload('groupMembers', {
          groupId,
          userId,
          role: toRole(member?.role),
          email: toText(member?.email),
          name: toText(member?.name || member?.email || member?.userId),
          joinedAt: pickTimestamp(member?.joinedAt, member?.createdAt, metaDoc.$updatedAt, metaDoc.$createdAt),
          invitedBy: toText(member?.invitedBy),
        }),
      };
      knownGroupIds.add(groupId);
      const dedupeKey = `${groupId}::${userId}`;
      const existing = memberRowsByKey.get(dedupeKey);
      memberRowsByKey.set(dedupeKey, existing ? choosePreferredMembership(existing, row) : row);
    });

    (Array.isArray(invites) ? invites : []).forEach((invite, index) => {
      const groupId = toText(invite?.groupId);
      if (!groupId || !shouldIncludeGroup(groupId)) {
        skipped.groupInvites += 1;
        return;
      }

      const rowId = toText(invite?.id) || makeDeterministicId('inv', `${metaDoc.$id}|${groupId}|${invite?.code}|${index}`);
      const row = {
        id: rowId,
        data: prunePayload('groupInvites', {
          groupId,
          code: toText(invite?.code).toUpperCase(),
          role: toRole(invite?.role),
          createdBy: toText(invite?.createdBy),
          createdAt: pickTimestamp(invite?.createdAt, metaDoc.$updatedAt, metaDoc.$createdAt),
          expiresAt: pickTimestamp(invite?.expiresAt, invite?.createdAt, metaDoc.$updatedAt, metaDoc.$createdAt),
          revoked: normalizeRevokedValue(invite?.revoked),
        }),
      };
      knownGroupIds.add(groupId);
      inviteRowsById.set(rowId, row);
    });

    (Array.isArray(joinRequests) ? joinRequests : []).forEach((request, index) => {
      const groupId = toText(request?.groupId);
      const userId = toText(request?.userId);
      if (!groupId || !userId || !shouldIncludeGroup(groupId)) {
        skipped.groupJoinRequests += 1;
        return;
      }

      const status = toStatus(request?.status);
      const row = {
        id: toText(request?.id) || makeDeterministicId('req', `${metaDoc.$id}|${groupId}|${userId}|${status}|${index}`),
        data: prunePayload('groupJoinRequests', {
          groupId,
          userId,
          name: toText(request?.name || request?.email || userId),
          email: toText(request?.email),
          status,
          createdAt: pickTimestamp(request?.createdAt, metaDoc.$updatedAt, metaDoc.$createdAt),
          reviewedAt: parseTimestamp(request?.reviewedAt),
          reviewedBy: toText(request?.reviewedBy),
        }),
      };
      knownGroupIds.add(groupId);
      const dedupeKey = `${groupId}::${userId}::${status}`;
      const existing = requestRowsByKey.get(dedupeKey);
      requestRowsByKey.set(dedupeKey, existing ? choosePreferredJoinRequest(existing, row) : row);
    });

    if (activeTournament && typeof activeTournament === 'object') {
      const tournamentGroupId = toText(activeTournament.groupId);
      let resolvedGroupId = tournamentGroupId;

      if (!resolvedGroupId) resolvedGroupId = lockGroupIdArg;
      if (!resolvedGroupId && knownGroupIds.size === 1) {
        resolvedGroupId = Array.from(knownGroupIds)[0];
      }

      if (!resolvedGroupId || !shouldIncludeGroup(resolvedGroupId)) {
        skipped.groupActiveLocks += 1;
        warnings.push(
          `Skipped active tournament lock from app_meta doc ${metaDoc.$id}: could not resolve groupId. ` +
          'Use --lock-group-id <groupId> to force assignment.'
        );
      } else {
        const row = {
          id: buildActiveLockDocId(resolvedGroupId),
          data: prunePayload('groupActiveLocks', {
            groupId: resolvedGroupId,
            [lockPayloadField]: JSON.stringify(activeTournament),
            updatedAt: pickTimestamp(metaDoc.updatedAt, metaDoc.$updatedAt, metaDoc.$createdAt),
          }),
        };
        const existing = lockRowsByGroupId.get(resolvedGroupId);
        lockRowsByGroupId.set(resolvedGroupId, existing ? choosePreferredLock(existing, row) : row);
      }
    }
  }

  return {
    rows: {
      groups: Array.from(groupRowsById.values()),
      groupMembers: Array.from(memberRowsByKey.values()),
      groupInvites: Array.from(inviteRowsById.values()),
      groupJoinRequests: Array.from(requestRowsByKey.values()),
      groupActiveLocks: Array.from(lockRowsByGroupId.values()),
    },
    warnings,
    skipped,
    knownGroupIds: Array.from(knownGroupIds),
    lockPayloadField,
    invitesRevokedType,
  };
};

const upsertRows = async ({
  databases,
  databaseId,
  collectionId,
  label,
  rows,
}) => {
  if (!apply) {
    console.log(`[dry-run] ${label}: ${rows.length} rows`);
    return;
  }

  if (rows.length === 0) {
    console.log(`[apply] ${label}: 0 rows`);
    return;
  }

  const batches = chunk(rows, batchSize);
  let written = 0;
  for (const set of batches) {
    for (const row of set) {
      let lastError = null;
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        try {
          // eslint-disable-next-line no-await-in-loop
          await databases.upsertDocument(databaseId, collectionId, row.id, row.data);
          lastError = null;
          break;
        } catch (error) {
          lastError = error;
          if (attempt < 3) {
            // eslint-disable-next-line no-await-in-loop
            await sleep(250 * attempt);
          }
        }
      }
      if (lastError) {
        throw new Error(`[apply] ${label}: failed row ${row.id} (${lastError.message || lastError})`);
      }
      written += 1;
    }
    console.log(`[apply] ${label}: ${written}/${rows.length}`);
  }
};

const writeSummary = async (summary) => {
  await fs.mkdir(reportDir, { recursive: true });
  const filePath = path.join(
    reportDir,
    `group-domain-migration-summary-${nowIso().replace(/[:.]/g, '-')}.json`
  );
  await fs.writeFile(filePath, JSON.stringify(summary, null, 2), 'utf8');
  return filePath;
};

const run = async () => {
  const { source, target } = getCollectionIds();
  const { databases, config } = createDatabasesClient();

  const attrMap = await fetchAttributeMap({ config, targetCollections: target });
  assertRequiredAttributes(attrMap);

  const metaDocs = await readMetaDocuments({
    databases,
    databaseId: config.databaseId,
    appMetaCollectionId: source.appMeta,
  });
  if (metaDocs.length === 0) {
    throw new Error(`No app_meta documents found in collection "${source.appMeta}".`);
  }

  const built = buildRows({ metaDocs, attrMap });
  const summary = {
    mode: apply ? 'apply' : 'dry-run',
    sourceCollection: source.appMeta,
    targetCollections: target,
    options: {
      batchSize,
      metaDocId: explicitMetaDocId,
      includeAllMetaDocs,
      onlyGroupId,
      lockGroupIdArg,
      invitesRevokedTypeOverride,
    },
    scannedMetaDocuments: metaDocs.length,
    knownGroupIds: built.knownGroupIds,
    lockPayloadField: built.lockPayloadField,
    invitesRevokedType: built.invitesRevokedType,
    rowCounts: {
      groups: built.rows.groups.length,
      groupMembers: built.rows.groupMembers.length,
      groupInvites: built.rows.groupInvites.length,
      groupJoinRequests: built.rows.groupJoinRequests.length,
      groupActiveLocks: built.rows.groupActiveLocks.length,
    },
    skipped: built.skipped,
    warnings: built.warnings,
  };

  console.log('[group-migration] plan summary:', JSON.stringify(summary.rowCounts));
  if (onlyGroupId) {
    console.log(`[group-migration] filter: only groupId=${onlyGroupId}`);
  }
  if (built.warnings.length > 0) {
    built.warnings.forEach((warning) => console.warn(`[group-migration] warning: ${warning}`));
  }

  await upsertRows({
    databases,
    databaseId: config.databaseId,
    collectionId: target.groups,
    label: 'Groups',
    rows: built.rows.groups,
  });
  await upsertRows({
    databases,
    databaseId: config.databaseId,
    collectionId: target.groupMembers,
    label: 'Group Members',
    rows: built.rows.groupMembers,
  });
  await upsertRows({
    databases,
    databaseId: config.databaseId,
    collectionId: target.groupInvites,
    label: 'Group Invites',
    rows: built.rows.groupInvites,
  });
  await upsertRows({
    databases,
    databaseId: config.databaseId,
    collectionId: target.groupJoinRequests,
    label: 'Group Join Requests',
    rows: built.rows.groupJoinRequests,
  });
  await upsertRows({
    databases,
    databaseId: config.databaseId,
    collectionId: target.groupActiveLocks,
    label: 'Group Active Locks',
    rows: built.rows.groupActiveLocks,
  });

  const summaryPath = await writeSummary(summary);
  console.log('[group-migration] summary file:', summaryPath);
  console.log(`[group-migration] ${apply ? 'completed' : 'dry-run complete'}`);
};

run().catch((error) => {
  console.error('[group-migration] failed:', error?.message || error);
  process.exitCode = 1;
});
