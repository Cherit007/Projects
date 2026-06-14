import { databases, DATABASE_ID, COLLECTIONS, ID } from '../appwrite/client.js';
import {
  parseSquadJson,
  serializeSquad,
} from '@fixture-maker/domain/sports/boxCricket/squadUtils.js';
import {
  getFreshPlayerLookupCache,
  listByGroup,
  setPlayerLookupCache,
} from './tournamentQueries';
import {
  normalizeName,
  toNonEmptyString,
} from './tournamentUtils';

const ensurePlayersExist = async ({ groupId, names = [], source = 'runtime.tournament' }) => {
  if (!COLLECTIONS.PLAYERS_V2) return new Map();
  const requested = Array.from(
    new Set((Array.isArray(names) ? names : []).map((name) => normalizeName(name)).filter(Boolean))
  );
  if (requested.length === 0) {
    return getFreshPlayerLookupCache(groupId) || new Map();
  }

  let byNormalized = getFreshPlayerLookupCache(groupId);
  if (!byNormalized) {
    const existing = await listByGroup(COLLECTIONS.PLAYERS_V2, groupId);
    byNormalized = new Map();
    existing.forEach((doc) => {
      const normalized = normalizeName(doc?.normalizedName || doc?.displayName);
      if (normalized) byNormalized.set(normalized, doc);
    });
  }

  // One refresh when requested names are not present in cache; this avoids stale-cache misses.
  const missingFromCache = requested.filter((normalized) => !byNormalized.has(normalized));
  if (missingFromCache.length > 0) {
    const existing = await listByGroup(COLLECTIONS.PLAYERS_V2, groupId);
    byNormalized = new Map();
    existing.forEach((doc) => {
      const normalized = normalizeName(doc?.normalizedName || doc?.displayName);
      if (normalized) byNormalized.set(normalized, doc);
    });
  }

  const now = new Date().toISOString();
  for (const rawName of names) {
    const displayName = toNonEmptyString(rawName);
    const normalized = normalizeName(displayName);
    if (!normalized || byNormalized.has(normalized)) continue;

    // eslint-disable-next-line no-await-in-loop
    const created = await databases.createDocument(
      DATABASE_ID,
      COLLECTIONS.PLAYERS_V2,
      ID.unique(),
      {
        groupId,
        displayName,
        normalizedName: normalized,
        source,
        migratedAt: now,
      }
    );

    byNormalized.set(normalized, created);
  }

  setPlayerLookupCache(groupId, byNormalized);
  return byNormalized;
};

const resolvePlayerId = (playerName, playerByNormalized) => {
  const normalized = normalizeName(playerName);
  if (!normalized) return '';
  return toNonEmptyString(playerByNormalized.get(normalized)?.$id);
};

const parseTeamDocument = (doc) => {
  const id = toNonEmptyString(doc?.legacyTeamId) || toNonEmptyString(doc?.teamNo) || toNonEmptyString(doc?.$id);
  const squad = parseSquadJson(doc?.squadJson);
  const player1 = toNonEmptyString(squad[0]?.name || doc?.player1Name);
  const player2 = toNonEmptyString(squad[1]?.name || doc?.player2Name);
  return {
    id,
    name: toNonEmptyString(doc?.teamName) || `Team ${toNonEmptyString(doc?.teamNo) || '?'}`,
    emoji: toNonEmptyString(doc?.emoji) || '🏸',
    player1,
    player: player1,
    player2,
    ...(squad.length > 0 ? { squad } : {}),
  };
};

const buildTeamForMatch = ({
  rowTeamId,
  rowTeamName,
  sidePlayers,
  mappedTeam,
}) => {
  const player1 = toNonEmptyString(sidePlayers[0] || mappedTeam?.player || mappedTeam?.player1);
  const player2 = toNonEmptyString(sidePlayers[1] || mappedTeam?.player2);
  const fallbackName = toNonEmptyString(rowTeamName)
    || toNonEmptyString(mappedTeam?.name)
    || [player1, player2].filter(Boolean).join(' & ')
    || 'Team';

  const id = toNonEmptyString(mappedTeam?.id)
    || toNonEmptyString(rowTeamId)
    || fallbackName;

  return {
    id,
    name: fallbackName,
    emoji: toNonEmptyString(mappedTeam?.emoji) || '🏸',
    player1,
    player: player1,
    player2,
  };
};

const buildTeamRows = ({
  groupId,
  tournamentId,
  legacyTournamentId,
  teams,
  playerByNormalized,
  existingTeamRows,
  optimisticVersion,
}) => {
  const existingByLegacyTeamId = new Map();
  existingTeamRows.forEach((row) => {
    const legacyTeamId = toNonEmptyString(row.legacyTeamId);
    if (!legacyTeamId || existingByLegacyTeamId.has(legacyTeamId)) return;
    existingByLegacyTeamId.set(legacyTeamId, row);
  });

  const rows = [];
  const teamRowIdByLegacyId = new Map();
  const teamRowIdByName = new Map();
  const now = new Date().toISOString();

  (Array.isArray(teams) ? teams : []).forEach((team, index) => {
    const legacyTeamId = toNonEmptyString(team?.id) || String(index + 1);
    const existing = existingByLegacyTeamId.get(legacyTeamId);
    const id = toNonEmptyString(existing?.$id) || ID.unique();
    const teamName = toNonEmptyString(team?.name) || `Team ${index + 1}`;
    const squad = Array.isArray(team?.squad) ? team.squad : [];
    const squadJson = serializeSquad(squad);
    const player1Name = toNonEmptyString(squad[0]?.name || team?.player || team?.player1);
    const player2Name = toNonEmptyString(squad[1]?.name || team?.player2);

    rows.push({
      id,
      data: {
        groupId,
        tournamentId,
        legacyTournamentId,
        legacyTeamId,
        teamNo: String(index + 1),
        teamName,
        emoji: toNonEmptyString(team?.emoji) || '🏸',
        player1Name,
        player1Id: resolvePlayerId(player1Name, playerByNormalized),
        player2Name,
        player2Id: resolvePlayerId(player2Name, playerByNormalized),
        ...(squadJson ? { squadJson } : {}),
        migratedAt: toNonEmptyString(optimisticVersion) || now,
      },
    });

    teamRowIdByLegacyId.set(legacyTeamId, id);
    const normalizedName = normalizeName(teamName);
    if (normalizedName) teamRowIdByName.set(normalizedName, id);
  });

  return {
    rows,
    teamRowIdByLegacyId,
    teamRowIdByName,
  };
};

export {
  ensurePlayersExist,
  resolvePlayerId,
  parseTeamDocument,
  buildTeamForMatch,
  buildTeamRows,
};
