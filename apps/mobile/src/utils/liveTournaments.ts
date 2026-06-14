type TournamentLike = {
  id?: string;
  appwriteId?: string;
  name?: string;
  status?: string;
  champion?: unknown;
  sportId?: string;
  fixtures?: Array<{ completed?: boolean }>;
};

const isCompletedTournament = (item: TournamentLike) => {
  if (item?.champion) return true;
  const fixtures = Array.isArray(item?.fixtures) ? item.fixtures : [];
  return fixtures.length > 0 && fixtures.every((match) => match?.completed);
};

export const getActiveLiveTournaments = (history: TournamentLike[] = []) => {
  const list = Array.isArray(history) ? history : [];
  return list.filter(
    (item) => item?.status === 'active' && !item?.champion && !isCompletedTournament(item),
  );
};

export const getCompletedTournamentRows = (history: TournamentLike[] = []) => {
  const list = Array.isArray(history) ? history : [];
  return list.filter((item) => isCompletedTournament(item) || item?.status === 'completed');
};
