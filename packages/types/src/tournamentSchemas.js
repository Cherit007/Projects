import { z } from 'zod';

const teamPayloadSchema = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  name: z.string().optional(),
  player: z.string().optional(),
  player1: z.string().optional(),
  player2: z.string().optional(),
}).passthrough();

const matchPatchSchema = z.object({
  matchKind: z.string().optional(),
  id: z.union([z.string(), z.number()]).optional(),
  legacyMatchId: z.union([z.string(), z.number()]).optional(),
  immutableMatchId: z.union([z.string(), z.number()]).optional(),
  bracketRoundIndex: z.union([z.string(), z.number()]).optional(),
  bracketMatchIndex: z.union([z.string(), z.number()]).optional(),
  team1: teamPayloadSchema.nullish(),
  team2: teamPayloadSchema.nullish(),
  score1: z.union([z.string(), z.number(), z.null()]).optional(),
  score2: z.union([z.string(), z.number(), z.null()]).optional(),
  completed: z.union([z.boolean(), z.string(), z.number()]).optional(),
  completedAt: z.union([z.string(), z.number(), z.null()]).optional(),
  roundLabel: z.union([z.string(), z.number()]).optional(),
  round: z.union([z.string(), z.number()]).optional(),
  roundNo: z.union([z.string(), z.number()]).optional(),
  nextLegacyMatchId: z.union([z.string(), z.number()]).optional(),
  nextMatchId: z.union([z.string(), z.number()]).optional(),
  sourceUpdatedAt: z.union([z.string(), z.number()]).optional(),
  statisticsJson: z.union([z.string(), z.null()]).optional(),
  statistics: z.record(z.unknown()).optional(),
}).passthrough();

const tournamentDocSchema = z.object({
  $id: z.string(),
  groupId: z.string().optional(),
  legacyTournamentId: z.union([z.string(), z.number()]).optional(),
  name: z.string().optional(),
  dateLabel: z.string().optional(),
  status: z.string().optional(),
  gameMode: z.string().optional(),
  tournamentFormat: z.string().optional(),
  format: z.string().optional(),
  oddPlayerEnabled: z.union([z.boolean(), z.string(), z.number()]).optional(),
  oddPlayerName: z.string().optional(),
  sportId: z.string().optional(),
  ruleConfigJson: z.string().optional(),
  sourceCreatedAt: z.string().optional(),
  sourceUpdatedAt: z.string().optional(),
  migratedAt: z.string().optional(),
  $createdAt: z.string().optional(),
  $updatedAt: z.string().optional(),
}).passthrough();

const tournamentTeamDocSchema = z.object({
  $id: z.string(),
  legacyTeamId: z.union([z.string(), z.number()]).optional(),
  teamNo: z.union([z.string(), z.number()]).optional(),
  teamName: z.string().optional(),
  emoji: z.string().optional(),
  player1Name: z.string().optional(),
  player2Name: z.string().optional(),
  squadJson: z.union([z.string(), z.null()]).optional(),
}).passthrough();

const tournamentMatchDocSchema = z.object({
  $id: z.string(),
  legacyMatchId: z.union([z.string(), z.number()]).optional(),
  matchKind: z.string().optional(),
  roundLabel: z.union([z.string(), z.number()]).optional(),
  roundNo: z.union([z.string(), z.number()]).optional(),
  sequenceNo: z.union([z.string(), z.number()]).optional(),
  bracketRoundIndex: z.union([z.string(), z.number()]).optional(),
  bracketMatchIndex: z.union([z.string(), z.number()]).optional(),
  nextLegacyMatchId: z.union([z.string(), z.number()]).optional(),
  team1Id: z.string().optional(),
  team2Id: z.string().optional(),
  team1Name: z.string().optional(),
  team2Name: z.string().optional(),
  score1: z.union([z.string(), z.number(), z.null()]).optional(),
  score2: z.union([z.string(), z.number(), z.null()]).optional(),
  completed: z.union([z.boolean(), z.string(), z.number()]).optional(),
  completedAt: z.string().optional(),
  winnerSide: z.string().optional(),
  statisticsJson: z.union([z.string(), z.null()]).optional(),
  sourceCreatedAt: z.string().optional(),
  migratedAt: z.string().optional(),
  $createdAt: z.string().optional(),
  $updatedAt: z.string().optional(),
}).passthrough();

const matchParticipantDocSchema = z.object({
  $id: z.string(),
  matchId: z.string().optional(),
  sideNo: z.union([z.string(), z.number()]).optional(),
  slotNo: z.union([z.string(), z.number()]).optional(),
  playerName: z.string().optional(),
}).passthrough();

const parseWithSchema = (schema, value, context, fallback) => {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  console.warn(`Invalid ${context} payload detected. Falling back to safe value.`, result.error.flatten());
  return fallback;
};

const normalizeDocList = (docs, schema, context) => (
  (Array.isArray(docs) ? docs : [])
    .map((doc) => parseWithSchema(
      schema,
      doc,
      context,
      doc && typeof doc === 'object' ? doc : null
    ))
    .filter(Boolean)
);

export {
  teamPayloadSchema,
  matchPatchSchema,
  tournamentDocSchema,
  tournamentTeamDocSchema,
  tournamentMatchDocSchema,
  matchParticipantDocSchema,
  parseWithSchema,
  normalizeDocList,
};
