const toTimestamp = (value) => {
  const parsed = new Date(value || 0).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
};

export const buildUnifiedHistoryEntries = (tournamentHistory = [], casualMatches = []) => {
  const tournamentEntries = (Array.isArray(tournamentHistory) ? tournamentHistory : []).map((tournament, index) => ({
    type: 'tournament',
    id: tournament.id || tournament.appwriteId || `tournament-${index}`,
    date: tournament.date || tournament.createdAt,
    sortKey: toTimestamp(tournament.date || tournament.createdAt || tournament.completedAt),
    tournament,
  }));

  const casualEntries = (Array.isArray(casualMatches) ? casualMatches : []).map((match, index) => ({
    type: 'casual',
    id: match.id || match.appwriteId || `casual-${index}`,
    date: match.date || match.completedAt || match.createdAt,
    sortKey: toTimestamp(match.date || match.completedAt || match.createdAt),
    match,
  }));

  return [...tournamentEntries, ...casualEntries].sort((left, right) => right.sortKey - left.sortKey);
};

export const countUnifiedHistoryEntries = (tournamentHistory = [], casualMatches = []) => (
  buildUnifiedHistoryEntries(tournamentHistory, casualMatches).length
);
