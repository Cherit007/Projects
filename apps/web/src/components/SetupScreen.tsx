import React, { useEffect, useMemo, useRef, useState } from 'react';
import { buildCasualDraftLiveCard } from '../utils/boxCricketCasualDraft';
import {
  Calendar,
  History,
  TrendingUp,
  Trophy,
  X,
  Sparkles,
  Clock3,
  Play,
  PencilLine,
  MessageCircle,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Eye,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import TournamentViewer from './TournamentViewer';
import BoxCricketCasualMatchDetail from './boxCricket/BoxCricketCasualMatchDetail';
import UnifiedHistoryModal from './setup/UnifiedHistoryModal';
import PlayerProfileModal from './PlayerProfileModal';
import { buildUnifiedHistoryEntries, countUnifiedHistoryEntries } from '../utils/historyEntries';
import { buildPlayerAdvancedProfile } from '../utils/playerProfileAnalytics';
import { buildPlayerAchievements } from '../utils/playerAchievements';
import { buildPlayerGamification } from '../utils/playerGamification';
import PairingAnalyticsModal from './pairing/PairingAnalyticsModal';
import FormPowerRankingsModal from './rankings/FormPowerRankingsModal';
import PlayerAvatar from './PlayerAvatar';
import MobileBottomSheet from './common/MobileBottomSheet';
import SetupScreenDesktop from './SetupScreenDesktop';
import SetupScreenMobileDashboard from './SetupScreenMobileDashboard';
import {
  getFormatLabel,
  getGameModeLabel,
  getSportMeta,
} from './setup';
import { formatCasualSeriesScoreLine } from '@fixture-maker/domain/sports/boxCricket/boxCricketScoring';
import { buildHomeNarratives } from '../utils/homeNarratives';
import { buildBoxCricketStatsRows } from '../utils/boxCricketStats';
import { scrollMobileShellToTop } from '../utils/scrollUtils';
import { sportUsesEloRatings } from '../utils/sportFeatures';
import { hasViewableBoxCricketDetail } from '../utils/casualMatchHydration';
import {
  formatTournamentDateLabel,
  isScheduledTournamentAlreadyStarted,
  normalizeTournamentFormat,
} from '../utils/appHelpers';

const LoadingRows = ({ rows = 4 }) => (
  <div className="space-y-3 animate-pulse">
    {Array.from({ length: rows }, (_, index) => (
      <div
        key={`skeleton-row-${index}`}
        className="h-20 rounded-xl border border-slate-200 bg-gradient-to-r from-slate-100 via-slate-50 to-slate-100"
      />
    ))}
  </div>
);

const SyncStatusChip = ({ syncStatus = null, freshnessText = '' }) => {
  if (!syncStatus) return null;
  const secondaryText = syncStatus?.busy
    ? String(syncStatus?.detail || '').trim()
    : String(freshnessText || syncStatus?.detail || '').trim();
  return (
    <div className={`setup-sync-chip sync-feedback-chip setup-sync-${syncStatus.tone || 'saved'}`}>
      <span className="setup-sync-chip-dot" />
      <span className="setup-sync-chip-label">
        {syncStatus.label || 'Ready'}
        {secondaryText ? ` · ${secondaryText}` : ''}
      </span>
      {syncStatus.busy && <RefreshCw size={12} className="animate-spin" />}
    </div>
  );
};

const buildFormSummary = (rawSeries = []) => {
  const series = (Array.isArray(rawSeries) ? rawSeries : [])
    .filter((value) => value === 'W' || value === 'L' || value === 'D')
    .slice(-4);
  if (series.length === 0) {
    return { label: 'No form', tone: 'neutral' };
  }
  const wins = series.filter((token) => token === 'W').length;
  const losses = series.filter((token) => token === 'L').length;
  const points = wins - losses;
  return {
    label: series.join(''),
    tone: points > 0 ? 'up' : points < 0 ? 'down' : 'neutral',
  };
};

const getTierMeta = ({ rating = 1000, levelName = '' } = {}) => {
  const normalized = String(levelName || '').trim().toLowerCase();
  if (normalized.includes('legend')) return { label: 'Legend', tone: 'legend', icon: '⭐' };
  if (normalized.includes('elite')) return { label: 'Elite', tone: 'elite', icon: '💎' };
  if (normalized.includes('pro')) return { label: 'Pro', tone: 'pro', icon: '⚡' };
  if (rating >= 1080) return { label: 'Legend', tone: 'legend', icon: '⭐' };
  if (rating >= 1040) return { label: 'Elite', tone: 'elite', icon: '💎' };
  if (rating >= 980) return { label: 'Pro', tone: 'pro', icon: '⚡' };
  return { label: 'Rising', tone: 'rising', icon: '🌱' };
};

const getEloHistoryWindowStart = (filterKey) => {
  const now = Date.now();
  if (filterKey === 'week') return now - (7 * 24 * 60 * 60 * 1000);
  if (filterKey === 'month') return now - (30 * 24 * 60 * 60 * 1000);
  return null;
};

const toFiniteNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toHistoryTimestamp = (entry) => {
  const parsed = Date.parse(String(entry?.date || ''));
  return Number.isFinite(parsed) ? parsed : null;
};

const getHistoryOutcomeToken = (entry) => {
  const result = String(entry?.result || '').trim().toLowerCase();
  if (result === 'win') return 'W';
  if (result === 'loss') return 'L';
  const change = Number(entry?.change || 0);
  if (change > 0) return 'W';
  if (change < 0) return 'L';
  return 'D';
};

const SetupScreen = ({ 
  tournamentName, 
  setTournamentName,
  numTeams,
  setNumTeams,
  format,
  setFormat,
  sportId,
  setSportId,
  ruleConfig,
  setRuleConfig,
  gameMode,
  setGameMode,
  tournamentFormat,
  setTournamentFormat,
  onNext,
  tournamentHistory,
  scheduledTournaments = [],
  activeLiveTournaments = [],
  activeCasualDraft = null,
  onResumeCasualDraft,
  onDeleteCasualDraft,
  onEditScheduledTournament,
  onStartScheduledTournament,
  onViewScheduledTournament,
  onShareScheduledTournament,
  onResumeActiveTournament,
  onDeleteActiveTournament,
  canDeleteLiveTournament = false,
  canDeleteActions = false,
  casualMatches,
  playerDatabase,
  teamNameDatabase,
  members,
  showHistory,
  setShowHistory,
  showCasualHistory,
  setShowCasualHistory,
  showAllTimeStats,
  setShowAllTimeStats,
  showEloLeaderboard,
  setShowEloLeaderboard,
  tournamentTemplates,
  onSaveTemplate,
  onApplyTemplate,
  onDeleteTemplate,
  onDeleteTournament,
  onDeleteCasualMatch,
  allTimeStats,
  eloLeaderboard,
  playerRatings,
  canEditPlayerPhoto = () => false,
  pairingAnalytics,
  formPowerRankings,
  playerPhotos = {},
  onUpdatePlayerPhoto,
  isAppwriteEnabled = false,
  historyHydrated = true,
  casualHydrated = true,
  historyHydrationPending = false,
  casualHydrationPending = false,
  getActionPending = () => false,
  syncStatus = null,
  lastDataUpdatedAt = 0,
  realtimeConnected = false,
  isMobileViewport = false,
  routeKey = null,
  mobileNavScrollTick = 0,
  mobileSetupView = 'home',
  setMobileSetupView = () => {},
  onOpenUtilityDrawer = () => {},
  casualMatchProps = {},
}) => {
  const [selectedTournament, setSelectedTournament] = useState(null);
  const [selectedCasualMatch, setSelectedCasualMatch] = useState(null);
  const [numTeamsInput, setNumTeamsInput] = useState(String(numTeams));
  const [selectedPlayerName, setSelectedPlayerName] = useState(null);
  const [showPairingAnalytics, setShowPairingAnalytics] = useState(false);
  const [showPowerRankings, setShowPowerRankings] = useState(false);
  const [showAdvancedActions, setShowAdvancedActions] = useState(false);
  const [freshnessNow, setFreshnessNow] = useState(() => Date.now());
  const [scheduledCarouselIndex, setScheduledCarouselIndex] = useState(0);
  const [mobileLiveTab, setMobileLiveTab] = useState('inProgress');
  const [mobileEloFilter, setMobileEloFilter] = useState('all');
  const [boxCricketStatsTab, setBoxCricketStatsTab] = useState('runs');
  const scheduledCarouselRef = useRef(null);
  const mobileScrollRef = useRef(null);
  const historyCacheRef = useRef(Array.isArray(tournamentHistory) ? tournamentHistory : []);
  const casualCacheRef = useRef(Array.isArray(casualMatches) ? casualMatches : []);
  const allTimeStatsCacheRef = useRef(Array.isArray(allTimeStats) ? allTimeStats : []);
  const eloCacheRef = useRef(Array.isArray(eloLeaderboard) ? eloLeaderboard : []);

  useEffect(() => {
    setNumTeamsInput(String(numTeams));
  }, [numTeams]);

  useEffect(() => {
    if (!isMobileViewport) return;
    scrollMobileShellToTop(mobileScrollRef);
  }, [
    isMobileViewport,
    mobileSetupView,
    mobileLiveTab,
    mobileEloFilter,
    boxCricketStatsTab,
    mobileNavScrollTick,
    routeKey,
  ]);

  const handleSelectPlayer = (playerName) => {
    setSelectedPlayerName(playerName);
  };

  const historyLoading = Boolean(isAppwriteEnabled && (historyHydrationPending || !historyHydrated));
  const casualLoading = Boolean(isAppwriteEnabled && (casualHydrationPending || !casualHydrated));
  const statsLoading = Boolean(isAppwriteEnabled && (
    historyHydrationPending
    || casualHydrationPending
    || !historyHydrated
    || !casualHydrated
  ));
  const isPendingAction = (actionKey) => Boolean(getActionPending?.(actionKey));
  const startTournamentPending = isPendingAction('setup.start-tournament');
  const scheduledCards = useMemo(
    () => (Array.isArray(scheduledTournaments) ? scheduledTournaments.filter(Boolean) : []),
    [scheduledTournaments]
  );

  useEffect(() => {
    if (scheduledCards.length <= 1) {
      setScheduledCarouselIndex(0);
      if (scheduledCarouselRef.current) {
        if (typeof scheduledCarouselRef.current.scrollTo === 'function') {
          scheduledCarouselRef.current.scrollTo({ left: 0, behavior: 'auto' });
        } else {
          scheduledCarouselRef.current.scrollLeft = 0;
        }
      }
      return;
    }
    setScheduledCarouselIndex((prev) => Math.min(prev, scheduledCards.length - 1));
  }, [scheduledCards.length]);

  const scrollScheduledToIndex = (targetIndex) => {
    if (scheduledCards.length <= 1) return;
    const clamped = Math.max(0, Math.min(targetIndex, scheduledCards.length - 1));
    const listNode = scheduledCarouselRef.current;
    if (listNode) {
      const left = clamped * listNode.clientWidth;
      if (typeof listNode.scrollTo === 'function') {
        listNode.scrollTo({ left, behavior: 'smooth' });
      } else {
        listNode.scrollLeft = left;
      }
    }
    setScheduledCarouselIndex(clamped);
  };

  const handleScheduledTrackScroll = () => {
    const listNode = scheduledCarouselRef.current;
    if (!listNode) return;
    const width = Math.max(1, listNode.clientWidth);
    const nextIndex = Math.max(0, Math.min(
      Math.round(listNode.scrollLeft / width),
      Math.max(scheduledCards.length - 1, 0)
    ));
    if (nextIndex !== scheduledCarouselIndex) {
      setScheduledCarouselIndex(nextIndex);
    }
  };

  const handleViewScheduledCard = async (tournament) => {
    if (!tournament) return;
    const tournamentId = tournament.appwriteId || tournament.id;
    let resolved = tournament;
    if (onViewScheduledTournament && tournamentId) {
      const detailed = await onViewScheduledTournament(tournamentId, tournament);
      if (detailed && typeof detailed === 'object') {
        resolved = detailed;
      }
    }
    if (!resolved || typeof resolved !== 'object') return;
    setSelectedTournament(resolved);
  };

  useEffect(() => {
    if (!isAppwriteEnabled || !lastDataUpdatedAt) return undefined;
    const timerId = setInterval(() => {
      setFreshnessNow(Date.now());
    }, 15 * 1000);
    return () => clearInterval(timerId);
  }, [isAppwriteEnabled, lastDataUpdatedAt]);

  const freshnessText = useMemo(() => {
    if (!isAppwriteEnabled) return 'Device local';
    const updatedAt = Number(lastDataUpdatedAt || 0);
    if (!Number.isFinite(updatedAt) || updatedAt <= 0) {
      return realtimeConnected ? 'Sync warming up' : 'Waiting for cloud sync';
    }
    const elapsedMinutes = Math.max(0, Math.floor((freshnessNow - updatedAt) / (60 * 1000)));
    if (elapsedMinutes < 1) return 'Synced just now';
    if (elapsedMinutes < 60) {
      return `Synced ${elapsedMinutes} min${elapsedMinutes === 1 ? '' : 's'} ago`;
    }

    const updatedDate = new Date(updatedAt);
    const nowDate = new Date(freshnessNow);
    const sameDay = updatedDate.toDateString() === nowDate.toDateString();
    const timeLabel = updatedDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    if (sameDay) return `Synced at ${timeLabel}`;

    const dateLabel = updatedDate.toLocaleDateString([], { month: 'short', day: 'numeric' });
    return `Synced ${dateLabel}, ${timeLabel}`;
  }, [isAppwriteEnabled, lastDataUpdatedAt, realtimeConnected, freshnessNow]);

  useEffect(() => {
    if (!historyLoading) {
      historyCacheRef.current = Array.isArray(tournamentHistory) ? tournamentHistory : [];
    }
  }, [historyLoading, tournamentHistory]);

  useEffect(() => {
    if (!casualLoading) {
      casualCacheRef.current = Array.isArray(casualMatches) ? casualMatches : [];
    }
  }, [casualLoading, casualMatches]);

  useEffect(() => {
    if (!statsLoading) {
      allTimeStatsCacheRef.current = Array.isArray(allTimeStats) ? allTimeStats : [];
      eloCacheRef.current = Array.isArray(eloLeaderboard) ? eloLeaderboard : [];
    }
  }, [statsLoading, allTimeStats, eloLeaderboard]);

  const formatCasualTeam = (team, match) => {
    if (!team) return 'Unknown';
    if (match?.sportId === 'boxCricket' || team?.squad?.length) {
      const name = String(team.name || '').trim();
      const squadCount = Array.isArray(team.squad)
        ? team.squad.filter((player) => String(player?.name || '').trim()).length
        : 0;
      if (name && squadCount) return `${name} (${squadCount} players)`;
      if (name) return name;
    }
    const player1 = String(team.player1 || team.player || '').trim();
    const player2 = String(team.player2 || '').trim();
    if (player1 && player2) return `${player1} & ${player2}`;
    if (player1) return player1;
    if (player2) return player2;
    return String(team.name || 'Unknown').trim() || 'Unknown';
  };

  const formatCasualMatchMeta = (match) => {
    if (match?.sportId === 'boxCricket') {
      const seriesLabel = match?.statistics?.series?.label;
      return seriesLabel ? `🏏 Box Cricket · ${seriesLabel}` : '🏏 Box Cricket';
    }
    return match.matchType === 'doubles' ? '👥 Doubles' : '🎯 Singles';
  };

  const formatCasualScoreLine = (match, team1Name, team2Name) => {
    if (match?.sportId === 'boxCricket') {
      const seriesLine = formatCasualSeriesScoreLine(match.statistics, team1Name, team2Name);
      if (seriesLine) return seriesLine;
    }
    return `${Number(match.score1)} - ${Number(match.score2)}`;
  };

  const selectedPlayerProfile = selectedPlayerName ? playerRatings?.[selectedPlayerName] : null;
  const selectedPlayerLeaderboardRank = useMemo(() => {
    if (!selectedPlayerName) return null;
    const target = selectedPlayerName.trim().toLowerCase();
    const index = (eloLeaderboard || []).findIndex((entry) => (
      String(entry?.name || '').trim().toLowerCase() === target
    ));
    return index >= 0 ? index + 1 : null;
  }, [selectedPlayerName, eloLeaderboard]);
  const selectedPlayerMember = selectedPlayerName
    ? (members || []).find(member => (member?.name || '').trim().toLowerCase() === selectedPlayerName.trim().toLowerCase())
    : null;
  const selectedPlayerIsLinked = Boolean(selectedPlayerMember?.linkedAccountId || selectedPlayerMember?.linkedEmail);
  const selectedPlayerCanEditPhoto = Boolean(selectedPlayerName && canEditPlayerPhoto(selectedPlayerName));
  const selectedPlayerTeam = selectedPlayerName
    ? [...(tournamentHistory || [])]
        .reverse()
        .flatMap(tournament => tournament?.teams || [])
        .find(team => [team.player, team.player1, team.player2].filter(Boolean).includes(selectedPlayerName))
    : null;
  const selectedPlayerAdvancedStats = useMemo(() => buildPlayerAdvancedProfile({
    playerName: selectedPlayerName,
    tournamentHistory,
    casualMatches,
  }), [selectedPlayerName, tournamentHistory, casualMatches]);
  const selectedPlayerAchievements = useMemo(() => buildPlayerAchievements({
    playerName: selectedPlayerName,
    playerRatings,
    tournamentHistory,
    casualMatches,
  }), [selectedPlayerName, playerRatings, tournamentHistory, casualMatches]);
  const selectedPlayerGamification = useMemo(() => buildPlayerGamification({
    playerName: selectedPlayerName,
    tournamentHistory,
    casualMatches,
  }), [selectedPlayerName, tournamentHistory, casualMatches]);
  const eloGamificationMap = useMemo(() => Object.fromEntries(
    (eloLeaderboard || []).map(player => [
      player.name,
      buildPlayerGamification({
        playerName: player.name,
        tournamentHistory,
        casualMatches,
      }),
    ])
  ), [eloLeaderboard, tournamentHistory, casualMatches]);
  const displayTournamentHistory = historyLoading && (tournamentHistory || []).length === 0
    ? historyCacheRef.current
    : (tournamentHistory || []);
  const displayCasualMatches = casualLoading && (casualMatches || []).length === 0
    ? casualCacheRef.current
    : (casualMatches || []);
  const displayAllTimeStats = statsLoading && (allTimeStats || []).length === 0
    ? allTimeStatsCacheRef.current
    : (allTimeStats || []);
  const displayEloLeaderboard = statsLoading && (eloLeaderboard || []).length === 0
    ? eloCacheRef.current
    : (eloLeaderboard || []);
  const eloFormMetaByPlayer = useMemo(() => {
    const map = new Map();
    (displayEloLeaderboard || []).forEach((player) => {
      const history = Array.isArray(player?.history) ? player.history : [];
      const trendSeries = history
        .slice(-4)
        .map((entry) => Number(entry?.change))
        .map((value) => (value > 0 ? 'W' : value < 0 ? 'L' : 'D'));
      map.set(player.name, buildFormSummary(trendSeries));
    });
    return map;
  }, [displayEloLeaderboard]);
  const unifiedHistoryEntries = useMemo(
    () => buildUnifiedHistoryEntries(displayTournamentHistory, displayCasualMatches),
    [displayTournamentHistory, displayCasualMatches],
  );
  const unifiedHistoryCountLabel = String(countUnifiedHistoryEntries(displayTournamentHistory, displayCasualMatches));
  const historyCountLabel = unifiedHistoryCountLabel;
  const casualCountLabel = String(displayCasualMatches.length);
  const historyModalOpen = showHistory || showCasualHistory;
  const closeHistoryModal = () => {
    setShowHistory(false);
    setShowCasualHistory(false);
  };
  const showUnifiedHistorySkeleton = (historyLoading || casualLoading)
    && unifiedHistoryEntries.length === 0;
  const showStatsSkeleton = statsLoading && displayAllTimeStats.length === 0;
  const showEloSkeleton = statsLoading && displayEloLeaderboard.length === 0;
  const completedTournamentsCount = useMemo(
    () => displayTournamentHistory.filter((entry) => entry?.champion || entry?.status === 'completed').length,
    [displayTournamentHistory]
  );
  const totalTournamentMatchesPlayed = useMemo(
    () => displayTournamentHistory.reduce((total, entry) => {
      const fixtureCount = (Array.isArray(entry?.fixtures) ? entry.fixtures : []).filter((match) => match?.completed).length;
      const bracketCount = (Array.isArray(entry?.bracket) ? entry.bracket : [])
        .flatMap((round) => (Array.isArray(round) ? round : []))
        .filter((match) => match?.completed).length;
      const finalCount = entry?.finalMatch?.completed ? 1 : 0;
      return total + fixtureCount + bracketCount + finalCount;
    }, 0),
    [displayTournamentHistory]
  );
  const totalMatchesPlayed = totalTournamentMatchesPlayed + displayCasualMatches.length;
  const hideEloFeatures = !sportUsesEloRatings(sportId);
  const isBoxCricketStats = sportId === 'boxCricket';
  const boxCricketStatsRows = useMemo(
    () => (isBoxCricketStats
      ? buildBoxCricketStatsRows(displayAllTimeStats, boxCricketStatsTab)
      : displayAllTimeStats),
    [displayAllTimeStats, isBoxCricketStats, boxCricketStatsTab],
  );
  const topEloPlayer = hideEloFeatures ? null : (displayEloLeaderboard[0] || null);
  const narratives = useMemo(() => buildHomeNarratives({
    tournamentHistory: displayTournamentHistory,
    casualMatches: displayCasualMatches,
    eloLeaderboard: displayEloLeaderboard,
    playerRatings,
    activeLiveTournaments,
    sportId,
  }), [
    displayTournamentHistory,
    displayCasualMatches,
    displayEloLeaderboard,
    playerRatings,
    activeLiveTournaments,
    sportId,
  ]);
  const syncChip = (
    <SyncStatusChip syncStatus={syncStatus} freshnessText={freshnessText} />
  );
  const selectedFormatLabel = getFormatLabel(sportId, tournamentFormat);
  const selectedGameModeLabel = getGameModeLabel(sportId, gameMode);
  const applyTemplateToForm = (template) => {
    if (!template) return;
    const nextFormat = normalizeTournamentFormat(template.tournamentFormat || 'league');
    const nextGameMode = String(template.gameMode || 'doubles').trim() || 'doubles';
    const nextFormatSetting = String(template.format || '1').trim() || '1';
    const parsedNumTeams = Math.max(3, parseInt(template.numTeams, 10) || numTeams || 3);
    const nextNumTeams = nextFormat === 'semiFinal'
      ? 4
      : nextFormat === 'fullKnockout'
        ? 8
        : parsedNumTeams;

    setGameMode(nextGameMode);
    setTournamentFormat(nextFormat);
    setFormat(nextFormat === 'league' ? nextFormatSetting : '1');
    setNumTeams(nextNumTeams);
    setNumTeamsInput(String(nextNumTeams));
    if (String(template.name || '').trim()) {
      setTournamentName(String(template.name).trim());
    }
  };
  const mobileStatsCards = [
    { icon: '🏆', value: String(completedTournamentsCount), label: 'Completed' },
    { icon: '🎯', value: String(totalMatchesPlayed), label: 'Matches Played' },
  ];
  const liveInProgressCards = useMemo(() => {
    const tournamentCards = (Array.isArray(activeLiveTournaments) ? activeLiveTournaments : []).map((tournament, index) => {
      const fixturesList = Array.isArray(tournament?.fixtures) ? tournament.fixtures : [];
      const bracketList = (Array.isArray(tournament?.bracket) ? tournament.bracket : [])
        .flatMap((round) => (Array.isArray(round) ? round : []));
      const finalMatch = tournament?.finalMatch ? [tournament.finalMatch] : [];
      const allMatches = [...fixturesList, ...bracketList, ...finalMatch].filter(Boolean);
      const completedCount = allMatches.filter((match) => Boolean(match?.completed)).length;
      const currentMatch = allMatches.find((match) => !match?.completed && match?.team1 && match?.team2) || null;
      const tournamentId = tournament?.id || tournament?.appwriteId || `live-${index}`;
      const sportMeta = getSportMeta(tournament?.sportId);
      return {
        id: tournamentId,
        name: tournament?.name || 'Live Tournament',
        sportId: sportMeta.id,
        sportIcon: sportMeta.icon,
        sportLabel: sportMeta.label,
        subtitle: formatTournamentDateLabel(tournament?.date, 'Today'),
        phaseLabel: currentMatch?.round ? `Round ${currentMatch.round}` : 'Live now',
        currentMatchLabel: currentMatch
          ? `${currentMatch.team1?.name || 'Team 1'} vs ${currentMatch.team2?.name || 'Team 2'}`
          : 'Resume current tournament',
        completedCount,
        totalCount: allMatches.length || 0,
      };
    });
    const casualCard = activeCasualDraft ? buildCasualDraftLiveCard(activeCasualDraft) : null;
    return casualCard ? [casualCard, ...tournamentCards] : tournamentCards;
  }, [activeLiveTournaments, activeCasualDraft]);
  const liveCompletedEntries = useMemo(() => {
    const toTimestamp = (value) => {
      const parsed = new Date(value || 0).getTime();
      return Number.isFinite(parsed) ? parsed : 0;
    };
    const tournamentEntries = displayTournamentHistory
      .filter((entry) => entry?.champion || entry?.status === 'completed')
      .map((tournament, index) => ({
        kind: 'tournament',
        id: tournament.id || tournament.appwriteId || `completed-tournament-${index}`,
        sortKey: toTimestamp(tournament.date || tournament.completedAt || tournament.createdAt),
        tournament,
      }));
    const casualEntries = displayCasualMatches
      .filter((match) => match?.completed !== false)
      .map((match, index) => ({
        kind: 'casual',
        id: match.id || match.appwriteId || `completed-casual-${index}`,
        sortKey: toTimestamp(match.completedAt || match.date || match.createdAt),
        match,
      }));
    return [...tournamentEntries, ...casualEntries]
      .sort((left, right) => right.sortKey - left.sortKey)
      .slice(0, 24);
  }, [displayTournamentHistory, displayCasualMatches]);
  const liveCompletedRows = liveCompletedEntries;
  const eloPeriodRows = useMemo(() => {
    const windowStart = getEloHistoryWindowStart(mobileEloFilter);
    return (displayEloLeaderboard || [])
      .map((player) => {
        const history = Array.isArray(player?.history) ? player.history : [];
        const scopedHistory = windowStart === null
          ? history
          : history.filter((entry) => {
              const timestamp = toHistoryTimestamp(entry);
              return Number.isFinite(timestamp) && timestamp >= windowStart;
            });
        if (windowStart !== null && scopedHistory.length === 0) return null;
        const recentEntries = (windowStart === null ? history : scopedHistory).slice(-4);
        const lastEntry = (windowStart === null ? history : scopedHistory).slice(-1)[0] || null;
        const rating = windowStart === null
          ? toFiniteNumber(player?.rating, 1000)
          : toFiniteNumber(lastEntry?.newRating, toFiniteNumber(player?.rating, 1000));
        const delta = windowStart === null
          ? toFiniteNumber(lastEntry?.change, 0)
          : scopedHistory.reduce((sum, entry) => sum + toFiniteNumber(entry?.change, 0), 0);
        const gamification = eloGamificationMap[player.name] || null;
        const tier = getTierMeta({
          rating,
          levelName: gamification?.level?.name || '',
        });
        return {
          name: player.name,
          rating,
          matchesPlayed: windowStart === null ? toFiniteNumber(player?.matchesPlayed, 0) : scopedHistory.length,
          delta,
          tier,
          recentForm: recentEntries.map(getHistoryOutcomeToken),
          photoUrl: playerPhotos[player.name],
        };
      })
      .filter(Boolean)
      .sort((left, right) => {
        if (right.rating !== left.rating) return right.rating - left.rating;
        if (right.matchesPlayed !== left.matchesPlayed) return right.matchesPlayed - left.matchesPlayed;
        return String(left.name || '').localeCompare(String(right.name || ''));
      });
  }, [displayEloLeaderboard, eloGamificationMap, mobileEloFilter, playerPhotos]);
  const eloFilterLabel = mobileEloFilter === 'month'
    ? 'This Month'
    : mobileEloFilter === 'week'
      ? 'This Week'
      : 'All Time';
  const premiumEloRows = eloPeriodRows.slice(0, 3);
  const compactEloRows = eloPeriodRows.slice(3);
  const statsPreviewRows = displayEloLeaderboard.slice(0, 3);
  const mobileHeaderTitle = mobileSetupView === 'create'
    ? 'Tournament Setup'
    : mobileSetupView === 'start'
      ? 'Start Match'
    : mobileSetupView === 'casual'
      ? 'Casual Match'
    : mobileSetupView === 'live'
      ? 'Live Matches'
      : mobileSetupView === 'stats'
        ? 'Stats'
        : mobileSetupView === 'elo'
          ? 'ELO Leaderboard'
          : 'Tournament';
  const mobileHeaderSubtitle = mobileSetupView === 'create'
    ? 'Configure & launch tournament'
    : mobileSetupView === 'start'
      ? 'Casual or tournament'
    : mobileSetupView === 'casual'
      ? 'Score and save result'
    : mobileSetupView === 'live'
      ? 'Real-time scores'
      : mobileSetupView === 'stats'
        ? 'Insights + history'
        : mobileSetupView === 'elo'
          ? `${eloPeriodRows.length} players · ${eloFilterLabel}`
          : 'Tournament · Group workspace';

  return (
    <div>
      {isMobileViewport && (
        <SetupScreenMobileDashboard
          mobileSetupView={mobileSetupView}
          setMobileSetupView={setMobileSetupView}
          onOpenUtilityDrawer={onOpenUtilityDrawer}
          mobileScrollRef={mobileScrollRef}
          syncChip={syncChip}
          mobileHeaderTitle={mobileHeaderTitle}
          mobileHeaderSubtitle={mobileHeaderSubtitle}
          selectedGameModeLabel={selectedGameModeLabel}
          selectedFormatLabel={selectedFormatLabel}
          sportId={sportId}
          setSportId={setSportId}
          ruleConfig={ruleConfig}
          setRuleConfig={setRuleConfig}
          mobileStatsCards={mobileStatsCards}
          topEloPlayer={topEloPlayer}
          liveInProgressCards={liveInProgressCards}
          completedTournamentsCount={completedTournamentsCount}
          narratives={narratives}
          gameMode={gameMode}
          setGameMode={setGameMode}
          tournamentFormat={tournamentFormat}
          setTournamentFormat={setTournamentFormat}
          format={format}
          setFormat={setFormat}
          setNumTeams={setNumTeams}
          setNumTeamsInput={setNumTeamsInput}
          numTeamsInput={numTeamsInput}
          tournamentName={tournamentName}
          setTournamentName={setTournamentName}
          startTournamentPending={startTournamentPending}
          onNext={onNext}
          tournamentTemplates={tournamentTemplates}
          playerDatabase={playerDatabase}
          teamNameDatabase={teamNameDatabase}
          onSaveTemplate={onSaveTemplate}
          onApplyTemplate={onApplyTemplate}
          applyTemplateToForm={applyTemplateToForm}
          onDeleteTemplate={onDeleteTemplate}
          mobileLiveTab={mobileLiveTab}
          setMobileLiveTab={setMobileLiveTab}
          isPendingAction={isPendingAction}
          canDeleteLiveTournament={canDeleteLiveTournament}
          onResumeActiveTournament={onResumeActiveTournament}
          onDeleteActiveTournament={onDeleteActiveTournament}
          onResumeCasualDraft={onResumeCasualDraft}
          onDeleteCasualDraft={onDeleteCasualDraft}
          scheduledCards={scheduledCards}
          onViewScheduledCard={handleViewScheduledCard}
          onEditScheduledTournament={onEditScheduledTournament}
          onStartScheduledTournament={onStartScheduledTournament}
          onShareScheduledTournament={onShareScheduledTournament}
          canDeleteActions={canDeleteActions}
          onDeleteTournament={onDeleteTournament}
          activeLiveTournaments={activeLiveTournaments}
          liveCompletedRows={liveCompletedRows}
          formatCasualTeam={formatCasualTeam}
          formatCasualScoreLine={formatCasualScoreLine}
          formatCasualMatchMeta={formatCasualMatchMeta}
          onSelectCasualMatch={setSelectedCasualMatch}
          hasViewableBoxCricketDetail={hasViewableBoxCricketDetail}
          onSelectTournament={setSelectedTournament}
          totalMatchesPlayed={totalMatchesPlayed}
          statsPreviewRows={statsPreviewRows}
          allTimeStatsPreview={boxCricketStatsRows.slice(0, 5)}
          isBoxCricketStats={isBoxCricketStats}
          boxCricketStatsTab={boxCricketStatsTab}
          setBoxCricketStatsTab={setBoxCricketStatsTab}
          boxCricketStatsRows={boxCricketStatsRows}
          eloGamificationMap={eloGamificationMap}
          getTierMeta={getTierMeta}
          casualCountLabel={casualCountLabel}
          historyCountLabel={historyCountLabel}
          setShowCasualHistory={setShowCasualHistory}
          setShowHistory={setShowHistory}
          setShowAllTimeStats={setShowAllTimeStats}
          mobileEloFilter={mobileEloFilter}
          setMobileEloFilter={setMobileEloFilter}
          eloPeriodRows={eloPeriodRows}
          eloFilterLabel={eloFilterLabel}
          premiumEloRows={premiumEloRows}
          compactEloRows={compactEloRows}
          onSelectPlayer={handleSelectPlayer}
          hideEloFeatures={hideEloFeatures}
          casualMatchProps={casualMatchProps}
        />
      )}
      {!isMobileViewport && (
        <SetupScreenDesktop
          syncChip={syncChip}
          scheduledCards={scheduledCards}
          scheduledCarouselIndex={scheduledCarouselIndex}
          scrollScheduledToIndex={scrollScheduledToIndex}
          scheduledCarouselRef={scheduledCarouselRef}
          handleScheduledTrackScroll={handleScheduledTrackScroll}
          handleViewScheduledCard={handleViewScheduledCard}
          activeLiveTournaments={activeLiveTournaments}
          isPendingAction={isPendingAction}
          onEditScheduledTournament={onEditScheduledTournament}
          onStartScheduledTournament={onStartScheduledTournament}
          onShareScheduledTournament={onShareScheduledTournament}
          onDeleteTournament={onDeleteTournament}
          canDeleteActions={canDeleteActions}
          onResumeActiveTournament={onResumeActiveTournament}
          onDeleteActiveTournament={onDeleteActiveTournament}
          canDeleteLiveTournament={canDeleteLiveTournament}
          gameMode={gameMode}
          setGameMode={setGameMode}
          tournamentFormat={tournamentFormat}
          setTournamentFormat={setTournamentFormat}
          format={format}
          setFormat={setFormat}
          numTeamsInput={numTeamsInput}
          setNumTeamsInput={setNumTeamsInput}
          setNumTeams={setNumTeams}
          tournamentName={tournamentName}
          setTournamentName={setTournamentName}
          sportId={sportId}
          setSportId={setSportId}
          ruleConfig={ruleConfig}
          setRuleConfig={setRuleConfig}
          onNext={onNext}
          startTournamentPending={startTournamentPending}
          completedTournamentsCount={completedTournamentsCount}
          displayCasualMatches={displayCasualMatches}
          totalMatchesPlayed={totalMatchesPlayed}
          topEloPlayer={topEloPlayer}
          showAdvancedActions={showAdvancedActions}
          setShowAdvancedActions={setShowAdvancedActions}
          isMobileViewport={isMobileViewport}
          historyCountLabel={historyCountLabel}
          casualCountLabel={casualCountLabel}
          setShowHistory={setShowHistory}
          setShowCasualHistory={setShowCasualHistory}
          setShowEloLeaderboard={setShowEloLeaderboard}
          setShowAllTimeStats={setShowAllTimeStats}
          setShowPairingAnalytics={setShowPairingAnalytics}
          setShowPowerRankings={setShowPowerRankings}
          tournamentTemplates={tournamentTemplates}
          onSaveTemplate={onSaveTemplate}
          onApplyTemplate={onApplyTemplate}
          onDeleteTemplate={onDeleteTemplate}
          canDeleteActionsForExplore={canDeleteActions}
          numTeams={numTeams}
          playerDatabase={playerDatabase}
          teamNameDatabase={teamNameDatabase}
          narratives={narratives}
          hideEloFeatures={hideEloFeatures}
          casualMatchProps={casualMatchProps}
        />
      )}

      <UnifiedHistoryModal
        open={historyModalOpen}
        onClose={closeHistoryModal}
        isMobileViewport={isMobileViewport}
        entryCount={unifiedHistoryEntries.length}
        entries={unifiedHistoryEntries}
        isLoading={historyLoading || casualLoading}
        showSkeleton={showUnifiedHistorySkeleton}
        onViewTournament={setSelectedTournament}
        onViewCasualMatch={setSelectedCasualMatch}
        onDeleteTournament={onDeleteTournament}
        onDeleteCasualMatch={onDeleteCasualMatch}
        canDeleteActions={canDeleteActions}
        isPendingAction={isPendingAction}
        formatCasualTeam={formatCasualTeam}
        formatCasualMatchMeta={formatCasualMatchMeta}
        formatCasualScoreLine={formatCasualScoreLine}
      />

      {/* All-Time Stats Modal */}
      {showAllTimeStats && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[240] p-4 app-overlay">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[80vh] overflow-hidden setup-stats-modal-shell app-modal-shell">
            <div className="app-gradient-band p-6 flex items-center justify-between setup-modal-header setup-modal-header-stats">
              <h3 className="text-2xl font-bold text-white flex items-center gap-2 app-section-heading">
                <TrendingUp size={24} /> All-Time Player Statistics
              </h3>
              <button
                onClick={() => setShowAllTimeStats(false)}
                aria-label="Close all-time stats"
                className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-lg transition-all"
              >
                <X size={24} />
              </button>
            </div>
            <div className="overflow-y-auto max-h-[calc(80vh-88px)]">
              {statsLoading && boxCricketStatsRows.length > 0 && (
                <div className="mx-4 mt-4 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-xs font-semibold text-orange-700">
                  Refreshing latest statistics...
                </div>
              )}
              {isBoxCricketStats && boxCricketStatsRows.length > 0 && (
                <div className="dashboard-v2-filter-tabs mx-4 mt-4" role="tablist" aria-label="Box cricket stat leaders">
                  {[
                    { key: 'runs', label: 'Top Scorers' },
                    { key: 'wickets', label: 'Top Wicket Takers' },
                  ].map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      role="tab"
                      aria-selected={boxCricketStatsTab === tab.key}
                      className={`dashboard-v2-filter-tab ${boxCricketStatsTab === tab.key ? 'is-active' : ''}`}
                      onClick={() => setBoxCricketStatsTab(tab.key)}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              )}
              {showStatsSkeleton ? (
                <div className="p-6">
                  <LoadingRows rows={5} />
                </div>
              ) : boxCricketStatsRows.length === 0 ? (
                <div className="p-12 text-center text-gray-500">
                  <TrendingUp size={48} className="mx-auto mb-4 text-gray-300" />
                  <p>No player statistics available yet</p>
                </div>
              ) : (
                <>
                  <div className="mobile-leaderboard-cards p-4">
                    {boxCricketStatsRows.map((player, index) => (
                      <article key={`stats-modal-card-${player.name}`} className="leaderboard-mobile-card app-surface-card app-card-tier-secondary">
                        <div className="leaderboard-mobile-top">
                          <span className={`leaderboard-rank-badge ${index < 3 ? 'leaderboard-rank-badge-podium' : ''}`}>#{index + 1}</span>
                          <span className="leaderboard-stat-chip">🏆 {player.championships}</span>
                        </div>
                        <div className="leaderboard-mobile-team">
                          <PlayerAvatar name={player.name} photoUrl={playerPhotos[player.name]} size="sm" />
                          <button
                            type="button"
                            onClick={() => setSelectedPlayerName(player.name)}
                            className="font-bold text-sm text-blue-700 hover:text-blue-900 hover:underline"
                          >
                            {player.name}
                          </button>
                        </div>
                        <div className="leaderboard-mobile-metrics">
                          {isBoxCricketStats ? (
                            <>
                              <span className="leaderboard-stat-chip">Runs {player.cricketRuns || 0}</span>
                              <span className="leaderboard-stat-chip">Wkts {player.cricketWickets || 0}</span>
                              <span className="leaderboard-stat-chip">Matches {player.matchesPlayed}</span>
                            </>
                          ) : (
                            <>
                              <span className="leaderboard-stat-chip">Tours {player.tournamentsPlayed}</span>
                              <span className="leaderboard-stat-chip">Played {player.matchesPlayed}</span>
                              <span className="leaderboard-stat-chip leaderboard-stat-chip-up">Won {player.matchesWon}</span>
                            </>
                          )}
                        </div>
                        <div className="leaderboard-mobile-bottom">
                          {isBoxCricketStats ? (
                            <span className="leaderboard-form-chip leaderboard-form-chip-up">
                              Won {player.matchesWon} · SR {player.cricketAverage}
                            </span>
                          ) : (
                            <span className="leaderboard-form-chip leaderboard-form-chip-up">Win {player.winPercentage}%</span>
                          )}
                        </div>
                      </article>
                    ))}
                  </div>

                  <div className="dense-table-shell overflow-x-auto">
                    <table className="w-full min-w-[760px]">
                      <thead className="bg-gray-100 sticky top-0">
                        <tr>
                          <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">Rank</th>
                          <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">Player</th>
                          {isBoxCricketStats ? (
                            <>
                              <th className="px-4 py-3 text-center text-sm font-bold text-gray-700">Runs</th>
                              <th className="px-4 py-3 text-center text-sm font-bold text-gray-700">Balls</th>
                              <th className="px-4 py-3 text-center text-sm font-bold text-gray-700">4s</th>
                              <th className="px-4 py-3 text-center text-sm font-bold text-gray-700">6s</th>
                              <th className="px-4 py-3 text-center text-sm font-bold text-gray-700">Wkts</th>
                              <th className="px-4 py-3 text-center text-sm font-bold text-gray-700">Matches</th>
                              <th className="px-4 py-3 text-center text-sm font-bold text-gray-700">Won</th>
                            </>
                          ) : (
                            <>
                              <th className="px-4 py-3 text-center text-sm font-bold text-gray-700">🏆</th>
                              <th className="px-4 py-3 text-center text-sm font-bold text-gray-700">Tournaments</th>
                              <th className="px-4 py-3 text-center text-sm font-bold text-gray-700">Played</th>
                              <th className="px-4 py-3 text-center text-sm font-bold text-gray-700">Won</th>
                              <th className="px-4 py-3 text-center text-sm font-bold text-gray-700">Win %</th>
                            </>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {boxCricketStatsRows.map((player, index) => (
                          <tr key={player.name} className="border-b border-gray-200 hover:bg-gray-50">
                            <td className="px-4 py-4 text-center">
                              <span className={`leaderboard-rank-badge ${index < 3 ? 'leaderboard-rank-badge-podium' : ''}`}>#{index + 1}</span>
                            </td>
                            <td className="px-4 py-4">
                              <div className="flex items-center gap-2">
                                <PlayerAvatar name={player.name} photoUrl={playerPhotos[player.name]} size="sm" />
                                <button
                                  type="button"
                                  onClick={() => setSelectedPlayerName(player.name)}
                                  className="font-bold text-blue-700 hover:text-blue-900 hover:underline"
                                >
                                  {player.name}
                                </button>
                              </div>
                            </td>
                            {isBoxCricketStats ? (
                              <>
                                <td className="px-4 py-4 text-center font-semibold">{player.cricketRuns || 0}</td>
                                <td className="px-4 py-4 text-center font-semibold">{player.cricketBalls || 0}</td>
                                <td className="px-4 py-4 text-center font-semibold">{player.cricketFours || 0}</td>
                                <td className="px-4 py-4 text-center font-semibold">{player.cricketSixes || 0}</td>
                                <td className="px-4 py-4 text-center font-semibold">{player.cricketWickets || 0}</td>
                                <td className="px-4 py-4 text-center font-semibold">{player.matchesPlayed}</td>
                                <td className="px-4 py-4 text-center font-semibold text-green-600">{player.matchesWon}</td>
                              </>
                            ) : (
                              <>
                                <td className="px-4 py-4 text-center">
                                  <span className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full font-bold text-sm">
                                    {player.championships}
                                  </span>
                                </td>
                                <td className="px-4 py-4 text-center font-semibold">{player.tournamentsPlayed}</td>
                                <td className="px-4 py-4 text-center font-semibold">{player.matchesPlayed}</td>
                                <td className="px-4 py-4 text-center font-semibold text-green-600">{player.matchesWon}</td>
                                <td className="px-4 py-4 text-center">
                                  <span className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full font-bold text-sm stats-win-badge">
                                    {player.winPercentage}%
                                  </span>
                                </td>
                              </>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ELO Leaderboard Modal */}
      {showEloLeaderboard && !hideEloFeatures && (
        <>
          {isMobileViewport ? (
            <MobileBottomSheet
              open={showEloLeaderboard}
              title="ELO Rating Leaderboard"
              subtitle={`${displayEloLeaderboard.length} players`}
              onClose={() => setShowEloLeaderboard(false)}
              sheetClassName="setup-elo-modal-shell"
            >
              {statsLoading && displayEloLeaderboard.length > 0 && (
                <div className="mx-1 mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
                  Refreshing latest ELO rankings...
                </div>
              )}
              {showEloSkeleton ? (
                <LoadingRows rows={5} />
              ) : displayEloLeaderboard.length === 0 ? (
                <div className="p-12 text-center text-gray-500">
                  <Trophy size={48} className="mx-auto mb-4 text-gray-300" />
                  <p>No ELO ratings yet. Complete matches to build the leaderboard!</p>
                </div>
              ) : (
                <>
                  <div className="mobile-leaderboard-cards p-1">
                    {displayEloLeaderboard.map((player, index) => {
                      const lastMatch = player.history && player.history.length > 0 ? player.history[player.history.length - 1] : null;
                      const delta = Number(lastMatch?.change || 0);
                      const trendMeta = eloFormMetaByPlayer.get(player.name) || buildFormSummary([]);
                      const moveTone = delta > 0 ? 'up' : delta < 0 ? 'down' : 'neutral';
                      return (
                        <article key={`elo-modal-card-${player.name}`} className="leaderboard-mobile-card app-surface-card app-card-tier-secondary">
                          <div className="leaderboard-mobile-top">
                            <span className={`leaderboard-rank-badge ${index < 3 ? 'leaderboard-rank-badge-podium' : ''}`}>#{index + 1}</span>
                            <span className={`leaderboard-move-chip leaderboard-move-chip-${moveTone}`}>
                              {delta > 0 ? <ArrowUpRight size={13} /> : delta < 0 ? <ArrowDownRight size={13} /> : <Minus size={13} />}
                              <span>{delta > 0 ? '+' : ''}{delta}</span>
                            </span>
                          </div>
                          <div className="leaderboard-mobile-team">
                            <PlayerAvatar name={player.name} photoUrl={playerPhotos[player.name]} size="sm" />
                            <button
                              type="button"
                              onClick={() => setSelectedPlayerName(player.name)}
                              className="font-bold text-sm text-blue-700 hover:text-blue-900 hover:underline truncate"
                            >
                              {player.name}
                            </button>
                          </div>
                          <div className="leaderboard-mobile-metrics">
                            <span className={`leaderboard-stat-chip ${player.rating >= 1200 ? 'leaderboard-stat-chip-up' : ''}`}>ELO {player.rating}</span>
                            <span className="leaderboard-stat-chip">Matches {player.matchesPlayed}</span>
                          </div>
                          <div className="leaderboard-mobile-bottom">
                            <span className={`leaderboard-form-chip leaderboard-form-chip-${trendMeta.tone}`}>Form {trendMeta.label}</span>
                            {eloGamificationMap[player.name]?.level && (
                              <span className="leaderboard-tier-chip">
                                <Sparkles size={11} />
                                <span>{eloGamificationMap[player.name].level.name}</span>
                              </span>
                            )}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                  <div className="dense-table-shell overflow-x-auto mt-3">
                    <table className="w-full min-w-[760px] elo-table-polished">
                      <thead className="bg-gray-100 sticky top-0">
                        <tr>
                          <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">Rank</th>
                          <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">Player</th>
                          <th className="px-4 py-3 text-center text-sm font-bold text-gray-700">Rating</th>
                          <th className="px-4 py-3 text-center text-sm font-bold text-gray-700">Matches</th>
                          <th className="px-4 py-3 text-center text-sm font-bold text-gray-700">Move</th>
                          <th className="px-4 py-3 text-center text-sm font-bold text-gray-700">Form</th>
                          <th className="px-4 py-3 text-center text-sm font-bold text-gray-700">Δ ELO</th>
                        </tr>
                      </thead>
                      <tbody>
                        {displayEloLeaderboard.map((player, index) => {
                          const lastMatch = player.history && player.history.length > 0 ? player.history[player.history.length - 1] : null;
                          const delta = Number(lastMatch?.change || 0);
                          const trendMeta = eloFormMetaByPlayer.get(player.name) || buildFormSummary([]);
                          const moveTone = delta > 0 ? 'up' : delta < 0 ? 'down' : 'neutral';
                          return (
                            <tr key={player.name} className="border-b border-gray-200 hover:bg-gray-50">
                              <td className="px-4 py-4 text-center">
                                <span className={`leaderboard-rank-badge ${index < 3 ? 'leaderboard-rank-badge-podium' : ''}`}>#{index + 1}</span>
                              </td>
                              <td className="px-4 py-4">
                                <div className="flex items-center gap-2 min-w-0 elo-player-cell">
                                  <PlayerAvatar name={player.name} photoUrl={playerPhotos[player.name]} size="sm" />
                                  <button
                                    type="button"
                                    onClick={() => setSelectedPlayerName(player.name)}
                                    className="font-bold text-blue-700 hover:text-blue-900 hover:underline truncate min-w-0 elo-player-name"
                                  >
                                    {player.name}
                                  </button>
                                  {eloGamificationMap[player.name]?.level && (
                                    <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-100 px-1.5 py-0.5 rounded-full elo-level-badge elo-level-inline max-w-[140px] truncate">
                                      {eloGamificationMap[player.name].level.icon} {eloGamificationMap[player.name].level.name}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-4 text-center">
                                <span className={`px-3 py-1 rounded-full font-bold text-sm elo-rating-chip ${
                                  player.rating >= 1200 ? 'elo-rating-gold' :
                                  player.rating >= 1000 ? 'elo-rating-green' :
                                  'elo-rating-neutral'
                                }`}>
                                  {player.rating}
                                </span>
                              </td>
                              <td className="px-4 py-4 text-center font-semibold">{player.matchesPlayed}</td>
                              <td className="px-4 py-4 text-center">
                                <span className={`leaderboard-move-chip leaderboard-move-chip-${moveTone}`}>
                                  {delta > 0 ? <ArrowUpRight size={13} /> : delta < 0 ? <ArrowDownRight size={13} /> : <Minus size={13} />}
                                  <span>{delta > 0 ? '+' : ''}{delta}</span>
                                </span>
                              </td>
                              <td className="px-4 py-4 text-center">
                                <span className={`leaderboard-form-chip leaderboard-form-chip-${trendMeta.tone}`}>{trendMeta.label}</span>
                              </td>
                              <td className="px-4 py-4 text-center">
                                <span className={`rank-change-indicator ${delta > 0 ? 'rank-change-up text-green-600' : delta < 0 ? 'rank-change-down text-red-600' : ''}`}>
                                  {delta > 0 ? '+' : ''}{delta}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </MobileBottomSheet>
          ) : (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[240] p-4 app-overlay">
              <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[80vh] overflow-hidden setup-elo-modal-shell app-modal-shell">
                <div className="app-gradient-band p-6 flex items-center justify-between setup-modal-header setup-modal-header-elo">
                  <h3 className="text-2xl font-bold text-white flex items-center gap-2 app-section-heading">
                    <Trophy size={24} /> ELO Rating Leaderboard
                  </h3>
                  <button
                    onClick={() => setShowEloLeaderboard(false)}
                    aria-label="Close elo leaderboard"
                    className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-lg transition-all"
                  >
                    <X size={24} />
                  </button>
                </div>
                <div className="overflow-y-auto max-h-[calc(80vh-88px)]">
                  {statsLoading && displayEloLeaderboard.length > 0 && (
                    <div className="mx-4 mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
                      Refreshing latest ELO rankings...
                    </div>
                  )}
                  {showEloSkeleton ? (
                    <div className="p-6">
                      <LoadingRows rows={5} />
                    </div>
                  ) : displayEloLeaderboard.length === 0 ? (
                    <div className="p-12 text-center text-gray-500">
                      <Trophy size={48} className="mx-auto mb-4 text-gray-300" />
                      <p>No ELO ratings yet. Complete matches to build the leaderboard!</p>
                    </div>
                  ) : (
                    <>
                      <div className="mobile-leaderboard-cards p-4">
                        {displayEloLeaderboard.map((player, index) => {
                          const lastMatch = player.history && player.history.length > 0 ? player.history[player.history.length - 1] : null;
                          const delta = Number(lastMatch?.change || 0);
                          const trendMeta = eloFormMetaByPlayer.get(player.name) || buildFormSummary([]);
                          const moveTone = delta > 0 ? 'up' : delta < 0 ? 'down' : 'neutral';
                          return (
                            <article key={`elo-modal-card-${player.name}`} className="leaderboard-mobile-card app-surface-card app-card-tier-secondary">
                              <div className="leaderboard-mobile-top">
                                <span className={`leaderboard-rank-badge ${index < 3 ? 'leaderboard-rank-badge-podium' : ''}`}>#{index + 1}</span>
                                <span className={`leaderboard-move-chip leaderboard-move-chip-${moveTone}`}>
                                  {delta > 0 ? <ArrowUpRight size={13} /> : delta < 0 ? <ArrowDownRight size={13} /> : <Minus size={13} />}
                                  <span>{delta > 0 ? '+' : ''}{delta}</span>
                                </span>
                              </div>
                              <div className="leaderboard-mobile-team">
                                <PlayerAvatar name={player.name} photoUrl={playerPhotos[player.name]} size="sm" />
                                <button
                                  type="button"
                                  onClick={() => setSelectedPlayerName(player.name)}
                                  className="font-bold text-sm text-blue-700 hover:text-blue-900 hover:underline truncate"
                                >
                                  {player.name}
                                </button>
                              </div>
                              <div className="leaderboard-mobile-metrics">
                                <span className={`leaderboard-stat-chip ${player.rating >= 1200 ? 'leaderboard-stat-chip-up' : ''}`}>ELO {player.rating}</span>
                                <span className="leaderboard-stat-chip">Matches {player.matchesPlayed}</span>
                              </div>
                              <div className="leaderboard-mobile-bottom">
                                <span className={`leaderboard-form-chip leaderboard-form-chip-${trendMeta.tone}`}>Form {trendMeta.label}</span>
                                {eloGamificationMap[player.name]?.level && (
                                  <span className="leaderboard-tier-chip">
                                    <Sparkles size={11} />
                                    <span>{eloGamificationMap[player.name].level.name}</span>
                                  </span>
                                )}
                              </div>
                            </article>
                          );
                        })}
                      </div>

                      <div className="dense-table-shell overflow-x-auto">
                        <table className="w-full min-w-[760px] elo-table-polished">
                          <thead className="bg-gray-100 sticky top-0">
                            <tr>
                              <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">Rank</th>
                              <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">Player</th>
                              <th className="px-4 py-3 text-center text-sm font-bold text-gray-700">Rating</th>
                              <th className="px-4 py-3 text-center text-sm font-bold text-gray-700">Matches</th>
                              <th className="px-4 py-3 text-center text-sm font-bold text-gray-700">Move</th>
                              <th className="px-4 py-3 text-center text-sm font-bold text-gray-700">Form</th>
                              <th className="px-4 py-3 text-center text-sm font-bold text-gray-700">Δ ELO</th>
                            </tr>
                          </thead>
                          <tbody>
                            {displayEloLeaderboard.map((player, index) => {
                              const lastMatch = player.history && player.history.length > 0 ? player.history[player.history.length - 1] : null;
                              const delta = Number(lastMatch?.change || 0);
                              const trendMeta = eloFormMetaByPlayer.get(player.name) || buildFormSummary([]);
                              const moveTone = delta > 0 ? 'up' : delta < 0 ? 'down' : 'neutral';
                              return (
                                <tr key={player.name} className="border-b border-gray-200 hover:bg-gray-50">
                                  <td className="px-4 py-4 text-center">
                                    <span className={`leaderboard-rank-badge ${index < 3 ? 'leaderboard-rank-badge-podium' : ''}`}>#{index + 1}</span>
                                  </td>
                                  <td className="px-4 py-4">
                                    <div className="flex items-center gap-2 min-w-0 elo-player-cell">
                                      <PlayerAvatar name={player.name} photoUrl={playerPhotos[player.name]} size="sm" />
                                      <button
                                        type="button"
                                        onClick={() => setSelectedPlayerName(player.name)}
                                        className="font-bold text-blue-700 hover:text-blue-900 hover:underline truncate min-w-0 elo-player-name"
                                      >
                                        {player.name}
                                      </button>
                                      {eloGamificationMap[player.name]?.level && (
                                        <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-100 px-1.5 py-0.5 rounded-full elo-level-badge elo-level-inline max-w-[140px] truncate">
                                          {eloGamificationMap[player.name].level.icon} {eloGamificationMap[player.name].level.name}
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-4 py-4 text-center">
                                    <span className={`px-3 py-1 rounded-full font-bold text-sm elo-rating-chip ${
                                      player.rating >= 1200 ? 'elo-rating-gold' :
                                      player.rating >= 1000 ? 'elo-rating-green' :
                                      'elo-rating-neutral'
                                    }`}>
                                      {player.rating}
                                    </span>
                                  </td>
                                  <td className="px-4 py-4 text-center font-semibold">{player.matchesPlayed}</td>
                                  <td className="px-4 py-4 text-center">
                                    <span className={`leaderboard-move-chip leaderboard-move-chip-${moveTone}`}>
                                      {delta > 0 ? <ArrowUpRight size={13} /> : delta < 0 ? <ArrowDownRight size={13} /> : <Minus size={13} />}
                                      <span>{delta > 0 ? '+' : ''}{delta}</span>
                                    </span>
                                  </td>
                                  <td className="px-4 py-4 text-center">
                                    <span className={`leaderboard-form-chip leaderboard-form-chip-${trendMeta.tone}`}>{trendMeta.label}</span>
                                  </td>
                                  <td className="px-4 py-4 text-center">
                                    <span className={`rank-change-indicator ${delta > 0 ? 'rank-change-up text-green-600' : delta < 0 ? 'rank-change-down text-red-600' : ''}`}>
                                      {delta > 0 ? '+' : ''}{delta}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}
      
      {/* Tournament Viewer Modal */}
      {selectedTournament && (
        <TournamentViewer
          tournament={selectedTournament}
          onClose={() => setSelectedTournament(null)}
        />
      )}

      {selectedCasualMatch && (
        <BoxCricketCasualMatchDetail
          match={selectedCasualMatch}
          onClose={() => setSelectedCasualMatch(null)}
          isMobileViewport={isMobileViewport}
          formatTeamName={formatCasualTeam}
          formatScoreLine={formatCasualScoreLine}
        />
      )}

      <PlayerProfileModal
        playerName={selectedPlayerName}
        profile={selectedPlayerProfile}
        team={selectedPlayerTeam}
        advancedStats={selectedPlayerAdvancedStats}
        achievements={selectedPlayerAchievements}
        gamification={selectedPlayerGamification}
        leaderboardRank={selectedPlayerLeaderboardRank}
        photoUrl={selectedPlayerName ? playerPhotos[selectedPlayerName] : ''}
        isLinked={selectedPlayerIsLinked}
        canEditPhoto={selectedPlayerCanEditPhoto}
        tournamentHistory={displayTournamentHistory}
        casualMatches={displayCasualMatches}
        playerRatings={playerRatings}
        defaultSportId={sportId}
        onUpdatePhoto={onUpdatePlayerPhoto}
        onClose={() => setSelectedPlayerName(null)}
      />

      {showPairingAnalytics && (
        <PairingAnalyticsModal
          analytics={pairingAnalytics}
          onClose={() => setShowPairingAnalytics(false)}
        />
      )}

      {showPowerRankings && (
        <FormPowerRankingsModal
          rankings={formPowerRankings}
          onClose={() => setShowPowerRankings(false)}
        />
      )}
    </div>
  );
};

export default SetupScreen;
