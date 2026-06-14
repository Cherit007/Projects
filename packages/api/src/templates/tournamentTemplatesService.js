import { databases, DATABASE_ID, COLLECTIONS, ID, Query } from '../appwrite/client.js';
import { isTournamentTemplatesCollectionEnabled, toAuxiliaryGroupId } from '@fixture-maker/config/auxiliaryConfig.js';

const PAGE_SIZE = 100;

const toNonEmptyString = (value) => String(value ?? '').trim();

const parseJson = (value, fallback) => {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
};

const listByGroup = async (groupId) => {
  const docs = [];
  let cursor = null;

  while (true) {
    const queries = [
      Query.equal('groupId', groupId),
      Query.orderAsc('$id'),
      Query.limit(PAGE_SIZE),
      ...(cursor ? [Query.cursorAfter(cursor)] : []),
    ];
    const response = await databases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.TOURNAMENT_TEMPLATES,
      queries
    );
    const page = response?.documents || [];
    if (page.length === 0) break;
    docs.push(...page);
    if (page.length < PAGE_SIZE) break;
    cursor = page[page.length - 1].$id;
  }

  return docs;
};

const mapTemplateDoc = (doc) => ({
  id: toNonEmptyString(doc?.legacyTemplateId) || toNonEmptyString(doc?.$id),
  name: toNonEmptyString(doc?.name),
  sportId: toNonEmptyString(doc?.sportId) || 'badminton',
  gameMode: toNonEmptyString(doc?.gameMode) || 'doubles',
  tournamentFormat: toNonEmptyString(doc?.tournamentFormat) || 'league',
  format: toNonEmptyString(doc?.format) || '1',
  numTeams: Number(doc?.numTeams) || 3,
  teams: parseJson(doc?.teamsJson, []),
  createdAt: toNonEmptyString(doc?.sourceCreatedAt || doc?.$createdAt),
  updatedAt: toNonEmptyString(doc?.sourceUpdatedAt || doc?.$updatedAt),
});

const buildTemplateDocId = (legacyTemplateId) => {
  const normalized = toNonEmptyString(legacyTemplateId)
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .slice(0, 36);
  return normalized || ID.unique();
};

const buildTemplatePayload = (groupId, template, now) => {
  const legacyTemplateId = toNonEmptyString(template?.id) || `template-${Date.now()}`;
  return {
    legacyTemplateId,
    groupId,
    name: toNonEmptyString(template?.name) || 'Untitled Template',
    sportId: toNonEmptyString(template?.sportId) || 'badminton',
    gameMode: toNonEmptyString(template?.gameMode) || 'doubles',
    tournamentFormat: toNonEmptyString(template?.tournamentFormat) || 'league',
    format: toNonEmptyString(template?.format) || '1',
    numTeams: String(Number(template?.numTeams) || 3),
    teamsJson: JSON.stringify(Array.isArray(template?.teams) ? template.teams : []),
    sourceCreatedAt: toNonEmptyString(template?.createdAt) || now,
    sourceUpdatedAt: toNonEmptyString(template?.updatedAt) || now,
    migratedAt: now,
  };
};

export const tournamentTemplatesService = {
  isEnabled: isTournamentTemplatesCollectionEnabled,

  async listTemplates(groupId = null) {
    if (!isTournamentTemplatesCollectionEnabled()) return [];
    const resolvedGroupId = toAuxiliaryGroupId(groupId);
    const docs = await listByGroup(resolvedGroupId);
    return docs
      .map(mapTemplateDoc)
      .sort((left, right) => toNonEmptyString(right.updatedAt).localeCompare(toNonEmptyString(left.updatedAt)));
  },

  async saveTemplates(templates = [], groupId = null) {
    if (!isTournamentTemplatesCollectionEnabled()) return templates;
    const resolvedGroupId = toAuxiliaryGroupId(groupId);
    const now = new Date().toISOString();
    const incoming = Array.isArray(templates) ? templates : [];
    const existing = await listByGroup(resolvedGroupId);
    const existingByLegacyId = new Map();
    existing.forEach((doc) => {
      const legacyId = toNonEmptyString(doc?.legacyTemplateId);
      if (legacyId) existingByLegacyId.set(legacyId, doc);
    });

    const keepIds = new Set();
    for (const template of incoming) {
      const legacyTemplateId = toNonEmptyString(template?.id) || `template-${Date.now()}`;
      const docId = toNonEmptyString(existingByLegacyId.get(legacyTemplateId)?.$id)
        || buildTemplateDocId(legacyTemplateId);
      keepIds.add(docId);
      const payload = buildTemplatePayload(resolvedGroupId, { ...template, id: legacyTemplateId }, now);
      // eslint-disable-next-line no-await-in-loop
      await databases.upsertDocument(
        DATABASE_ID,
        COLLECTIONS.TOURNAMENT_TEMPLATES,
        docId,
        payload
      );
    }

    for (const doc of existing) {
      if (keepIds.has(doc.$id)) continue;
      // eslint-disable-next-line no-await-in-loop
      await databases.deleteDocument(DATABASE_ID, COLLECTIONS.TOURNAMENT_TEMPLATES, doc.$id);
    }

    return this.listTemplates(resolvedGroupId);
  },
};
