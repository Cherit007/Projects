import fs from 'node:fs/promises';
import path from 'node:path';
import { Query } from 'appwrite';

import {
  chunk,
  createDatabasesClient,
  ensureDir,
  fetchCollectionAttributes,
  legacyCollections,
  loadManifest,
  makeDeterministicId,
  normalizedCollections,
  normalizeName,
  nowIso,
  parseArgs,
  readNdjson,
  safeJsonParse,
  sleep,
} from './lib/appwriteMigrationCommon.mjs';

const args = parseArgs(process.argv.slice(2));
const apply = Boolean(args['--apply']);
const backupDir = String(args['--backup-dir'] || '').trim();
const batchSize = Math.max(1, Number(args['--batch-size'] || 100));

if (!backupDir) {
  console.error(
    'Usage: node scripts/migration/backfill-normalized.mjs --backup-dir <dir> [--apply] [--batch-size 100] [--group-id <id>]'
  );
  process.exit(1);
}

const toNonEmptyString = (value) => String(value || '').trim();

const playerNamesFromTeam = (team) => (
  [team?.player || team?.player1, team?.player2]
    .map((name) => toNonEmptyString(name))
    .filter(Boolean)
);

const parseLegacyTournament = (doc) => ({
  legacyId: String(doc.$id || doc.id || ''),
  name: toNonEmptyString(doc.name) || 'Untitled Tournament',
  dateLabel: toNonEmptyString(doc.date),
  status: toNonEmptyString(doc.status) || 'active',
  gameMode: toNonEmptyString(doc.gameMode) || 'doubles',
  tournamentFormat: toNonEmptyString(doc.tournamentFormat) || 'league',
  format: toNonEmptyString(doc.format) || '1',
  oddPlayerEnabled: Boolean(doc.oddPlayerEnabled),
  oddPlayerName: toNonEmptyString(doc.oddPlayerName),
  teams: safeJsonParse(doc.teams, []),
  fixtures: safeJsonParse(doc.fixtures, []),
  bracket: safeJsonParse(doc.bracket, []),
  finalMatch: safeJsonParse(doc.finalMatch, null),
  champion: safeJsonParse(doc.champion, null),
  createdAt: toNonEmptyString(doc.createdAt || doc.$createdAt) || nowIso(),
  updatedAt: toNonEmptyString(doc.$updatedAt || doc.createdAt) || nowIso(),
});

const parseLegacyCasual = (doc) => ({
  legacyId: String(doc.$id || doc.id || ''),
  matchType: toNonEmptyString(doc.matchType) || 'unknown',
  team1: safeJsonParse(doc.team1, {}),
  team2: safeJsonParse(doc.team2, {}),
  score1: toNonEmptyString(doc.score1),
  score2: toNonEmptyString(doc.score2),
  winner: toNonEmptyString(doc.winner),
  date: toNonEmptyString(doc.date || doc.createdAt || doc.$createdAt) || nowIso(),
  createdAt: toNonEmptyString(doc.createdAt || doc.$createdAt) || nowIso(),
});

const resolveDefaultGroupId = ({ appMetaDocs, explicitGroupId }) => {
  if (toNonEmptyString(explicitGroupId)) return toNonEmptyString(explicitGroupId);

  const firstMeta = appMetaDocs[0];
  if (firstMeta) {
    const groups = safeJsonParse(firstMeta.groups, []);
    if (Array.isArray(groups) && groups.length === 1 && toNonEmptyString(groups[0]?.id)) {
      return toNonEmptyString(groups[0].id);
    }
  }

  const fromEnv = toNonEmptyString(process.env.MIGRATION_DEFAULT_GROUP_ID);
  if (fromEnv) return fromEnv;
  return 'legacy-default-group';
};

const loadBackupDocs = async (resolvedBackupDir) => {
  const manifest = await loadManifest(resolvedBackupDir);
  const collections = manifest.collections || {};

  const readAlias = async (alias) => {
    const meta = collections[alias];
    if (!meta?.file) return [];
    return readNdjson(path.join(resolvedBackupDir, meta.file));
  };

  return {
    manifest,
    tournaments: await readAlias('tournaments'),
    casualMatches: await readAlias('casualMatches'),
    players: await readAlias('players'),
    ratings: await readAlias('ratings'),
    appMeta: await readAlias('appMeta'),
  };
};

const registerPlayers = ({ playerRegistry, names, source }) => {
  for (const rawName of names) {
    const displayName = toNonEmptyString(rawName);
    const normalized = normalizeName(displayName);
    if (!normalized) continue;

    const existing = playerRegistry.get(normalized);
    if (existing) {
      existing.sources.add(source);
      continue;
    }

    playerRegistry.set(normalized, {
      displayName,
      normalizedName: normalized,
      sources: new Set([source]),
    });
  }
};

const upsertRows = async ({
  databases,
  databaseId,
  collectionId,
  label,
  rows,
  applyChanges,
  batch,
}) => {
  if (!applyChanges) {
    console.log(`[dry-run] ${label}: ${rows.length} rows`);
    return;
  }

  if (rows.length === 0) {
    console.log(`[apply] ${label}: 0 rows`);
    return;
  }

  const groups = chunk(rows, batch);
  let written = 0;

  for (const group of groups) {
    for (const row of group) {
      let lastError = null;
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        try {
          await databases.upsertDocument(databaseId, collectionId, row.id, row.data);
          lastError = null;
          break;
        } catch (error) {
          lastError = error;
          if (attempt < 3) {
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

const assertNoCollectionIdCollisions = ({ normalized, legacy }) => {
  const legacyById = new Map(
    Object.entries(legacy)
      .filter(([, value]) => Boolean(value))
      .map(([key, value]) => [String(value), key])
  );

  for (const [key, value] of Object.entries(normalized)) {
    const hit = legacyById.get(String(value));
    if (hit) {
      throw new Error(
        `[preflight] ${key} points to legacy collection id "${value}" (${hit}). ` +
        'Set APPWRITE_COLLECTION_V2_* to new normalized collections only.'
      );
    }
  }
};

const assertRequiredAttributes = async ({ config, normalized }) => {
  // Full payload schema expected by the migration writer.
  // This prevents partial writes with "Unknown attribute" errors mid-run.
  const required = {
    playersV2: [
      'groupId',
      'displayName',
      'normalizedName',
      'source',
      'migratedAt',
    ],
    tournamentsV2: [
      'groupId',
      'legacyTournamentId',
      'name',
      'dateLabel',
      'status',
      'gameMode',
      'tournamentFormat',
      'format',
      'oddPlayerEnabled',
      'oddPlayerName',
      'oddPlayerId',
      'sourceCreatedAt',
      'sourceUpdatedAt',
      'migratedAt',
    ],
    tournamentTeamsV2: [
      'groupId',
      'tournamentId',
      'legacyTournamentId',
      'legacyTeamId',
      'teamNo',
      'teamName',
      'emoji',
      'player1Name',
      'player1Id',
      'player2Name',
      'player2Id',
      'migratedAt',
    ],
    matchesV2: [
      'groupId',
      'tournamentId',
      'legacyTournamentId',
      'legacyMatchId',
      'matchKind',
      'roundLabel',
      'roundNo',
      'sequenceNo',
      'bracketRoundIndex',
      'bracketMatchIndex',
      'nextLegacyMatchId',
      'team1Id',
      'team2Id',
      'team1Name',
      'team2Name',
      'score1',
      'score2',
      'completed',
      'winnerSide',
      'sourceCreatedAt',
      'migratedAt',
    ],
    matchPlayersV2: [
      'groupId',
      'matchId',
      'sideNo',
      'slotNo',
      'playerName',
      'playerId',
      'sourceCreatedAt',
      'migratedAt',
    ],
    ratingsCurrentV2: [
      'groupId',
      'playerId',
      'playerName',
      'rating',
      'matchesPlayed',
      'lastResult',
      'lastChange',
      'sourceUpdatedAt',
      'migratedAt',
    ],
  };

  for (const [key, collectionId] of Object.entries(normalized)) {
    const attrs = await fetchCollectionAttributes({ config, collectionId });
    const attrSet = new Set(attrs.map((attr) => String(attr?.key || '').trim()).filter(Boolean));
    const missing = (required[key] || []).filter((field) => !attrSet.has(field));
    if (missing.length > 0) {
      throw new Error(
        `[preflight] Collection ${key} (${collectionId}) is missing required attributes: ${missing.join(', ')}`
      );
    }
  }
};

const run = async () => {
  const resolvedBackupDir = path.resolve(backupDir);
  const loaded = await loadBackupDocs(resolvedBackupDir);
  const parsedTournaments = loaded.tournaments.map(parseLegacyTournament);
  const parsedCasualMatches = loaded.casualMatches.map(parseLegacyCasual);
  const groupId = resolveDefaultGroupId({
    appMetaDocs: loaded.appMeta,
    explicitGroupId: args['--group-id'],
  });

  const playerRegistry = new Map();

  for (const playerDoc of loaded.players) {
    registerPlayers({
      playerRegistry,
      source: 'legacy.players',
      names: safeJsonParse(playerDoc.players, []),
    });
  }

  for (const ratingDoc of loaded.ratings) {
    const ratings = safeJsonParse(ratingDoc.ratings, {});
    registerPlayers({
      playerRegistry,
      source: 'legacy.ratings',
      names: Object.keys(ratings || {}),
    });
  }

  for (const metaDoc of loaded.appMeta) {
    const members = safeJsonParse(metaDoc.members, []);
    registerPlayers({
      playerRegistry,
      source: 'legacy.meta.members',
      names: (Array.isArray(members) ? members : []).map((member) => member?.name),
    });
  }

  for (const tournament of parsedTournaments) {
    const teams = Array.isArray(tournament.teams) ? tournament.teams : [];
    for (const team of teams) {
      registerPlayers({
        playerRegistry,
        source: 'legacy.tournament.teams',
        names: playerNamesFromTeam(team),
      });
    }

    const fixtures = Array.isArray(tournament.fixtures) ? tournament.fixtures : [];
    for (const match of fixtures) {
      registerPlayers({
        playerRegistry,
        source: 'legacy.tournament.fixtures',
        names: [...playerNamesFromTeam(match?.team1), ...playerNamesFromTeam(match?.team2)],
      });
    }

    const bracketRounds = Array.isArray(tournament.bracket) ? tournament.bracket : [];
    for (const round of bracketRounds) {
      for (const match of (Array.isArray(round) ? round : [])) {
        registerPlayers({
          playerRegistry,
          source: 'legacy.tournament.bracket',
          names: [...playerNamesFromTeam(match?.team1), ...playerNamesFromTeam(match?.team2)],
        });
      }
    }

    if (tournament.finalMatch) {
      registerPlayers({
        playerRegistry,
        source: 'legacy.tournament.final',
        names: [...playerNamesFromTeam(tournament.finalMatch?.team1), ...playerNamesFromTeam(tournament.finalMatch?.team2)],
      });
    }
    if (tournament.champion) {
      registerPlayers({
        playerRegistry,
        source: 'legacy.tournament.champion',
        names: playerNamesFromTeam(tournament.champion),
      });
    }
  }

  for (const casual of parsedCasualMatches) {
    registerPlayers({
      playerRegistry,
      source: 'legacy.casual',
      names: [...playerNamesFromTeam(casual.team1), ...playerNamesFromTeam(casual.team2)],
    });
  }

  const playerIdByName = new Map();
  const playerRows = Array.from(playerRegistry.values())
    .sort((a, b) => a.displayName.localeCompare(b.displayName))
    .map((player) => {
      const playerId = makeDeterministicId('pl', `${groupId}|${player.normalizedName}`);
      playerIdByName.set(player.normalizedName, playerId);
      return {
        id: playerId,
        data: {
          groupId,
          displayName: player.displayName,
          normalizedName: player.normalizedName,
          source: Array.from(player.sources).sort().join(','),
          migratedAt: nowIso(),
        },
      };
    });

  const resolvePlayerId = (name) => {
    const normalized = normalizeName(name);
    return playerIdByName.get(normalized) || '';
  };

  const tournamentRows = [];
  const tournamentTeamRows = [];
  const matchRows = [];
  const matchPlayerRows = [];
  const ratingsCurrentRows = [];

  for (const tournament of parsedTournaments) {
    const tournamentId = makeDeterministicId('trn', `${groupId}|${tournament.legacyId}`);
    tournamentRows.push({
      id: tournamentId,
      data: {
        groupId,
        legacyTournamentId: tournament.legacyId,
        name: tournament.name,
        dateLabel: tournament.dateLabel,
        status: tournament.status,
        gameMode: tournament.gameMode,
        tournamentFormat: tournament.tournamentFormat,
        format: tournament.format,
        oddPlayerEnabled: String(Boolean(tournament.oddPlayerEnabled)),
        oddPlayerName: tournament.oddPlayerName,
        oddPlayerId: resolvePlayerId(tournament.oddPlayerName),
        sourceCreatedAt: tournament.createdAt,
        sourceUpdatedAt: tournament.updatedAt,
        migratedAt: nowIso(),
      },
    });

    const teamLookupByLegacyId = new Map();
    const teamLookupByName = new Map();
    const teams = Array.isArray(tournament.teams) ? tournament.teams : [];
    teams.forEach((team, index) => {
      const legacyTeamId = String(team?.id ?? (index + 1));
      const rowId = makeDeterministicId('ttm', `${tournamentId}|${legacyTeamId}|${index}`);
      const teamName = toNonEmptyString(team?.name);
      tournamentTeamRows.push({
        id: rowId,
        data: {
          groupId,
          tournamentId,
          legacyTournamentId: tournament.legacyId,
          legacyTeamId,
          teamNo: String(index + 1),
          teamName,
          emoji: toNonEmptyString(team?.emoji) || '🏸',
          player1Name: toNonEmptyString(team?.player || team?.player1),
          player1Id: resolvePlayerId(team?.player || team?.player1),
          player2Name: toNonEmptyString(team?.player2),
          player2Id: resolvePlayerId(team?.player2),
          migratedAt: nowIso(),
        },
      });

      teamLookupByLegacyId.set(legacyTeamId, rowId);
      if (teamName) teamLookupByName.set(normalizeName(teamName), rowId);
    });

    const appendMatch = ({ match, matchKind, seedSuffix, roundIndex = -1, matchIndex = -1 }) => {
      if (!match?.team1 && !match?.team2) return;

      const legacyMatchId = String(match?.id ?? `${seedSuffix}-${roundIndex}-${matchIndex}`);
      const rowId = makeDeterministicId(
        'mch',
        `${groupId}|${tournament.legacyId}|${matchKind}|${legacyMatchId}|${roundIndex}|${matchIndex}`
      );
      const team1Name = toNonEmptyString(match?.team1?.name);
      const team2Name = toNonEmptyString(match?.team2?.name);
      const team1RefById = toNonEmptyString(match?.team1?.id);
      const team2RefById = toNonEmptyString(match?.team2?.id);
      const team1Id = teamLookupByLegacyId.get(team1RefById) || teamLookupByName.get(normalizeName(team1Name)) || '';
      const team2Id = teamLookupByLegacyId.get(team2RefById) || teamLookupByName.get(normalizeName(team2Name)) || '';

      const score1 = toNonEmptyString(match?.score1);
      const score2 = toNonEmptyString(match?.score2);
      const score1Number = Number(score1);
      const score2Number = Number(score2);
      const hasNumericScores = Number.isFinite(score1Number) && Number.isFinite(score2Number);
      const completed = Boolean(match?.completed) || (hasNumericScores && score1 !== '' && score2 !== '');

      let winnerSide = '';
      if (hasNumericScores && score1Number !== score2Number) {
        winnerSide = score1Number > score2Number ? '1' : '2';
      }

      matchRows.push({
        id: rowId,
        data: {
          groupId,
          tournamentId,
          legacyTournamentId: tournament.legacyId,
          legacyMatchId,
          matchKind,
          roundLabel: toNonEmptyString(match?.round),
          roundNo: toNonEmptyString(match?.round),
          sequenceNo: toNonEmptyString(matchIndex >= 0 ? matchIndex + 1 : ''),
          bracketRoundIndex: toNonEmptyString(roundIndex >= 0 ? roundIndex + 1 : ''),
          bracketMatchIndex: toNonEmptyString(matchIndex >= 0 ? matchIndex + 1 : ''),
          nextLegacyMatchId: toNonEmptyString(match?.nextMatchId),
          team1Id,
          team2Id,
          team1Name,
          team2Name,
          score1,
          score2,
          completed: String(completed),
          winnerSide,
          sourceCreatedAt: tournament.createdAt,
          migratedAt: nowIso(),
        },
      });

      const addParticipant = (team, sideNo, slotNo, rawName) => {
        const playerName = toNonEmptyString(rawName);
        if (!playerName) return;
        const participantId = makeDeterministicId('mps', `${rowId}|${sideNo}|${slotNo}|${playerName}`);
        matchPlayerRows.push({
          id: participantId,
          data: {
            groupId,
            matchId: rowId,
            sideNo: String(sideNo),
            slotNo: String(slotNo),
            playerName,
            playerId: resolvePlayerId(playerName),
            sourceCreatedAt: tournament.createdAt,
            migratedAt: nowIso(),
          },
        });
      };

      addParticipant(match?.team1, 1, 1, match?.team1?.player || match?.team1?.player1);
      addParticipant(match?.team1, 1, 2, match?.team1?.player2);
      addParticipant(match?.team2, 2, 1, match?.team2?.player || match?.team2?.player1);
      addParticipant(match?.team2, 2, 2, match?.team2?.player2);
    };

    (Array.isArray(tournament.fixtures) ? tournament.fixtures : []).forEach((match, matchIndex) => {
      appendMatch({ match, matchKind: 'league', seedSuffix: 'fixture', roundIndex: -1, matchIndex });
    });

    (Array.isArray(tournament.bracket) ? tournament.bracket : []).forEach((round, roundIndex) => {
      (Array.isArray(round) ? round : []).forEach((match, matchIndex) => {
        const label = toNonEmptyString(match?.round).toLowerCase() === 'final' ? 'final' : 'knockout';
        appendMatch({ match, matchKind: label, seedSuffix: 'bracket', roundIndex, matchIndex });
      });
    });

    if (tournament.finalMatch) {
      appendMatch({ match: tournament.finalMatch, matchKind: 'final', seedSuffix: 'final', roundIndex: -1, matchIndex: -1 });
    }
  }

  parsedCasualMatches.forEach((match, index) => {
    const rowId = makeDeterministicId('mch', `${groupId}|casual|${match.legacyId}|${index}`);
    const score1 = toNonEmptyString(match.score1);
    const score2 = toNonEmptyString(match.score2);
    matchRows.push({
      id: rowId,
      data: {
        groupId,
        tournamentId: '',
        legacyTournamentId: '',
        legacyMatchId: match.legacyId,
        matchKind: 'casual',
        roundLabel: '',
        roundNo: '',
        sequenceNo: String(index + 1),
        bracketRoundIndex: '',
        bracketMatchIndex: '',
        nextLegacyMatchId: '',
        team1Id: '',
        team2Id: '',
        team1Name: toNonEmptyString(match.team1?.name),
        team2Name: toNonEmptyString(match.team2?.name),
        score1,
        score2,
        completed: String(true),
        winnerSide: toNonEmptyString(match.winner) === 'team1' ? '1' : (toNonEmptyString(match.winner) === 'team2' ? '2' : ''),
        sourceCreatedAt: match.createdAt,
        migratedAt: nowIso(),
      },
    });

    const addParticipant = (sideNo, slotNo, rawName) => {
      const playerName = toNonEmptyString(rawName);
      if (!playerName) return;
      const participantId = makeDeterministicId('mps', `${rowId}|${sideNo}|${slotNo}|${playerName}`);
      matchPlayerRows.push({
        id: participantId,
        data: {
          groupId,
          matchId: rowId,
          sideNo: String(sideNo),
          slotNo: String(slotNo),
          playerName,
          playerId: resolvePlayerId(playerName),
          sourceCreatedAt: match.createdAt,
          migratedAt: nowIso(),
        },
      });
    };

    addParticipant(1, 1, match.team1?.player || match.team1?.player1);
    addParticipant(1, 2, match.team1?.player2);
    addParticipant(2, 1, match.team2?.player || match.team2?.player1);
    addParticipant(2, 2, match.team2?.player2);
  });

  const ratingsMap = new Map();
  for (const ratingDoc of loaded.ratings) {
    const ratings = safeJsonParse(ratingDoc.ratings, {});
    for (const [name, value] of Object.entries(ratings || {})) {
      const normalized = normalizeName(name);
      if (!normalized) continue;
      const snapshot = value && typeof value === 'object' ? value : {};
      const history = Array.isArray(snapshot.history) ? snapshot.history : [];
      const last = history.length > 0 ? history[history.length - 1] : null;

      ratingsMap.set(normalized, {
        playerName: toNonEmptyString(name),
        rating: Number(snapshot.rating ?? 1000),
        matchesPlayed: Number(snapshot.matchesPlayed ?? history.length ?? 0),
        lastResult: toNonEmptyString(last?.result),
        lastChange: Number(last?.change ?? 0),
        sourceUpdatedAt: toNonEmptyString(last?.date || ratingDoc.updatedAt || ratingDoc.$updatedAt) || nowIso(),
      });
    }
  }

  for (const [normalized, snapshot] of ratingsMap.entries()) {
    const rowId = makeDeterministicId('rtc', `${groupId}|${normalized}`);
    ratingsCurrentRows.push({
      id: rowId,
      data: {
        groupId,
        playerId: resolvePlayerId(snapshot.playerName),
        playerName: snapshot.playerName,
        rating: String(Number.isFinite(snapshot.rating) ? snapshot.rating : 1000),
        matchesPlayed: String(Number.isFinite(snapshot.matchesPlayed) ? snapshot.matchesPlayed : 0),
        lastResult: snapshot.lastResult,
        lastChange: String(Number.isFinite(snapshot.lastChange) ? snapshot.lastChange : 0),
        sourceUpdatedAt: snapshot.sourceUpdatedAt,
        migratedAt: nowIso(),
      },
    });
  }

  const summary = {
    generatedAt: nowIso(),
    backupDir: resolvedBackupDir,
    groupId,
    mode: apply ? 'apply' : 'dry-run',
    counts: {
      playersV2: playerRows.length,
      tournamentsV2: tournamentRows.length,
      tournamentTeamsV2: tournamentTeamRows.length,
      matchesV2: matchRows.length,
      matchPlayersV2: matchPlayerRows.length,
      ratingsCurrentV2: ratingsCurrentRows.length,
    },
  };

  await ensureDir(path.resolve('migration-reports'));
  const summaryPath = path.resolve(
    'migration-reports',
    `backfill-summary-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
  );
  await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2), 'utf8');

  console.log('[backfill] plan summary:', JSON.stringify(summary.counts));
  console.log(`[backfill] summary file: ${summaryPath}`);

  const collectionIds = apply
    ? normalizedCollections()
    : {
        playersV2: process.env.APPWRITE_COLLECTION_V2_PLAYERS || '(not-set)',
        tournamentsV2: process.env.APPWRITE_COLLECTION_V2_TOURNAMENTS || '(not-set)',
        tournamentTeamsV2: process.env.APPWRITE_COLLECTION_V2_TOURNAMENT_TEAMS || '(not-set)',
        matchesV2: process.env.APPWRITE_COLLECTION_V2_MATCHES || '(not-set)',
        matchPlayersV2: process.env.APPWRITE_COLLECTION_V2_MATCH_PLAYERS || '(not-set)',
        ratingsCurrentV2: process.env.APPWRITE_COLLECTION_V2_RATINGS_CURRENT || '(not-set)',
      };

  const legacyCollectionIds = legacyCollections();
  const rowsByCollection = [
    ['playersV2', 'Players V2', playerRows],
    ['tournamentsV2', 'Tournaments V2', tournamentRows],
    ['tournamentTeamsV2', 'Tournament Teams V2', tournamentTeamRows],
    ['matchesV2', 'Matches V2', matchRows],
    ['matchPlayersV2', 'Match Players V2', matchPlayerRows],
    ['ratingsCurrentV2', 'Ratings Current V2', ratingsCurrentRows],
  ];

  if (!apply) {
    for (const [key, label, rows] of rowsByCollection) {
      console.log(`[dry-run] ${label}: ${rows.length} rows -> ${collectionIds[key]}`);
    }
    return;
  }

  const { databases, config } = createDatabasesClient();
  assertNoCollectionIdCollisions({
    normalized: collectionIds,
    legacy: legacyCollectionIds,
  });
  await assertRequiredAttributes({
    config,
    normalized: collectionIds,
  });
  for (const [key, label] of rowsByCollection) {
    const collectionId = collectionIds[key];
    try {
      await databases.listDocuments(config.databaseId, collectionId, [Query.limit(1)]);
    } catch (error) {
      throw new Error(
        `[preflight] Cannot access normalized collection "${label}" (${collectionId}). ${error?.message || error}`
      );
    }
  }

  for (const [key, label, rows] of rowsByCollection) {
    await upsertRows({
      databases,
      databaseId: config.databaseId,
      collectionId: collectionIds[key],
      label,
      rows,
      applyChanges: true,
      batch: batchSize,
    });
  }

  console.log('[backfill] completed successfully');
};

run().catch((error) => {
  console.error('[backfill] failed:', error?.message || error);
  process.exitCode = 1;
});
