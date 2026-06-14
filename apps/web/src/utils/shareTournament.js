import { formatTournamentDateLabel, normalizeTournamentFormat } from './appHelpers';

const formatTeamLabel = (team, fallbackIndex = 0) => {
  if (!team) return `Team ${fallbackIndex + 1}`;
  if (typeof team === 'string') return team;

  const teamName = String(team?.name || '').trim();
  const player1 = String(team?.player1 || team?.player || '').trim();
  const player2 = String(team?.player2 || '').trim();
  const playerLabel = [player1, player2].filter(Boolean).join(' & ');
  if (teamName && playerLabel && teamName.toLowerCase() !== playerLabel.toLowerCase()) {
    return `${teamName} (${playerLabel})`;
  }
  return teamName || playerLabel || `Team ${fallbackIndex + 1}`;
};

const formatTournamentFormatLabel = (formatValue) => {
  if (formatValue === 'league') return 'League';
  if (formatValue === 'semiFinal') return 'Semi Final';
  if (formatValue === 'fullKnockout') return 'Full Knockout';
  if (formatValue === 'knockoutByes') return 'Knockout (Byes)';
  if (formatValue === 'playInFinal') return 'Play-in + Final';
  return 'Knockout';
};

export const buildTournamentShareMessage = ({
  tournament,
  groupName = '',
  baseUrl = '',
} = {}) => {
  const tournamentLabel = String(tournament?.name || '').trim();
  if (!tournamentLabel) return null;

  const formatValue = normalizeTournamentFormat(
    tournament?.tournamentFormat || tournament?.format || 'league'
  );
  const formatLabel = formatTournamentFormatLabel(formatValue);
  const modeLabel = String(tournament?.gameMode || 'doubles').toLowerCase() === 'singles'
    ? 'Singles'
    : 'Doubles';
  const normalizedTeams = Array.isArray(tournament?.teams) ? tournament.teams : [];
  const teamsCount = normalizedTeams.length > 0
    ? normalizedTeams.length
    : Number(tournament?.teamsCount || 0);
  const dateLabel = formatTournamentDateLabel(tournament?.date, 'To be announced');
  const groupLabel = String(groupName || '').trim();

  const teamLines = normalizedTeams
    .filter(Boolean)
    .map((team, index) => `• 🧑‍🤝‍🧑 ${formatTeamLabel(team, index)}`);

  const leagueFixtureLines = (Array.isArray(tournament?.fixtures) ? tournament.fixtures : [])
    .filter((match) => match?.team1 && match?.team2)
    .map((match, index) => {
      const roundLabel = Number.isFinite(Number(match?.round)) ? `R${Number(match.round)}` : `M${index + 1}`;
      return `• 🏸 ${roundLabel}: ${formatTeamLabel(match.team1, index)} vs ${formatTeamLabel(match.team2, index + 1)}`;
    });

  const bracketFixtureLines = (Array.isArray(tournament?.bracket) ? tournament.bracket : [])
    .flatMap((round, roundIndex) => (Array.isArray(round) ? round : [])
      .filter((match) => match?.team1 && match?.team2)
      .map((match, matchIndex) => (
        `• 🥊 KO R${roundIndex + 1}.${matchIndex + 1}: `
        + `${formatTeamLabel(match.team1, matchIndex)} vs ${formatTeamLabel(match.team2, matchIndex + 1)}`
      )));

  const finalMatch = tournament?.finalMatch;
  const finalMatchLine = finalMatch?.team1 && finalMatch?.team2
    ? `• 🏆 Final: ${formatTeamLabel(finalMatch.team1)} vs ${formatTeamLabel(finalMatch.team2)}`
    : null;

  const fixturesSection = [
    '📋 *Fixture Details*',
    ...(leagueFixtureLines.length > 0
      ? ['🔹 League Fixtures', ...leagueFixtureLines]
      : []),
    ...(bracketFixtureLines.length > 0
      ? ['🔸 Knockout Fixtures', ...bracketFixtureLines]
      : []),
    finalMatchLine,
    leagueFixtureLines.length === 0 && bracketFixtureLines.length === 0 && !finalMatchLine
      ? '• Fixtures will be generated when the tournament starts.'
      : null,
  ].filter(Boolean);

  const appUrl = baseUrl || '';
  const posterUrl = baseUrl ? new URL('pwa-512x512.png', baseUrl).toString() : '';

  const messageLines = [
    '🏸 *Badminton Tournament Invite*',
    `📛 *${tournamentLabel}*`,
    groupLabel ? `👥 Group: ${groupLabel}` : null,
    `🗓️ Date: ${dateLabel}`,
    `🎯 Format: ${formatLabel}`,
    `🎮 Mode: ${modeLabel}`,
    teamsCount > 0 ? `👥 Teams: ${teamsCount}` : null,
    teamLines.length > 0 ? '' : null,
    teamLines.length > 0 ? '🧩 *Teams*' : null,
    ...teamLines,
    '',
    ...fixturesSection,
    appUrl ? '' : null,
    appUrl ? `📲 Open App: ${appUrl}` : null,
    posterUrl ? `🖼️ Poster: ${posterUrl}` : null,
    '',
    '🔥 See you on court!',
  ].filter(Boolean);

  return {
    message: messageLines.join('\n'),
    title: `${tournamentLabel} scheduled`,
    appUrl,
  };
};

export const shareTournamentInvite = async ({
  message,
  title,
  appUrl = '',
  onWhatsAppFallback,
} = {}) => {
  if (!message) {
    return { method: 'error', reason: 'empty-message' };
  }

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({
        title: title || 'Tournament invite',
        text: message,
        ...(appUrl ? { url: appUrl } : {}),
      });
      return { method: 'native-share' };
    } catch (error) {
      if (error?.name === 'AbortError') {
        return { method: 'cancelled' };
      }
    }
  }

  const whatsAppUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
  if (typeof window !== 'undefined') {
    window.open(whatsAppUrl, '_blank', 'noopener,noreferrer');
    if (typeof onWhatsAppFallback === 'function') {
      onWhatsAppFallback();
    }
    return { method: 'whatsapp' };
  }

  return { method: 'error', reason: 'unsupported-platform' };
};

export const getAppBaseUrl = () => {
  if (typeof window === 'undefined') return '';
  return new URL(import.meta.env.BASE_URL || '/', window.location.origin).toString();
};
