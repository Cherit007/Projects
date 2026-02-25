const asNumber = (value, fallback = null) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const getTeamPlayers = (team) => [team?.player || team?.player1, team?.player2].filter(Boolean);

const LEVELS = [
  { key: 'beginner', name: 'Beginner', minXp: 0, icon: '🌱' },
  { key: 'amateur', name: 'Amateur', minXp: 120, icon: '🏸' },
  { key: 'pro', name: 'Pro', minXp: 300, icon: '⚡' },
  { key: 'elite', name: 'Elite', minXp: 600, icon: '🔥' },
  { key: 'legend', name: 'Legend', minXp: 1000, icon: '👑' },
];

const XP_RULES = {
  matchPlayed: 10,
  winBonus: 6,
  upsetWinBonus: 10,
  streakBonus: 4,
  streakThreshold: 3,
};

const collectPlayerMatchOutcomes = ({ playerName, tournamentHistory = [], casualMatches = [] }) => {
  const outcomes = [];

  const collectMatch = (match, dateFallback = null) => {
    if (!match?.team1 || !match?.team2) return;

    const score1 = asNumber(match.score1);
    const score2 = asNumber(match.score2);
    if (score1 === null || score2 === null || score1 === score2) return;

    const team1Players = getTeamPlayers(match.team1);
    const team2Players = getTeamPlayers(match.team2);
    const inTeam1 = team1Players.includes(playerName);
    const inTeam2 = team2Players.includes(playerName);
    if (!inTeam1 && !inTeam2) return;

    const won = inTeam1 ? score1 > score2 : score2 > score1;

    outcomes.push({
      date: match.completedAt || match.date || dateFallback || null,
      won,
      upset: Boolean(match.upsetAlert) && won,
    });
  };

  tournamentHistory.forEach((tournament) => {
    const fallbackDate = tournament?.updatedAt || tournament?.date || tournament?.createdAt || null;
    (tournament?.fixtures || []).forEach(match => collectMatch(match, fallbackDate));
    if (tournament?.finalMatch) collectMatch(tournament.finalMatch, fallbackDate);
    (tournament?.bracket || []).forEach((round) => {
      (round || []).forEach(match => collectMatch(match, fallbackDate));
    });
  });

  casualMatches.forEach((match) => {
    collectMatch(match, match?.createdAt || null);
  });

  return outcomes.sort((a, b) => {
    const aTime = a?.date ? new Date(a.date).getTime() : 0;
    const bTime = b?.date ? new Date(b.date).getTime() : 0;
    return aTime - bTime;
  });
};

const getLevelForXp = (xp) => {
  let level = LEVELS[0];
  LEVELS.forEach((entry) => {
    if (xp >= entry.minXp) level = entry;
  });
  return level;
};

const getNextLevel = (xp) => LEVELS.find(level => level.minXp > xp) || null;

export const buildPlayerGamification = ({
  playerName,
  tournamentHistory = [],
  casualMatches = [],
}) => {
  if (!playerName) {
    return {
      totalXp: 0,
      level: LEVELS[0],
      nextLevel: LEVELS[1],
      progressPercent: 0,
      matchesPlayed: 0,
      wins: 0,
      upsetWins: 0,
      streakBonusMatches: 0,
      breakdown: XP_RULES,
    };
  }

  const outcomes = collectPlayerMatchOutcomes({ playerName, tournamentHistory, casualMatches });
  let totalXp = 0;
  let currentStreak = 0;
  let streakBonusMatches = 0;
  let wins = 0;
  let upsetWins = 0;

  outcomes.forEach((match) => {
    totalXp += XP_RULES.matchPlayed;
    if (match.won) {
      wins += 1;
      currentStreak += 1;
      totalXp += XP_RULES.winBonus;
      if (match.upset) {
        upsetWins += 1;
        totalXp += XP_RULES.upsetWinBonus;
      }
      if (currentStreak >= XP_RULES.streakThreshold) {
        streakBonusMatches += 1;
        totalXp += XP_RULES.streakBonus;
      }
    } else {
      currentStreak = 0;
    }
  });

  const level = getLevelForXp(totalXp);
  const nextLevel = getNextLevel(totalXp);
  const currentFloor = level.minXp;
  const nextFloor = nextLevel?.minXp ?? currentFloor;
  const progressInLevel = totalXp - currentFloor;
  const progressSpan = Math.max(1, nextFloor - currentFloor);
  const progressPercent = nextLevel ? Math.min(100, (progressInLevel / progressSpan) * 100) : 100;

  return {
    totalXp,
    level,
    nextLevel,
    progressPercent: Number(progressPercent.toFixed(1)),
    matchesPlayed: outcomes.length,
    wins,
    upsetWins,
    streakBonusMatches,
    breakdown: XP_RULES,
  };
};

export { LEVELS, XP_RULES };
