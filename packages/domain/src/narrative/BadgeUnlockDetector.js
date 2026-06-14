export const detectNewlyUnlockedBadges = (beforeBadges = [], afterBadges = []) => {
  const beforeMap = new Map(beforeBadges.map((badge) => [badge.id, badge]));
  return afterBadges
    .filter((badge) => {
      const previous = beforeMap.get(badge.id);
      return badge.earned && !previous?.earned;
    })
    .map((badge) => ({ id: badge.id, title: badge.title, icon: badge.icon || '🏅' }));
};
