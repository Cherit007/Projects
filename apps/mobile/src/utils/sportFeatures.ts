import { getSport, resolveSportId } from '@fixture-maker/domain/sports';

export const sportUsesEloRatings = (sportId: string) => {
  const sport = getSport(resolveSportId(sportId));
  return sport.participantModel !== 'squad';
};
