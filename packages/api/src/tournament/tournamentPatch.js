import { databases, DATABASE_ID, COLLECTIONS, ID } from '../appwrite/client.js';
import { TOURNAMENT_DELETED_STATUS } from './tournamentConstants';
import {
  clearTournamentChildrenCache,
  deleteRows,
  findExistingTournamentDocForCreate,
  listByGroupAndValues,
} from './tournamentQueries';
import { syncTournamentChildren } from './tournamentMatches';
import { ensurePlayersExist } from './tournamentTeams';
import {
  ensureV2Configured,
  getTournamentOptimisticVersionMs,
  getTournamentOptimisticVersionValue,
  isDeletedTournamentDoc,
  parseBoolean,
  shouldUseSoftTournamentDelete,
  toGroupId,
  toNonEmptyString,
  toTimestampMs,
} from './tournamentUtils';
import {
  buildTournamentDocument,
  collectTournamentPlayers,
  getTournamentById,
  mergeTournamentState,
} from './tournamentHydration';
import { resolveTournamentRuleConfig } from './tournamentSport';

export const createTournament = async (tournamentData, groupId = null) => {
  ensureV2Configured();
  const resolvedGroupId = toGroupId(groupId);
  const merged = mergeTournamentState(null, tournamentData || {});
  const existingDoc = await findExistingTournamentDocForCreate({
    groupId: resolvedGroupId,
    payload: merged,
  });
  const players = collectTournamentPlayers(merged);
  const playerByNormalized = await ensurePlayersExist({
    groupId: resolvedGroupId,
    names: players,
    source: 'runtime.tournament-create',
  });

  const tournamentId = toNonEmptyString(existingDoc?.$id) || ID.unique();
  const document = buildTournamentDocument({
    tournamentId,
    groupId: resolvedGroupId,
    payload: merged,
    existing: existingDoc,
    playerByNormalized,
  });

  const created = await databases.upsertDocument(
    DATABASE_ID,
    COLLECTIONS.TOURNAMENTS_V2,
    tournamentId,
    document
  );

  await syncTournamentChildren({
    groupId: resolvedGroupId,
    tournamentDoc: created,
    payload: merged,
    playerByNormalized,
  });

  return {
    id: created.$id,
    appwriteId: created.$id,
    immutableTournamentId: created.legacyTournamentId || created.$id,
    name: merged.name,
    date: merged.date,
    teams: merged.teams,
    fixtures: merged.fixtures,
    bracket: merged.bracket,
    finalMatch: merged.finalMatch,
    champion: merged.champion,
    aiSummaries: merged.aiSummaries,
    swapHistory: merged.swapHistory,
    format: merged.format,
    gameMode: merged.gameMode,
    tournamentFormat: merged.tournamentFormat,
    status: merged.status,
    oddPlayerEnabled: Boolean(merged.oddPlayerEnabled),
    oddPlayerName: toNonEmptyString(merged.oddPlayerName),
    sportId: merged.sportId,
    ruleConfig: merged.ruleConfig,
    createdAt: created.sourceCreatedAt || created.$createdAt,
    updatedAt: created.sourceUpdatedAt || created.$updatedAt,
    optimisticVersion: created.sourceUpdatedAt || created.$updatedAt,
  };
};

export const updateTournament = async (tournamentId, updates, groupId = null, options = {}) => {
  ensureV2Configured();
  const resolvedGroupId = toGroupId(groupId);
  const { skipExistingHydration = false } = options || {};

  const baseDoc = await databases.getDocument(DATABASE_ID, COLLECTIONS.TOURNAMENTS_V2, tournamentId);
  if (toNonEmptyString(baseDoc.groupId) !== resolvedGroupId) {
    throw new Error('Tournament not found for this group');
  }
  if (isDeletedTournamentDoc(baseDoc)) {
    throw new Error('Tournament is deleted');
  }

  const incomingUpdatedAt = getTournamentOptimisticVersionValue(updates);
  const remoteUpdatedAtMs = getTournamentOptimisticVersionMs(baseDoc);
  const incomingUpdatedAtMs = toTimestampMs(incomingUpdatedAt);
  if (incomingUpdatedAtMs > 0 && remoteUpdatedAtMs > 0 && incomingUpdatedAtMs <= remoteUpdatedAtMs) {
    return getTournamentById(tournamentId, resolvedGroupId);
  }

  const hasCompleteStateInUpdates = Boolean(
    updates
    && Object.prototype.hasOwnProperty.call(updates, 'teams')
    && Object.prototype.hasOwnProperty.call(updates, 'fixtures')
    && Object.prototype.hasOwnProperty.call(updates, 'bracket')
    && Object.prototype.hasOwnProperty.call(updates, 'aiSummaries')
    && Object.prototype.hasOwnProperty.call(updates, 'swapHistory')
  );
  const canSkipHydration = skipExistingHydration && hasCompleteStateInUpdates;

  const existing = canSkipHydration
    ? {
        id: baseDoc.$id,
        appwriteId: baseDoc.$id,
        immutableTournamentId: baseDoc.legacyTournamentId || baseDoc.$id,
        groupId: baseDoc.groupId,
        legacyTournamentId: baseDoc.legacyTournamentId || baseDoc.$id,
        name: baseDoc.name,
        date: baseDoc.dateLabel,
        teams: updates.teams,
        fixtures: updates.fixtures,
        bracket: updates.bracket,
        finalMatch: updates.finalMatch ?? null,
        champion: updates.champion ?? null,
        aiSummaries: updates.aiSummaries ?? [],
        swapHistory: updates.swapHistory ?? [],
        format: baseDoc.format || '1',
        gameMode: baseDoc.gameMode || 'doubles',
        tournamentFormat: baseDoc.tournamentFormat || 'league',
        status: baseDoc.status || 'active',
        oddPlayerEnabled: parseBoolean(baseDoc.oddPlayerEnabled),
        oddPlayerName: toNonEmptyString(baseDoc.oddPlayerName),
        sportId: toNonEmptyString(baseDoc.sportId) || 'badminton',
        ruleConfig: resolveTournamentRuleConfig(null, baseDoc),
        optimisticVersion: getTournamentOptimisticVersionValue(baseDoc),
      }
    : await this.getTournamentById(tournamentId, resolvedGroupId);
  const merged = mergeTournamentState(existing, updates || {});

  const players = collectTournamentPlayers(merged);
  const playerByNormalized = await ensurePlayersExist({
    groupId: resolvedGroupId,
    names: players,
    source: 'runtime.tournament-update',
  });

  const document = buildTournamentDocument({
    tournamentId,
    groupId: resolvedGroupId,
    payload: merged,
    existing: baseDoc,
    playerByNormalized,
  });

  const updatedDoc = await databases.upsertDocument(
    DATABASE_ID,
    COLLECTIONS.TOURNAMENTS_V2,
    tournamentId,
    document
  );

  await syncTournamentChildren({
    groupId: resolvedGroupId,
    tournamentDoc: updatedDoc,
    payload: merged,
    playerByNormalized,
  });

  return {
    ...merged,
    id: updatedDoc.$id,
    appwriteId: updatedDoc.$id,
    immutableTournamentId: updatedDoc.legacyTournamentId || updatedDoc.$id,
    createdAt: updatedDoc.sourceCreatedAt || updatedDoc.$createdAt,
    updatedAt: updatedDoc.sourceUpdatedAt || updatedDoc.$updatedAt,
    optimisticVersion: updatedDoc.sourceUpdatedAt || updatedDoc.$updatedAt,
  };
};

export const deleteTournament = async (tournamentId, groupId = null) => {
  ensureV2Configured();
  const resolvedGroupId = toGroupId(groupId);

  let tournamentDoc = null;
  try {
    tournamentDoc = await databases.getDocument(DATABASE_ID, COLLECTIONS.TOURNAMENTS_V2, tournamentId);
  } catch (error) {
    if (error?.code === 404) return false;
    throw error;
  }

  if (toNonEmptyString(tournamentDoc.groupId) !== resolvedGroupId) {
    return false;
  }
  if (isDeletedTournamentDoc(tournamentDoc)) {
    clearTournamentChildrenCache(resolvedGroupId, tournamentId);
    return true;
  }

  if (shouldUseSoftTournamentDelete()) {
    try {
      await databases.updateDocument(
        DATABASE_ID,
        COLLECTIONS.TOURNAMENTS_V2,
        tournamentId,
        {
          status: TOURNAMENT_DELETED_STATUS,
          sourceUpdatedAt: new Date().toISOString(),
        }
      );
      clearTournamentChildrenCache(resolvedGroupId, tournamentId);
      return true;
    } catch (error) {
      const message = String(error?.message || '').toLowerCase();
      const isStatusValidationError = error?.code === 400 && (
        message.includes('status')
        || message.includes('enum')
        || message.includes('invalid document structure')
        || message.includes('unknown attribute')
      );
      if (!isStatusValidationError) throw error;
      console.warn('Soft delete failed; falling back to hard delete for tournament.', error);
    }
  }

  const [teamDocs, matchDocs] = await Promise.all([
    listByGroupAndValues({
      collectionId: COLLECTIONS.TOURNAMENT_TEAMS_V2,
      groupId: resolvedGroupId,
      key: 'tournamentId',
      values: [tournamentId],
    }),
    listByGroupAndValues({
      collectionId: COLLECTIONS.MATCHES_V2,
      groupId: resolvedGroupId,
      key: 'tournamentId',
      values: [tournamentId],
    }),
  ]);

  const participants = await listByGroupAndValues({
    collectionId: COLLECTIONS.MATCH_PLAYERS_V2,
    groupId: resolvedGroupId,
    key: 'matchId',
    values: matchDocs.map((row) => row.$id),
  });

  await deleteRows(COLLECTIONS.MATCH_PLAYERS_V2, participants);
  await deleteRows(COLLECTIONS.MATCHES_V2, matchDocs);
  await deleteRows(COLLECTIONS.TOURNAMENT_TEAMS_V2, teamDocs);

  await databases.deleteDocument(DATABASE_ID, COLLECTIONS.TOURNAMENTS_V2, tournamentId);
  clearTournamentChildrenCache(resolvedGroupId, tournamentId);
  return true;
};
