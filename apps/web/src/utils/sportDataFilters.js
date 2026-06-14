import { inferCasualMatchSportId, resolveSportId } from '@fixture-maker/domain/sports';

export const resolveRecordSportId = (record) => (
  inferCasualMatchSportId(record)
);

export const filterBySport = (items, sportId) => {
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
  scheduledTournaments = [],
  activeCasualDraft = null,
}) => {
  const history = filterBySport(tournamentHistory, sportId);
  const casual = filterBySport(casualMatches, sportId);
  const live = filterBySport(activeLiveTournaments, sportId);
  const scheduled = filterBySport(scheduledTournaments, sportId);
  const draftInProgress = activeCasualDraft?.sportId === resolveSportId(sportId)
    && activeCasualDraft?.status === 'live'
    ? 1
    : 0;

  return {
    sportId: resolveSportId(sportId),
    completedTournaments: history.length,
    casualMatches: casual.length,
    liveTournaments: live.length,
    inProgressCount: live.length + draftInProgress,
    scheduledTournaments: scheduled.length,
    totalMatches: history.reduce((sum, entry) => {
      const fixtures = Array.isArray(entry?.fixtures) ? entry.fixtures.length : 0;
      return sum + fixtures;
    }, 0) + casual.length,
  };
};

export const buildAllSportHubSummaries = ({
  sports = [],
  tournamentHistory = [],
  casualMatches = [],
  activeLiveTournaments = [],
  scheduledTournaments = [],
  activeCasualDraft = null,
}) => (
  sports.map((sport) => buildSportHubSummary({
    sportId: sport.id,
    tournamentHistory,
    casualMatches,
    activeLiveTournaments,
    scheduledTournaments,
    activeCasualDraft,
  }))
);
