const getTeamPlayers = (team) => {
  if (!team) return [];
  return [team.player || team.player1, team.player2].filter(Boolean);
};

const formatTeamName = (team) => {
  if (!team) return 'TBD';
  return `${team.emoji || '🏸'} ${team.name || 'Team'}`;
};

const includesPlayer = (team, playerName) => {
  return getTeamPlayers(team).some(
    player => player.toLowerCase() === playerName.toLowerCase()
  );
};

const normalizeWhatsAppPhone = (phone) => {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('00')) return digits.slice(2);
  return digits;
};

const getRoundLabel = (match, tournamentFormat) => {
  if (tournamentFormat === 'league') {
    return `League Round ${match.round || 1}`;
  }
  if (match.round === 'playin') return 'Play-in Match';
  if (match.round === 'quarter') return 'Quarter Final';
  if (match.round === 'semi') return 'Semi Final';
  if (match.round === 'round16') return 'Round of 16';
  if (match.round === 'final') return 'Final';
  if (typeof match.round === 'string' && match.round.startsWith('round')) {
    return `Knockout ${match.round.replace('round', 'Round ')}`;
  }
  return 'Knockout Match';
};

const getFixtureLinesForPlayer = ({ playerName, fixtures, bracket, tournamentFormat }) => {
  if (tournamentFormat === 'league') {
    return (fixtures || [])
      .filter(match => includesPlayer(match.team1, playerName) || includesPlayer(match.team2, playerName))
      .map(match => {
        return `Match ${match.id}: ${formatTeamName(match.team1)} vs ${formatTeamName(match.team2)} (${getRoundLabel(match, tournamentFormat)})`;
      });
  }

  const knockoutMatches = (bracket || []).flat().filter(Boolean);
  return knockoutMatches
    .filter(match => includesPlayer(match.team1, playerName) || includesPlayer(match.team2, playerName))
    .map(match => {
      return `Match ${match.id}: ${formatTeamName(match.team1)} vs ${formatTeamName(match.team2)} (${getRoundLabel(match, tournamentFormat)})`;
    });
};

const buildInviteMessage = ({ playerName, tournamentName, teamName, fixtureLines }) => {
  const fixturesSection = fixtureLines.length > 0
    ? fixtureLines.map((line, index) => `${index + 1}. ${line}`).join('\n')
    : 'Fixture details will be shared soon.';

  return `Hi ${playerName},\n\nYou are invited to play in *${tournamentName}*.\nTeam: *${teamName}*\n\nYour upcoming fixtures:\n${fixturesSection}\n\nPlease confirm your availability.`;
};

export const getInvitablePlayers = ({
  teams = [],
  members = [],
  fixtures = [],
  bracket = [],
  tournamentFormat = 'league',
  tournamentName = 'Badminton Tournament'
}) => {
  const memberMap = new Map(
    members.map(member => [member.name.trim().toLowerCase(), member])
  );

  const players = [];
  teams.forEach(team => {
    getTeamPlayers(team).forEach(playerName => {
      const member = memberMap.get(playerName.trim().toLowerCase());
      const fixtureLines = getFixtureLinesForPlayer({
        playerName,
        fixtures,
        bracket,
        tournamentFormat
      });
      const normalizedPhone = normalizeWhatsAppPhone(member?.phone || '');
      const message = buildInviteMessage({
        playerName,
        tournamentName,
        teamName: team.name || 'Team',
        fixtureLines
      });

      players.push({
        name: playerName,
        teamName: team.name || 'Team',
        phone: member?.phone || '',
        hasPhone: Boolean(normalizedPhone),
        fixtureLines,
        message,
        whatsappLink: normalizedPhone
          ? `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`
          : null,
      });
    });
  });

  return players;
};
