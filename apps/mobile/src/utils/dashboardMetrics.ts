import { calculateCumulativePlayerStats } from '@fixture-maker/domain/stats';
import { getPlayerLeaderboard, updatePlayerRatingsAfterMatch } from '@fixture-maker/domain/scoring/EloCalculator';
import { filterBySport } from './sportDataFilters';
import { sportUsesEloRatings } from './sportFeatures';

const normalizeCompletedMatch = (match: Record<string, unknown> | null | undefined) => {
  if (!match?.team1 || !match?.team2 || !match?.completed) return null;
  const score1 = Number(match.score1);
  const score2 = Number(match.score2);
  if (!Number.isFinite(score1) || !Number.isFinite(score2) || score1 === score2) return null;
  return { ...match, score1, score2, completed: true as const };
};

type HistoryEntry = {
  fixtures?: unknown[];
  createdAt?: string;
  date?: string;
  updatedAt?: string;
  id?: string;
  appwriteId?: string;
  sportId?: string;
};

type CasualEntry = Record<string, unknown> & {
  createdAt?: string;
  date?: string;
  updatedAt?: string;
  completedAt?: string;
  id?: string;
  appwriteId?: string;
  sportId?: string;
};

export const deriveRatingsFromHistory = ({
  history = [],
  casual = [],
}: {
  history?: HistoryEntry[];
  casual?: CasualEntry[];
} = {}) => {
  const toTimestamp = (value: unknown) => {
    const parsed = Date.parse(String(value || ''));
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const sortByTimeAscending = <T extends { createdAt?: string; date?: string; updatedAt?: string; id?: string; appwriteId?: string }>(
    list: T[] = [],
  ) => [...list].sort((a, b) => {
    const aTime = Math.max(toTimestamp(a.createdAt), toTimestamp(a.updatedAt), toTimestamp(a.date));
    const bTime = Math.max(toTimestamp(b.createdAt), toTimestamp(b.updatedAt), toTimestamp(b.date));
    if (aTime !== bTime) return aTime - bTime;
    return String(a.id || a.appwriteId || '').localeCompare(String(b.id || b.appwriteId || ''));
  });

  let rebuilt: Record<string, { rating: number; matchesPlayed?: number; name?: string }> = {};

  sortByTimeAscending(history).forEach((tournament) => {
    const fallbackCompletedAt = tournament.createdAt || tournament.date || tournament.updatedAt || null;
    (Array.isArray(tournament.fixtures) ? tournament.fixtures : [])
      .map((match) => normalizeCompletedMatch(match as Record<string, unknown>))
      .filter(Boolean)
      .forEach((match) => {
        const completedAt = (match as Record<string, unknown>).completedAt;
        const matchWithDate = completedAt
          ? match
          : { ...match, completedAt: fallbackCompletedAt };
        rebuilt = updatePlayerRatingsAfterMatch(rebuilt, matchWithDate);
      });
  });

  sortByTimeAscending(casual).forEach((match) => {
    const normalized = normalizeCompletedMatch(match);
    if (!normalized) return;
    const fallbackCompletedAt = match.completedAt || match.date || match.createdAt || match.updatedAt || null;
    const matchWithDate = { ...normalized, completedAt: fallbackCompletedAt };
    rebuilt = updatePlayerRatingsAfterMatch(rebuilt, matchWithDate);
  });

  return rebuilt;
};

export const buildDashboardDerivedData = ({
  tournamentHistory = [],
  casualMatches = [],
  sportId,
}: {
  tournamentHistory?: HistoryEntry[];
  casualMatches?: CasualEntry[];
  sportId: string;
}) => {
  const filteredScope = {
    tournamentHistory: filterBySport(tournamentHistory, sportId) as HistoryEntry[],
    casualMatches: filterBySport(casualMatches, sportId) as CasualEntry[],
  };

  const effectiveRatings = deriveRatingsFromHistory({
    history: filteredScope.tournamentHistory,
    casual: filteredScope.casualMatches,
  });

  const eloLeaderboard = sportUsesEloRatings(sportId)
    ? getPlayerLeaderboard(effectiveRatings)
    : [];

  return {
    cumulativeAllTimeStats: calculateCumulativePlayerStats(
      filteredScope.tournamentHistory,
      filteredScope.casualMatches,
    ),
    eloLeaderboard,
    playerRatings: effectiveRatings,
  };
};

export const getTopEloPlayer = (rows: Array<{ name?: string; rating?: number }> = []) => {
  const list = Array.isArray(rows) ? rows : [];
  if (!list.length) return null;
  const sorted = [...list].sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0));
  const top = sorted[0];
  return top?.name ? { name: top.name, rating: Number(top.rating || 1000) } : null;
};

export const formatCasualTeam = (team: Record<string, unknown> | null | undefined) => {
  const name = String(team?.name || '').trim();
  if (name) return name;
  const p1 = String(team?.player || team?.player1 || '').trim();
  const p2 = String(team?.player2 || '').trim();
  return [p1, p2].filter(Boolean).join(' & ') || 'Team';
};

export const formatCasualScoreLine = (match: { score1?: number; score2?: number }) => (
  `${Number(match?.score1 ?? 0)} – ${Number(match?.score2 ?? 0)}`
);
