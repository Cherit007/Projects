import React from 'react';

const StatCard = ({ label, value, tone = 'text-slate-800' }) => (
  <div className="rounded-lg border border-slate-200 bg-white p-2.5 profile-gamification-stat">
    <p className="text-[11px] text-slate-500">{label}</p>
    <p className={`text-sm font-bold ${tone}`}>{value}</p>
  </div>
);

const GamificationPanel = ({ gamification }) => {
  if (!gamification) return null;

  const { level, nextLevel } = gamification;
  const remainingXp = nextLevel ? Math.max(0, nextLevel.minXp - gamification.totalXp) : 0;

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 sm:p-4 mt-4 profile-gamification-panel">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-slate-800">XP & Level</p>
        <span className="text-xs font-semibold px-2 py-1 rounded-full bg-slate-900 text-white">
          {level.icon} {level.name}
        </span>
      </div>

      <div className="mt-3 flex items-end justify-between gap-3">
        <div>
          <p className="text-[11px] text-slate-500">Total XP</p>
          <p className="text-xl font-bold text-slate-800">{gamification.totalXp}</p>
        </div>
        <p className="text-xs text-slate-600 text-right">
          {nextLevel ? `${remainingXp} XP to ${nextLevel.name}` : 'Max level reached'}
        </p>
      </div>

      <div className="mt-2 h-2.5 rounded-full bg-slate-200 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-teal-500 to-blue-600"
          style={{ width: `${gamification.progressPercent}%` }}
        />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
        <StatCard label="Matches XP" value={gamification.matchesPlayed * gamification.breakdown.matchPlayed} />
        <StatCard label="Win Bonus XP" value={gamification.wins * gamification.breakdown.winBonus} tone="text-emerald-700" />
        <StatCard label="Upset XP" value={gamification.upsetWins * gamification.breakdown.upsetWinBonus} tone="text-orange-700" />
        <StatCard label="Streak XP" value={gamification.streakBonusMatches * gamification.breakdown.streakBonus} tone="text-indigo-700" />
      </div>
    </div>
  );
};

export default GamificationPanel;
