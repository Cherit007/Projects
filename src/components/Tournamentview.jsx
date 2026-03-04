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
  Menu,
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
import PlayerAvatar from './PlayerAvatar';

const parseActivityTimestamp = (value) => {
  if (!value) return null;
  const ts = Date.parse(String(value));
  return Number.isFinite(ts) ? ts : null;
};

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

const TournamentView = ({
  tournamentName,
  setTournamentName,
  format,
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
    tournamentFormat,
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
  const championBurstKeyRef = useRef('');
  const isPendingAction = (actionKey) => Boolean(getActionPending?.(actionKey));
  const resetPending = isPendingAction('tournament.reset');
  const rematchPending = isPendingAction('tournament.rematch');
  const nextTournamentPending = isPendingAction('tournament.next');
  const syncTone = String(syncStatus?.tone || 'saved');
  const mobileCommandItems = useMemo(() => {
    const items = [
      {
        key: 'home',
        label: 'Home',
        icon: House,
        onClick: onGoHome,
        active: false,
      },
      {
        key: 'fixtures',
        label: 'Live',
        icon: RefreshCw,
        onClick: () => setActiveTab('fixtures'),
        active: activeTab === 'fixtures',
      },
    ];

    if (tournamentFormat === 'league') {
      items.push({
        key: 'table',
        label: 'Table',
        icon: TrendingUp,
        onClick: () => setActiveTab('table'),
        active: activeTab === 'table',
      });
      items.push({
        key: 'stats',
        label: 'Stats',
        icon: Users,
        onClick: () => setActiveTab('stats'),
        active: activeTab === 'stats',
      });
    }

    items.push({
      key: 'elo',
      label: 'ELO',
      icon: TrendingUp,
      onClick: () => setActiveTab('elo'),
      active: activeTab === 'elo',
    });
    items.push({
      key: 'final',
      label: 'Final',
      icon: Trophy,
      onClick: () => setActiveTab('final'),
      active: activeTab === 'final',
    });

    return items;
  }, [activeTab, onGoHome, tournamentFormat]);

  useEffect(() => () => {
    Object.values(syncTimersRef.current || {}).forEach((timerId) => {
      clearTimeout(timerId);
    });
    syncTimersRef.current = {};
    if (championBurstTimerRef.current) {
      clearTimeout(championBurstTimerRef.current);
      championBurstTimerRef.current = null;
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
  
  // Filter ELO leaderboard to only show players in current tournament
  const currentTournamentPlayers = useMemo(() => {
    const players = new Set();
    teams.forEach((team) => {
      if (team.player) players.add(team.player);
      if (team.player1) players.add(team.player1);
      if (team.player2) players.add(team.player2);
    });
    fixtures.forEach((match) => {
      [match?.team1?.player || match?.team1?.player1, match?.team1?.player2, match?.team2?.player || match?.team2?.player1, match?.team2?.player2]
        .filter(Boolean)
        .forEach((name) => players.add(name));
    });
    return players;
  }, [teams, fixtures]);

  const allEloLeaderboard = useMemo(() => getPlayerLeaderboard(playerRatings), [playerRatings, getPlayerLeaderboard]);
  const eloLeaderboard = useMemo(
    () => allEloLeaderboard.filter((player) => currentTournamentPlayers.has(player.name)),
    [allEloLeaderboard, currentTournamentPlayers]
  );
  const eloFormMetaByPlayer = useMemo(() => {
    const map = new Map();
    eloLeaderboard.forEach((player) => {
      const history = Array.isArray(player?.history) ? player.history : [];
      const trendSeries = history
        .slice(-4)
        .map((entry) => Number(entry?.change))
        .map((value) => (value > 0 ? 'W' : value < 0 ? 'L' : 'D'));
      map.set(player.name, buildFormSummary(trendSeries));
    });
    return map;
  }, [eloLeaderboard]);
  const selectedPlayerProfile = selectedPlayerName ? playerRatings[selectedPlayerName] : null;
  const selectedPlayerLeaderboardRank = useMemo(() => {
    if (!selectedPlayerName) return null;
    const target = selectedPlayerName.trim().toLowerCase();
    const index = allEloLeaderboard.findIndex((entry) => (
      String(entry?.name || '').trim().toLowerCase() === target
    ));
    return index >= 0 ? index + 1 : null;
  }, [selectedPlayerName, allEloLeaderboard]);
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
  const eloGamificationMap = useMemo(() => Object.fromEntries(
    eloLeaderboard.map(player => [
      player.name,
      buildPlayerGamification({
        playerName: player.name,
        tournamentHistory,
        casualMatches,
      }),
    ])
  ), [eloLeaderboard, tournamentHistory, casualMatches]);
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
        const entryIds = [entry?.appwriteId, entry?.id]
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
      setChampionBurstActive(false);
      if (!champion) {
        championBurstKeyRef.current = '';
      }
      return;
    }
    const burstKey = `${String(currentTournamentId || tournamentName || 'live')}:${String(champion?.name || champion?.player || champion?.player1 || '')}`;
    if (championBurstKeyRef.current === burstKey) return;
    championBurstKeyRef.current = burstKey;
    setChampionBurstActive(true);
    if (championBurstTimerRef.current) {
      clearTimeout(championBurstTimerRef.current);
    }
    championBurstTimerRef.current = setTimeout(() => {
      setChampionBurstActive(false);
      championBurstTimerRef.current = null;
    }, 1800);
  }, [champion, activeTab, currentTournamentId, tournamentName]);

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

  return (
    <div className="theme-page app-screen-live">
      {/* Header */}
      <div className="sticky top-0 theme-topbar tour-sticky-header shadow-md z-[130]">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
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
                    className="text-2xl md:text-3xl font-bold text-gray-800 border-2 border-blue-500 rounded-lg px-3 py-1 outline-none"
                    autoFocus
                  />
                  <button onClick={() => { setTournamentName(tempTournamentName); setIsEditingName(false); }}
                    className="text-green-600 hover:text-green-700 p-2 text-2xl">✓</button>
                  <button onClick={() => { setTempTournamentName(tournamentName); setIsEditingName(false); }}
                    className="text-red-600 hover:text-red-700 p-2 text-2xl">✕</button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl md:text-3xl font-bold text-gray-800 app-section-heading">🏸 {tournamentName}</h1>
                  <button onClick={() => { setTempTournamentName(tournamentName); setIsEditingName(true); }}
                    className="text-gray-400 hover:text-gray-600 p-1">
                    <Edit2 size={18} />
                  </button>
                </div>
              )}
              <p className="text-sm text-gray-600">
                {tournamentFormat === 'league' && `${format} League Match(es) + Final`}
                {(tournamentFormat === 'knockoutByes' || tournamentFormat === 'playInFinal') && 'Knockout + Byes'}
                {tournamentFormat === 'semiFinal' && 'Semi Final + Final'}
                {tournamentFormat === 'fullKnockout' && 'Full Knockout Bracket'}
              </p>
              {syncStatus && (
                <div className={`tour-sync-chip sync-feedback-chip tour-sync-${syncTone}`}>
                  <span className="tour-sync-dot" />
                  <span>{syncStatus.label || 'All changes saved'}</span>
                  {syncStatus.busy && <RefreshCw size={12} className="animate-spin" />}
                </div>
              )}
            </div>
            <div className="hidden md:flex gap-2 flex-wrap">
              <button onClick={onGoHome}
                className="tour-action-btn tour-action-blue flex items-center gap-2 px-4 py-2 rounded-xl transition-all font-semibold">
                <House size={18} />
                <span>Home</span>
              </button>
              {champion && (
                <button onClick={onRerunTournament}
                  disabled={rematchPending || resetPending || nextTournamentPending}
                  className="btn-brand flex items-center gap-2 px-4 py-2 rounded-xl hover:shadow-lg transition-all font-semibold disabled:opacity-60 disabled:cursor-not-allowed">
                  <RefreshCw size={18} />
                  <span>{rematchPending ? 'Starting...' : 'Rematch'}</span>
                </button>
              )}
              {champion && (
                <button onClick={openNextTournamentModal}
                  disabled={nextTournamentPending || resetPending}
                  className="tour-action-btn tour-action-indigo flex items-center gap-2 px-4 py-2 rounded-xl transition-all font-semibold disabled:opacity-60 disabled:cursor-not-allowed">
                  <Trophy size={18} />
                  <span>{nextTournamentPending ? 'Starting...' : 'Next Tournament'}</span>
                </button>
              )}
              <button onClick={openSwapMemberModal}
                className="tour-action-btn tour-action-cyan flex items-center gap-2 px-4 py-2 rounded-xl transition-all font-semibold">
                <Users size={18} />
                <span>Swap Team Member</span>
              </button>
              <button onClick={onResetTournament}
                disabled={resetPending || rematchPending || nextTournamentPending}
                className="tour-action-btn tour-action-red flex items-center gap-2 px-4 py-2 rounded-xl transition-all disabled:opacity-60 disabled:cursor-not-allowed">
                <RotateCcw size={18} />
                <span>{resetPending ? 'Deleting...' : 'Delete & New'}</span>
              </button>
            </div>
            <div className="md:hidden relative">
              <button
                onClick={() => setShowHeaderMenu(prev => !prev)}
                className="tour-mobile-actions-btn flex items-center gap-2 px-3 py-2 rounded-xl font-semibold"
              >
                <Menu size={18} />
                <span>Actions</span>
              </button>
              {showHeaderMenu && (
                <div className="absolute right-0 mt-2 w-64 tour-actions-panel rounded-xl shadow-xl p-2 z-[140]">
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

          {/* Tabs */}
          <div className="hidden md:flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            <button onClick={() => setActiveTab('fixtures')}
              className={`tour-tab-btn px-3 sm:px-4 py-2 rounded-full font-semibold transition-all whitespace-nowrap text-sm sm:text-base ${
                activeTab === 'fixtures' ? 'tour-tab-active' : ''}`}>
              Fixtures
            </button>
            {tournamentFormat === 'league' && (
              <>
                <button onClick={() => setActiveTab('table')}
                  className={`tour-tab-btn px-3 sm:px-4 py-2 rounded-full font-semibold transition-all whitespace-nowrap text-sm sm:text-base ${
                    activeTab === 'table' ? 'tour-tab-active' : ''}`}>
                  Table
                </button>
                <button onClick={() => setActiveTab('stats')}
                  className={`tour-tab-btn px-3 sm:px-4 py-2 rounded-full font-semibold transition-all whitespace-nowrap text-sm sm:text-base ${
                    activeTab === 'stats' ? 'tour-tab-active' : ''}`}>
                  Stats
                </button>
              </>
            )}
            <button onClick={() => setActiveTab('elo')}
              className={`tour-tab-btn px-3 sm:px-4 py-2 rounded-full font-semibold transition-all whitespace-nowrap text-sm sm:text-base ${
                activeTab === 'elo' ? 'tour-tab-active' : ''}`}>
              ELO
            </button>
            <button onClick={() => setActiveTab('final')}
              className={`tour-tab-btn px-3 sm:px-4 py-2 rounded-full font-semibold transition-all whitespace-nowrap text-sm sm:text-base ${
                activeTab === 'final' ? 'tour-tab-active' : ''}`}>
              Final
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div
        className="max-w-7xl mx-auto px-4 py-6 pb-28 md:pb-6 tour-gesture-shell"
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
              tournamentName={tournamentName}
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
              playerStats={playerStats}
              playerPhotos={playerPhotos}
              setSelectedPlayerName={setSelectedPlayerName}
            />
          )}

          {activeTab === 'elo' && (
            <motion.section
              key="tab-elo"
              variants={tabContentMotionVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="bg-white rounded-xl sm:rounded-2xl overflow-hidden tour-elo-card app-surface-card app-card-tier-primary app-rhythm-panel"
            >
              <div className="app-gradient-band p-4 sm:p-6">
                <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2 app-section-heading">
                  <Trophy size={20} className="sm:w-6 sm:h-6" /> ELO Leaderboard
                </h2>
              </div>
              {eloLeaderboard.length === 0 ? (
                <div className="p-8 sm:p-12 text-center text-gray-500">
                  <Trophy size={40} className="mx-auto mb-4 text-gray-300 sm:w-12 sm:h-12" />
                  <p className="text-sm sm:text-base">Complete matches to build the leaderboard!</p>
                </div>
              ) : (
                <>
                  <div className="mobile-leaderboard-cards p-3 sm:p-4">
                    {eloLeaderboard.map((player, index) => {
                      const lastMatch = player.history?.[player.history.length - 1];
                      const delta = Number(lastMatch?.change || 0);
                      const trendMeta = eloFormMetaByPlayer.get(player.name) || buildFormSummary([]);
                      const moveTone = delta > 0 ? 'up' : delta < 0 ? 'down' : 'neutral';
                      return (
                        <article key={`elo-card-${player.name}`} className="leaderboard-mobile-card app-surface-card app-card-tier-secondary">
                          <div className="leaderboard-mobile-top">
                            <span className={`leaderboard-rank-badge ${index < 3 ? 'leaderboard-rank-badge-podium' : ''}`}>#{index + 1}</span>
                            <span className={`leaderboard-move-chip leaderboard-move-chip-${moveTone}`}>
                              {delta > 0 ? <ArrowUpRight size={13} /> : delta < 0 ? <ArrowDownRight size={13} /> : <Minus size={13} />}
                              <span>{delta > 0 ? '+' : ''}{delta}</span>
                            </span>
                          </div>
                          <div className="leaderboard-mobile-team">
                            <PlayerAvatar name={player.name} photoUrl={playerPhotos[player.name]} size="sm" />
                            <div className="min-w-0">
                              <button
                                type="button"
                                onClick={() => setSelectedPlayerName(player.name)}
                                className="font-bold text-sm leading-tight text-left truncate"
                              >
                                {player.name}
                              </button>
                              <p className="text-xs opacity-80">{player.matchesPlayed} matches</p>
                            </div>
                          </div>
                          <div className="leaderboard-mobile-metrics">
                            <span className={`leaderboard-stat-chip ${player.rating >= 1200 ? 'leaderboard-stat-chip-up' : ''}`}>ELO {player.rating}</span>
                            <span className={`leaderboard-stat-chip ${moveTone === 'up' ? 'leaderboard-stat-chip-up' : moveTone === 'down' ? 'leaderboard-stat-chip-down' : ''}`}>
                              Δ {delta > 0 ? '+' : ''}{delta}
                            </span>
                          </div>
                          <div className="leaderboard-mobile-bottom">
                            <span className={`leaderboard-form-chip leaderboard-form-chip-${trendMeta.tone}`}>
                              Form {trendMeta.label}
                            </span>
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
                    <table className="w-full min-w-[820px] elo-table-polished">
                      <thead className="bg-gray-100 tour-table-head">
                        <tr>
                          <th className="px-2 sm:px-4 py-3 text-left text-xs sm:text-sm font-bold text-gray-700">Rank</th>
                          <th className="px-2 sm:px-4 py-3 text-left text-xs sm:text-sm font-bold text-gray-700">Player</th>
                          <th className="px-2 sm:px-4 py-3 text-center text-xs sm:text-sm font-bold text-gray-700">Rating</th>
                          <th className="px-2 sm:px-4 py-3 text-center text-xs sm:text-sm font-bold text-gray-700">Matches</th>
                          <th className="px-2 sm:px-4 py-3 text-center text-xs sm:text-sm font-bold text-gray-700">Move</th>
                          <th className="px-2 sm:px-4 py-3 text-center text-xs sm:text-sm font-bold text-gray-700">Form</th>
                          <th className="px-2 sm:px-4 py-3 text-center text-xs sm:text-sm font-bold text-gray-700">Δ ELO</th>
                        </tr>
                      </thead>
                      <tbody>
                        {eloLeaderboard.map((player, index) => {
                          const lastMatch = player.history?.[player.history.length - 1];
                          const delta = Number(lastMatch?.change || 0);
                          const moveTone = delta > 0 ? 'up' : delta < 0 ? 'down' : 'neutral';
                          const trendMeta = eloFormMetaByPlayer.get(player.name) || buildFormSummary([]);
                          return (
                            <tr key={player.name} className="tour-data-row border-b border-gray-200 hover:bg-gray-50">
                              <td className="px-2 sm:px-4 py-3 sm:py-4 text-center">
                                <span className={`leaderboard-rank-badge ${index < 3 ? 'leaderboard-rank-badge-podium' : ''}`}>#{index + 1}</span>
                              </td>
                              <td className="px-2 sm:px-4 py-3 sm:py-4">
                                <div className="flex items-center gap-2 min-w-0 elo-player-cell">
                                  <PlayerAvatar name={player.name} photoUrl={playerPhotos[player.name]} size="sm" />
                                  <button
                                    type="button"
                                    onClick={() => setSelectedPlayerName(player.name)}
                                    className="font-bold text-sm sm:text-base text-blue-700 hover:text-blue-900 hover:underline truncate text-left min-w-0 elo-player-name"
                                  >
                                    {player.name}
                                  </button>
                                  {eloGamificationMap[player.name]?.level && (
                                    <span className="text-[10px] sm:text-[11px] font-semibold text-indigo-700 bg-indigo-100 px-1.5 py-0.5 rounded-full elo-level-badge elo-level-inline max-w-[132px] truncate">
                                      {eloGamificationMap[player.name].level.icon} {eloGamificationMap[player.name].level.name}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-2 sm:px-4 py-3 sm:py-4 text-center">
                                <span className={`px-2 sm:px-4 py-1 sm:py-2 rounded-full font-bold text-sm sm:text-base elo-rating-chip ${
                                  player.rating >= 1200 ? 'elo-rating-gold' :
                                  player.rating >= 1000 ? 'elo-rating-green' :
                                  'elo-rating-neutral'
                                }`}>
                                  {player.rating}
                                </span>
                              </td>
                              <td className="px-2 sm:px-4 py-3 sm:py-4 text-center font-semibold text-sm">{player.matchesPlayed}</td>
                              <td className="px-2 sm:px-4 py-3 sm:py-4 text-center">
                                <span className={`leaderboard-move-chip leaderboard-move-chip-${moveTone}`}>
                                  {delta > 0 ? <ArrowUpRight size={13} /> : delta < 0 ? <ArrowDownRight size={13} /> : <Minus size={13} />}
                                  <span>{delta > 0 ? '+' : ''}{delta}</span>
                                </span>
                              </td>
                              <td className="px-2 sm:px-4 py-3 sm:py-4 text-center">
                                <span className={`leaderboard-form-chip leaderboard-form-chip-${trendMeta.tone}`}>
                                  {trendMeta.label}
                                </span>
                              </td>
                              <td className="px-2 sm:px-4 py-3 sm:py-4 text-center">
                                <span className={`rank-change-indicator text-sm ${delta > 0 ? 'rank-change-up text-green-600' : delta < 0 ? 'rank-change-down text-red-600' : ''}`}>
                                  {delta > 0 ? '+' : ''}{delta}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="p-3 sm:p-4 bg-gray-50 text-xs text-gray-600 tour-elo-footnote">
                    <p>All players start at 1000 • Ratings update after each match</p>
                  </div>
                </>
              )}
            </motion.section>
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
              championBurstActive={championBurstActive}
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
                <Icon size={16} />
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
        onUpdatePhoto={onUpdatePlayerPhoto}
        onClose={() => setSelectedPlayerName(null)}
      />
    </div>
  );
};

export default TournamentView;
