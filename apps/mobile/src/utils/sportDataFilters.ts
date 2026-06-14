import { inferCasualMatchSportId, resolveSportId } from '@fixture-maker/domain/sports';

export const resolveRecordSportId = (record: { sportId?: string } | null | undefined) => (
  inferCasualMatchSportId(record)
);

export const filterBySport = <T extends { sportId?: string }>(
  items: T[] | null | undefined,
  sportId: string,
) => {
  const target = resolveSportId(sportId);
  return (Array.isArray(items) ? items : []).filter(
    (item) => resolveRecordSportId(item) === target,
  );
};

export const buildSportHubSummary = ({
  sportId,
  tournamentHistory = [],
  casualMatches = [],
  activeLiveTournaments = [],
}: {
  sportId: string;
  tournamentHistory?: Array<{ sportId?: string; fixtures?: unknown[] }>;
  casualMatches?: Array<{ sportId?: string }>;
  activeLiveTournaments?: Array<{ sportId?: string }>;
}) => {
  const history = filterBySport(tournamentHistory, sportId);
  const casual = filterBySport(casualMatches, sportId);
  const live = filterBySport(activeLiveTournaments, sportId);

  return {
    sportId: resolveSportId(sportId),
    completedTournaments: history.filter((entry) => entry?.fixtures?.length).length,
    casualMatches: casual.length,
    liveTournaments: live.length,
    inProgressCount: live.length,
  };
};
