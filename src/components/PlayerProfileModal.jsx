import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, TrendingUp, Trophy, Activity, Clock, Image, CheckCircle2, ArrowUpRight, ArrowDownRight, Minus, Users } from 'lucide-react';
import AdvancedProfileInsights from './profile/AdvancedProfileInsights';
import AchievementsPanel from './profile/AchievementsPanel';
import GamificationPanel from './profile/GamificationPanel';
import PlayerAvatar from './PlayerAvatar';
import PlayerPhotoEditorModal from './profile/PlayerPhotoEditorModal';

const formatDate = (dateString) => {
  if (!dateString) return 'Unknown';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return date.toLocaleString();
};

const PlayerProfileModal = ({
  playerName,
  profile,
  team,
  advancedStats,
  achievements,
  gamification,
  leaderboardRank = null,
  photoUrl = '',
  isLinked = false,
  canEditPhoto = true,
  onUpdatePhoto,
  onClose
}) => {
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [showPhotoEditor, setShowPhotoEditor] = useState(false);
  const [showInsightsPanel, setShowInsightsPanel] = useState(false);

  useEffect(() => {
    setShowAllHistory(false);
    setShowInsightsPanel(false);
  }, [playerName]);

  const history = Array.isArray(profile?.history) ? profile.history : [];
  const unlockedBadges = (achievements?.badges || []).filter(badge => badge.earned);
  const highlightedBadges = unlockedBadges.slice(0, 4);
  const matchesPlayed = profile?.matchesPlayed || history.length || 0;
  const wins = history.filter(match => match.result === 'win').length;
  const losses = history.filter(match => match.result === 'loss').length;
  const winRate = matchesPlayed > 0 ? ((wins / matchesPlayed) * 100).toFixed(1) : '0.0';
  const sortedHistory = useMemo(() => (
    [...history].sort((left, right) => {
      const leftTime = left?.date ? new Date(left.date).getTime() : 0;
      const rightTime = right?.date ? new Date(right.date).getTime() : 0;
      return leftTime - rightTime;
    })
  ), [history]);
  const orderedMatches = [...sortedHistory].reverse();
  const visibleMatches = showAllHistory ? orderedMatches : orderedMatches.slice(0, 8);
  const recentTen = sortedHistory.slice(-10);
  const recentTenForm = recentTen.map((entry) => (entry?.result === 'win' ? 'W' : 'L'));
  const recentTenWins = recentTenForm.filter((entry) => entry === 'W').length;
  const recentTenLosses = recentTenForm.filter((entry) => entry === 'L').length;
  const latestHistoryEntry = sortedHistory[sortedHistory.length - 1] || null;
  const latestEloDelta = Number(latestHistoryEntry?.change || 0);
  const eloDeltaDirection = latestEloDelta > 0 ? 'up' : latestEloDelta < 0 ? 'down' : 'flat';
  const teamRecord = `${wins}-${losses}`;
  let runningBestWinStreak = 0;
  let runningCurrentWinStreak = 0;
  let currentStreakType = null;
  let currentStreakCount = 0;
  sortedHistory.forEach((entry) => {
    const isWin = entry?.result === 'win';
    runningCurrentWinStreak = isWin ? runningCurrentWinStreak + 1 : 0;
    runningBestWinStreak = Math.max(runningBestWinStreak, runningCurrentWinStreak);
  });
  for (let index = sortedHistory.length - 1; index >= 0; index -= 1) {
    const result = sortedHistory[index]?.result === 'win' ? 'win' : 'loss';
    if (!currentStreakType) {
      currentStreakType = result;
      currentStreakCount = 1;
      continue;
    }
    if (result !== currentStreakType) break;
    currentStreakCount += 1;
  }
  const trendSeries = useMemo(() => {
    if (recentTen.length === 0) return [];
    const totalRecentDelta = recentTen.reduce((sum, entry) => sum + Number(entry?.change || 0), 0);
    let rollingRating = Number(profile?.rating || 1000) - totalRecentDelta;
    return recentTen.map((entry) => {
      const explicit = Number(entry?.newRating);
      if (Number.isFinite(explicit)) {
        rollingRating = explicit;
      } else {
        rollingRating += Number(entry?.change || 0);
      }
      return Math.round(rollingRating);
    });
  }, [recentTen, profile?.rating]);
  const trendMin = trendSeries.length > 0 ? Math.min(...trendSeries) : 0;
  const trendMax = trendSeries.length > 0 ? Math.max(...trendSeries) : 0;
  const trendSpan = Math.max(1, trendMax - trendMin);
  const seasonDelta = trendSeries.length > 1
    ? trendSeries[trendSeries.length - 1] - trendSeries[0]
    : latestEloDelta;
  const seasonDirection = seasonDelta > 0 ? 'up' : seasonDelta < 0 ? 'down' : 'flat';
  const topRivalries = useMemo(() => (
    [...(advancedStats?.headToHead || [])]
      .filter((entry) => Number(entry?.played || 0) >= 2)
      .sort((left, right) => {
        if (right.played !== left.played) return right.played - left.played;
        const leftGap = Math.abs((left?.wins || 0) - (left?.losses || 0));
        const rightGap = Math.abs((right?.wins || 0) - (right?.losses || 0));
        if (leftGap !== rightGap) return leftGap - rightGap;
        return String(left?.name || '').localeCompare(String(right?.name || ''));
      })
      .slice(0, 3)
  ), [advancedStats?.headToHead]);
  const partnerLeaders = useMemo(() => (
    [...(advancedStats?.preferredPartners || [])]
      .filter((entry) => Number(entry?.played || 0) > 0)
      .sort((left, right) => {
        const leftRate = Number(left?.winRate || 0);
        const rightRate = Number(right?.winRate || 0);
        if (rightRate !== leftRate) return rightRate - leftRate;
        if ((right?.played || 0) !== (left?.played || 0)) return (right?.played || 0) - (left?.played || 0);
        return (right?.wins || 0) - (left?.wins || 0);
      })
  ), [advancedStats?.preferredPartners]);
  const bestPartner = partnerLeaders[0] || null;
  const alternatePartners = partnerLeaders.slice(1, 3);
  const hasGlobalRank = Number.isFinite(Number(leaderboardRank));
  const rankBadgeLabel = hasGlobalRank ? `#${Number(leaderboardRank)}` : 'NR';
  const formSummaryLabel = recentTen.length > 0 ? `${recentTenWins}W-${recentTenLosses}L` : 'No form yet';

  const handleEditPhoto = () => {
    if (!canEditPhoto || !onUpdatePhoto || !playerName) return;
    setShowPhotoEditor(true);
  };

  if (!playerName) return null;

  return (
    <div className="fixed inset-0 z-[270] bg-black bg-opacity-50 flex items-center justify-center p-4 player-profile-overlay app-overlay">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden player-profile-shell app-modal-shell flex flex-col">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-3 py-2 sm:px-4 sm:py-2.5 shrink-0">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex items-center gap-2">
              <PlayerAvatar
                name={playerName}
                photoUrl={photoUrl}
                size="xl"
                className="w-10 h-10 sm:w-12 sm:h-12 ring-2 ring-white/70"
              />
              <div className="min-w-0">
                <h3 className="text-sm sm:text-base font-bold text-white truncate">{playerName}</h3>
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-full border border-white/50 bg-white/20 text-white shrink-0">
                    {rankBadgeLabel}
                  </span>
                  {isLinked ? (
                    <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 shrink-0">
                      <CheckCircle2 size={10} />
                      Linked
                    </span>
                  ) : (
                    <span className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-full border border-white/40 bg-white/20 text-white/90 shrink-0">
                      Not linked
                    </span>
                  )}
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label="Close profile"
              className="text-white hover:bg-white hover:bg-opacity-20 p-1.5 rounded-lg transition-all"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="p-4 sm:p-5 overflow-y-auto flex-1 min-h-0 player-profile-content">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center px-2 py-1 rounded-full bg-blue-50 border border-blue-200 text-xs font-semibold text-blue-800">
              {team ? `${team.emoji || '🏸'} ${team.name}` : 'No current team'}
            </span>
            {gamification?.level?.name && (
              <span className="inline-flex items-center px-2 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-xs font-semibold text-indigo-800">
                {gamification.level.icon} {gamification.level.name} • {gamification.totalXp} XP
              </span>
            )}
            {highlightedBadges.slice(0, 2).map((badge) => (
              <span
                key={badge.id}
                className="inline-flex items-center px-2 py-1 rounded-full bg-amber-50 border border-amber-200 text-xs font-semibold text-amber-800"
              >
                {badge.icon || '🏅'} {badge.title}
              </span>
            ))}
            {canEditPhoto && (
              <button
                type="button"
                onClick={handleEditPhoto}
                className="text-xs bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full font-semibold hover:bg-slate-200 transition-all inline-flex items-center gap-1 border border-slate-200"
              >
                <Image size={12} />
                Edit Photo
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-4">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 player-profile-kpi">
              <p className="text-xs text-gray-600 mb-1 flex items-center gap-1"><TrendingUp size={12} /> Rating</p>
              <p className="text-lg font-bold text-blue-700">{profile?.rating || 1000}</p>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-xl p-3 player-profile-kpi">
              <p className="text-xs text-gray-600 mb-1 flex items-center gap-1"><Activity size={12} /> Played</p>
              <p className="text-lg font-bold text-green-700">{matchesPlayed}</p>
            </div>
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 player-profile-kpi">
              <p className="text-xs text-gray-600 mb-1 flex items-center gap-1"><Trophy size={12} /> Record</p>
              <p className="text-lg font-bold text-emerald-700">{teamRecord}</p>
            </div>
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 player-profile-kpi">
              <p className="text-xs text-gray-600 mb-1">Best Win Streak</p>
              <p className="text-lg font-bold text-purple-700">{runningBestWinStreak}</p>
            </div>
          </div>

          <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-3 player-profile-history">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-gray-800">Season Trend</p>
              <span className="text-xs font-bold inline-flex items-center gap-1 text-slate-700">
                {seasonDirection === 'up' && <ArrowUpRight size={12} />}
                {seasonDirection === 'down' && <ArrowDownRight size={12} />}
                {seasonDirection === 'flat' && <Minus size={12} />}
                {seasonDelta > 0 ? '+' : ''}{seasonDelta}
              </span>
            </div>
            {trendSeries.length === 0 ? (
              <p className="text-xs mt-2 text-slate-500">Play matches to build trend.</p>
            ) : (
              <div className="mt-2 flex items-end gap-1 h-14">
                {trendSeries.map((value, index) => {
                  const height = 24 + (((value - trendMin) / trendSpan) * 76);
                  return (
                    <div
                      key={`season-trend-${index}`}
                      className="flex-1 rounded-sm profile-season-bar"
                      style={{ height: `${Math.max(24, Math.min(100, height))}%` }}
                      title={`Match ${index + 1}: ${value}`}
                    />
                  );
                })}
              </div>
            )}
          </div>

          <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-3 player-profile-history">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-gray-800">Form (Last 10)</p>
              <span className="text-xs font-semibold text-slate-600">{formSummaryLabel}</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {recentTenForm.length === 0 ? (
                <span className="text-xs text-slate-500">No recent form available.</span>
              ) : (
                recentTenForm.map((token, index) => (
                  <span
                    key={`form-token-${index}`}
                    className={`inline-flex items-center justify-center w-7 h-7 rounded-md text-xs font-bold profile-form-token ${
                      token === 'W' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-rose-100 text-rose-700 border border-rose-200'
                    }`}
                  >
                    {token}
                  </span>
                ))
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 player-profile-history">
              <p className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                <Users size={14} />
                Rivalries
              </p>
              {topRivalries.length === 0 ? (
                <p className="text-xs text-gray-500 mt-2">No rivalry data yet. Play more repeated opponents.</p>
              ) : (
                <div className="mt-2 space-y-2">
                  {topRivalries.map((rival) => (
                    <div key={`rival-${rival.name}`} className="rounded-lg border border-slate-200 bg-white p-2 profile-rival-card">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-800 truncate">{rival.name}</p>
                        <span className="text-xs font-bold text-slate-600">{rival.played} matches</span>
                      </div>
                      <p className="text-xs text-slate-600 mt-0.5">
                        Record {rival.wins}-{rival.losses} • Win rate {rival.winRate}%
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 player-profile-history">
              <p className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                <Trophy size={14} />
                Best Partner
              </p>
              {!bestPartner ? (
                <p className="text-xs text-gray-500 mt-2">No partner chemistry data yet.</p>
              ) : (
                <div className="mt-2 space-y-2">
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2 profile-partner-card profile-partner-card-best">
                    <p className="text-sm font-bold text-emerald-800 truncate">{bestPartner.name}</p>
                    <p className="text-xs text-emerald-700 mt-0.5">
                      {bestPartner.wins}-{bestPartner.losses} in {bestPartner.played} matches • {bestPartner.winRate}% win rate
                    </p>
                  </div>
                  {alternatePartners.length > 0 && (
                    <div className="space-y-1.5">
                      {alternatePartners.map((partner) => (
                        <div key={`partner-${partner.name}`} className="rounded-lg border border-slate-200 bg-white p-2 profile-partner-card">
                          <p className="text-sm font-semibold text-slate-800 truncate">{partner.name}</p>
                          <p className="text-xs text-slate-600 mt-0.5">
                            {partner.wins}-{partner.losses} • {partner.winRate}% win rate
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 sm:p-4 player-profile-history">
            <p className="text-sm font-semibold text-gray-800 mb-3 player-profile-history-title">Recent Match History</p>
            {orderedMatches.length === 0 ? (
              <p className="text-sm text-gray-500 player-profile-history-empty">No match history available yet.</p>
            ) : (
              <>
                <div className="space-y-2">
                  {visibleMatches.map((match, index) => (
                    <div key={`${match.matchId}-${index}`} className="bg-white border border-gray-200 rounded-lg p-2 sm:p-3 player-profile-history-item">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs sm:text-sm font-semibold text-gray-800 truncate player-profile-history-opponent">
                          vs {match.opponent || 'Unknown opponent'}
                        </p>
                        <span className={`text-xs font-bold ${match.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {match.change >= 0 ? '+' : ''}{match.change}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-1 text-[11px] sm:text-xs text-gray-500 player-profile-history-meta">
                        <span className={match.result === 'win' ? 'text-green-700 font-semibold' : 'text-red-700 font-semibold'}>
                          {match.result === 'win' ? 'Win' : 'Loss'}
                        </span>
                        <span className="flex items-center gap-1"><Clock size={11} /> {formatDate(match.date)}</span>
                      </div>
                    </div>
                  ))}
                </div>
                {orderedMatches.length > 8 && (
                  <button
                    type="button"
                    onClick={() => setShowAllHistory(prev => !prev)}
                    className="mt-3 text-sm font-semibold text-blue-700 hover:text-blue-900 hover:underline"
                  >
                    {showAllHistory ? 'Show less' : `See more (${orderedMatches.length - 8} more)`}
                  </button>
                )}
              </>
            )}
          </div>

          <div className="mt-4 mb-2 flex justify-end">
            <button
              type="button"
              onClick={() => setShowInsightsPanel((prev) => !prev)}
              className="text-xs sm:text-sm bg-slate-100 text-slate-700 px-3 py-1.5 rounded-full font-semibold hover:bg-slate-200 transition-all border border-slate-200"
            >
              {showInsightsPanel ? 'Hide Advanced Insights' : 'Show Advanced Insights'}
            </button>
          </div>

          <AnimatePresence initial={false}>
            {showInsightsPanel && (
              <motion.div
                key="profile-insights-panel"
                initial={{ opacity: 0, y: 14, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={{ opacity: 0, y: -10, height: 0 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className="overflow-hidden space-y-4"
              >
                <AdvancedProfileInsights advancedStats={advancedStats} />
                <GamificationPanel gamification={gamification} />
                <AchievementsPanel achievements={achievements} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      {showPhotoEditor && (
        <PlayerPhotoEditorModal
          playerName={playerName}
          onSave={(dataUrl) => {
            onUpdatePhoto?.(playerName, dataUrl);
            setShowPhotoEditor(false);
          }}
          onClose={() => setShowPhotoEditor(false)}
        />
      )}
    </div>
  );
};

export default PlayerProfileModal;
