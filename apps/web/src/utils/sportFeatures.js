import { getSport, resolveSportId } from '@fixture-maker/domain/sports';

/** Squad-based sports (e.g. box cricket) use runs/wins stats, not racket-sport ELO. */
export const sportUsesEloRatings = (sportId) => {
  const sport = getSport(resolveSportId(sportId));
  return sport.participantModel !== 'squad';
};
