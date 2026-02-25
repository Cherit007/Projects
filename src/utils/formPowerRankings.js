const asNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const trendFromMomentum = (momentum) => {
  if (momentum > 3) return 'up';
  if (momentum < -3) return 'down';
  return 'flat';
};

const trendSymbol = (trend) => {
  if (trend === 'up') return '↑';
  if (trend === 'down') return '↓';
  return '→';
};

const sortHistoryByDate = (history = []) => {
  return [...history].sort((a, b) => {
    const aTime = a?.date ? new Date(a.date).getTime() : 0;
    const bTime = b?.date ? new Date(b.date).getTime() : 0;
    return aTime - bTime;
  });
};

const formatForm = (entries) => entries.map(entry => (entry.result === 'win' ? 'W' : 'L')).join(' ');

const computePlayerPowerProfile = (name, data = {}) => {
  const rating = asNumber(data.rating, 1000);
  const history = sortHistoryByDate(data.history || []);

  const last5Entries = history.slice(-5);
  const last10Entries = history.slice(-10);

  const winsLast5 = last5Entries.filter(item => item.result === 'win').length;
  const winsLast10 = last10Entries.filter(item => item.result === 'win').length;

  const avgRecentRating = last5Entries.length > 0
    ? Math.round(last5Entries.reduce((sum, item) => sum + asNumber(item.newRating, rating), 0) / last5Entries.length)
    : rating;

  const momentum = last5Entries.length > 0
    ? last5Entries.reduce((sum, item) => sum + asNumber(item.change), 0) / last5Entries.length
    : 0;

  const recentWinRate = last5Entries.length > 0 ? winsLast5 / last5Entries.length : 0.5;
  const weightedElo = Math.round(rating * 0.8 + avgRecentRating * 0.2 + momentum * 2);
  const formBonus = Math.round((recentWinRate - 0.5) * 80);
  const powerScore = weightedElo + formBonus;

  const trend = trendFromMomentum(momentum);

  return {
    name,
    rating,
    matchesPlayed: asNumber(data.matchesPlayed, history.length),
    weightedElo,
    powerScore,
    trend,
    trendSymbol: trendSymbol(trend),
    winsLast5,
    winsLast10,
    last5Form: formatForm(last5Entries),
    last10Form: formatForm(last10Entries),
    last5Played: last5Entries.length,
    last10Played: last10Entries.length,
    history,
  };
};

const buildPeriodLeaderboard = (profiles, days) => {
  const now = Date.now();
  const windowMs = days * 24 * 60 * 60 * 1000;

  const rows = profiles
    .map(profile => {
      const entries = profile.history.filter(item => {
        if (!item?.date) return false;
        const time = new Date(item.date).getTime();
        if (Number.isNaN(time)) return false;
        return now - time <= windowMs;
      });

      if (entries.length === 0) return null;

      const wins = entries.filter(item => item.result === 'win').length;
      const losses = entries.length - wins;
      const netChange = entries.reduce((sum, item) => sum + asNumber(item.change), 0);
      const winRate = wins / entries.length;
      const periodScore = Math.round(netChange + wins * 4 + winRate * 20);

      return {
        name: profile.name,
        matches: entries.length,
        wins,
        losses,
        winRate: (winRate * 100).toFixed(1),
        netChange,
        periodScore,
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (b.periodScore !== a.periodScore) return b.periodScore - a.periodScore;
      if (b.netChange !== a.netChange) return b.netChange - a.netChange;
      return a.name.localeCompare(b.name);
    });

  return rows;
};

export const buildFormPowerRankings = (playerRatings = {}) => {
  const profiles = Object.entries(playerRatings)
    .map(([name, data]) => computePlayerPowerProfile(name, data))
    .sort((a, b) => {
      if (b.powerScore !== a.powerScore) return b.powerScore - a.powerScore;
      return a.name.localeCompare(b.name);
    });

  const rankedPlayers = profiles.map((profile, index) => ({ ...profile, rank: index + 1 }));

  return {
    leaderboard: rankedPlayers,
    weeklyLeaderboard: buildPeriodLeaderboard(profiles, 7),
    monthlyLeaderboard: buildPeriodLeaderboard(profiles, 30),
    generatedAt: new Date().toISOString(),
  };
};
