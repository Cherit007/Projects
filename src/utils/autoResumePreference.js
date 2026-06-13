import { webSessionStorage } from '../platform/storage';
import { SESSION_STORAGE_KEYS } from '../platform/storageKeys';

const normalizeTournamentId = (value) => String(value || '').trim();

export const getAutoResumeSuppressedTournamentId = () => (
  normalizeTournamentId(webSessionStorage.getItem(SESSION_STORAGE_KEYS.AUTO_RESUME_SUPPRESS))
);

export const setAutoResumeSuppressedTournamentId = (tournamentId) => {
  const normalizedTournamentId = normalizeTournamentId(tournamentId);
  if (!normalizedTournamentId) {
    webSessionStorage.removeItem(SESSION_STORAGE_KEYS.AUTO_RESUME_SUPPRESS);
    return;
  }
  webSessionStorage.setItem(SESSION_STORAGE_KEYS.AUTO_RESUME_SUPPRESS, normalizedTournamentId);
};

export const clearAutoResumeSuppressedTournamentId = () => {
  setAutoResumeSuppressedTournamentId('');
};

export const tournamentMatchesAutoResumeSuppression = (
  tournament,
  suppressedTournamentId = getAutoResumeSuppressedTournamentId()
) => {
  const normalizedSuppressedTournamentId = normalizeTournamentId(suppressedTournamentId);
  if (!normalizedSuppressedTournamentId) return false;

  const tournamentIds = [
    tournament?.id,
    tournament?.appwriteId,
    tournament?.legacyTournamentId,
  ]
    .map(normalizeTournamentId)
    .filter(Boolean);

  return tournamentIds.includes(normalizedSuppressedTournamentId);
};
