const AUTO_RESUME_SUPPRESS_KEY = 'badminton_skip_auto_resume_tournament';

const canUseSessionStorage = () => (
  typeof window !== 'undefined'
  && typeof window.sessionStorage !== 'undefined'
);

const normalizeTournamentId = (value) => String(value || '').trim();

export const getAutoResumeSuppressedTournamentId = () => {
  if (!canUseSessionStorage()) return '';
  try {
    return normalizeTournamentId(window.sessionStorage.getItem(AUTO_RESUME_SUPPRESS_KEY));
  } catch {
    return '';
  }
};

export const setAutoResumeSuppressedTournamentId = (tournamentId) => {
  if (!canUseSessionStorage()) return;
  try {
    const normalizedTournamentId = normalizeTournamentId(tournamentId);
    if (!normalizedTournamentId) {
      window.sessionStorage.removeItem(AUTO_RESUME_SUPPRESS_KEY);
      return;
    }
    window.sessionStorage.setItem(AUTO_RESUME_SUPPRESS_KEY, normalizedTournamentId);
  } catch {
    // Ignore session storage availability issues.
  }
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
