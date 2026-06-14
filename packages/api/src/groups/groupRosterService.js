import { databases, DATABASE_ID, COLLECTIONS, ID, Query } from '../appwrite/client.js';
import { isGroupRosterCollectionEnabled, toAuxiliaryGroupId } from '@fixture-maker/config/auxiliaryConfig.js';

const PAGE_SIZE = 100;

const toNonEmptyString = (value) => String(value ?? '').trim();

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
      COLLECTIONS.GROUP_ROSTER,
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

const buildRosterDocId = (legacyMemberId) => {
  const normalized = toNonEmptyString(legacyMemberId)
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .slice(0, 36);
  return normalized || ID.unique();
};

const mapRosterDoc = (doc) => ({
  id: toNonEmptyString(doc?.legacyMemberId) || toNonEmptyString(doc?.$id),
  name: toNonEmptyString(doc?.name),
  phone: toNonEmptyString(doc?.phone),
  linkedAccountId: toNonEmptyString(doc?.linkedAccountId) || undefined,
  linkedEmail: toNonEmptyString(doc?.linkedEmail) || undefined,
});

const buildRosterPayload = (groupId, member, now) => {
  const legacyMemberId = toNonEmptyString(member?.id) || `member-${Date.now()}`;
  return {
    groupId,
    legacyMemberId,
    name: toNonEmptyString(member?.name),
    phone: toNonEmptyString(member?.phone),
    linkedAccountId: toNonEmptyString(member?.linkedAccountId),
    linkedEmail: toNonEmptyString(member?.linkedEmail),
    sourceUpdatedAt: now,
    migratedAt: now,
  };
};

export const groupRosterService = {
  isEnabled: isGroupRosterCollectionEnabled,

  async listMembers(groupId = null) {
    if (!isGroupRosterCollectionEnabled()) return [];
    const resolvedGroupId = toAuxiliaryGroupId(groupId);
    const docs = await listByGroup(resolvedGroupId);
    return docs
      .map(mapRosterDoc)
      .filter((member) => member.name)
      .sort((left, right) => left.name.localeCompare(right.name));
  },

  async saveMembers(members = [], groupId = null) {
    if (!isGroupRosterCollectionEnabled()) return members;
    const resolvedGroupId = toAuxiliaryGroupId(groupId);
    const now = new Date().toISOString();
    const incoming = Array.isArray(members) ? members : [];
    const existing = await listByGroup(resolvedGroupId);
    const existingByLegacyId = new Map();
    existing.forEach((doc) => {
      const legacyId = toNonEmptyString(doc?.legacyMemberId);
      if (legacyId) existingByLegacyId.set(legacyId, doc);
    });

    const keepIds = new Set();
    for (const member of incoming) {
      const legacyMemberId = toNonEmptyString(member?.id) || `member-${Date.now()}`;
      const docId = toNonEmptyString(existingByLegacyId.get(legacyMemberId)?.$id)
        || buildRosterDocId(legacyMemberId);
      keepIds.add(docId);
      const payload = buildRosterPayload(resolvedGroupId, { ...member, id: legacyMemberId }, now);
      // eslint-disable-next-line no-await-in-loop
      await databases.upsertDocument(
        DATABASE_ID,
        COLLECTIONS.GROUP_ROSTER,
        docId,
        payload
      );
    }

    for (const doc of existing) {
      if (keepIds.has(doc.$id)) continue;
      // eslint-disable-next-line no-await-in-loop
      await databases.deleteDocument(DATABASE_ID, COLLECTIONS.GROUP_ROSTER, doc.$id);
    }

    return this.listMembers(resolvedGroupId);
  },
};
