/**
 * Tournament Service
 * Normalized Appwrite V2 implementation.
 */
import { createTournament, deleteTournament, updateTournament } from './tournament/tournamentPatch';
import { patchTournamentMatches } from './tournament/tournamentMatches';
import {
  getAllTournaments,
  getTournamentById,
  getTournamentSummaries,
} from './tournament/tournamentHydration';

export { patchTournamentMatches } from './tournament/tournamentMatches';
export {
  getAllTournaments,
  getTournamentById,
  getTournamentSummaries,
} from './tournament/tournamentHydration';
export {
  createTournament,
  updateTournament,
  deleteTournament,
} from './tournament/tournamentPatch';

export const tournamentService = {
  createTournament,
  getAllTournaments,
  getTournamentSummaries,
  getTournamentById,
  patchTournamentMatches,
  updateTournament,
  deleteTournament,
};
