import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Trophy,
  RotateCcw,
  RefreshCw,
  Edit2,
  TrendingUp,
  Users,
  House,
  MoreVertical,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Sparkles,
} from 'lucide-react';
import PlayerProfileModal from './PlayerProfileModal';
import AutocompleteInput from './AutocompleteInput';
import FixturesTab from './tournamentTabs/FixturesTab';
import TableTab from './tournamentTabs/TableTab';
import StatsTab from './tournamentTabs/StatsTab';
import FinalTab from './tournamentTabs/FinalTab';
import { useTournamentViewState } from './tournamentTabs/useTournamentViewState';
import { buildPlayerAdvancedProfile } from '../utils/playerProfileAnalytics';
import { buildPlayerAchievements } from '../utils/playerAchievements';
import { buildPlayerGamification } from '../utils/playerGamification';
import { filterLeaderboardRowsByRecordedMatches } from '../utils/dashboardAnalytics';
import PlayerAvatar from './PlayerAvatar';

const parseActivityTimestamp = (value) => {
  if (!value) return null;
  const ts = Date.parse(String(value));
  return Number.isFinite(ts) ? ts : null;
};
const normalizePlayerKey = (value) => String(value || '').trim().toLowerCase();

const buildFormSummary = (rawSeries = []) => {
  const series = (Array.isArray(rawSeries) ? rawSeries : [])
    .filter((value) => value === 'W' || value === 'L' || value === 'D')
    .slice(-4);
  if (series.length === 0) {
    return { label: 'No form', tone: 'neutral', wins: 0, losses: 0 };
  }
  const wins = series.filter((token) => token === 'W').length;
  const losses = series.filter((token) => token === 'L').length;
  const points = wins - losses;
  const tone = points > 0 ? 'up' : points < 0 ? 'down' : 'neutral';
  return {
    label: series.join(''),
    tone,
    wins,
    losses,
  };
};

const tabContentMotionVariants = {
  initial: { opacity: 0, x: 18 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.2, ease: 'easeOut' } },
  exit: { opacity: 0, x: -18, transition: { duration: 0.16, ease: 'easeIn' } },
};
const MotionSection = motion.section;

const TournamentView = ({
  tournamentName,
  setTournamentName,
  tournamentFormat,
  fixtures,
  bracket,
  teams,
  champion,
  members,
  playerDatabase = [],
  playerRatings,
  gameMode,
  tournamentHistory = [],
  currentTournamentId = null,
  casualMatches = [],
  aiMatchSummaries = [],
  oddPlayerEnabled = false,
  oddPlayerName = '',
  playerPhotos = {},
  allTimeStats = [],
  eloLeaderboard: persistedEloLeaderboard = [],
  onUpdatePlayerPhoto,
  canEditPlayerPhoto = () => false,
  onSaveMatchResult,
  onPrioritizeMatch,
  onSaveBracketResult,
  onSaveFinalResult,
  onSwapTeamMember,
  swapHistory = [],
  onGoHome,
  onResetTournament,
  onRerunTournament,
  onStartNextTournament,
  onRefreshTournament = null,
  calculatePointsTable,
  calculatePlayerStats,
  getPlayerLeaderboard,
  getActionPending = () => false,
  syncStatus = null,
}) => {
  const {
    activeTab,
    setActiveTab,
    showHeaderMenu,
    setShowHeaderMenu,
    isMobileViewport,
    pullDistance,
    isPullRefreshing,
    handleContentTouchStart,
    handleContentTouchMove,
    handleContentTouchEnd,
  } = useTournamentViewState({
    onRefreshTournament,
  });
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempTournamentName, setTempTournamentName] = useState(tournamentName);
  const [selectedBracketMatch, setSelectedBracketMatch] = useState(null);
  const [selectedPlayerName, setSelectedPlayerName] = useState(null);
  const [showNextTournamentModal, setShowNextTournamentModal] = useState(false);
  const [nextTournamentName, setNextTournamentName] = useState('');
  const [showSwapMemberModal, setShowSwapMemberModal] = useState(false);
  const [swapTeamId, setSwapTeamId] = useState('');
  const [swapCurrentPlayer, setSwapCurrentPlayer] = useState('');
  const [swapReplacementPlayer, setSwapReplacementPlayer] = useState('');
  const [swapError, setSwapError] = useState('');
  const [showDuplicatePlayerModal, setShowDuplicatePlayerModal] = useState(false);
  const [duplicatePlayers, setDuplicatePlayers] = useState([]);
  const [showFutureClashModal, setShowFutureClashModal] = useState(false);
  const [futureClashMatches, setFutureClashMatches] = useState([]);
  const [futureClashPlayer, setFutureClashPlayer] = useState('');
  const [matchSyncState, setMatchSyncState] = useState({});
  const [championBurstActive, setChampionBurstActive] = useState(false);
  const syncTimersRef = useRef({});
  const championBurstTimerRef = useRef(null);
  const championBurstFrameRef = useRef(null);
  const championBurstKeyRef = useRef('');
  const isPendingAction = (actionKey) => Boolean(getActionPending?.(actionKey));
  const resetPending = isPendingAction('tournament.reset');
  const rematchPending = isPendingAction('tournament.rematch');
  const nextTournamentPending = isPendingAction('tournament.next');
  const syncTone = String(syncStatus?.tone || 'saved');
  const headerSyncLabel = (() => {
    const rawLabel = String(syncStatus?.label || '').trim();
    if (syncStatus?.busy) return rawLabel || 'Saving';
    if (!rawLabel) return 'Saved';
    if (rawLabel.toLowerCase().includes('local mode')) return 'Saved';
    return rawLabel;
  })();
  const mobileCommandItems = useMemo(() => {
    const items = [
      {
        key: 'home',
        label: 'Home',
        icon: House,
        glyph: '🏠',
        onClick: onGoHome,
        active: false,
      },
      {
        key: 'fixtures',
        label: 'Live',
        icon: RefreshCw,
        glyph: '🔄',
        onClick: () => setActiveTab('fixtures'),
        active: activeTab === 'fixtures',
      },
    ];

    if (tournamentFormat === 'league') {
      items.push({
        key: 'table',
        label: 'Table',
        icon: TrendingUp,
        glyph: '📊',
        onClick: () => setActiveTab('table'),
        active: activeTab === 'table',
      });
      items.push({
        key: 'stats',
        label: 'Stats',
        icon: Users,
        glyph: '👤',
        onClick: () => setActiveTab('stats'),
        active: activeTab === 'stats',
      });
    }

    items.push({
      key: 'elo',
      label: 'ELO',
      icon: TrendingUp,
      glyph: '📈',
      onClick: () => setActiveTab('elo'),
      active: activeTab === 'elo',
    });
    items.push({
      key: 'final',
      label: 'Final',
      icon: Trophy,
      glyph: '🏆',
      onClick: () => setActiveTab('final'),
      active: activeTab === 'final',
    });

    return items;
  }, [activeTab, onGoHome, setActiveTab, tournamentFormat]);

  useEffect(() => () => {
    Object.values(syncTimersRef.current || {}).forEach((timerId) => {
      clearTimeout(timerId);
    });
    syncTimersRef.current = {};
    if (championBurstTimerRef.current) {
      clearTimeout(championBurstTimerRef.current);
      championBurstTimerRef.current = null;
    }
    if (championBurstFrameRef.current) {
      cancelAnimationFrame(championBurstFrameRef.current);
      championBurstFrameRef.current = null;
    }
  }, []);

  // Find current match (first incomplete)
  const currentMatch = useMemo(() => (
    tournamentFormat === 'league'
      ? fixtures.find((m) => !m.completed)
      : null
  ), [tournamentFormat, fixtures]);

  // Get next matches
  const nextMatches = useMemo(() => (
    tournamentFormat === 'league'
      ? fixtures.filter((m) => !m.completed).slice(1)
      : []
  ), [tournamentFormat, fixtures]);

  const pointsTable = useMemo(() => (
    tournamentFormat === 'league' ? calculatePointsTable(teams, fixtures) : []
  ), [tournamentFormat, teams, fixtures, calculatePointsTable]);
  const completedFixturesOrdered = useMemo(() => (
    fixtures
      .filter((match) => Boolean(match?.completed))
      .sort((a, b) => {
        const roundA = Number(a?.round || 0);
        const roundB = Number(b?.round || 0);
        if (roundA !== roundB) return roundA - roundB;
        return String(a?.id || '').localeCompare(String(b?.id || ''));
      })
  ), [fixtures]);
  const teamFormMetaById = useMemo(() => {
    const historyByTeamId = new Map();
    completedFixturesOrdered.forEach((match) => {
      const score1 = Number(match?.score1);
      const score2 = Number(match?.score2);
      if (!Number.isFinite(score1) || !Number.isFinite(score2) || score1 === score2) return;
      const team1Id = String(match?.team1?.id || '');
      const team2Id = String(match?.team2?.id || '');
      if (!team1Id || !team2Id) return;
      const team1Won = score1 > score2;
      const token1 = team1Won ? 'W' : 'L';
      const token2 = team1Won ? 'L' : 'W';
      if (!historyByTeamId.has(team1Id)) historyByTeamId.set(team1Id, []);
      if (!historyByTeamId.has(team2Id)) historyByTeamId.set(team2Id, []);
      historyByTeamId.get(team1Id).push(token1);
      historyByTeamId.get(team2Id).push(token2);
    });

    const summaryByTeamId = new Map();
    teams.forEach((team) => {
      const teamId = String(team?.id || '');
      if (!teamId) return;
      summaryByTeamId.set(teamId, buildFormSummary(historyByTeamId.get(teamId) || []));
    });
    return summaryByTeamId;
  }, [completedFixturesOrdered, teams]);
  const pointsTableRankMovement = useMemo(() => {
    if (tournamentFormat !== 'league' || pointsTable.length === 0) {
      return new Map();
    }
    const completedMatches = completedFixturesOrdered;
    if (completedMatches.length === 0) {
      return new Map();
    }
    const tableBefore = calculatePointsTable(teams, completedMatches.slice(0, -1));
    const previousRankById = new Map(
      tableBefore.map((team, index) => [String(team?.id || ''), index + 1])
    );
    const movementMap = new Map();
    pointsTable.forEach((team, index) => {
      const teamId = String(team?.id || '');
      const previousRank = previousRankById.get(teamId);
      const nextRank = index + 1;
      if (!Number.isFinite(previousRank) || previousRank === nextRank) return;
      movementMap.set(teamId, {
        previousRank,
        nextRank,
        delta: previousRank - nextRank,
      });
    });
    return movementMap;
  }, [tournamentFormat, pointsTable, completedFixturesOrdered, calculatePointsTable, teams]);
  const getTeamFormMeta = useCallback(
    (teamId) => teamFormMetaById.get(String(teamId)) || buildFormSummary([]),
    [teamFormMetaById]
  );

  const playerStats = useMemo(() => (
    tournamentFormat === 'league' ? calculatePlayerStats(teams, fixtures) : []
  ), [tournamentFormat, teams, fixtures, calculatePlayerStats]);
  const championConfettiPieces = useMemo(() => (
    Array.from({ length: 18 }, (_, index) => ({
      id: index,
      x: 8 + ((index * 11) % 84),
      delay: index * 38,
      rotation: ((index * 23) % 80) - 40,
      hue: (40 + (index * 17)) % 360,
    }))
  ), []);
  const fallbackEloLeaderboard = useMemo(
    () => filterLeaderboardRowsByRecordedMatches(
      getPlayerLeaderboard(playerRatings),
      { tournamentHistory, casualMatches }
    ),
    [playerRatings, getPlayerLeaderboard, tournamentHistory, casualMatches]
  );
  const displayEloLeaderboard = useMemo(() => {
    const persistedRows = Array.isArray(persistedEloLeaderboard) ? persistedEloLeaderboard : [];
    if (persistedRows.length === 0) return fallbackEloLeaderboard;

    const mergedRows = [...persistedRows];
    const seenNames = new Set(persistedRows.map((player) => normalizePlayerKey(player?.name)));
    fallbackEloLeaderboard.forEach((player) => {
      const key = normalizePlayerKey(player?.name);
      if (!key || seenNames.has(key)) return;
      seenNames.add(key);
      mergedRows.push(player);
    });
    return mergedRows;
  }, [persistedEloLeaderboard, fallbackEloLeaderboard]);
  const selectedPlayerProfile = selectedPlayerName ? playerRatings[selectedPlayerName] : null;
  const selectedPlayerLeaderboardRank = useMemo(() => {
    if (!selectedPlayerName) return null;
    const target = normalizePlayerKey(selectedPlayerName);
    const index = displayEloLeaderboard.findIndex((entry) => normalizePlayerKey(entry?.name) === target);
    return index >= 0 ? index + 1 : null;
  }, [selectedPlayerName, displayEloLeaderboard]);
  const selectedPlayerMember = selectedPlayerName
    ? (members || []).find(member => (member?.name || '').trim().toLowerCase() === selectedPlayerName.trim().toLowerCase())
    : null;
  const selectedPlayerIsLinked = Boolean(selectedPlayerMember?.linkedAccountId || selectedPlayerMember?.linkedEmail);
  const selectedPlayerCanEditPhoto = Boolean(selectedPlayerName && canEditPlayerPhoto(selectedPlayerName));
  const selectedPlayerTeam = selectedPlayerName
    ? teams.find(team => [team.player, team.player1, team.player2].filter(Boolean).includes(selectedPlayerName))
    : null;
  const selectedPlayerAdvancedStats = useMemo(() => buildPlayerAdvancedProfile({
    playerName: selectedPlayerName,
    tournamentHistory,
    casualMatches,
    liveTournament: {
      tournamentName,
      tournamentFormat,
      gameMode,
      fixtures,
      bracket,
    },
  }), [
    selectedPlayerName,
    tournamentHistory,
    casualMatches,
    tournamentName,
    tournamentFormat,
    gameMode,
    fixtures,
    bracket,
  ]);
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
  const swapCandidatePlayers = useMemo(() => {
    const fromDatabase = (playerDatabase || []).map((name) => String(name || '').trim());
    const fromMembers = (members || []).map((member) => (member?.name || '').trim());
    const fromTeams = (teams || []).flatMap((team) => [
      (team?.player || team?.player1 || '').trim(),
      (team?.player2 || '').trim(),
    ]);
    return [...new Set([...fromDatabase, ...fromMembers, ...fromTeams].filter(Boolean))];
  }, [playerDatabase, members, teams]);
  const completedTournamentRecord = useMemo(() => {
    if (!champion || !Array.isArray(tournamentHistory) || tournamentHistory.length === 0) return null;
    return tournamentHistory.find((entry) => {
      if (!entry?.champion) return false;
      const entryId = entry.appwriteId || entry.id;
      if (entryId && currentTournamentId) return entryId === currentTournamentId;
      return (
        (entry.name || '') === (tournamentName || '') &&
        (entry.champion?.name || '') === (champion?.name || '')
      );
    }) || null;
  }, [champion, tournamentHistory, currentTournamentId, tournamentName]);
  const currentTournamentRecord = useMemo(() => {
    if (!Array.isArray(tournamentHistory) || tournamentHistory.length === 0) return null;
    const targetId = String(currentTournamentId || '').trim();
    if (targetId) {
      const byId = tournamentHistory.find((entry) => {
        const entryIds = [entry?.appwriteId, entry?.id, entry?.legacyTournamentId, entry?.immutableTournamentId]
          .map((value) => String(value || '').trim())
          .filter(Boolean);
        return entryIds.includes(targetId);
      });
      if (byId) return byId;
    }
    const targetName = String(tournamentName || '').trim().toLowerCase();
    if (!targetName) return null;
    return tournamentHistory.find((entry) => (
      String(entry?.name || '').trim().toLowerCase() === targetName
    )) || null;
  }, [tournamentHistory, currentTournamentId, tournamentName]);
  const recordedTournamentPlayerStats = useMemo(() => (
    tournamentFormat === 'league' && currentTournamentRecord
      ? calculatePlayerStats(
        Array.isArray(currentTournamentRecord?.teams) ? currentTournamentRecord.teams : teams,
        Array.isArray(currentTournamentRecord?.fixtures) ? currentTournamentRecord.fixtures : []
      )
      : []
  ), [tournamentFormat, currentTournamentRecord, calculatePlayerStats, teams]);
  const displayPlayerStats = useMemo(() => {
    const persistedStats = Array.isArray(allTimeStats) ? allTimeStats : [];
    const liveStats = Array.isArray(playerStats) ? playerStats : [];
    if (persistedStats.length === 0) return liveStats;
    if (liveStats.length === 0) return persistedStats;

    const mergedStats = new Map();
    persistedStats.forEach((player) => {
      const key = normalizePlayerKey(player?.name);
      if (!key) return;
      mergedStats.set(key, {
        name: player?.name || '',
        team: player?.team || '',
        teamEmoji: player?.teamEmoji || '',
        tournamentsPlayed: Number(player?.tournamentsPlayed || 0),
        matchesPlayed: Number(player?.matchesPlayed || 0),
        matchesWon: Number(player?.matchesWon || 0),
        totalScored: Number(player?.totalScored || 0),
        totalConceded: Number(player?.totalConceded || 0),
        championships: Number(player?.championships || 0),
      });
    });

    const recordedStatsByPlayer = new Map(
      recordedTournamentPlayerStats.map((player) => [normalizePlayerKey(player?.name), player])
    );

    liveStats.forEach((player) => {
      const key = normalizePlayerKey(player?.name);
      if (!key) return;

      const recordedPlayer = recordedStatsByPlayer.get(key);
      const currentMatchesPlayed = Number(player?.matchesPlayed || 0);
      const currentMatchesWon = Number(player?.matchesWon || 0);
      const currentScored = Number(player?.totalScored || 0);
      const currentConceded = Number(player?.totalConceded || 0);
      const recordedMatchesPlayed = Number(recordedPlayer?.matchesPlayed || 0);
      const recordedMatchesWon = Number(recordedPlayer?.matchesWon || 0);
      const recordedScored = Number(recordedPlayer?.totalScored || 0);
      const recordedConceded = Number(recordedPlayer?.totalConceded || 0);

      const deltaMatchesPlayed = Math.max(0, currentMatchesPlayed - recordedMatchesPlayed);
      const deltaMatchesWon = Math.max(0, currentMatchesWon - recordedMatchesWon);
      const deltaScored = Math.max(0, currentScored - recordedScored);
      const deltaConceded = Math.max(0, currentConceded - recordedConceded);
      const shouldCountTournament = recordedMatchesPlayed === 0 && currentMatchesPlayed > 0 ? 1 : 0;

      const existing = mergedStats.get(key) || {
        name: player?.name || '',
        team: '',
        teamEmoji: '',
        tournamentsPlayed: 0,
        matchesPlayed: 0,
        matchesWon: 0,
        totalScored: 0,
        totalConceded: 0,
        championships: 0,
      };

      mergedStats.set(key, {
        ...existing,
        name: player?.name || existing.name,
        team: player?.team || existing.team,
        teamEmoji: player?.teamEmoji || existing.teamEmoji,
        tournamentsPlayed: existing.tournamentsPlayed + shouldCountTournament,
        matchesPlayed: existing.matchesPlayed + deltaMatchesPlayed,
        matchesWon: existing.matchesWon + deltaMatchesWon,
        totalScored: existing.totalScored + deltaScored,
        totalConceded: existing.totalConceded + deltaConceded,
      });
    });

    return Array.from(mergedStats.values())
      .map((player) => ({
        ...player,
        winPercentage: player.matchesPlayed > 0
          ? ((player.matchesWon / player.matchesPlayed) * 100).toFixed(1)
          : 0,
        avgScorePerMatch: player.matchesPlayed > 0
          ? (player.totalScored / player.matchesPlayed).toFixed(1)
          : 0,
        scoreDiff: player.totalScored - player.totalConceded,
      }))
      .sort((left, right) => {
        if (right.championships !== left.championships) return right.championships - left.championships;
        if (right.matchesWon !== left.matchesWon) return right.matchesWon - left.matchesWon;
        const rightWinRate = Number(right.winPercentage || 0);
        const leftWinRate = Number(left.winPercentage || 0);
        if (rightWinRate !== leftWinRate) return rightWinRate - leftWinRate;
        if (right.matchesPlayed !== left.matchesPlayed) return right.matchesPlayed - left.matchesPlayed;
        return String(left.name || '').localeCompare(String(right.name || ''));
      });
  }, [allTimeStats, playerStats, recordedTournamentPlayerStats]);
  const summaryTimestampByMatchId = useMemo(() => {
    const map = new Map();
    (Array.isArray(aiMatchSummaries) ? aiMatchSummaries : []).forEach((summary) => {
      const key = String(summary?.matchId || '').trim().toLowerCase();
      if (!key) return;
      const ts = parseActivityTimestamp(summary?.createdAt);
      if (!Number.isFinite(ts)) return;
      const previous = map.get(key);
      if (!Number.isFinite(previous) || ts > previous) {
        map.set(key, ts);
      }
    });
    return map;
  }, [aiMatchSummaries]);
  const liveActivityEvents = useMemo(() => {
    const events = [];
    let sequence = 0;
    const sourceTournament = completedTournamentRecord || currentTournamentRecord;

    const toTimestamp = (...values) => {
      for (const value of values) {
        const parsed = parseActivityTimestamp(value);
        if (Number.isFinite(parsed)) return parsed;
      }
      return null;
    };
    const toTeamName = (team, fallback = 'Team') => {
      const name = String(team?.name || '').trim();
      return name || fallback;
    };
    const resolveMatchTimestamp = (match) => {
      const matchKey = String(match?.id || '').trim().toLowerCase();
      const summaryTime = matchKey ? summaryTimestampByMatchId.get(matchKey) : null;
      if (Number.isFinite(summaryTime)) return summaryTime;
      return toTimestamp(match?.completedAt, match?.updatedAt, match?.date);
    };
    const pushEvent = ({ id, type, message, detail = '', timestamp = null }) => {
      if (!message) return;
      events.push({
        id: id || `activity-${type || 'event'}-${sequence}`,
        type: type || 'match-result',
        message,
        detail,
        timestamp: Number.isFinite(timestamp) ? timestamp : null,
        sequence,
      });
      sequence += 1;
    };
    const pushMatchEvent = (match, phaseLabel) => {
      if (!match?.completed) return;
      const score1 = Number(match?.score1);
      const score2 = Number(match?.score2);
      if (!Number.isFinite(score1) || !Number.isFinite(score2) || score1 === score2) return;
      const team1Name = toTeamName(match?.team1, 'Team 1');
      const team2Name = toTeamName(match?.team2, 'Team 2');
      const winnerName = score1 > score2 ? team1Name : team2Name;
      const loserName = score1 > score2 ? team2Name : team1Name;
      pushEvent({
        id: `match-${String(match?.id || sequence)}`,
        type: 'match-result',
        message: `${winnerName} beat ${loserName}`,
        detail: `${phaseLabel || 'Match'} • ${score1}-${score2}`,
        timestamp: resolveMatchTimestamp(match),
      });
    };

    pushEvent({
      id: `start-${String(sourceTournament?.appwriteId || sourceTournament?.id || tournamentName || 'live')}`,
      type: 'tournament-started',
      message: `${sourceTournament?.name || tournamentName || 'Tournament'} started`,
      detail: tournamentFormat === 'league' ? 'League format' : 'Knockout format',
      timestamp: toTimestamp(
        sourceTournament?.createdAt,
        sourceTournament?.updatedAt,
        sourceTournament?.date
      ),
    });

    const completedLeagueMatches = (Array.isArray(fixtures) ? fixtures : [])
      .filter((match) => Boolean(match?.completed))
      .sort((a, b) => {
        const roundA = Number(a?.round || 0);
        const roundB = Number(b?.round || 0);
        if (roundA !== roundB) return roundA - roundB;
        return String(a?.id || '').localeCompare(String(b?.id || ''));
      });

    completedLeagueMatches.forEach((match) => {
      pushMatchEvent(match, `Round ${match?.round || '-'}`);
    });

    if (tournamentFormat === 'league' && completedLeagueMatches.length > 0) {
      const processed = [];
      completedLeagueMatches.forEach((match) => {
        const tableBefore = calculatePointsTable(teams, processed);
        const beforeRankById = new Map(
          tableBefore.map((team, index) => [String(team?.id || ''), index + 1])
        );
        processed.push(match);
        const tableAfter = calculatePointsTable(teams, processed);
        const movers = tableAfter
          .map((team, index) => {
            const teamId = String(team?.id || '');
            const previousRank = beforeRankById.get(teamId);
            const nextRank = index + 1;
            if (!Number.isFinite(previousRank) || previousRank === nextRank) return null;
            return {
              teamName: String(team?.name || 'Team').trim() || 'Team',
              previousRank,
              nextRank,
              delta: nextRank - previousRank,
            };
          })
          .filter(Boolean)
          .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta) || a.delta - b.delta);

        if (movers.length === 0) return;
        const mover = movers[0];
        const movement = Math.abs(mover.previousRank - mover.nextRank);
        pushEvent({
          id: `rank-${String(match?.id || sequence)}`,
          type: 'rank-changed',
          message: `${mover.teamName} moved ${mover.nextRank < mover.previousRank ? 'up' : 'down'} to #${mover.nextRank}`,
          detail: `${movement} place${movement === 1 ? '' : 's'} changed`,
          timestamp: resolveMatchTimestamp(match),
        });
      });
    }

    (Array.isArray(bracket) ? bracket : []).forEach((round, roundIndex) => {
      (Array.isArray(round) ? round : []).forEach((match) => {
        const roundLabel = String(match?.round || '').trim();
        const phaseLabel = roundLabel || `Knockout R${roundIndex + 1}`;
        pushMatchEvent(match, phaseLabel);
      });
    });

    if (completedTournamentRecord?.finalMatch?.completed) {
      pushMatchEvent(completedTournamentRecord.finalMatch, 'Final');
    } else if (champion && summaryTimestampByMatchId.has('final')) {
      pushEvent({
        id: 'match-final-summary',
        type: 'match-result',
        message: `${toTeamName(champion, 'Champion')} won the final`,
        detail: 'Final',
        timestamp: summaryTimestampByMatchId.get('final'),
      });
    }

    return events
      .sort((a, b) => {
        const aTs = Number.isFinite(a?.timestamp) ? a.timestamp : -Infinity;
        const bTs = Number.isFinite(b?.timestamp) ? b.timestamp : -Infinity;
        if (aTs !== bTs) return bTs - aTs;
        return Number(b?.sequence || 0) - Number(a?.sequence || 0);
      })
      .slice(0, 80);
  }, [
    completedTournamentRecord,
    currentTournamentRecord,
    tournamentName,
    tournamentFormat,
    fixtures,
    bracket,
    champion,
    calculatePointsTable,
    teams,
    summaryTimestampByMatchId,
  ]);

  const leagueMatchesComplete = useMemo(
    () => fixtures.length > 0 && fixtures.every((match) => match.completed),
    [fixtures]
  );

  useEffect(() => {
    if (!champion || activeTab !== 'final') {
      if (championBurstFrameRef.current) {
        cancelAnimationFrame(championBurstFrameRef.current);
        championBurstFrameRef.current = null;
      }
      if (!champion) {
        championBurstKeyRef.current = '';
      }
      return;
    }
    const burstKey = `${String(currentTournamentId || tournamentName || 'live')}:${String(champion?.name || champion?.player || champion?.player1 || '')}`;
    if (championBurstKeyRef.current === burstKey) return;
    championBurstKeyRef.current = burstKey;
    if (championBurstFrameRef.current) {
      cancelAnimationFrame(championBurstFrameRef.current);
    }
    championBurstFrameRef.current = requestAnimationFrame(() => {
      setChampionBurstActive(true);
      championBurstFrameRef.current = null;
    });
    if (championBurstTimerRef.current) {
      clearTimeout(championBurstTimerRef.current);
    }
    championBurstTimerRef.current = setTimeout(() => {
      setChampionBurstActive(false);
      championBurstTimerRef.current = null;
    }, 1800);
  }, [champion, activeTab, currentTournamentId, tournamentName]);
  const showChampionBurst = Boolean(championBurstActive && champion && activeTab === 'final');

  const getTeamPlayers = (team) => {
    if (!team) return [];
    const players = [
      (team.player1 || team.player || '').trim(),
      (team.player2 || '').trim(),
    ].filter(Boolean);
    return [...new Set(players)];
  };

  const getTeamPlayersWithSlots = (team) => {
    if (!team) return [];
    const player1 = String(team.player1 || team.player || '').trim();
    const player2 = String(team.player2 || '').trim();
    return [
      { slot: 'player1', value: player1 },
      { slot: 'player2', value: player2 },
    ].filter(item => item.value);
  };

  const selectedSwapTeam = teams.find(team => String(team.id) === String(swapTeamId)) || null;
  const selectedSwapTeamPlayers = getTeamPlayers(selectedSwapTeam);
  const normalizedSwapCurrentPlayer = String(swapCurrentPlayer || '').trim().toLowerCase();

  const findDuplicatePlayersAcrossTeams = () => {
    const playerMap = new Map();
    teams.forEach((team) => {
      const players = getTeamPlayersWithSlots(team);
      players.forEach(({ slot, value }) => {
        const normalized = String(value || '').trim().toLowerCase();
        if (!normalized) return;
        if (!playerMap.has(normalized)) {
          playerMap.set(normalized, { player: value, teams: [] });
        }
        playerMap.get(normalized).teams.push({
          teamId: team.id,
          teamName: team.name,
          slot,
        });
      });
    });
    return Array.from(playerMap.values()).filter(item => item.teams.length > 1);
  };

  const getCurrentLiveOpponentPlayers = () => {
    if (!currentMatch || !selectedSwapTeam) return [];
    const selectedId = String(selectedSwapTeam.id);
    const team1Id = String(currentMatch.team1?.id || '');
    const team2Id = String(currentMatch.team2?.id || '');
    if (selectedId !== team1Id && selectedId !== team2Id) return [];
    const opponent = selectedId === team1Id ? currentMatch.team2 : currentMatch.team1;
    return getTeamPlayers(opponent).map(name => String(name || '').trim().toLowerCase());
  };

  const blockedOpponentPlayers = getCurrentLiveOpponentPlayers();
  const filteredSwapCandidatePlayers = swapCandidatePlayers.filter((name) => {
    const normalized = String(name || '').trim().toLowerCase();
    if (!normalized) return false;
    if (normalized === normalizedSwapCurrentPlayer) return true;
    return !blockedOpponentPlayers.includes(normalized);
  });

  const finalSelection = useMemo(() => {
    if (!leagueMatchesComplete) {
      return {
        finalists: null,
        oddPlayerIncluded: false,
        oddPlayerReason: '',
      };
    }

    const table = calculatePointsTable(teams, fixtures);
    const finalists = [table[0], table[1]];

    if (!oddPlayerEnabled || !oddPlayerName.trim()) {
      return {
        finalists,
        oddPlayerIncluded: false,
        oddPlayerReason: '',
      };
    }

    const oddName = oddPlayerName.trim();
    const individualPoints = {};
    const bump = (name, delta) => {
      if (!name) return;
      individualPoints[name] = (individualPoints[name] || 0) + delta;
    };
    const allPlayers = new Set();
    fixtures.forEach((match) => {
      const players = [
        match.team1.player || match.team1.player1,
        match.team1.player2,
        match.team2.player || match.team2.player1,
        match.team2.player2,
      ].filter(Boolean);
      players.forEach((name) => allPlayers.add(name));
      if (!match.completed) return;
      const margin = Number(match.score1) - Number(match.score2);
      bump(match.team1.player || match.team1.player1, margin);
      bump(match.team1.player2, margin);
      bump(match.team2.player || match.team2.player1, -margin);
      bump(match.team2.player2, -margin);
    });

    const oddPoints = individualPoints[oddName] || 0;
    const maxPoints = Math.max(0, ...Array.from(allPlayers).map((name) => individualPoints[name] || 0));
    if (oddPoints < maxPoints) {
      return {
        finalists,
        oddPlayerIncluded: false,
        oddPlayerReason: '',
      };
    }

    const countOddInTeam = (team) => fixtures.filter((match) => {
      if (!match.completed) return false;
      const onTeam1 = match.team1.id === team.id
        && [match.team1.player || match.team1.player1, match.team1.player2].includes(oddName);
      const onTeam2 = match.team2.id === team.id
        && [match.team2.player || match.team2.player1, match.team2.player2].includes(oddName);
      return onTeam1 || onTeam2;
    }).length;

    const team1OddMatches = countOddInTeam(finalists[0]);
    const team2OddMatches = countOddInTeam(finalists[1]);
    const targetIndex = team2OddMatches > team1OddMatches ? 1 : 0;
    const targetTeam = finalists[targetIndex];
    const p1 = targetTeam.player || targetTeam.player1;
    const p2 = targetTeam.player2;
    const p1Points = individualPoints[p1] || 0;
    const p2Points = individualPoints[p2] || 0;
    const replacePlayer2 = p2 && p2Points <= p1Points;

    const updatedTargetTeam = {
      ...targetTeam,
      ...(replacePlayer2
        ? { player2: oddName }
        : { player1: oddName, player: oddName }),
    };
    const updatedFinalists = targetIndex === 0
      ? [updatedTargetTeam, finalists[1]]
      : [finalists[0], updatedTargetTeam];

    return {
      finalists: updatedFinalists,
      oddPlayerIncluded: true,
      oddPlayerReason: `${oddName} qualified with top individual points (${oddPoints}).`,
    };
  }, [leagueMatchesComplete, fixtures, teams, oddPlayerEnabled, oddPlayerName, calculatePointsTable]);

  const getOrdinalSuffix = (value) => {
    const num = Number(value);
    const mod100 = num % 100;
    if (mod100 >= 11 && mod100 <= 13) return 'th';
    const mod10 = num % 10;
    if (mod10 === 1) return 'st';
    if (mod10 === 2) return 'nd';
    if (mod10 === 3) return 'rd';
    return 'th';
  };

  const getSuggestedNextTournamentName = (name) => {
    const source = String(name || '').trim();
    if (!source) return 'Next Tournament';

    const ordinalMatches = Array.from(source.matchAll(/(\d+)(st|nd|rd|th)\b/gi));
    const lastOrdinal = ordinalMatches[ordinalMatches.length - 1];
    if (lastOrdinal && Number.isFinite(Number(lastOrdinal[1]))) {
      const nextNumber = Number(lastOrdinal[1]) + 1;
      const replacement = `${nextNumber}${getOrdinalSuffix(nextNumber)}`;
      const matchText = lastOrdinal[0];
      const start = lastOrdinal.index ?? source.lastIndexOf(matchText);
      return `${source.slice(0, start)}${replacement}${source.slice(start + matchText.length)}`;
    }

    const numberMatches = Array.from(source.matchAll(/\d+/g));
    const lastNumber = numberMatches[numberMatches.length - 1];
    if (lastNumber && Number.isFinite(Number(lastNumber[0]))) {
      const nextNumber = Number(lastNumber[0]) + 1;
      const matchText = lastNumber[0];
      const start = lastNumber.index ?? source.lastIndexOf(matchText);
      return `${source.slice(0, start)}${nextNumber}${source.slice(start + matchText.length)}`;
    }

    if (/tournament/i.test(source)) {
      return source.replace(/tournament/i, '2nd Tournament');
    }

    return `${source} 2nd Tournament`;
  };

  const openNextTournamentModal = () => {
    setShowHeaderMenu(false);
    setNextTournamentName(getSuggestedNextTournamentName(tournamentName));
    setShowNextTournamentModal(true);
  };

  const openSwapMemberModal = () => {
    setShowHeaderMenu(false);
    if (!teams.length) return;
    const firstTeam = teams[0];
    const firstTeamPlayers = getTeamPlayers(firstTeam);
    setSwapTeamId(String(firstTeam.id));
    setSwapCurrentPlayer(firstTeamPlayers[0] || '');
    setSwapReplacementPlayer('');
    setSwapError('');
    setShowSwapMemberModal(true);
  };

  const handleNextTournamentAction = async (editTeams) => {
    if (nextTournamentPending) return;
    const normalizedName = String(nextTournamentName || '').trim();
    const started = await Promise.resolve(onStartNextTournament({
      editTeams,
      tournamentNameOverride: normalizedName || getSuggestedNextTournamentName(tournamentName),
    }));
    if (started !== false) {
      setActiveTab('fixtures');
      setShowNextTournamentModal(false);
    }
  };

  const handleSwapTeamChange = (value) => {
    setSwapTeamId(value);
    const nextTeam = teams.find(team => String(team.id) === String(value));
    const nextPlayers = getTeamPlayers(nextTeam);
    setSwapCurrentPlayer(nextPlayers[0] || '');
    setSwapError('');
  };

  const handleConfirmSwap = () => {
    const replacementNormalized = String(swapReplacementPlayer || '').trim().toLowerCase();
    if (blockedOpponentPlayers.includes(replacementNormalized)) {
      setSwapError('Cannot pick a player from the current live opposite team. Choose another player.');
      return;
    }

    const success = onSwapTeamMember({
      teamId: swapTeamId,
      currentPlayerName: swapCurrentPlayer,
      replacementPlayerName: swapReplacementPlayer,
    });
    if (success) {
      const replacementNormalized = String(swapReplacementPlayer || '').trim().toLowerCase();
      const futureLeagueMatches = (fixtures || []).filter((match) => {
        if (!match || match.completed) return false;
        const team1Id = String(match.team1?.id || '');
        const team2Id = String(match.team2?.id || '');
        const selectedTeamId = String(swapTeamId || '');
        if (team1Id !== selectedTeamId && team2Id !== selectedTeamId) return false;
        const opponentTeam = team1Id === selectedTeamId ? match.team2 : match.team1;
        const opponentPlayers = getTeamPlayers(opponentTeam).map((name) => String(name || '').trim().toLowerCase());
        return opponentPlayers.includes(replacementNormalized);
      });
      const futureBracketMatches = (Array.isArray(bracket) ? bracket : [])
        .flatMap((round) => (Array.isArray(round) ? round : []))
        .filter((match) => {
          if (!match || match.completed) return false;
          const team1Id = String(match.team1?.id || '');
          const team2Id = String(match.team2?.id || '');
          const selectedTeamId = String(swapTeamId || '');
          if (team1Id !== selectedTeamId && team2Id !== selectedTeamId) return false;
          const opponentTeam = team1Id === selectedTeamId ? match.team2 : match.team1;
          const opponentPlayers = getTeamPlayers(opponentTeam).map((name) => String(name || '').trim().toLowerCase());
          return opponentPlayers.includes(replacementNormalized);
        });
      const clashMatches = [...futureLeagueMatches, ...futureBracketMatches];

      setSwapReplacementPlayer('');
      setSwapError('');
      setShowSwapMemberModal(false);
      if (clashMatches.length > 0) {
        setFutureClashPlayer(String(swapReplacementPlayer || '').trim());
        setFutureClashMatches(clashMatches.map((match) => ({
          id: match.id,
          round: match.round,
          team1: match.team1?.name || 'Team 1',
          team2: match.team2?.name || 'Team 2',
        })));
        setShowFutureClashModal(true);
      }
    }
  };

  const handleFixDuplicatePlayers = () => {
    if (duplicatePlayers.length > 0) {
      const firstDuplicate = duplicatePlayers[0];
      const firstTeam = firstDuplicate.teams?.[0];
      if (firstTeam?.teamId) {
        setSwapTeamId(String(firstTeam.teamId));
      }
      setSwapCurrentPlayer(firstDuplicate.player || '');
    }
    setShowDuplicatePlayerModal(false);
    setShowSwapMemberModal(true);
  };

  const validateDuplicatePlayersAfterGame = () => {
    const duplicates = findDuplicatePlayersAcrossTeams();
    if (duplicates.length > 0) {
      setDuplicatePlayers(duplicates);
      setShowDuplicatePlayerModal(true);
    }
  };

  const setInlineSyncState = useCallback((rowKey, nextState) => {
    const normalizedKey = String(rowKey || '').trim();
    if (!normalizedKey) return;
    setMatchSyncState((prev) => ({
      ...prev,
      [normalizedKey]: {
        ...(prev[normalizedKey] || {}),
        ...(nextState || {}),
      },
    }));
  }, []);

  const scheduleInlineSyncStateClear = useCallback((rowKey, delayMs = 2400) => {
    const normalizedKey = String(rowKey || '').trim();
    if (!normalizedKey) return;
    if (syncTimersRef.current[normalizedKey]) {
      clearTimeout(syncTimersRef.current[normalizedKey]);
    }
    syncTimersRef.current[normalizedKey] = setTimeout(() => {
      setMatchSyncState((prev) => {
        const next = { ...prev };
        delete next[normalizedKey];
        return next;
      });
      delete syncTimersRef.current[normalizedKey];
    }, delayMs);
  }, []);

  const getInlineSyncState = useCallback((rowKey, actionScope = 'score') => {
    const normalizedKey = String(rowKey || '').trim();
    if (actionScope === 'final' && isPendingAction('tournament.final')) {
      return { status: 'syncing', label: 'Saving...' };
    }
    if (
      normalizedKey
      && (
        isPendingAction(`tournament.score.${normalizedKey}`)
        || isPendingAction(`tournament.bracket.${normalizedKey}`)
      )
    ) {
      return { status: 'syncing', label: 'Saving...' };
    }
    return normalizedKey ? (matchSyncState[normalizedKey] || null) : null;
  }, [isPendingAction, matchSyncState]);

  const handleSaveMatchResult = async (matchId, score1, score2) => {
    const key = String(matchId || '').trim();
    setInlineSyncState(key, {
      status: 'syncing',
      label: 'Saving...',
      score1: Number(score1),
      score2: Number(score2),
      updatedAt: Date.now(),
    });
    try {
      const result = await Promise.resolve(onSaveMatchResult(matchId, score1, score2));
      if (result === false) {
        setInlineSyncState(key, { status: 'error', label: 'Retry' });
        scheduleInlineSyncStateClear(key);
        return false;
      }
      setInlineSyncState(key, { status: 'saved', label: 'Saved', updatedAt: Date.now() });
      scheduleInlineSyncStateClear(key);
      setTimeout(validateDuplicatePlayersAfterGame, 0);
      return true;
    } catch {
      setInlineSyncState(key, { status: 'error', label: 'Retry' });
      scheduleInlineSyncStateClear(key);
      return false;
    }
  };

  const handleSaveBracketResult = async (matchId, score1, score2) => {
    const key = String(matchId || '').trim();
    setInlineSyncState(key, {
      status: 'syncing',
      label: 'Saving...',
      score1: Number(score1),
      score2: Number(score2),
      updatedAt: Date.now(),
    });
    try {
      const result = await Promise.resolve(onSaveBracketResult(matchId, score1, score2));
      if (result === false) {
        setInlineSyncState(key, { status: 'error', label: 'Retry' });
        scheduleInlineSyncStateClear(key);
        return false;
      }
      setInlineSyncState(key, { status: 'saved', label: 'Saved', updatedAt: Date.now() });
      scheduleInlineSyncStateClear(key);
      setTimeout(validateDuplicatePlayersAfterGame, 0);
      return true;
    } catch {
      setInlineSyncState(key, { status: 'error', label: 'Retry' });
      scheduleInlineSyncStateClear(key);
      return false;
    }
  };

  const handleSaveFinalResult = async (score1, score2, finalistsOverride = null) => {
    const key = 'final';
    setInlineSyncState(key, {
      status: 'syncing',
      label: 'Saving...',
      score1: Number(score1),
      score2: Number(score2),
      updatedAt: Date.now(),
    });
    try {
      const result = await Promise.resolve(onSaveFinalResult(score1, score2, finalistsOverride));
      if (result === false) {
        setInlineSyncState(key, { status: 'error', label: 'Retry' });
        scheduleInlineSyncStateClear(key);
        return false;
      }
      setInlineSyncState(key, { status: 'saved', label: 'Saved', updatedAt: Date.now() });
      scheduleInlineSyncStateClear(key);
      setTimeout(validateDuplicatePlayersAfterGame, 0);
      return true;
    } catch {
      setInlineSyncState(key, { status: 'error', label: 'Retry' });
      scheduleInlineSyncStateClear(key);
      return false;
    }
  };

  const tournamentModeLabel = (() => {
    if (tournamentFormat === 'league') return 'League + Final';
    if (tournamentFormat === 'knockoutByes' || tournamentFormat === 'playInFinal') return 'Knockout + Byes';
    if (tournamentFormat === 'semiFinal') return 'Semi Final + Final';
    if (tournamentFormat === 'fullKnockout') return 'Full Knockout';
    return 'Tournament';
  })();

  const desktopTabItems = [
    { key: 'fixtures', label: 'Live' },
    ...(tournamentFormat === 'league'
      ? [
          { key: 'table', label: 'Table' },
          { key: 'stats', label: 'Stats' },
        ]
      : []),
    { key: 'elo', label: 'ELO' },
    { key: 'final', label: 'Final' },
  ];

  return (
    <div className="theme-page app-screen-live variant-a-page">
      <div className="sticky top-0 tour-sticky-header z-[130]">
        <div className="max-w-5xl mx-auto px-3 sm:px-4 pt-3">
          <div className="variant-a-topbar">
            <div className="flex-1">
              {isEditingName ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={tempTournamentName}
                    onChange={(e) => setTempTournamentName(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        setTournamentName(tempTournamentName);
                        setIsEditingName(false);
                      }
                    }}
                    className="variant-a-edit-input"
                    autoFocus
                  />
                  <button onClick={() => { setTournamentName(tempTournamentName); setIsEditingName(false); }}
                    className="variant-a-edit-action">✓</button>
                  <button onClick={() => { setTempTournamentName(tournamentName); setIsEditingName(false); }}
                    className="variant-a-edit-action">✕</button>
                </div>
              ) : (
                <div className="flex items-center gap-2 min-w-0">
                  <div className="min-w-0">
                    <h1 className="variant-a-header-title truncate">🏸 {tournamentName}</h1>
                    <p className="variant-a-header-sub">
                      <span className="variant-a-header-dot" />
                      <span>{headerSyncLabel} · {tournamentModeLabel}</span>
                    </p>
                  </div>
                  <button onClick={() => { setTempTournamentName(tournamentName); setIsEditingName(true); }}
                    className="variant-a-edit-trigger hidden md:inline-flex"
                    aria-label="Edit tournament name"
                  >
                    <Edit2 size={18} />
                  </button>
                </div>
              )}
              {syncStatus && (
                <div className={`tour-sync-chip sync-feedback-chip tour-sync-${syncTone} hidden md:inline-flex mt-2`}>
                  <span className="tour-sync-dot" />
                  <span>{syncStatus.label || 'All changes saved'}</span>
                  {syncStatus.busy && <RefreshCw size={12} className="animate-spin" />}
                </div>
              )}
            </div>
            <div className="hidden md:flex gap-2 flex-wrap items-center">
              <button onClick={onGoHome}
                className="variant-a-header-action tour-action-btn tour-action-blue flex items-center gap-2">
                <House size={18} />
                <span>Home</span>
              </button>
              {champion && (
                <button onClick={onRerunTournament}
                  disabled={rematchPending || resetPending || nextTournamentPending}
                  className="variant-a-header-action btn-brand flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed">
                  <RefreshCw size={18} />
                  <span>{rematchPending ? 'Starting...' : 'Rematch'}</span>
                </button>
              )}
              {champion && (
                <button onClick={openNextTournamentModal}
                  disabled={nextTournamentPending || resetPending}
                  className="variant-a-header-action tour-action-btn tour-action-indigo flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed">
                  <Trophy size={18} />
                  <span>{nextTournamentPending ? 'Starting...' : 'Next Tournament'}</span>
                </button>
              )}
              <button onClick={openSwapMemberModal}
                className="variant-a-header-action tour-action-btn tour-action-cyan flex items-center gap-2">
                <Users size={18} />
                <span>Swap Team Member</span>
              </button>
              <button onClick={onResetTournament}
                disabled={resetPending || rematchPending || nextTournamentPending}
                className="variant-a-header-action tour-action-btn tour-action-red flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed">
                <RotateCcw size={18} />
                <span>{resetPending ? 'Deleting...' : 'Delete & New'}</span>
              </button>
            </div>
            <div className="md:hidden relative">
              <button
                onClick={() => setShowHeaderMenu(prev => !prev)}
                className="variant-a-topbar-menu"
                aria-label="Open tournament actions"
              >
                <MoreVertical size={16} />
              </button>
              {showHeaderMenu && (
                <div className="absolute right-0 mt-2 w-64 tour-actions-panel variant-a-actions-panel rounded-xl shadow-xl p-2 z-[140]">
                  <button
                    onClick={() => {
                      setShowHeaderMenu(false);
                      setTempTournamentName(tournamentName);
                      setIsEditingName(true);
                    }}
                    className="w-full text-left px-3 py-2 rounded-lg tour-actions-item"
                  >
                    Rename Tournament
                  </button>
                  <button
                    onClick={() => {
                      setShowHeaderMenu(false);
                      onGoHome();
                    }}
                    className="w-full text-left px-3 py-2 rounded-lg tour-actions-item"
                  >
                    Home
                  </button>
                  {champion && (
                    <button
                      onClick={() => {
                        setShowHeaderMenu(false);
                        onRerunTournament();
                      }}
                      disabled={rematchPending || resetPending || nextTournamentPending}
                      className="w-full text-left px-3 py-2 rounded-lg tour-actions-item disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {rematchPending ? 'Starting...' : 'Rematch'}
                    </button>
                  )}
                  {champion && (
                    <button
                      onClick={openNextTournamentModal}
                      disabled={nextTournamentPending || resetPending}
                      className="w-full text-left px-3 py-2 rounded-lg tour-actions-item disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {nextTournamentPending ? 'Starting...' : 'Next Tournament'}
                    </button>
                  )}
                  <button
                    onClick={openSwapMemberModal}
                    className="w-full text-left px-3 py-2 rounded-lg tour-actions-item"
                  >
                    Swap Team Member
                  </button>
                  <button
                    onClick={() => {
                      setShowHeaderMenu(false);
                      onResetTournament();
                    }}
                    disabled={resetPending || rematchPending || nextTournamentPending}
                    className="w-full text-left px-3 py-2 rounded-lg tour-actions-item danger disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {resetPending ? 'Deleting...' : 'Delete & New'}
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="hidden md:flex gap-2 overflow-x-auto py-3 scrollbar-hide">
            {desktopTabItems.map((item) => (
              <button
                key={item.key}
                onClick={() => setActiveTab(item.key)}
                className={`variant-a-desktop-tab tour-tab-btn ${
                  activeTab === item.key ? 'tour-tab-active' : ''
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div
        className="max-w-5xl mx-auto px-3 sm:px-4 py-3 sm:py-4 pb-28 md:pb-6 tour-gesture-shell"
        onTouchStart={handleContentTouchStart}
        onTouchMove={handleContentTouchMove}
        onTouchEnd={handleContentTouchEnd}
        onTouchCancel={handleContentTouchEnd}
      >
        {isMobileViewport && typeof onRefreshTournament === 'function' && (
          <div
            className={`tour-pull-indicator ${
              pullDistance >= 62 ? 'is-ready' : ''
            } ${isPullRefreshing ? 'is-refreshing' : ''}`}
            style={{
              transform: `translateY(${Math.max(-14, pullDistance - 40)}px)`,
              opacity: pullDistance > 0 || isPullRefreshing ? 1 : 0,
            }}
          >
            <span>
              {isPullRefreshing
                ? 'Refreshing live tournament...'
                : pullDistance >= 62
                  ? 'Release to refresh'
                  : 'Pull down to refresh'}
            </span>
            {(isPullRefreshing || pullDistance >= 62) && <RefreshCw size={14} className={isPullRefreshing ? 'animate-spin' : ''} />}
          </div>
        )}

        <AnimatePresence mode="wait" initial={false}>
          {activeTab === 'fixtures' && (
            <FixturesTab
              key="tab-fixtures"
              isActive
              tournamentFormat={tournamentFormat}
              currentMatch={currentMatch}
              onSaveMatchResult={handleSaveMatchResult}
              nextMatches={nextMatches}
              onPrioritizeMatch={onPrioritizeMatch}
              playerRatings={playerRatings}
              playerPhotos={playerPhotos}
              pointsTable={pointsTable}
              tournamentHistory={tournamentHistory}
              casualMatches={casualMatches}
              getInlineSyncState={getInlineSyncState}
              liveActivityEvents={liveActivityEvents}
              fixtures={fixtures}
              bracket={bracket}
              selectedBracketMatch={selectedBracketMatch}
              setSelectedBracketMatch={setSelectedBracketMatch}
              onSaveBracketResult={handleSaveBracketResult}
              leagueMatchesComplete={leagueMatchesComplete}
              onGoToFinal={() => setActiveTab('final')}
            />
          )}

          {activeTab === 'table' && (
            <TableTab
              key="tab-table"
              isActive
              tournamentFormat={tournamentFormat}
              pointsTable={pointsTable}
              pointsTableRankMovement={pointsTableRankMovement}
              getTeamFormMeta={getTeamFormMeta}
            />
          )}

          {activeTab === 'stats' && (
            <StatsTab
              key="tab-stats"
              isActive
              tournamentFormat={tournamentFormat}
              playerStats={displayPlayerStats}
              playerPhotos={playerPhotos}
              playerRatings={playerRatings}
              setSelectedPlayerName={setSelectedPlayerName}
            />
          )}

          {activeTab === 'elo' && (
            <MotionSection
              key="tab-elo"
              variants={tabContentMotionVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="variant-a-card"
            >
              <p className="variant-a-section-label">ELO rankings</p>
              {displayEloLeaderboard.length === 0 ? (
                <div className="variant-a-empty-card">
                  <p>Complete matches to build the leaderboard.</p>
                </div>
              ) : (
                <>
                  <div className="variant-a-elo-list">
                    {displayEloLeaderboard.map((player, index) => {
                      const lastMatch = player.history?.[player.history.length - 1];
                      const delta = Number(lastMatch?.change || 0);
                      const playerTeam = teams.find((team) => (
                        [team.player, team.player1, team.player2].filter(Boolean).includes(player.name)
                      ));
                      const matchesPlayed = Number(player?.matchesPlayed || 0);
                      return (
                        <div key={player.name} className="variant-a-elo-row">
                          <div className="variant-a-elo-left">
                            <span className={`variant-a-elo-rank ${index < 2 ? 'variant-a-elo-rank-top' : ''}`}>{index + 1}</span>
                            <PlayerAvatar name={player.name} photoUrl={playerPhotos[player.name]} size="sm" />
                            <div className="min-w-0">
                              <button
                                type="button"
                                onClick={() => setSelectedPlayerName(player.name)}
                                className="variant-a-elo-name"
                              >
                                {player.name}
                              </button>
                              <p className="variant-a-elo-team">
                                {playerTeam?.name || (matchesPlayed > 0 ? `${matchesPlayed} match${matchesPlayed === 1 ? '' : 'es'}` : 'Leaderboard')}
                              </p>
                            </div>
                          </div>
                          <div className="variant-a-elo-right">
                            <p className="variant-a-elo-value">{player.rating}</p>
                            <p className={`variant-a-elo-delta ${delta > 0 ? 'variant-a-elo-delta-up' : delta < 0 ? 'variant-a-elo-delta-down' : ''}`}>
                              {delta > 0 ? '+' : ''}{delta}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <p className="variant-a-elo-footnote">Deltas update after each match</p>
                </>
              )}
            </MotionSection>
          )}

          {activeTab === 'final' && (
            <FinalTab
              key="tab-final"
              isActive
              tournamentFormat={tournamentFormat}
              champion={champion}
              teams={teams}
              fixtures={fixtures}
              bracket={bracket}
              completedTournamentRecord={completedTournamentRecord}
              championBurstActive={showChampionBurst}
              championConfettiPieces={championConfettiPieces}
              setSelectedPlayerName={setSelectedPlayerName}
              leagueMatchesComplete={leagueMatchesComplete}
              finalSelection={finalSelection}
              handleSaveFinalResult={handleSaveFinalResult}
              getInlineSyncState={getInlineSyncState}
              playerRatings={playerRatings}
            />
          )}
        </AnimatePresence>
      </div>

      <div className="md:hidden tour-command-bar-shell">
        <div className="tour-command-bar" style={{ '--tour-command-cols': mobileCommandItems.length }}>
          {mobileCommandItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                type="button"
                onClick={item.onClick}
                className={`tour-command-btn ${item.active ? 'tour-command-btn-active' : ''}`}
              >
                {item.glyph ? <span className="tour-command-glyph">{item.glyph}</span> : <Icon size={16} />}
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {showNextTournamentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[240] p-4 app-overlay">
          <div className="bg-white rounded-2xl max-w-md w-full app-modal-shell tour-modal-shell">
            <div className="app-gradient-band p-5">
              <h3 className="text-lg sm:text-xl font-bold text-white">Start Next Tournament</h3>
              <p className="text-xs sm:text-sm text-indigo-100 mt-1">
                OK starts directly with same teams. Edit opens team edit page.
              </p>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Tournament Name</label>
                <input
                  type="text"
                  value={nextTournamentName}
                  onChange={(e) => setNextTournamentName(e.target.value)}
                  className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-indigo-500"
                  placeholder="Enter tournament name"
                  autoFocus
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowNextTournamentModal(false)}
                  disabled={nextTournamentPending}
                  className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={() => { void handleNextTournamentAction(true); }}
                  disabled={nextTournamentPending}
                  className="px-4 py-2 rounded-lg bg-amber-100 text-amber-800 hover:bg-amber-200 font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {nextTournamentPending ? 'Starting...' : 'Edit'}
                </button>
                <button
                  onClick={() => { void handleNextTournamentAction(false); }}
                  disabled={nextTournamentPending}
                  className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {nextTournamentPending ? 'Starting...' : 'OK'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showSwapMemberModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[240] p-4 app-overlay">
          <div className="bg-white rounded-2xl max-w-md w-full app-modal-shell tour-modal-shell">
            <div className="app-gradient-band p-5">
              <h3 className="text-lg sm:text-xl font-bold text-white">Swap Team Member</h3>
              <p className="text-xs sm:text-sm text-cyan-100 mt-1">
                Replace one team member for upcoming matches. Other teams remain unchanged.
              </p>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Team</label>
                <select
                  value={swapTeamId}
                  onChange={(e) => handleSwapTeamChange(e.target.value)}
                  className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-cyan-500 bg-white"
                >
                  {teams.map(team => (
                    <option key={team.id} value={String(team.id)}>
                      {team.emoji} {team.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Current Member</label>
                <select
                  value={swapCurrentPlayer}
                  onChange={(e) => setSwapCurrentPlayer(e.target.value)}
                  className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-cyan-500 bg-white"
                >
                  {selectedSwapTeamPlayers.map(player => (
                    <option key={player} value={player}>{player}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Replacement Player</label>
                <AutocompleteInput
                  value={swapReplacementPlayer}
                  onChange={(value) => {
                    setSwapReplacementPlayer(value);
                    if (swapError) setSwapError('');
                  }}
                  placeholder="Type or pick player name"
                  playerDatabase={filteredSwapCandidatePlayers}
                />
              </div>
              {swapError && (
                <p className="text-sm text-red-600">{swapError}</p>
              )}

              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 max-h-32 overflow-y-auto">
                <p className="text-xs font-semibold text-gray-700 mb-1">Swap History ({swapHistory.length})</p>
                {swapHistory.length === 0 ? (
                  <p className="text-xs text-gray-500">No swaps yet.</p>
                ) : (
                  <div className="space-y-1">
                    {swapHistory.map((entry) => (
                      <p key={entry.id} className="text-xs text-gray-700">
                        {entry.teamName}: {entry.fromPlayer}{' -> '}{entry.toPlayer}
                      </p>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => {
                    setShowSwapMemberModal(false);
                    setSwapError('');
                  }}
                  className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmSwap}
                  className="px-4 py-2 rounded-lg bg-cyan-600 text-white hover:bg-cyan-700 font-semibold"
                >
                  Swap
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showDuplicatePlayerModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[240] p-4 app-overlay">
          <div className="bg-white rounded-2xl max-w-md w-full app-modal-shell tour-modal-shell">
            <div className="app-gradient-band p-5">
              <h3 className="text-lg sm:text-xl font-bold text-white">Duplicate Player Found</h3>
              <p className="text-xs sm:text-sm text-red-100 mt-1">
                Same player is assigned to multiple teams. Please fix before continuing.
              </p>
            </div>
            <div className="p-5 space-y-4">
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 space-y-2">
                {duplicatePlayers.map((item) => (
                  <div key={item.player} className="text-sm text-red-800">
                    <span className="font-semibold">{item.player}</span>: {item.teams.map(t => t.teamName).join(', ')}
                  </div>
                ))}
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={handleFixDuplicatePlayers}
                  className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 font-semibold"
                >
                  Fix Now
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showFutureClashModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[240] p-4 app-overlay">
          <div className="bg-white rounded-2xl max-w-md w-full app-modal-shell tour-modal-shell">
            <div className="app-gradient-band p-5">
              <h3 className="text-lg sm:text-xl font-bold text-white">Future Match Conflict</h3>
              <p className="text-xs sm:text-sm text-amber-100 mt-1">
                Swap completed, but {futureClashPlayer} is also on opponent side in upcoming match(es).
              </p>
            </div>
            <div className="p-5 space-y-3">
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2">
                {futureClashMatches.map((item) => (
                  <p key={`${item.id}-${item.round || 'r'}`} className="text-sm text-amber-900">
                    Match {item.id}{item.round ? ` (Round ${item.round})` : ''}: {item.team1} vs {item.team2}
                  </p>
                ))}
              </div>
              <div className="flex justify-end">
                <button
                  onClick={() => {
                    setShowFutureClashModal(false);
                    setFutureClashMatches([]);
                    setFutureClashPlayer('');
                  }}
                  className="px-4 py-2 rounded-lg bg-amber-600 text-white hover:bg-amber-700 font-semibold"
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        </div>
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
        tournamentHistory={tournamentHistory}
        casualMatches={casualMatches}
        onUpdatePhoto={onUpdatePlayerPhoto}
        onClose={() => setSelectedPlayerName(null)}
      />
    </div>
  );
};

export default TournamentView;
