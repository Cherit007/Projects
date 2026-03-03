import fs from 'node:fs/promises';
import path from 'node:path';

import {
  createDatabasesClient,
  listAllDocuments,
  normalizedCollections,
  parseArgs,
} from './lib/appwriteMigrationCommon.mjs';

const args = parseArgs(process.argv.slice(2));

const summaryPath = String(args['--summary'] || '').trim();
const runIntegrity = Boolean(args['--integrity']);

if (!summaryPath) {
  console.error(
    'Usage: node scripts/migration/validate-normalized.mjs --summary <migration-reports/backfill-summary-*.json> [--integrity]'
  );
  process.exit(1);
}

const loadSummary = async (filePath) => {
  const payload = await fs.readFile(path.resolve(filePath), 'utf8');
  const json = JSON.parse(payload);
  if (!json?.counts || typeof json.counts !== 'object') {
    throw new Error('Invalid summary file: missing counts');
  }
  return json;
};

const countMismatch = ({ label, expected, actual }) => {
  const ok = Number(expected) === Number(actual);
  const marker = ok ? 'OK' : 'MISMATCH';
  console.log(`[validate] ${label}: ${marker} (expected=${expected}, actual=${actual})`);
  return ok;
};

const run = async () => {
  const summary = await loadSummary(summaryPath);
  const { databases, config } = createDatabasesClient();
  const collections = normalizedCollections();

  const players = await listAllDocuments({
    databases,
    databaseId: config.databaseId,
    collectionId: collections.playersV2,
  });
  const tournaments = await listAllDocuments({
    databases,
    databaseId: config.databaseId,
    collectionId: collections.tournamentsV2,
  });
  const tournamentTeams = await listAllDocuments({
    databases,
    databaseId: config.databaseId,
    collectionId: collections.tournamentTeamsV2,
  });
  const matches = await listAllDocuments({
    databases,
    databaseId: config.databaseId,
    collectionId: collections.matchesV2,
  });
  const matchPlayers = await listAllDocuments({
    databases,
    databaseId: config.databaseId,
    collectionId: collections.matchPlayersV2,
  });
  const ratingsCurrent = await listAllDocuments({
    databases,
    databaseId: config.databaseId,
    collectionId: collections.ratingsCurrentV2,
  });

  const checks = [
    countMismatch({
      label: 'playersV2',
      expected: summary.counts.playersV2,
      actual: players.length,
    }),
    countMismatch({
      label: 'tournamentsV2',
      expected: summary.counts.tournamentsV2,
      actual: tournaments.length,
    }),
    countMismatch({
      label: 'tournamentTeamsV2',
      expected: summary.counts.tournamentTeamsV2,
      actual: tournamentTeams.length,
    }),
    countMismatch({
      label: 'matchesV2',
      expected: summary.counts.matchesV2,
      actual: matches.length,
    }),
    countMismatch({
      label: 'matchPlayersV2',
      expected: summary.counts.matchPlayersV2,
      actual: matchPlayers.length,
    }),
    countMismatch({
      label: 'ratingsCurrentV2',
      expected: summary.counts.ratingsCurrentV2,
      actual: ratingsCurrent.length,
    }),
  ];

  if (runIntegrity) {
    const tournamentIds = new Set(tournaments.map((row) => row.$id));
    const playerIds = new Set(players.map((row) => row.$id));
    const matchIds = new Set(matches.map((row) => row.$id));

    const orphanTeams = tournamentTeams.filter((row) => {
      const tournamentId = String(row.tournamentId || '').trim();
      return tournamentId && !tournamentIds.has(tournamentId);
    });
    const orphanMatches = matches.filter((row) => {
      const tournamentId = String(row.tournamentId || '').trim();
      return tournamentId && !tournamentIds.has(tournamentId);
    });
    const orphanMatchPlayers = matchPlayers.filter((row) => {
      const matchId = String(row.matchId || '').trim();
      return matchId && !matchIds.has(matchId);
    });
    const orphanRatings = ratingsCurrent.filter((row) => {
      const playerId = String(row.playerId || '').trim();
      return playerId && !playerIds.has(playerId);
    });

    const integrityChecks = [
      { label: 'orphan tournament teams', count: orphanTeams.length },
      { label: 'orphan matches', count: orphanMatches.length },
      { label: 'orphan match players', count: orphanMatchPlayers.length },
      { label: 'orphan ratings', count: orphanRatings.length },
    ];

    for (const check of integrityChecks) {
      const ok = check.count === 0;
      checks.push(ok);
      console.log(`[validate] ${check.label}: ${ok ? 'OK' : `MISMATCH (${check.count})`}`);
    }
  }

  if (checks.every(Boolean)) {
    console.log('[validate] PASS');
    return;
  }

  console.log('[validate] FAIL');
  process.exitCode = 1;
};

run().catch((error) => {
  console.error('[validate] failed:', error?.message || error);
  process.exitCode = 1;
});
