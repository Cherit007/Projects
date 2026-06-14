import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, TrendingUp, Trophy, Activity, Clock, Image, CheckCircle2, ArrowUpRight, ArrowDownRight, Minus, Users } from 'lucide-react';
import AdvancedProfileInsights from './profile/AdvancedProfileInsights';
import AchievementsPanel from './profile/AchievementsPanel';
import GamificationPanel from './profile/GamificationPanel';
import PlayerAvatar from './PlayerAvatar';
import PlayerPhotoEditorModal from './profile/PlayerPhotoEditorModal';
import { resolveSportId } from '@fixture-maker/domain/sports';
import { scrollElementToTop } from '../utils/scrollUtils';
import {
  buildPlayerStatsBySport,
  getTeamPlayerNames,
  listSportsWithPlayerActivity,
  resolveDefaultPlayerSportId,
  filterPlayerHistoryForSport,
} from '../utils/playerSportStats';

const formatDate = (dateString) => {
  if (!dateString) return 'Recent';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return 'Recent';
  return date.toLocaleString();
};

const toTimestamp = (value) => {
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
};

const getTeamPlayers = (team, match = null) => getTeamPlayerNames(team, match);

const normalizeResult = (value) => {
  if (value === 'win' || value === 'loss' || value === 'draw') return value;
  return null;
};

const buildHistoryKey = (entry) => {
  const matchId = String(entry?.matchId || '').trim();
  const opponent = String(entry?.opponent || '').trim().toLowerCase();
  const result = normalizeResult(entry?.result) || '';
  if (!matchId && !opponent && !result) return '';
  return `${matchId}|${opponent}|${result}`;
};

const mergeHistoryDates = (profileHistory = [], fallbackHistory = []) => {
  if (!Array.isArray(profileHistory) || profileHistory.length === 0) return fallbackHistory;
  if (!Array.isArray(fallbackHistory) || fallbackHistory.length === 0) return profileHistory;

  const timestamps = profileHistory
    .map((entry) => toTimestamp(entry?.date))
    .filter((value) => Number.isFinite(value) && value > 0);
  const minTime = timestamps.length > 0 ? Math.min(...timestamps) : null;
  const maxTime = timestamps.length > 0 ? Math.max(...timestamps) : null;
  const isSuspiciousCluster = timestamps.length >= 3
    && Number.isFinite(minTime)
    && Number.isFinite(maxTime)
    && maxTime - minTime < 5 * 60 * 1000;

  const fallbackBuckets = new Map();
  fallbackHistory.forEach((entry) => {
    const key = buildHistoryKey(entry);
    if (!key) return;
    if (!fallbackBuckets.has(key)) fallbackBuckets.set(key, []);
    fallbackBuckets.get(key).push(entry);
  });
  fallbackBuckets.forEach((bucket) => bucket.sort((a, b) => toTimestamp(a?.date) - toTimestamp(b?.date)));

  return profileHistory.map((entry) => {
    if (!entry) return entry;
    const needsFallback = !entry.date || isSuspiciousCluster;
    if (!needsFallback) return entry;
    const key = buildHistoryKey(entry);
    if (!key) return entry;
    const bucket = fallbackBuckets.get(key);
    if (!bucket || bucket.length === 0) return entry;
    const fallback = bucket.shift();
    if (!fallback?.date) return entry;
    return { ...entry, date: fallback.date };
  });
};

const buildFallbackHistory = ({ playerName, tournamentHistory = [], casualMatches = [] }) => {
  const normalizedName = String(playerName || '').trim().toLowerCase();
  if (!normalizedName) return [];

  const entries = [];
  const collectMatch = (match, fallbackDate = null, sourcePrefix = 'match', sportId = null) => {
    if (!match?.team1 || !match?.team2) return;
    if (match.completed === false) return;

    const score1 = Number(match?.score1);
    const score2 = Number(match?.score2);
    if (!Number.isFinite(score1) || !Number.isFinite(score2)) return;

    const resolvedSportId = sportId || match?.sportId || 'badminton';
    const team1Players = getTeamPlayers(match.team1, match);
    const team2Players = getTeamPlayers(match.team2, match);
    const inTeam1 = team1Players.some((name) => String(name || '').trim().toLowerCase() === normalizedName);
    const inTeam2 = team2Players.some((name) => String(name || '').trim().toLowerCase() === normalizedName);
    if (!inTeam1 && !inTeam2) return;

    const opponentPlayers = (inTeam1 ? team2Players : team1Players).filter(Boolean);
    const result = inTeam1
      ? (score1 > score2 ? 'win' : score1 < score2 ? 'loss' : 'draw')
      : (score2 > score1 ? 'win' : score2 < score1 ? 'loss' : 'draw');

    const matchId = String(
      match.matchId
      || match.id
      || match.appwriteId
      || `${sourcePrefix}-${entries.length + 1}`
    );

    entries.push({
      matchId,
      opponent: opponentPlayers.join(' & ') || 'Match opponent',
      result,
      change: Number(match?.change || 0),
      date: match.completedAt || match.date || fallbackDate || null,
      sportId: resolvedSportId,
    });
  };

  (Array.isArray(tournamentHistory) ? tournamentHistory : []).forEach((tournament) => {
    const fallbackDate = tournament?.date || tournament?.createdAt || tournament?.updatedAt || null;
    const tournamentSportId = tournament?.sportId || 'badminton';
    (Array.isArray(tournament?.fixtures) ? tournament.fixtures : []).forEach((match) => {
      collectMatch(match, fallbackDate, `fixture-${tournament?.id || tournament?.appwriteId || 't'}`, tournamentSportId);
    });
    (Array.isArray(tournament?.bracket) ? tournament.bracket : [])
      .flatMap((round) => (Array.isArray(round) ? round : []))
      .forEach((match) => {
        collectMatch(match, fallbackDate, `bracket-${tournament?.id || tournament?.appwriteId || 't'}`, tournamentSportId);
      });
    if (tournament?.finalMatch) {
      collectMatch(tournament.finalMatch, fallbackDate, `final-${tournament?.id || tournament?.appwriteId || 't'}`, tournamentSportId);
    }
  });

  (Array.isArray(casualMatches) ? casualMatches : []).forEach((match) => {
    collectMatch(
      match,
      match?.completedAt || match?.date || match?.createdAt || match?.updatedAt || null,
      'casual',
      match?.sportId || 'badminton',
    );
  });

  const deduped = new Map();
  entries.forEach((entry) => {
    const key = [
      String(entry.matchId || '').trim(),
      String(entry.date || '').trim(),
      String(entry.opponent || '').trim().toLowerCase(),
      String(entry.result || '').trim().toLowerCase(),
    ].join('|');
    if (!deduped.has(key)) {
      deduped.set(key, entry);
    }
  });

  return [...deduped.values()].sort((left, right) => toTimestamp(left?.date) - toTimestamp(right?.date));
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
  historyFallback = [],
  tournamentHistory = [],
  casualMatches = [],
  playerRatings = {},
  defaultSportId = null,
  onUpdatePhoto,
  onClose
}) => {
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [showPhotoEditor, setShowPhotoEditor] = useState(false);
  const [showInsightsPanel, setShowInsightsPanel] = useState(false);
  const [selectedSportId, setSelectedSportId] = useState(resolveSportId(defaultSportId));
  const contentRef = useRef(null);

  const statsBySport = useMemo(() => buildPlayerStatsBySport({
    playerName,
    tournamentHistory,
    casualMatches,
    playerRatings,
  }), [playerName, tournamentHistory, casualMatches, playerRatings]);

  const activeSports = useMemo(
    () => listSportsWithPlayerActivity(statsBySport),
    [statsBySport],
  );

  useEffect(() => {
    setShowAllHistory(false);
    setShowInsightsPanel(false);
    const nextSportId = resolveDefaultPlayerSportId({
      defaultSportId,
      statsBySport,
    });
    setSelectedSportId(activeSports.some((sport) => sport.id === nextSportId)
      ? nextSportId
      : (activeSports[0]?.id || nextSportId));
  }, [playerName, defaultSportId, statsBySport, activeSports]);

  useEffect(() => {
    if (!playerName) return undefined;
    scrollElementToTop(contentRef.current);
    if (typeof document === 'undefined') return undefined;
    document.body.classList.add('has-player-profile-open');
    return () => {
      document.body.classList.remove('has-player-profile-open');
    };
  }, [playerName]);

  useEffect(() => {
    if (!playerName) return;
    scrollElementToTop(contentRef.current);
  }, [playerName, selectedSportId]);

  const selectedSportStats = statsBySport[selectedSportId]?.stats || null;
  const selectedSportMeta = statsBySport[selectedSportId] || null;
  const isBoxCricketView = selectedSportId === 'boxCricket';
  const showEloPanels = Boolean(selectedSportMeta?.usesElo && selectedSportStats);

  const profileHistory = Array.isArray(profile?.history) ? profile.history : [];
  const computedFallbackHistory = useMemo(() => {
    if (Array.isArray(historyFallback) && historyFallback.length > 0) {
      return historyFallback;
    }
    return buildFallbackHistory({
      playerName,
      tournamentHistory,
      casualMatches,
    });
  }, [historyFallback, playerName, tournamentHistory, casualMatches]);
  const effectiveHistory = useMemo(() => {
    const sportFallbackHistory = filterPlayerHistoryForSport(computedFallbackHistory, selectedSportId);
    if (showEloPanels && profileHistory.length > 0) {
      const legacyProfileHistory = filterPlayerHistoryForSport(profileHistory, selectedSportId);
      return mergeHistoryDates(legacyProfileHistory, sportFallbackHistory)
        .filter((entry) => filterPlayerHistoryForSport([entry], selectedSportId).length > 0);
    }
    return sportFallbackHistory;
  }, [showEloPanels, profileHistory, computedFallbackHistory, selectedSportId]);
  const unlockedBadges = (achievements?.badges || []).filter(badge => badge.earned);
  const highlightedBadges = unlockedBadges.slice(0, 4);
  const featuredBadge = highlightedBadges[0] || null;
  const matchesPlayed = Math.max(
    Number(selectedSportStats?.matchesPlayed || 0),
    Number(showEloPanels ? profile?.matchesPlayed : 0),
    effectiveHistory.length,
    0,
  );
  const wins = Number(selectedSportStats?.matchesWon ?? effectiveHistory.filter((match) => match.result === 'win').length);
  const losses = Math.max(0, matchesPlayed - wins - effectiveHistory.filter((match) => match.result === 'draw').length);
  const winRate = matchesPlayed > 0 ? ((wins / matchesPlayed) * 100).toFixed(1) : '0.0';
  const sortedHistory = useMemo(() => (
    [...effectiveHistory].sort((left, right) => {
      const leftTime = left?.date ? new Date(left.date).getTime() : 0;
      const rightTime = right?.date ? new Date(right.date).getTime() : 0;
      return leftTime - rightTime;
    })
  ), [effectiveHistory]);
  const orderedMatches = [...sortedHistory].reverse();
  const visibleMatches = showAllHistory ? orderedMatches : orderedMatches.slice(0, 8);
  const recentTen = sortedHistory.slice(-10);
  const recentTenForm = recentTen.map((entry) => {
    const result = normalizeResult(entry?.result);
    if (result === 'win') return 'W';
    if (result === 'loss') return 'L';
    return 'D';
  });
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
    <div className="fixed inset-0 z-[270] bg-black bg-opacity-50 flex items-end sm:items-center justify-center p-0 sm:p-4 player-profile-overlay app-overlay">
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
                  {featuredBadge && (
                    <span className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-full border border-amber-200/85 bg-amber-50 text-amber-800 shrink-0">
                      {featuredBadge.icon || '🏅'} {featuredBadge.title}
                    </span>
                  )}
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

        <div ref={contentRef} className="p-4 sm:p-5 overflow-y-auto flex-1 min-h-0 player-profile-content">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            {activeSports.length > 1 ? (
              <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600">
                Sport
                <select
                  value={selectedSportId}
                  onChange={(event) => setSelectedSportId(event.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm font-semibold text-slate-800"
                >
                  {activeSports.map((sport) => {
                    const sportStats = statsBySport[sport.id]?.stats;
                    const played = Number(sportStats?.matchesPlayed || 0);
                    return (
                      <option key={sport.id} value={sport.id}>
                        {sport.icon} {sport.name} ({played})
                      </option>
                    );
                  })}
                </select>
              </label>
            ) : activeSports.length === 1 ? (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700">
                {activeSports[0].icon} {activeSports[0].name}
              </span>
            ) : (
              <span className="text-xs text-slate-500">No recorded matches yet for this player.</span>
            )}
          </div>

          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center px-2 py-1 rounded-full bg-blue-50 border border-blue-200 text-xs font-semibold text-blue-800">
              {team ? `${team.emoji || '🏸'} ${team.name}` : 'No current team'}
            </span>
            {gamification?.level?.name && (
              <span className="inline-flex items-center px-2 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-xs font-semibold text-indigo-800">
                {gamification.level.icon} {gamification.level.name} • {gamification.totalXp} XP
              </span>
            )}
            {highlightedBadges.slice(featuredBadge ? 1 : 0, 3).map((badge) => (
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

          {isBoxCricketView ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-4">
              <div className="bg-teal-50 border border-teal-200 rounded-xl p-3 player-profile-kpi">
                <p className="text-xs text-gray-600 mb-1">Runs</p>
                <p className="text-lg font-bold text-teal-700">{selectedSportStats?.cricketRuns || 0}</p>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 player-profile-kpi">
                <p className="text-xs text-gray-600 mb-1">Balls</p>
                <p className="text-lg font-bold text-blue-700">{selectedSportStats?.cricketBalls || 0}</p>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 player-profile-kpi">
                <p className="text-xs text-gray-600 mb-1">4s / 6s</p>
                <p className="text-lg font-bold text-amber-700">
                  {selectedSportStats?.cricketFours || 0} / {selectedSportStats?.cricketSixes || 0}
                </p>
              </div>
              <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 player-profile-kpi">
                <p className="text-xs text-gray-600 mb-1">Wickets</p>
                <p className="text-lg font-bold text-purple-700">{selectedSportStats?.cricketWickets || 0}</p>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-xl p-3 player-profile-kpi">
                <p className="text-xs text-gray-600 mb-1 flex items-center gap-1"><Activity size={12} /> Matches</p>
                <p className="text-lg font-bold text-green-700">{matchesPlayed}</p>
              </div>
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 player-profile-kpi">
                <p className="text-xs text-gray-600 mb-1 flex items-center gap-1"><Trophy size={12} /> Won</p>
                <p className="text-lg font-bold text-emerald-700">{wins}</p>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 player-profile-kpi">
                <p className="text-xs text-gray-600 mb-1">Runs conceded</p>
                <p className="text-lg font-bold text-slate-700">{selectedSportStats?.cricketRunsConceded || 0}</p>
              </div>
              <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 player-profile-kpi">
                <p className="text-xs text-gray-600 mb-1">Strike rate</p>
                <p className="text-lg font-bold text-indigo-700">{selectedSportStats?.cricketAverage || '0.0'}</p>
              </div>
            </div>
          ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-4">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 player-profile-kpi">
              <p className="text-xs text-gray-600 mb-1 flex items-center gap-1"><TrendingUp size={12} /> Rating</p>
              <p className="text-lg font-bold text-blue-700">{statsBySport[selectedSportId]?.rating || 1000}</p>
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
              <p className="text-xs text-gray-600 mb-1">Win rate</p>
              <p className="text-lg font-bold text-purple-700">{winRate}%</p>
            </div>
          </div>
          )}

          {showEloPanels && (
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
          )}

          {showEloPanels && (
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
          )}

          {showEloPanels && (
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
          )}

          <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 sm:p-4 player-profile-history">
            <p className="text-sm font-semibold text-gray-800 mb-3 player-profile-history-title">Recent Match History</p>
            {orderedMatches.length === 0 ? (
              <p className="text-sm text-gray-500 player-profile-history-empty">No match history available yet.</p>
            ) : (
              <>
                <div className="space-y-2">
                  {visibleMatches.map((match, index) => (
                    (() => {
                      const delta = Number(match?.change);
                      const safeDelta = Number.isFinite(delta) ? Math.round(delta) : 0;
                      const result = normalizeResult(match?.result);
                      const resultLabel = result === 'win' ? 'Win' : result === 'loss' ? 'Loss' : 'Played';
                      const resultClass = result === 'win'
                        ? 'text-green-700 font-semibold'
                        : result === 'loss'
                          ? 'text-red-700 font-semibold'
                          : 'text-slate-600 font-semibold';
                      return (
                        <div
                          key={`${String(match?.matchId || match?.date || match?.opponent || 'history')}-${index}`}
                          className="bg-white border border-gray-200 rounded-lg p-2 sm:p-3 player-profile-history-item"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs sm:text-sm font-semibold text-gray-800 truncate player-profile-history-opponent">
                              vs {match?.opponent || 'Match opponent'}
                            </p>
                            <span className={`text-xs font-bold ${showEloPanels ? (safeDelta >= 0 ? 'text-green-600' : 'text-red-600') : 'text-slate-500'}`}>
                              {showEloPanels ? `${safeDelta >= 0 ? '+' : ''}${safeDelta}` : resultLabel}
                            </span>
                          </div>
                          <div className="flex items-center justify-between mt-1 text-[11px] sm:text-xs text-gray-500 player-profile-history-meta">
                            <span className={resultClass}>{resultLabel}</span>
                            <span className="flex items-center gap-1"><Clock size={11} /> {formatDate(match?.date)}</span>
                          </div>
                        </div>
                      );
                    })()
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
