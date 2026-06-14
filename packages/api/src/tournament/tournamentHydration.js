import { databases, DATABASE_ID, COLLECTIONS, Query } from '../appwrite/client.js';
import {
  tournamentDocSchema,
  tournamentMatchDocSchema,
  tournamentTeamDocSchema,
  matchParticipantDocSchema,
  parseWithSchema,
  normalizeDocList,
} from './tournamentSchemas';
import {
  listByGroupAndValues,
  setTournamentChildrenCache,
  isIndexConstraintError,
} from './tournamentQueries';
import { parseTeamDocument } from './tournamentTeams';
import { parseMatchDocument, sortMatchesBySequence } from './tournamentMatches';
import {
  ensureV2Configured,
  inferTournamentChampionFromState,
  getTournamentOptimisticVersionValue,
  isDeletedTournamentDoc,
  normalizeTournamentStatusValue,
  parseBoolean,
  pickFirstNonEmptyString,
  resolveTournamentImmutableId,
  toBooleanString,
  toGroupId,
  toNonEmptyString,
  collectPlayersFromTeam,
  collectPlayersFromMatch,
} from './tournamentUtils';
import { resolvePlayerId } from './tournamentTeams';
import {
  resolveTournamentRuleConfig,
  resolveTournamentSportId,
  serializeRuleConfig,
} from './tournamentSport';

const hydrateTournament = ({ tournamentDoc, teamDocs = [], matchDocs = [], matchPlayerDocs = [] }) => {
  const safeTournamentDoc = parseWithSchema(
    tournamentDocSchema,
    tournamentDoc,
    'tournament document',
    tournamentDoc && typeof tournamentDoc === 'object' ? tournamentDoc : {}
  );
  const normalizedTeamDocs = normalizeDocList(teamDocs, tournamentTeamDocSchema, 'tournament team document');
  const normalizedMatchDocs = normalizeDocList(matchDocs, tournamentMatchDocSchema, 'tournament match document');
  const normalizedMatchPlayerDocs = normalizeDocList(
    matchPlayerDocs,
    matchParticipantDocSchema,
    'match participant document'
  );

  const sortedTeamDocs = [...normalizedTeamDocs].sort((a, b) => {
    const aNo = Number(a.teamNo || 0);
    const bNo = Number(b.teamNo || 0);
    if (Number.isFinite(aNo) && Number.isFinite(bNo) && aNo !== bNo) return aNo - bNo;
    return toNonEmptyString(a.$id).localeCompare(toNonEmptyString(b.$id));
  });

  const teams = sortedTeamDocs.map(parseTeamDocument);
  const teamByRowId = new Map();
  sortedTeamDocs.forEach((doc, index) => {
    teamByRowId.set(toNonEmptyString(doc.$id), teams[index]);
  });

  const participantsByMatchId = new Map();
  normalizedMatchPlayerDocs.forEach((row) => {
    const matchId = toNonEmptyString(row.matchId);
    if (!matchId) return;
    const bucket = participantsByMatchId.get(matchId) || [];
    bucket.push(row);
    participantsByMatchId.set(matchId, bucket);
  });

  const fixtures = [];
  const bracketByRound = new Map();
  let finalMatch = null;

  const sortedMatches = [...normalizedMatchDocs].sort(sortMatchesBySequence);

  sortedMatches.forEach((row) => {
    const parsed = parseMatchDocument({
      doc: row,
      teamByRowId,
      participantsByMatchId,
    });

    const kind = toNonEmptyString(row.matchKind).toLowerCase();
    const bracketRound = toNonEmptyString(row.bracketRoundIndex);

    if (kind === 'league') {
      fixtures.push(parsed);
      return;
    }

    if (kind === 'knockout' || (kind === 'final' && bracketRound)) {
      const roundIndex = Number(bracketRound || 0);
      const roundKey = Number.isFinite(roundIndex) && roundIndex > 0 ? roundIndex : 1;
      const bucket = bracketByRound.get(roundKey) || [];
      bucket.push({
        row,
        parsed,
      });
      bracketByRound.set(roundKey, bucket);
      return;
    }

    if (kind === 'final') {
      finalMatch = parsed;
    }
  });

  const bracket = Array.from(bracketByRound.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([, roundMatches]) => (
      [...roundMatches]
        .sort((a, b) => {
          const aIndex = Number(a.row?.bracketMatchIndex || a.row?.sequenceNo || 0);
          const bIndex = Number(b.row?.bracketMatchIndex || b.row?.sequenceNo || 0);
          if (Number.isFinite(aIndex) && Number.isFinite(bIndex) && aIndex !== bIndex) return aIndex - bIndex;
          return toNonEmptyString(a.row?.$id).localeCompare(toNonEmptyString(b.row?.$id));
        })
        .map((entry) => entry.parsed)
    ));

  const champion = inferTournamentChampionFromState({
    champion: null,
    finalMatch,
    bracket,
  });
  const immutableTournamentId = pickFirstNonEmptyString(
    safeTournamentDoc.legacyTournamentId,
    safeTournamentDoc.$id
  );
  const optimisticVersion = getTournamentOptimisticVersionValue(safeTournamentDoc);
  const normalizedStatus = normalizeTournamentStatusValue({
    status: safeTournamentDoc?.status,
    champion,
    finalMatch,
    bracket,
  });

  return {
    id: safeTournamentDoc.$id,
    appwriteId: safeTournamentDoc.$id,
    immutableTournamentId,
    optimisticVersion,
    groupId: safeTournamentDoc.groupId,
    legacyTournamentId: immutableTournamentId,
    name: safeTournamentDoc.name,
    date: safeTournamentDoc.dateLabel,
    teams,
    fixtures,
    bracket,
    finalMatch,
    champion,
    aiSummaries: [],
    swapHistory: [],
    format: safeTournamentDoc.format || '1',
    gameMode: safeTournamentDoc.gameMode || 'doubles',
    tournamentFormat: safeTournamentDoc.tournamentFormat || 'league',
    status: normalizedStatus,
    oddPlayerEnabled: parseBoolean(safeTournamentDoc.oddPlayerEnabled),
    oddPlayerName: toNonEmptyString(safeTournamentDoc.oddPlayerName),
    sportId: resolveTournamentSportId(null, safeTournamentDoc),
    ruleConfig: resolveTournamentRuleConfig(null, safeTournamentDoc),
    createdAt: safeTournamentDoc.sourceCreatedAt || safeTournamentDoc.$createdAt,
    updatedAt: safeTournamentDoc.sourceUpdatedAt || safeTournamentDoc.$updatedAt,
  };
};

const buildTournamentDocument = ({
  tournamentId,
  groupId,
  payload,
  existing,
  playerByNormalized,
}) => {
  const now = new Date().toISOString();
  const immutableTournamentId = resolveTournamentImmutableId({
    payload,
    existing,
    tournamentId,
  });
  const incomingUpdatedAt = getTournamentOptimisticVersionValue(payload)
    || getTournamentOptimisticVersionValue(existing)
    || now;
  const oddPlayerName = toNonEmptyString(payload.oddPlayerName ?? existing?.oddPlayerName);
  const resolvedOddPlayerId = resolvePlayerId(oddPlayerName, playerByNormalized);
  const normalizedStatus = normalizeTournamentStatusValue({
    status: payload.status ?? existing?.status,
    champion: payload.champion,
    finalMatch: payload.finalMatch,
    bracket: payload.bracket,
  });
  const sportId = resolveTournamentSportId(payload, existing);
  const ruleConfig = resolveTournamentRuleConfig(payload, existing);
  const ruleConfigJson = serializeRuleConfig(ruleConfig);

  return {
    groupId,
    legacyTournamentId: immutableTournamentId,
    name: toNonEmptyString(payload.name) || toNonEmptyString(existing?.name) || 'Untitled Tournament',
    dateLabel: toNonEmptyString(payload.date) || toNonEmptyString(existing?.dateLabel),
    status: normalizedStatus,
    sportId,
    ...(ruleConfigJson ? { ruleConfigJson } : {}),
    gameMode: toNonEmptyString(payload.gameMode) || toNonEmptyString(existing?.gameMode) || 'doubles',
    tournamentFormat: toNonEmptyString(payload.tournamentFormat) || toNonEmptyString(existing?.tournamentFormat) || 'league',
    format: toNonEmptyString(payload.format) || toNonEmptyString(existing?.format) || '1',
    oddPlayerEnabled: toBooleanString(payload.oddPlayerEnabled ?? parseBoolean(existing?.oddPlayerEnabled)),
    oddPlayerName,
    oddPlayerId: resolvedOddPlayerId || toNonEmptyString(existing?.oddPlayerId),
    sourceCreatedAt: toNonEmptyString(existing?.sourceCreatedAt) || now,
    sourceUpdatedAt: incomingUpdatedAt,
    migratedAt: now,
  };
};

const mergeTournamentState = (existing, updates = {}) => {
  const merged = {
    id: updates.id ?? existing?.id ?? null,
    appwriteId: updates.appwriteId ?? existing?.appwriteId ?? null,
    immutableTournamentId: updates.immutableTournamentId ?? existing?.immutableTournamentId ?? null,
    legacyTournamentId: updates.legacyTournamentId ?? existing?.legacyTournamentId ?? null,
    name: updates.name ?? existing?.name ?? 'Untitled Tournament',
    date: updates.date ?? existing?.date ?? '',
    teams: updates.teams ?? existing?.teams ?? [],
    fixtures: updates.fixtures ?? existing?.fixtures ?? [],
    bracket: updates.bracket ?? existing?.bracket ?? [],
    finalMatch: updates.finalMatch !== undefined ? updates.finalMatch : (existing?.finalMatch ?? null),
    champion: updates.champion !== undefined ? updates.champion : (existing?.champion ?? null),
    format: updates.format ?? existing?.format ?? '1',
    gameMode: updates.gameMode ?? existing?.gameMode ?? 'doubles',
    tournamentFormat: updates.tournamentFormat ?? existing?.tournamentFormat ?? 'league',
    status: updates.status ?? existing?.status ?? 'active',
    oddPlayerEnabled: updates.oddPlayerEnabled ?? existing?.oddPlayerEnabled ?? false,
    oddPlayerName: updates.oddPlayerName ?? existing?.oddPlayerName ?? '',
    sportId: resolveTournamentSportId(updates, existing),
    ruleConfig: resolveTournamentRuleConfig(updates, existing),
    optimisticVersion: updates.optimisticVersion ?? existing?.optimisticVersion ?? updates.updatedAt ?? existing?.updatedAt ?? null,
    aiSummaries: updates.aiSummaries ?? existing?.aiSummaries ?? [],
    swapHistory: updates.swapHistory ?? existing?.swapHistory ?? [],
  };

  return {
    ...merged,
    status: normalizeTournamentStatusValue(merged),
  };
};

const collectTournamentPlayers = (payload = {}) => {
  const names = new Set();
  const add = (name) => {
    const value = toNonEmptyString(name);
    if (value) names.add(value);
  };

  (Array.isArray(payload.teams) ? payload.teams : []).forEach((team) => {
    collectPlayersFromTeam(team).forEach(add);
  });

  (Array.isArray(payload.fixtures) ? payload.fixtures : []).forEach((match) => {
    collectPlayersFromMatch(match).forEach(add);
  });

  (Array.isArray(payload.bracket) ? payload.bracket : []).forEach((round) => {
    (Array.isArray(round) ? round : []).forEach((match) => {
      collectPlayersFromMatch(match).forEach(add);
    });
  });

  if (payload.finalMatch) {
    collectPlayersFromMatch(payload.finalMatch).forEach(add);
  }

  if (payload.champion) {
    collectPlayersFromTeam(payload.champion).forEach(add);
  }

  add(payload.oddPlayerName);
  return Array.from(names);
};

export const getAllTournaments = async (limit = 100, groupId = null) => {
  ensureV2Configured();
  const resolvedGroupId = toGroupId(groupId);
  let effectiveGroupId = resolvedGroupId;
  const queryLimit = Math.max(limit, 200);

  let tournamentDocs = [];
  try {
    const response = await databases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.TOURNAMENTS_V2,
      [
        Query.equal('groupId', resolvedGroupId),
        Query.orderDesc('$updatedAt'),
        Query.limit(queryLimit),
      ]
    );
    tournamentDocs = (response?.documents || [])
      .filter((doc) => !isDeletedTournamentDoc(doc))
      .slice(0, limit);
  } catch (error) {
    if (!isIndexConstraintError(error)) throw error;
    const unfiltered = await databases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.TOURNAMENTS_V2,
      [
        Query.orderDesc('$updatedAt'),
        Query.limit(queryLimit),
      ]
    );
    tournamentDocs = (unfiltered?.documents || [])
      .filter((doc) => toNonEmptyString(doc?.groupId) === resolvedGroupId)
      .filter((doc) => !isDeletedTournamentDoc(doc))
      .slice(0, limit);
  }

  if (tournamentDocs.length === 0 && resolvedGroupId) {
    const unscoped = await databases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.TOURNAMENTS_V2,
      [
        Query.orderDesc('$updatedAt'),
        Query.limit(Math.max(limit, 200)),
      ]
    );
    const docs = unscoped?.documents || [];
    const discoveredGroups = Array.from(
      new Set(docs.map((doc) => toNonEmptyString(doc?.groupId)).filter(Boolean))
    );
    if (discoveredGroups.length === 1 && discoveredGroups[0] !== resolvedGroupId) {
      console.warn(
        `V2 tournaments are stored under group "${discoveredGroups[0]}", but active group is "${resolvedGroupId}". Falling back to discovered group.`
      );
      effectiveGroupId = discoveredGroups[0];
      tournamentDocs = docs
        .filter((doc) => toNonEmptyString(doc?.groupId) === effectiveGroupId)
        .filter((doc) => !isDeletedTournamentDoc(doc))
        .slice(0, limit);
    }
  }

  if (tournamentDocs.length === 0) return [];

  const tournamentIds = tournamentDocs.map((doc) => doc.$id);

  const [teamDocs, matchDocs] = await Promise.all([
    listByGroupAndValues({
      collectionId: COLLECTIONS.TOURNAMENT_TEAMS_V2,
      groupId: effectiveGroupId,
      key: 'tournamentId',
      values: tournamentIds,
    }),
    listByGroupAndValues({
      collectionId: COLLECTIONS.MATCHES_V2,
      groupId: effectiveGroupId,
      key: 'tournamentId',
      values: tournamentIds,
    }),
  ]);

  const matchIds = matchDocs.map((doc) => doc.$id);
  const matchPlayerDocs = await listByGroupAndValues({
    collectionId: COLLECTIONS.MATCH_PLAYERS_V2,
    groupId: effectiveGroupId,
    key: 'matchId',
    values: matchIds,
  });

  const teamsByTournament = new Map();
  teamDocs.forEach((doc) => {
    const key = toNonEmptyString(doc.tournamentId);
    if (!key) return;
    const bucket = teamsByTournament.get(key) || [];
    bucket.push(doc);
    teamsByTournament.set(key, bucket);
  });

  const matchesByTournament = new Map();
  matchDocs.forEach((doc) => {
    const key = toNonEmptyString(doc.tournamentId);
    if (!key) return;
    const bucket = matchesByTournament.get(key) || [];
    bucket.push(doc);
    matchesByTournament.set(key, bucket);
  });

  const participantsByTournament = new Map();
  const tournamentIdByMatchId = new Map();
  matchDocs.forEach((doc) => {
    tournamentIdByMatchId.set(toNonEmptyString(doc.$id), toNonEmptyString(doc.tournamentId));
  });
  matchPlayerDocs.forEach((doc) => {
    const matchId = toNonEmptyString(doc.matchId);
    const tournamentId = tournamentIdByMatchId.get(matchId);
    if (!tournamentId) return;
    const bucket = participantsByTournament.get(tournamentId) || [];
    bucket.push(doc);
    participantsByTournament.set(tournamentId, bucket);
  });

  tournamentDocs.forEach((doc) => {
    setTournamentChildrenCache(effectiveGroupId, doc.$id, {
      teamRows: teamsByTournament.get(doc.$id) || [],
      matchRows: matchesByTournament.get(doc.$id) || [],
      participantRows: participantsByTournament.get(doc.$id) || [],
    });
  });

  return tournamentDocs.map((doc) => hydrateTournament({
    tournamentDoc: doc,
    teamDocs: teamsByTournament.get(doc.$id) || [],
    matchDocs: matchesByTournament.get(doc.$id) || [],
    matchPlayerDocs: participantsByTournament.get(doc.$id) || [],
  }));
};

export const getTournamentSummaries = async (limit = 100, groupId = null, statuses = []) => {
  ensureV2Configured();
  const resolvedGroupId = toGroupId(groupId);
  let effectiveGroupId = resolvedGroupId;
  const normalizedStatuses = Array.from(
    new Set(
      (Array.isArray(statuses) ? statuses : [])
        .map((status) => toNonEmptyString(status).toLowerCase())
        .filter(Boolean)
    )
  );

  let tournamentDocs = [];
  try {
    const response = await databases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.TOURNAMENTS_V2,
      [
        Query.equal('groupId', resolvedGroupId),
        Query.orderDesc('$updatedAt'),
        Query.limit(Math.max(limit, 200)),
      ]
    );
    tournamentDocs = (response?.documents || [])
      .filter((doc) => !isDeletedTournamentDoc(doc));
  } catch (error) {
    if (!isIndexConstraintError(error)) throw error;
    const unfiltered = await databases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.TOURNAMENTS_V2,
      [
        Query.orderDesc('$updatedAt'),
        Query.limit(Math.max(limit, 200)),
      ]
    );
    tournamentDocs = (unfiltered?.documents || [])
      .filter((doc) => toNonEmptyString(doc?.groupId) === resolvedGroupId)
      .filter((doc) => !isDeletedTournamentDoc(doc));
  }

  if (tournamentDocs.length === 0 && resolvedGroupId) {
    const unscoped = await databases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.TOURNAMENTS_V2,
      [
        Query.orderDesc('$updatedAt'),
        Query.limit(Math.max(limit, 200)),
      ]
    );
    const docs = unscoped?.documents || [];
    const discoveredGroups = Array.from(
      new Set(docs.map((doc) => toNonEmptyString(doc?.groupId)).filter(Boolean))
    );
    if (discoveredGroups.length === 1 && discoveredGroups[0] !== resolvedGroupId) {
      console.warn(
        `V2 tournaments are stored under group "${discoveredGroups[0]}", but active group is "${resolvedGroupId}". Falling back to discovered group.`
      );
      effectiveGroupId = discoveredGroups[0];
      tournamentDocs = docs
        .filter((doc) => toNonEmptyString(doc?.groupId) === effectiveGroupId)
        .filter((doc) => !isDeletedTournamentDoc(doc));
    }
  }

  const tournamentIds = tournamentDocs.map((doc) => toNonEmptyString(doc?.$id)).filter(Boolean);
  if (tournamentIds.length === 0) return [];

  const [teamDocs, matchDocs] = await Promise.all([
    listByGroupAndValues({
      collectionId: COLLECTIONS.TOURNAMENT_TEAMS_V2,
      groupId: effectiveGroupId,
      key: 'tournamentId',
      values: tournamentIds,
    }),
    listByGroupAndValues({
      collectionId: COLLECTIONS.MATCHES_V2,
      groupId: effectiveGroupId,
      key: 'tournamentId',
      values: tournamentIds,
    }),
  ]);

  const teamsByTournament = new Map();
  teamDocs.forEach((doc) => {
    const tournamentId = toNonEmptyString(doc?.tournamentId);
    if (!tournamentId) return;
    const bucket = teamsByTournament.get(tournamentId) || [];
    bucket.push(doc);
    teamsByTournament.set(tournamentId, bucket);
  });

  const matchesByTournament = new Map();
  matchDocs.forEach((doc) => {
    const tournamentId = toNonEmptyString(doc?.tournamentId);
    if (!tournamentId) return;
    const bucket = matchesByTournament.get(tournamentId) || [];
    bucket.push(doc);
    matchesByTournament.set(tournamentId, bucket);
  });

  const hydrated = tournamentDocs.map((doc) => hydrateTournament({
    tournamentDoc: doc,
    teamDocs: teamsByTournament.get(doc.$id) || [],
    matchDocs: matchesByTournament.get(doc.$id) || [],
    matchPlayerDocs: [],
  }));

  return hydrated
    .filter((item) => (
      normalizedStatuses.length === 0
      || normalizedStatuses.includes(toNonEmptyString(item?.status).toLowerCase())
    ))
    .slice(0, limit)
    .map((item) => ({
      id: item.id,
      appwriteId: item.appwriteId,
      immutableTournamentId: item.immutableTournamentId || item.legacyTournamentId || item.appwriteId || item.id,
      groupId: item.groupId,
      legacyTournamentId: item.legacyTournamentId,
      name: item.name,
      date: item.date,
      teams: Array.isArray(item.teams) ? item.teams : [],
      teamsCount: Array.isArray(item.teams) ? item.teams.length : 0,
      fixtures: [],
      bracket: [],
      finalMatch: null,
      champion: item.champion || null,
      aiSummaries: [],
      swapHistory: [],
      format: item.format || '1',
      gameMode: item.gameMode || 'doubles',
      tournamentFormat: item.tournamentFormat || 'league',
      status: item.status || 'active',
      oddPlayerEnabled: Boolean(item.oddPlayerEnabled),
      oddPlayerName: toNonEmptyString(item.oddPlayerName),
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      optimisticVersion: item.optimisticVersion || item.updatedAt || item.createdAt || null,
      isSummary: true,
    }));
};

export const getTournamentById = async (tournamentId, groupId = null) => {
  ensureV2Configured();
  const resolvedGroupId = toGroupId(groupId);
  const doc = await databases.getDocument(DATABASE_ID, COLLECTIONS.TOURNAMENTS_V2, tournamentId);

  if (toNonEmptyString(doc.groupId) !== resolvedGroupId) {
    throw new Error('Tournament not found for this group');
  }
  if (isDeletedTournamentDoc(doc)) {
    return null;
  }

  const [teamDocs, matchDocs] = await Promise.all([
    listByGroupAndValues({
      collectionId: COLLECTIONS.TOURNAMENT_TEAMS_V2,
      groupId: resolvedGroupId,
      key: 'tournamentId',
      values: [doc.$id],
    }),
    listByGroupAndValues({
      collectionId: COLLECTIONS.MATCHES_V2,
      groupId: resolvedGroupId,
      key: 'tournamentId',
      values: [doc.$id],
    }),
  ]);

  const matchPlayerDocs = await listByGroupAndValues({
    collectionId: COLLECTIONS.MATCH_PLAYERS_V2,
    groupId: resolvedGroupId,
    key: 'matchId',
    values: matchDocs.map((row) => row.$id),
  });

  setTournamentChildrenCache(resolvedGroupId, doc.$id, {
    teamRows: teamDocs,
    matchRows: matchDocs,
    participantRows: matchPlayerDocs,
  });

  return hydrateTournament({
    tournamentDoc: doc,
    teamDocs,
    matchDocs,
    matchPlayerDocs,
  });
};

export {
  hydrateTournament,
  buildTournamentDocument,
  mergeTournamentState,
  collectTournamentPlayers,
};
