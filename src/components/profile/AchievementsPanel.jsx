import React from 'react';

const BadgeItem = ({ badge }) => (
  <div className={`rounded-xl border p-3 profile-badge-item ${badge.earned ? 'bg-emerald-50 border-emerald-200' : 'bg-gray-50 border-gray-200'}`}>
    <div className="flex items-center justify-between gap-2 mb-1">
      <p className={`text-sm font-semibold ${badge.earned ? 'text-emerald-800' : 'text-gray-800'}`}>
        <span className="mr-1">{badge.icon || '🏅'}</span>{badge.title}
      </p>
      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${badge.earned ? 'bg-emerald-600 text-white' : 'bg-gray-200 text-gray-600'}`}>
        {badge.earned ? 'Unlocked' : 'Locked'}
      </span>
    </div>
    <p className="text-xs text-gray-600">{badge.description}</p>
    <p className="text-xs font-semibold text-blue-700 mt-1">{badge.progress}</p>
  </div>
);

const AchievementsPanel = ({ achievements }) => {
  if (!achievements) return null;

  const unlocked = achievements.badges.filter(badge => badge.earned).length;

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 sm:p-4 mt-4 profile-achievements-panel">
      <p className="text-sm font-semibold text-gray-800 mb-3">
        Achievements & Milestones ({unlocked}/{achievements.badges.length})
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {achievements.badges.map(badge => (
          <BadgeItem key={badge.id} badge={badge} />
        ))}
      </div>
    </div>
  );
};

export default AchievementsPanel;
