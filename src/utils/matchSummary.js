export const detectNewlyUnlockedBadges = (beforeBadges = [], afterBadges = []) => {
  const beforeMap = new Map(beforeBadges.map((badge) => [badge.id, badge]));
  return afterBadges
    .filter((badge) => {
      const previous = beforeMap.get(badge.id);
      return badge.earned && !previous?.earned;
    })
    .map((badge) => ({ id: badge.id, title: badge.title, icon: badge.icon || '🏅' }));
};

const formatBadgeUnlocks = (badgeUnlocks = []) => {
  if (badgeUnlocks.length === 0) return '';
  const lines = badgeUnlocks.map((unlock) => `- ${unlock.icon} ${unlock.player}: ${unlock.title}`);
  return `\n\nBadge updates:\n${lines.join('\n')}`;
};

export const buildAiMatchSummary = ({
  match,
  tournamentName = 'Tournament',
  tournamentFormat = 'league',
  prediction,
  upsetAlert,
  pointsTable = [],
  badgeUnlocks = [],
  isFinal = false,
}) => {
  if (!match?.team1 || !match?.team2) return null;

  const score1 = Number(match.score1);
  const score2 = Number(match.score2);
  const team1Won = score1 > score2;
  const winner = team1Won ? match.team1 : match.team2;
  const loser = team1Won ? match.team2 : match.team1;
  const margin = Math.abs(score1 - score2);

  const favoriteName = prediction?.favorite === 'team1' ? match.team1.name
    : prediction?.favorite === 'team2' ? match.team2.name
    : null;

  const contextLabel = isFinal
    ? 'Final'
    : tournamentFormat === 'league'
      ? `Round ${match.round || '-'}`
      : 'Knockout';

  const leaderboardSnippet = pointsTable.length > 1
    ? `Top 2 now: ${pointsTable[0].name} (${pointsTable[0].points} pts), ${pointsTable[1].name} (${pointsTable[1].points} pts).`
    : '';

  const upsetLine = upsetAlert
    ? ` Upset alert: ${winner.name} beat the pre-match favorite.`
    : favoriteName
      ? ` Pre-match favorite: ${favoriteName}.`
      : '';

  const title = `${contextLabel}: ${winner.name} def. ${loser.name} ${score1}-${score2}`;
  const narrative = `${winner.name} won by ${margin} point${margin === 1 ? '' : 's'} in ${tournamentName}.${upsetLine} ${leaderboardSnippet}`.trim();

  return {
    id: `summary-${Date.now()}-${match.id || 'match'}`,
    matchId: match.id,
    title,
    narrative: `${narrative}${formatBadgeUnlocks(badgeUnlocks)}`,
    tags: [
      isFinal ? 'Final' : 'Match',
      upsetAlert ? 'Upset' : 'Result',
      badgeUnlocks.length > 0 ? 'Badges' : null,
    ].filter(Boolean),
    createdAt: new Date().toISOString(),
  };
};
