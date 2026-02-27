import React, { useEffect, useState } from 'react';
import { X, TrendingUp, Trophy, Activity, Clock, Image, CheckCircle2 } from 'lucide-react';
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
  photoUrl = '',
  isLinked = false,
  canEditPhoto = true,
  onUpdatePhoto,
  onClose
}) => {
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [showPhotoEditor, setShowPhotoEditor] = useState(false);

  useEffect(() => {
    setShowAllHistory(false);
  }, [playerName]);

  if (!playerName) return null;

  const history = Array.isArray(profile?.history) ? profile.history : [];
  const unlockedBadges = (achievements?.badges || []).filter(badge => badge.earned);
  const highlightedBadges = unlockedBadges.slice(0, 4);
  const matchesPlayed = profile?.matchesPlayed || history.length || 0;
  const wins = history.filter(match => match.result === 'win').length;
  const losses = history.filter(match => match.result === 'loss').length;
  const winRate = matchesPlayed > 0 ? ((wins / matchesPlayed) * 100).toFixed(1) : '0.0';
  const orderedMatches = [...history].reverse();
  const visibleMatches = showAllHistory ? orderedMatches : orderedMatches.slice(0, 8);

  const handleEditPhoto = () => {
    if (!canEditPhoto || !onUpdatePhoto || !playerName) return;
    setShowPhotoEditor(true);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4 sm:p-5 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-3 mb-2">
              <PlayerAvatar name={playerName} photoUrl={photoUrl} size="xl" className="ring-2 ring-white/70" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 min-w-0">
                  <h3 className="text-lg sm:text-xl font-bold text-white truncate">{playerName}</h3>
                  {isLinked ? (
                    <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 shrink-0">
                      <CheckCircle2 size={12} />
                      Linked
                    </span>
                  ) : (
                    <span className="inline-flex items-center text-[11px] px-2 py-0.5 rounded-full border border-white/40 bg-white/20 text-white/90 shrink-0">
                      Not linked
                    </span>
                  )}
                </div>
                <p className="text-xs sm:text-sm text-blue-100 truncate">
                  {team ? `${team.emoji || '🏸'} ${team.name}` : 'No current team'}
                </p>
                {gamification?.level?.name && (
                  <p className="text-[11px] sm:text-xs text-blue-100 mt-1">
                    {gamification.level.icon} {gamification.level.name} • {gamification.totalXp} XP
                  </p>
                )}
                {highlightedBadges.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {highlightedBadges.map(badge => (
                      <span
                        key={badge.id}
                        className="text-[10px] sm:text-xs bg-white/20 text-white px-2 py-0.5 rounded-full font-semibold"
                      >
                        {badge.icon || '🏅'} {badge.title}
                      </span>
                    ))}
                  </div>
                )}
                <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  <div className="bg-white/20 rounded-lg px-2 py-1 text-white">
                    <p className="text-[10px] uppercase tracking-wide opacity-80">Rating</p>
                    <p className="text-xs sm:text-sm font-bold">{profile?.rating || 1000}</p>
                  </div>
                  <div className="bg-white/20 rounded-lg px-2 py-1 text-white">
                    <p className="text-[10px] uppercase tracking-wide opacity-80">Played</p>
                    <p className="text-xs sm:text-sm font-bold">{matchesPlayed}</p>
                  </div>
                  <div className="bg-white/20 rounded-lg px-2 py-1 text-white">
                    <p className="text-[10px] uppercase tracking-wide opacity-80">Wins</p>
                    <p className="text-xs sm:text-sm font-bold">{wins}</p>
                  </div>
                  <div className="bg-white/20 rounded-lg px-2 py-1 text-white">
                    <p className="text-[10px] uppercase tracking-wide opacity-80">Win %</p>
                    <p className="text-xs sm:text-sm font-bold">{winRate}%</p>
                  </div>
                </div>
              </div>
            </div>
            {canEditPhoto && (
              <button
                type="button"
                onClick={handleEditPhoto}
                className="text-[11px] sm:text-xs bg-white/20 text-white px-2.5 py-1 rounded-full font-semibold hover:bg-white/30 transition-all flex items-center gap-1"
              >
                <Image size={12} />
                Edit Photo
              </button>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close profile"
            className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-lg transition-all"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-4 sm:p-5 overflow-y-auto max-h-[calc(85vh-84px)]">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-4">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
              <p className="text-xs text-gray-600 mb-1 flex items-center gap-1"><TrendingUp size={12} /> Rating</p>
              <p className="text-lg font-bold text-blue-700">{profile?.rating || 1000}</p>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-xl p-3">
              <p className="text-xs text-gray-600 mb-1 flex items-center gap-1"><Activity size={12} /> Played</p>
              <p className="text-lg font-bold text-green-700">{matchesPlayed}</p>
            </div>
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
              <p className="text-xs text-gray-600 mb-1 flex items-center gap-1"><Trophy size={12} /> Wins</p>
              <p className="text-lg font-bold text-emerald-700">{wins}</p>
            </div>
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-3">
              <p className="text-xs text-gray-600 mb-1">Win Rate</p>
              <p className="text-lg font-bold text-purple-700">{winRate}%</p>
            </div>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 sm:p-4">
            <p className="text-sm font-semibold text-gray-800 mb-3">Recent Match History</p>
            {orderedMatches.length === 0 ? (
              <p className="text-sm text-gray-500">No match history available yet.</p>
            ) : (
              <>
                <div className="space-y-2">
                  {visibleMatches.map((match, index) => (
                    <div key={`${match.matchId}-${index}`} className="bg-white border border-gray-200 rounded-lg p-2 sm:p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs sm:text-sm font-semibold text-gray-800 truncate">
                          vs {match.opponent || 'Unknown opponent'}
                        </p>
                        <span className={`text-xs font-bold ${match.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {match.change >= 0 ? '+' : ''}{match.change}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-1 text-[11px] sm:text-xs text-gray-500">
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

          <AdvancedProfileInsights advancedStats={advancedStats} />
          <GamificationPanel gamification={gamification} />
          <AchievementsPanel achievements={achievements} />
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
