import { databases, DATABASE_ID, COLLECTIONS, ID } from '../appwrite/client.js';
import { matchPatchSchema } from './tournamentSchemas';
import {
  parseMatchStatistics,
  serializeMatchStatistics,
} from '@fixture-maker/domain/sports/matchStatistics.js';
import {
  clearTournamentChildrenCache,
  deleteRows,
  getFreshTournamentChildrenCache,
  listByGroupAndValues,
  setTournamentChildrenCache,
  upsertRows,
} from './tournamentQueries';
import { buildTeamRows, ensurePlayersExist, resolvePlayerId } from './tournamentTeams';
import {
  ensureV2Configured,
  getMatchCompleted,
  getMatchOptimisticVersionMs,
  getMatchOptimisticVersionValue,
  getTournamentOptimisticVersionMs,
  getTournamentOptimisticVersionValue,
  getWinnerSide,
  isDeletedTournamentDoc,
  makeMatchNaturalKey,
  normalizeComparable,
  normalizeName,
  normalizePatchMatchKind,
  parseBoolean,
  parseMaybeNumeric,
  parseScore,
  pickFirstNonEmptyString,
  resolveMatchImmutableId,
  toBooleanString,
  toGroupId,
  toNonEmptyString,
  toNumericString,
  toTimestampMs,
} from './tournamentUtils';
import { buildTeamForMatch } from './tournamentTeams';

const parseMatchDocument = ({ doc, teamByRowId, participantsByMatchId }) => {
  const participantRows = participantsByMatchId.get(doc.$id) || [];
  const side1 = participantRows
    .filter((row) => toNonEmptyString(row.sideNo) === '1')
    .sort((a, b) => Number(a.slotNo || 0) - Number(b.slotNo || 0));
  const side2 = participantRows
    .filter((row) => toNonEmptyString(row.sideNo) === '2')
    .sort((a, b) => Number(a.slotNo || 0) - Number(b.slotNo || 0));

  const team1 = buildTeamForMatch({
    rowTeamId: doc.team1Id,
    rowTeamName: doc.team1Name,
    sidePlayers: side1.map((row) => row.playerName),
    mappedTeam: teamByRowId.get(toNonEmptyString(doc.team1Id)),
  });

  const team2 = buildTeamForMatch({
    rowTeamId: doc.team2Id,
    rowTeamName: doc.team2Name,
    sidePlayers: side2.map((row) => row.playerName),
    mappedTeam: teamByRowId.get(toNonEmptyString(doc.team2Id)),
  });

  const score1 = parseScore(doc.score1);
  const score2 = parseScore(doc.score2);
  const immutableMatchId = pickFirstNonEmptyString(doc.legacyMatchId, doc.$id);
  const optimisticVersion = getMatchOptimisticVersionValue(doc);
  const statistics = parseMatchStatistics(doc.statisticsJson);

  return {
    id: parseMaybeNumeric(immutableMatchId) || toNonEmptyString(doc.$id),
    appwriteId: toNonEmptyString(doc.$id),
    legacyMatchId: immutableMatchId,
    immutableMatchId,
    optimisticVersion,
    updatedAt: optimisticVersion,
    team1,
    team2,
    score1,
    score2,
    completed: parseBoolean(doc.completed),
    completedAt: toNonEmptyString(doc.completedAt),
    round: parseMaybeNumeric(doc.roundNo || doc.roundLabel),
    nextMatchId: parseMaybeNumeric(doc.nextLegacyMatchId),
    ...(statistics ? { statistics } : {}),
    upsetAlert: null,
    preMatchPrediction: null,
  };
};

const sortMatchesBySequence = (a, b) => {
  const aSeq = Number(a?.sequenceNo || 0);
  const bSeq = Number(b?.sequenceNo || 0);
  if (Number.isFinite(aSeq) && Number.isFinite(bSeq) && aSeq !== bSeq) return aSeq - bSeq;
  return toNonEmptyString(a?.$id).localeCompare(toNonEmptyString(b?.$id));
};

const buildMatchAndParticipantRows = ({
  groupId,
  tournamentId,
  legacyTournamentId,
  fixtures,
  bracket,
  finalMatch,
  playerByNormalized,
  teamRowIdByLegacyId,
  teamRowIdByName,
  existingMatchRows,
  existingParticipantsByMatchId,
  optimisticVersion,
}) => {
  const existingMatchByNaturalKey = new Map();
  existingMatchRows.forEach((row) => {
    const key = makeMatchNaturalKey({
      matchKind: row.matchKind,
      legacyMatchId: row.legacyMatchId,
      bracketRoundIndex: row.bracketRoundIndex,
      bracketMatchIndex: row.bracketMatchIndex,
    });
    if (!existingMatchByNaturalKey.has(key)) existingMatchByNaturalKey.set(key, row);
  });

  const matchRows = [];
  const participantRows = [];
  const seenMatchKeys = new Set();
  const now = new Date().toISOString();

  const resolveTeamRowId = (team) => {
    const teamLegacyId = toNonEmptyString(team?.id);
    if (teamLegacyId && teamRowIdByLegacyId.has(teamLegacyId)) {
      return teamRowIdByLegacyId.get(teamLegacyId) || '';
    }

    const normalizedTeamName = normalizeName(team?.name);
    if (normalizedTeamName && teamRowIdByName.has(normalizedTeamName)) {
      return teamRowIdByName.get(normalizedTeamName) || '';
    }

    return '';
  };

  const appendMatch = ({
    match,
    matchKind,
    sequenceNo,
    bracketRoundIndex,
    bracketMatchIndex,
    fallbackLegacyMatchId,
  }) => {
    if (!match?.team1 && !match?.team2) return;

    const existing = existingMatchByNaturalKey.get(makeMatchNaturalKey({
      matchKind,
      legacyMatchId: resolveMatchImmutableId({
        match,
        fallbackLegacyMatchId,
      }),
      bracketRoundIndex: toNonEmptyString(bracketRoundIndex),
      bracketMatchIndex: toNonEmptyString(bracketMatchIndex),
    }));
    const legacyMatchId = resolveMatchImmutableId({
      match,
      existing,
      fallbackLegacyMatchId,
    });
    const roundLabel = toNonEmptyString(match?.round);
    const roundNo = toNonEmptyString(match?.round);
    const sequenceValue = toNonEmptyString(sequenceNo);
    const bracketRoundValue = toNonEmptyString(bracketRoundIndex);
    const bracketMatchValue = toNonEmptyString(bracketMatchIndex);
    const naturalKey = makeMatchNaturalKey({
      matchKind,
      legacyMatchId,
      bracketRoundIndex: bracketRoundValue,
      bracketMatchIndex: bracketMatchValue,
    });

    if (seenMatchKeys.has(naturalKey)) return;
    seenMatchKeys.add(naturalKey);

    const existingRow = existing || existingMatchByNaturalKey.get(naturalKey);
    const id = toNonEmptyString(existingRow?.$id) || ID.unique();
    const score1 = toNumericString(match?.score1);
    const score2 = toNumericString(match?.score2);

    const completedValue = getMatchCompleted(match, score1, score2);
    const completedAt = completedValue
      ? (toNonEmptyString(match?.completedAt) || toNonEmptyString(existingRow?.completedAt))
      : '';
    const matchOptimisticVersion = getMatchOptimisticVersionValue(match)
      || toNonEmptyString(optimisticVersion)
      || getMatchOptimisticVersionValue(existingRow)
      || now;
    const statisticsJson = serializeMatchStatistics(match?.statistics)
      || toNonEmptyString(existingRow?.statisticsJson);

    matchRows.push({
      id,
      data: {
        groupId,
        tournamentId,
        legacyTournamentId,
        legacyMatchId,
        matchKind,
        roundLabel,
        roundNo,
        sequenceNo: sequenceValue,
        bracketRoundIndex: bracketRoundValue,
        bracketMatchIndex: bracketMatchValue,
        nextLegacyMatchId: toNonEmptyString(match?.nextMatchId),
        team1Id: resolveTeamRowId(match?.team1),
        team2Id: resolveTeamRowId(match?.team2),
        team1Name: toNonEmptyString(match?.team1?.name),
        team2Name: toNonEmptyString(match?.team2?.name),
        score1,
        score2,
        completed: toBooleanString(completedValue),
        completedAt,
        winnerSide: getWinnerSide(score1, score2),
        ...(statisticsJson ? { statisticsJson } : {}),
        sourceCreatedAt: toNonEmptyString(existingRow?.sourceCreatedAt) || now,
        migratedAt: matchOptimisticVersion,
      },
    });

    const existingParticipants = existingParticipantsByMatchId.get(id) || [];
    const existingParticipantBySlot = new Map();
    existingParticipants.forEach((row) => {
      const slotKey = `${toNonEmptyString(row.sideNo)}|${toNonEmptyString(row.slotNo)}`;
      if (!slotKey || existingParticipantBySlot.has(slotKey)) return;
      existingParticipantBySlot.set(slotKey, row);
    });

    const addParticipant = (sideNo, slotNo, rawPlayerName) => {
      const playerName = toNonEmptyString(rawPlayerName);
      if (!playerName) return;

      const slotKey = `${sideNo}|${slotNo}`;
      const existingParticipant = existingParticipantBySlot.get(slotKey);
      participantRows.push({
        id: toNonEmptyString(existingParticipant?.$id) || ID.unique(),
        data: {
          groupId,
          matchId: id,
          sideNo: String(sideNo),
          slotNo: String(slotNo),
          playerName,
          playerId: resolvePlayerId(playerName, playerByNormalized),
          sourceCreatedAt: toNonEmptyString(existingParticipant?.sourceCreatedAt) || now,
          migratedAt: matchOptimisticVersion,
        },
      });
    };

    addParticipant(1, 1, match?.team1?.player || match?.team1?.player1);
    addParticipant(1, 2, match?.team1?.player2);
    addParticipant(2, 1, match?.team2?.player || match?.team2?.player1);
    addParticipant(2, 2, match?.team2?.player2);
  };

  (Array.isArray(fixtures) ? fixtures : []).forEach((match, index) => {
    appendMatch({
      match,
      matchKind: 'league',
      sequenceNo: index + 1,
      bracketRoundIndex: '',
      bracketMatchIndex: '',
      fallbackLegacyMatchId: `fixture-${index + 1}`,
    });
  });

  (Array.isArray(bracket) ? bracket : []).forEach((round, roundIndex) => {
    (Array.isArray(round) ? round : []).forEach((match, matchIndex) => {
      const roundLabel = toNonEmptyString(match?.round).toLowerCase();
      appendMatch({
        match,
        matchKind: roundLabel === 'final' ? 'final' : 'knockout',
        sequenceNo: matchIndex + 1,
        bracketRoundIndex: roundIndex + 1,
        bracketMatchIndex: matchIndex + 1,
        fallbackLegacyMatchId: `bracket-${roundIndex + 1}-${matchIndex + 1}`,
      });
    });
  });

  if (finalMatch) {
    appendMatch({
      match: finalMatch,
      matchKind: 'final',
      sequenceNo: 1,
      bracketRoundIndex: '',
      bracketMatchIndex: '',
      fallbackLegacyMatchId: 'final',
    });
  }

  return {
    matchRows,
    participantRows,
  };
};

const syncTournamentChildren = async ({
  groupId,
  tournamentDoc,
  payload,
  playerByNormalized,
}) => {
  const tournamentId = toNonEmptyString(tournamentDoc.$id);
  const legacyTournamentId = toNonEmptyString(tournamentDoc.legacyTournamentId) || tournamentId;
  let existingTeamRows = [];
  let existingMatchRows = [];
  let existingParticipants = [];
  const cachedChildren = getFreshTournamentChildrenCache(groupId, tournamentId);
  if (cachedChildren) {
    existingTeamRows = cachedChildren.teamRows;
    existingMatchRows = cachedChildren.matchRows;
    existingParticipants = cachedChildren.participantRows;
  } else {
    [existingTeamRows, existingMatchRows] = await Promise.all([
      listByGroupAndValues({
        collectionId: COLLECTIONS.TOURNAMENT_TEAMS_V2,
        groupId,
        key: 'tournamentId',
        values: [tournamentId],
      }),
      listByGroupAndValues({
        collectionId: COLLECTIONS.MATCHES_V2,
        groupId,
        key: 'tournamentId',
        values: [tournamentId],
      }),
    ]);

    existingParticipants = await listByGroupAndValues({
      collectionId: COLLECTIONS.MATCH_PLAYERS_V2,
      groupId,
      key: 'matchId',
      values: existingMatchRows.map((row) => row.$id),
    });
  }

  const existingParticipantsByMatchId = new Map();
  existingParticipants.forEach((row) => {
    const key = toNonEmptyString(row.matchId);
    if (!key) return;
    const bucket = existingParticipantsByMatchId.get(key) || [];
    bucket.push(row);
    existingParticipantsByMatchId.set(key, bucket);
  });

  const existingTeamById = new Map();
  existingTeamRows.forEach((row) => {
    const id = toNonEmptyString(row?.$id);
    if (id) existingTeamById.set(id, row);
  });
  const existingMatchById = new Map();
  existingMatchRows.forEach((row) => {
    const id = toNonEmptyString(row?.$id);
    if (id) existingMatchById.set(id, row);
  });
  const existingParticipantById = new Map();
  existingParticipants.forEach((row) => {
    const id = toNonEmptyString(row?.$id);
    if (id) existingParticipantById.set(id, row);
  });

  const { rows: teamRows, teamRowIdByLegacyId, teamRowIdByName } = buildTeamRows({
    groupId,
    tournamentId,
    legacyTournamentId,
    teams: payload.teams,
    playerByNormalized,
    existingTeamRows,
    optimisticVersion: getTournamentOptimisticVersionValue(payload) || getTournamentOptimisticVersionValue(tournamentDoc),
  });

  const { matchRows, participantRows } = buildMatchAndParticipantRows({
    groupId,
    tournamentId,
    legacyTournamentId,
    fixtures: payload.fixtures,
    bracket: payload.bracket,
    finalMatch: payload.finalMatch,
    playerByNormalized,
    teamRowIdByLegacyId,
    teamRowIdByName,
    existingMatchRows,
    existingParticipantsByMatchId,
    optimisticVersion: getTournamentOptimisticVersionValue(payload) || getTournamentOptimisticVersionValue(tournamentDoc),
  });

  teamRows._existingById = existingTeamById;
  matchRows._existingById = existingMatchById;
  participantRows._existingById = existingParticipantById;
  await upsertRows(COLLECTIONS.TOURNAMENT_TEAMS_V2, teamRows);
  await upsertRows(COLLECTIONS.MATCHES_V2, matchRows);
  await upsertRows(COLLECTIONS.MATCH_PLAYERS_V2, participantRows);

  const nextTeamIds = new Set(teamRows.map((row) => row.id));
  const nextMatchIds = new Set(matchRows.map((row) => row.id));
  const nextParticipantIds = new Set(participantRows.map((row) => row.id));

  const staleParticipants = existingParticipants.filter((row) => !nextParticipantIds.has(row.$id));
  const staleMatches = existingMatchRows.filter((row) => !nextMatchIds.has(row.$id));
  const staleTeams = existingTeamRows.filter((row) => !nextTeamIds.has(row.$id));

  await deleteRows(COLLECTIONS.MATCH_PLAYERS_V2, staleParticipants);
  await deleteRows(COLLECTIONS.MATCHES_V2, staleMatches);
  await deleteRows(COLLECTIONS.TOURNAMENT_TEAMS_V2, staleTeams);

  const toCachedDocs = (rows = []) => rows.map((row) => ({
    $id: row.id,
    ...(row.data || {}),
  }));
  setTournamentChildrenCache(groupId, tournamentId, {
    teamRows: toCachedDocs(teamRows),
    matchRows: toCachedDocs(matchRows),
    participantRows: toCachedDocs(participantRows),
  });
};

export const patchTournamentMatches = async (tournamentId, patches = [], groupId = null) => {
  ensureV2Configured();
  const resolvedGroupId = toGroupId(groupId);
  const targetTournamentId = toNonEmptyString(tournamentId);
  const baseSummary = {
    updatedMatches: 0,
    updatedParticipants: 0,
    deletedParticipants: 0,
    missingMatches: 0,
  };
  if (!targetTournamentId) return baseSummary;

  const validatedPatches = (Array.isArray(patches) ? patches : [])
    .map((patch, index) => {
      const parsed = matchPatchSchema.safeParse(patch);
      if (parsed.success) return parsed.data;
      console.warn(`Ignoring invalid tournament match patch at index ${index}.`, parsed.error.flatten());
      return null;
    })
    .filter(Boolean);

  const normalizedPatches = validatedPatches
    .map((patch) => {
      const roundValue = patch?.roundLabel ?? patch?.round ?? patch?.roundNo;
      const matchKind = normalizePatchMatchKind(patch?.matchKind, roundValue);
      const legacyMatchId = pickFirstNonEmptyString(
        patch?.legacyMatchId,
        patch?.immutableMatchId,
        patch?.id,
        patch?.appwriteId
      );
      const bracketRoundIndex = toNonEmptyString(patch?.bracketRoundIndex);
      const bracketMatchIndex = toNonEmptyString(patch?.bracketMatchIndex);
      const key = makeMatchNaturalKey({
        matchKind,
        legacyMatchId,
        bracketRoundIndex,
        bracketMatchIndex,
      });
      if (!legacyMatchId) return null;
      return {
        patch,
        matchKind,
        legacyMatchId,
        bracketRoundIndex,
        bracketMatchIndex,
        key,
      };
    })
    .filter(Boolean);
  if (normalizedPatches.length === 0) return baseSummary;

  const tournamentDoc = await databases.getDocument(DATABASE_ID, COLLECTIONS.TOURNAMENTS_V2, targetTournamentId);
  if (toNonEmptyString(tournamentDoc.groupId) !== resolvedGroupId) {
    throw new Error('Tournament not found for this group');
  }
  if (isDeletedTournamentDoc(tournamentDoc)) {
    return {
      ...baseSummary,
      missingMatches: normalizedPatches.length,
    };
  }

  const [teamRows, existingMatchRows] = await Promise.all([
    listByGroupAndValues({
      collectionId: COLLECTIONS.TOURNAMENT_TEAMS_V2,
      groupId: resolvedGroupId,
      key: 'tournamentId',
      values: [targetTournamentId],
    }),
    listByGroupAndValues({
      collectionId: COLLECTIONS.MATCHES_V2,
      groupId: resolvedGroupId,
      key: 'tournamentId',
      values: [targetTournamentId],
    }),
  ]);

  const matchByNaturalKey = new Map();
  existingMatchRows.forEach((row) => {
    const key = makeMatchNaturalKey({
      matchKind: row.matchKind,
      legacyMatchId: row.legacyMatchId,
      bracketRoundIndex: row.bracketRoundIndex,
      bracketMatchIndex: row.bracketMatchIndex,
    });
    if (key && !matchByNaturalKey.has(key)) matchByNaturalKey.set(key, row);
  });

  const patchTargets = normalizedPatches.map((entry) => ({
    ...entry,
    row: matchByNaturalKey.get(entry.key) || null,
  }));
  const matchedRows = patchTargets
    .map((entry) => entry.row)
    .filter(Boolean);

  if (matchedRows.length === 0) {
    return {
      ...baseSummary,
      missingMatches: normalizedPatches.length,
    };
  }

  const existingParticipants = await listByGroupAndValues({
    collectionId: COLLECTIONS.MATCH_PLAYERS_V2,
    groupId: resolvedGroupId,
    key: 'matchId',
    values: matchedRows.map((row) => row.$id),
  });

  const participantsByMatchId = new Map();
  existingParticipants.forEach((row) => {
    const matchId = toNonEmptyString(row.matchId);
    if (!matchId) return;
    const bucket = participantsByMatchId.get(matchId) || [];
    bucket.push(row);
    participantsByMatchId.set(matchId, bucket);
  });

  const teamRowIdByLegacyId = new Map();
  const teamRowIdByName = new Map();
  teamRows.forEach((row) => {
    const rowId = toNonEmptyString(row?.$id);
    if (!rowId) return;
    const legacyTeamId = toNonEmptyString(row?.legacyTeamId);
    if (legacyTeamId && !teamRowIdByLegacyId.has(legacyTeamId)) {
      teamRowIdByLegacyId.set(legacyTeamId, rowId);
    }
    const normalizedTeamName = normalizeName(row?.teamName);
    if (normalizedTeamName && !teamRowIdByName.has(normalizedTeamName)) {
      teamRowIdByName.set(normalizedTeamName, rowId);
    }
  });

  const resolveTeamRowId = (team, existingTeamId = '') => {
    const teamLegacyId = toNonEmptyString(team?.id);
    if (teamLegacyId && teamRowIdByLegacyId.has(teamLegacyId)) {
      return teamRowIdByLegacyId.get(teamLegacyId) || existingTeamId;
    }
    const normalizedTeamName = normalizeName(team?.name);
    if (normalizedTeamName && teamRowIdByName.has(normalizedTeamName)) {
      return teamRowIdByName.get(normalizedTeamName) || existingTeamId;
    }
    return existingTeamId;
  };

  const playerNames = patchTargets.flatMap(({ patch }) => (
    [
      patch?.team1?.player || patch?.team1?.player1,
      patch?.team1?.player2,
      patch?.team2?.player || patch?.team2?.player1,
      patch?.team2?.player2,
    ].map((name) => toNonEmptyString(name)).filter(Boolean)
  ));
  const playerByNormalized = await ensurePlayersExist({
    groupId: resolvedGroupId,
    names: playerNames,
    source: 'runtime.tournament-match-patch',
  });

  const now = new Date().toISOString();
  const counters = { ...baseSummary };

  for (const target of patchTargets) {
    const { patch, matchKind, legacyMatchId, bracketRoundIndex, bracketMatchIndex, row } = target;
    if (!row) {
      counters.missingMatches += 1;
      // eslint-disable-next-line no-continue
      continue;
    }

    const score1 = Object.prototype.hasOwnProperty.call(patch, 'score1')
      ? toNumericString(patch.score1)
      : toNonEmptyString(row.score1);
    const score2 = Object.prototype.hasOwnProperty.call(patch, 'score2')
      ? toNumericString(patch.score2)
      : toNonEmptyString(row.score2);
    const completed = Object.prototype.hasOwnProperty.call(patch, 'completed')
      ? toBooleanString(patch.completed)
      : toBooleanString(getMatchCompleted({ completed: parseBoolean(row.completed) }, score1, score2));
    const existingCompletedAt = toNonEmptyString(row?.completedAt);
    const patchCompletedAt = Object.prototype.hasOwnProperty.call(patch, 'completedAt')
      ? toNonEmptyString(patch.completedAt)
      : '';
    const resolvedCompletedAt = patchCompletedAt || existingCompletedAt;
    const completedAt = completed === 'true'
      ? (resolvedCompletedAt || now)
      : '';
    const winnerSide = toNonEmptyString(patch?.winnerSide)
      || getWinnerSide(score1, score2)
      || toNonEmptyString(row?.winnerSide);
    const nextMatchVersion = getMatchOptimisticVersionValue(patch)
      || getTournamentOptimisticVersionValue(tournamentDoc)
      || now;
    const incomingPatchUpdatedAtMs = toTimestampMs(nextMatchVersion);
    const existingRowUpdatedAtMs = Math.max(
      getMatchOptimisticVersionMs(row),
      getTournamentOptimisticVersionMs(tournamentDoc)
    );
    if (
      incomingPatchUpdatedAtMs > 0
      && existingRowUpdatedAtMs > 0
      && incomingPatchUpdatedAtMs <= existingRowUpdatedAtMs
    ) {
      continue;
    }

    const nextLegacyMatchId = toNonEmptyString(
      patch?.nextLegacyMatchId ?? patch?.nextMatchId ?? row?.nextLegacyMatchId
    );
    const roundLabel = toNonEmptyString(patch?.roundLabel ?? patch?.round ?? row?.roundLabel);
    const roundNo = toNonEmptyString(patch?.roundNo ?? patch?.round ?? row?.roundNo);

    const nextTeam1Id = resolveTeamRowId(patch?.team1, toNonEmptyString(row?.team1Id));
    const nextTeam2Id = resolveTeamRowId(patch?.team2, toNonEmptyString(row?.team2Id));
    const nextTeam1Name = toNonEmptyString(patch?.team1?.name) || toNonEmptyString(row?.team1Name);
    const nextTeam2Name = toNonEmptyString(patch?.team2?.name) || toNonEmptyString(row?.team2Name);
    const statisticsJson = Object.prototype.hasOwnProperty.call(patch, 'statisticsJson')
      ? toNonEmptyString(patch.statisticsJson)
      : Object.prototype.hasOwnProperty.call(patch, 'statistics')
        ? serializeMatchStatistics(patch.statistics)
        : toNonEmptyString(row?.statisticsJson);

    const matchPayload = {
      groupId: resolvedGroupId,
      tournamentId: targetTournamentId,
      legacyTournamentId: toNonEmptyString(row?.legacyTournamentId || tournamentDoc?.legacyTournamentId || targetTournamentId),
      legacyMatchId,
      matchKind,
      roundLabel,
      roundNo,
      sequenceNo: toNonEmptyString(row?.sequenceNo),
      bracketRoundIndex,
      bracketMatchIndex,
      nextLegacyMatchId,
      team1Id: nextTeam1Id,
      team2Id: nextTeam2Id,
      team1Name: nextTeam1Name,
      team2Name: nextTeam2Name,
      score1,
      score2,
      completed,
      completedAt,
      winnerSide,
      ...(statisticsJson ? { statisticsJson } : {}),
      sourceCreatedAt: toNonEmptyString(row?.sourceCreatedAt) || now,
      migratedAt: nextMatchVersion,
    };

    const isUnchanged = Object.keys(matchPayload).every((key) => (
      normalizeComparable(row?.[key]) === normalizeComparable(matchPayload[key])
    ));
    if (!isUnchanged) {
      // eslint-disable-next-line no-await-in-loop
      await databases.updateDocument(
        DATABASE_ID,
        COLLECTIONS.MATCHES_V2,
        row.$id,
        matchPayload
      );
      counters.updatedMatches += 1;
    }

    const hasTeamPayload = Boolean(patch?.team1 || patch?.team2);
    if (!hasTeamPayload) {
      // eslint-disable-next-line no-continue
      continue;
    }

    const desiredParticipants = [
      { sideNo: '1', slotNo: '1', playerName: toNonEmptyString(patch?.team1?.player || patch?.team1?.player1) },
      { sideNo: '1', slotNo: '2', playerName: toNonEmptyString(patch?.team1?.player2) },
      { sideNo: '2', slotNo: '1', playerName: toNonEmptyString(patch?.team2?.player || patch?.team2?.player1) },
      { sideNo: '2', slotNo: '2', playerName: toNonEmptyString(patch?.team2?.player2) },
    ].filter((participant) => participant.playerName);

    const existingRows = participantsByMatchId.get(row.$id) || [];
    const existingBySlot = new Map();
    existingRows.forEach((participant) => {
      const slotKey = `${toNonEmptyString(participant.sideNo)}|${toNonEmptyString(participant.slotNo)}`;
      if (slotKey && !existingBySlot.has(slotKey)) existingBySlot.set(slotKey, participant);
    });

    const keepSlots = new Set();
    for (const participant of desiredParticipants) {
      const slotKey = `${participant.sideNo}|${participant.slotNo}`;
      keepSlots.add(slotKey);
      const existingParticipant = existingBySlot.get(slotKey);
      const payload = {
        groupId: resolvedGroupId,
        matchId: row.$id,
        sideNo: participant.sideNo,
        slotNo: participant.slotNo,
        playerName: participant.playerName,
        playerId: resolvePlayerId(participant.playerName, playerByNormalized),
        sourceCreatedAt: toNonEmptyString(existingParticipant?.sourceCreatedAt) || now,
        migratedAt: nextMatchVersion,
      };

      if (existingParticipant?.$id) {
        const participantUnchanged = Object.keys(payload).every((key) => (
          normalizeComparable(existingParticipant?.[key]) === normalizeComparable(payload[key])
        ));
        if (!participantUnchanged) {
          // eslint-disable-next-line no-await-in-loop
          await databases.updateDocument(
            DATABASE_ID,
            COLLECTIONS.MATCH_PLAYERS_V2,
            existingParticipant.$id,
            payload
          );
          counters.updatedParticipants += 1;
        }
      } else {
        // eslint-disable-next-line no-await-in-loop
        await databases.createDocument(
          DATABASE_ID,
          COLLECTIONS.MATCH_PLAYERS_V2,
          ID.unique(),
          payload
        );
        counters.updatedParticipants += 1;
      }
    }

    const staleParticipants = existingRows.filter((participant) => {
      const slotKey = `${toNonEmptyString(participant.sideNo)}|${toNonEmptyString(participant.slotNo)}`;
      return !keepSlots.has(slotKey);
    });
    for (const stale of staleParticipants) {
      // eslint-disable-next-line no-await-in-loop
      await databases.deleteDocument(DATABASE_ID, COLLECTIONS.MATCH_PLAYERS_V2, stale.$id);
      counters.deletedParticipants += 1;
    }
  }

  clearTournamentChildrenCache(resolvedGroupId, targetTournamentId);
  return counters;
};

export { syncTournamentChildren, parseMatchDocument, sortMatchesBySequence };
