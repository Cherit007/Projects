import React, { useState, useEffect, useRef } from 'react';
import { Trophy, Users, Calendar, RotateCcw, Share2, History, TrendingUp, RefreshCw, ChevronDown, Edit2, X } from 'lucide-react';
import AutocompleteInput from './components/AutocompleteInput';
import MatchCard from './components/MatchCard';
import FinalMatchCard from './components/FinalMatchCard';
import Toast from './components/Toast';
import ConfirmActionModal from './components/ConfirmActionModal';
import { 
  calculatePointsTable, 
  calculatePlayerStats, 
  calculateCumulativePlayerStats,
  generateFixtures as createFixtures,
  updatePlayerRatingsAfterMatch,
  getPlayerLeaderboard
} from './utils/calculations';

const DEFAULT_TEAM_CONFIGS = [
  { emoji: '🔥', name: 'Fire Smashers', player1: 'Alex Chen', player2: 'Sarah Kim' },
  { emoji: '⚡', name: 'Thunder Shots', player1: 'Mike Johnson', player2: 'Emma Davis' },
  { emoji: '🌟', name: 'Star Rallyers', player1: 'David Lee', player2: 'Lisa Wang' },
  { emoji: '💎', name: 'Diamond Drops', player1: 'Chris Brown', player2: 'Amy Liu' },
  { emoji: '🎯', name: 'Ace Strikers', player1: 'Tom Wilson', player2: 'Kate Zhang' },
  { emoji: '🚀', name: 'Rocket Serves', player1: 'Ryan Park', player2: 'Mia Chen' },
  { emoji: '👑', name: 'Royal Netters', player1: 'James Garcia', player2: 'Sophia Lee' },
  { emoji: '🌊', name: 'Wave Smashers', player1: 'Daniel Kim', player2: 'Olivia Wu' },
  { emoji: '🏆', name: 'Trophy Hunters', player1: 'Kevin Ng', player2: 'Grace Park' },
  { emoji: '⭐', name: 'Stellar Shuttles', player1: 'Brian Li', player2: 'Rachel Tan' },
  { emoji: '🎨', name: 'Art of Smash', player1: 'Eric Chen', player2: 'Jessica Yu' },
  { emoji: '🌈', name: 'Rainbow Rallies', player1: 'Andrew Kim', player2: 'Nicole Wang' },
];

const BadmintonFixtureGenerator = () => {
  const [step, setStep] = useState('setup');
  const [tournamentName, setTournamentName] = useState('');
  const [numTeams, setNumTeams] = useState(3);
  const [format, setFormat] = useState('1');
  const [teams, setTeams] = useState([]);
  const [fixtures, setFixtures] = useState([]);
  const [activeTab, setActiveTab] = useState('fixtures');
  const [toast, setToast] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [loading, setLoading] = useState(false);
  const [tournamentHistory, setTournamentHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showAllTimeStats, setShowAllTimeStats] = useState(false);
  const [showEloLeaderboard, setShowEloLeaderboard] = useState(false);
  const [finalMatch, setFinalMatch] = useState(null);
  const [champion, setChampion] = useState(null);
  const [playerDatabase, setPlayerDatabase] = useState([]);
  const [lastTournamentConfig, setLastTournamentConfig] = useState(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempTournamentName, setTempTournamentName] = useState('');
  const [playerRatings, setPlayerRatings] = useState({});
  const confirmResolverRef = useRef(null);
  const tournamentIdSeedRef = useRef(1);

  useEffect(() => {
    const savedHistory = localStorage.getItem('badmintonTournamentHistory');
    if (savedHistory) {
      try {
        const history = JSON.parse(savedHistory);
        setTournamentHistory(history);
        const allPlayers = new Set();
        history.forEach(tournament => {
          tournament.teams?.forEach(team => {
            if (team.player1) allPlayers.add(team.player1);
            if (team.player2) allPlayers.add(team.player2);
          });
        });
        setPlayerDatabase(Array.from(allPlayers));
      } catch (e) {
        console.error('Error loading history:', e);
      }
    }

    const savedConfig = localStorage.getItem('badmintonLastConfig');
    if (savedConfig) {
      try {
        setLastTournamentConfig(JSON.parse(savedConfig));
      } catch (e) {
        console.error('Error loading last config:', e);
      }
    }

    const savedRatings = localStorage.getItem('badmintonPlayerRatings');
    if (savedRatings) {
      try {
        setPlayerRatings(JSON.parse(savedRatings));
      } catch (e) {
        console.error('Error loading ratings:', e);
      }
    }

    const savedCurrentState = localStorage.getItem('badmintonCurrentTournament');
    if (savedCurrentState) {
      try {
        const currentState = JSON.parse(savedCurrentState);
        setStep(currentState.step);
        setTournamentName(currentState.tournamentName);
        setNumTeams(currentState.numTeams);
        setFormat(currentState.format);
        setTeams(currentState.teams);
        setFixtures(currentState.fixtures);
        setActiveTab(currentState.activeTab || 'fixtures');
        setFinalMatch(currentState.finalMatch);
        setChampion(currentState.champion);
      } catch (e) {
        console.error('Error loading current tournament:', e);
      }
    }
  }, []);

  useEffect(() => {
    if (step !== 'setup' && tournamentName) {
      const currentState = {
        step, tournamentName, numTeams, format, teams, fixtures, activeTab, finalMatch, champion,
      };
      localStorage.setItem('badmintonCurrentTournament', JSON.stringify(currentState));
    }
  }, [step, tournamentName, numTeams, format, teams, fixtures, activeTab, finalMatch, champion]);

  useEffect(() => {
    if (tournamentHistory.length > 0) {
      localStorage.setItem('badmintonTournamentHistory', JSON.stringify(tournamentHistory));
    }
  }, [tournamentHistory]);

  useEffect(() => {
    if (Object.keys(playerRatings).length > 0) {
      localStorage.setItem('badmintonPlayerRatings', JSON.stringify(playerRatings));
    }
  }, [playerRatings]);

  useEffect(() => {
    if (step === 'teams') {
        const newTeams = Array.from({ length: numTeams }, (_, i) => ({
          id: i + 1,
          emoji: DEFAULT_TEAM_CONFIGS[i]?.emoji || '🏸',
          name: DEFAULT_TEAM_CONFIGS[i]?.name || `Team ${i + 1}`,
          player1: DEFAULT_TEAM_CONFIGS[i]?.player1 || '',
          player2: DEFAULT_TEAM_CONFIGS[i]?.player2 || '',
        }));
      setTeams(newTeams);
    }
  }, [step, numTeams]);

  const getNextTournamentId = () => {
    const nextId = `legacy-${tournamentIdSeedRef.current}`;
    tournamentIdSeedRef.current += 1;
    return nextId;
  };

  const updatePlayerDatabase = (playerName) => {
    if (playerName && playerName.trim() !== '') {
      setPlayerDatabase(prev => {
        if (!prev.includes(playerName.trim())) {
          return [...prev, playerName.trim()];
        }
        return prev;
      });
    }
  };

  const reuseTournamentConfig = () => {
    if (lastTournamentConfig) {
      setTournamentName(lastTournamentConfig.name + ' (Rematch)');
      setNumTeams(lastTournamentConfig.numTeams);
      setFormat(lastTournamentConfig.format);
      setTeams(lastTournamentConfig.teams.map((team, i) => ({ ...team, id: i + 1 })));
      setStep('teams');
      showToast('Previous tournament loaded! Edit teams or proceed.');
    }
  };

  const generateFixtures = () => {
    setLoading(true);
    setLastTournamentConfig({ name: tournamentName, numTeams: numTeams, format: format, teams: teams });
    localStorage.setItem('badmintonLastConfig', JSON.stringify({ name: tournamentName, numTeams: numTeams, format: format, teams: teams }));
    teams.forEach(team => {
      updatePlayerDatabase(team.player1);
      updatePlayerDatabase(team.player2);
    });
    setTimeout(() => {
      const newFixtures = createFixtures(teams, format);
      setFixtures(newFixtures);
      setStep('tournament');
      setLoading(false);
      showToast('Fixtures generated successfully! 🏸');
    }, 800);
  };

  const saveMatchResult = (matchId, score1, score2) => {
    if (score1 === '' || score2 === '' || score1 === score2) {
      showToast('Please enter valid scores (must be different)', 'error');
      return;
    }
    const match = fixtures.find(m => m.id === matchId);
    const completedMatch = { ...match, score1: parseInt(score1), score2: parseInt(score2), completed: true };
    const updatedRatings = updatePlayerRatingsAfterMatch(playerRatings, completedMatch);
    setPlayerRatings(updatedRatings);
    setFixtures(prev => prev.map(m => m.id === matchId ? completedMatch : m));
    showToast('Result saved! ✓');
  };

  const allLeagueMatchesComplete = () => {
    return fixtures.length > 0 && fixtures.every(match => match.completed);
  };

  const getFinalists = () => {
    if (!allLeagueMatchesComplete()) return null;
    const table = calculatePointsTable(teams, fixtures);
    return [table[0], table[1]];
  };

  const saveFinalResult = (score1, score2) => {
    if (score1 === '' || score2 === '' || score1 === score2) {
      showToast('Please enter valid scores (must be different)', 'error');
      return;
    }
    const finalists = getFinalists();
    const winner = parseInt(score1) > parseInt(score2) ? finalists[0] : finalists[1];
    const finalMatchData = { id: 'final', team1: finalists[0], team2: finalists[1], score1: parseInt(score1), score2: parseInt(score2), completed: true };
    const updatedRatings = updatePlayerRatingsAfterMatch(playerRatings, finalMatchData);
    setPlayerRatings(updatedRatings);
    setFinalMatch({ team1: finalists[0], team2: finalists[1], score1: parseInt(score1), score2: parseInt(score2) });
    setChampion(winner);
    const tournament = {
      id: getNextTournamentId(), name: tournamentName, date: new Date().toLocaleDateString(), teams: teams, fixtures: fixtures,
      finalMatch: { team1: finalists[0], team2: finalists[1], score1: parseInt(score1), score2: parseInt(score2) },
      champion: winner, format: format,
    };
    setTournamentHistory(prev => [tournament, ...prev]);
    showToast(`🎉 ${winner.name} are the champions!`);
  };

  const resetTournament = () => {
    void requestConfirmAction({
      title: 'Start New Tournament',
      message: 'Are you sure you want to start a new tournament?',
      confirmLabel: 'Start New',
      cancelLabel: 'Cancel',
      tone: 'danger',
    }).then((confirmed) => {
      if (!confirmed) return;
      localStorage.removeItem('badmintonCurrentTournament');
      setStep('setup'); setTournamentName(''); setNumTeams(3); setTeams([]); setFixtures([]); setChampion(null); setFinalMatch(null); setActiveTab('fixtures');
    });
  };

  const rerunTournament = () => {
    setFixtures([]); setChampion(null); setFinalMatch(null); setActiveTab('fixtures');
    setTimeout(() => {
      const newFixtures = createFixtures(teams, format);
      setFixtures(newFixtures);
      showToast('Rematch started! Same teams, fresh tournament! 🏸');
    }, 500);
  };

  const shareTournament = () => {
    if (!champion) return;
    const pointsTable = calculatePointsTable(teams, fixtures);
    let message = `🏸 *${tournamentName}*\n\n🏆 *CHAMPIONS:* ${champion.name}\n   ${champion.player1} & ${champion.player2}\n\n`;
    if (finalMatch) {
      message += `⚡ *FINAL MATCH*\n${finalMatch.team1.name}: ${finalMatch.score1}\n${finalMatch.team2.name}: ${finalMatch.score2}\n\n`;
    }
    message += `📊 *LEAGUE STANDINGS*\n`;
    pointsTable.forEach((team, idx) => {
      const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`;
      message += `${medal} ${team.name} - ${team.points}pts\n`;
    });
    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/?text=${encodedMessage}`, '_blank');
  };

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };
  const closeConfirmDialog = (confirmed) => {
    const resolver = confirmResolverRef.current;
    confirmResolverRef.current = null;
    setConfirmDialog(null);
    if (typeof resolver === 'function') {
      resolver(Boolean(confirmed));
    }
  };
  const requestConfirmAction = (options = {}) => (
    new Promise((resolve) => {
      const normalized = typeof options === 'string' ? { message: options } : (options || {});
      if (typeof confirmResolverRef.current === 'function') {
        confirmResolverRef.current(false);
      }
      confirmResolverRef.current = resolve;
      setConfirmDialog({
        title: normalized.title || 'Confirm Action',
        message: normalized.message || 'Are you sure?',
        confirmLabel: normalized.confirmLabel || 'Confirm',
        cancelLabel: normalized.cancelLabel || 'Cancel',
        tone: normalized.tone || 'danger',
      });
    })
  );

  const deleteTournamentFromHistory = (tournamentId) => {
    void requestConfirmAction({
      title: 'Delete Tournament',
      message: 'Delete this tournament from history?',
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      tone: 'danger',
    }).then((confirmed) => {
      if (!confirmed) return;
      setTournamentHistory(prev => prev.filter(t => t.id !== tournamentId));
      showToast('Tournament deleted from history');
    });
  };

  useEffect(() => () => {
    if (typeof confirmResolverRef.current === 'function') {
      confirmResolverRef.current(false);
      confirmResolverRef.current = null;
    }
  }, []);

  const exportAllData = () => {
    const exportData = {
      exportDate: new Date().toISOString(), tournamentHistory: tournamentHistory, playerDatabase: playerDatabase,
      playerRatings: playerRatings, version: '3.0'
    };
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `badminton-data-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('Data exported successfully! 📥');
  };

  const importData = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importedData = JSON.parse(e.target.result);
        if (importedData.tournamentHistory) setTournamentHistory(importedData.tournamentHistory);
        if (importedData.playerDatabase) setPlayerDatabase(importedData.playerDatabase);
        if (importedData.playerRatings) setPlayerRatings(importedData.playerRatings);
        showToast('Data imported successfully! 📤');
      } catch (error) {
        showToast('Error importing data', 'error');
        console.error('Import error:', error);
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const renderSetup = () => {
    const allTimeStats = calculateCumulativePlayerStats(tournamentHistory);
    const eloLeaderboard = getPlayerLeaderboard(playerRatings);

    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 py-8 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <div className="text-6xl mb-4">🏸</div>
            <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
              Badminton Tournament
            </h1>
            <p className="text-gray-600">Round-robin league + knockout final</p>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-6 md:p-8 mb-6">
            {lastTournamentConfig && (
              <div className="mb-6 bg-gradient-to-r from-green-50 to-blue-50 border-2 border-green-300 rounded-xl p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-700 mb-1">🔄 Previous Tournament Available</p>
                    <p className="text-xs text-gray-600">"{lastTournamentConfig.name}" - {lastTournamentConfig.numTeams} teams</p>
                  </div>
                  <button onClick={reuseTournamentConfig} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-all font-semibold text-sm whitespace-nowrap">
                    <RefreshCw size={16} /> Reuse Teams
                  </button>
                </div>
              </div>
            )}

            <div className="mb-6 grid grid-cols-2 gap-3">
              {tournamentHistory.length > 0 && (
                <>
                  <button onClick={() => setShowHistory(true)} className="flex items-center justify-center gap-2 px-4 py-3 bg-purple-100 text-purple-600 rounded-xl hover:bg-purple-200 transition-all font-semibold">
                    <History size={18} /> History ({tournamentHistory.length})
                  </button>
                  <button onClick={() => setShowAllTimeStats(true)} className="flex items-center justify-center gap-2 px-4 py-3 bg-orange-100 text-orange-600 rounded-xl hover:bg-orange-200 transition-all font-semibold">
                    <TrendingUp size={18} /> All-Time Stats
                  </button>
                  <button onClick={() => setShowEloLeaderboard(true)} className="flex items-center justify-center gap-2 px-4 py-3 bg-yellow-100 text-yellow-700 rounded-xl hover:bg-yellow-200 transition-all font-semibold">
                    <Trophy size={18} /> ELO Leaderboard
                  </button>
                  <button onClick={exportAllData} className="flex items-center justify-center gap-2 px-4 py-3 bg-green-100 text-green-600 rounded-xl hover:bg-green-200 transition-all font-semibold">
                    <Share2 size={18} /> Export Data
                  </button>
                </>
              )}
              <label className="block col-span-2">
                <input type="file" accept=".json" onChange={importData} className="hidden" />
                <div className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-100 text-blue-600 rounded-xl hover:bg-blue-200 transition-all font-semibold cursor-pointer">
                  <Calendar size={18} /> Import Data
                </div>
              </label>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Tournament Name</label>
                <input type="text" value={tournamentName} onChange={(e) => setTournamentName(e.target.value)} placeholder="e.g., Summer Smash 2024"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 outline-none transition-all" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Number of Teams</label>
                <input type="text" inputMode="numeric" pattern="[0-9]*" value={String(numTeams)}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === '') {
                      setNumTeams(3);
                    } else {
                      const numericValue = value.replace(/\D/g, '');
                      const num = parseInt(numericValue);
                      if (!isNaN(num)) {
                        setNumTeams(Math.max(3, Math.min(12, num)));
                      }
                    }
                  }}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 outline-none transition-all" />
                <p className="text-xs text-gray-500 mt-1">Min: 3, Max: 12 teams</p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Tournament Format</label>
                <select value={format} onChange={(e) => setFormat(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 outline-none transition-all bg-white">
                  <option value="1">1 League Match + Final</option>
                  <option value="2">2 League Matches + Final</option>
                </select>
              </div>
              <button onClick={() => tournamentName ? setStep('teams') : showToast('Please enter tournament name', 'error')}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-4 rounded-xl font-semibold text-lg hover:shadow-xl transform hover:scale-[1.02] transition-all">
                <div className="flex items-center justify-center gap-2">
                  <Users size={20} /> Next: Enter Teams
                </div>
              </button>
            </div>
          </div>
        </div>

        {showHistory && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
              <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-6 flex items-center justify-between">
                <h3 className="text-2xl font-bold text-white flex items-center gap-2">
                  <History size={24} /> Tournament History
                </h3>
                <button onClick={() => setShowHistory(false)} className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-lg transition-all">
                  <X size={24} />
                </button>
              </div>
              <div className="p-6 overflow-y-auto max-h-[calc(80vh-88px)]">
                {tournamentHistory.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <History size={48} className="mx-auto mb-4 text-gray-300" />
                    <p>No tournament history yet</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {tournamentHistory.map(tournament => (
                      <div key={tournament.id} className="border-2 border-gray-200 rounded-xl p-4 hover:border-purple-300 transition-all">
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-lg text-gray-800 mb-1">{tournament.name}</h4>
                            <p className="text-xs text-gray-500">{tournament.date}</p>
                          </div>
                          <button onClick={() => deleteTournamentFromHistory(tournament.id)}
                            className="text-red-500 hover:text-red-700 text-xs px-3 py-1 rounded-lg hover:bg-red-50 transition-all flex-shrink-0">
                            Delete
                          </button>
                        </div>
                        {tournament.champion && (
                          <div className="flex items-center gap-3 bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                            <span className="text-3xl">{tournament.champion.emoji}</span>
                            <div className="min-w-0 flex-1">
                              <p className="font-bold text-gray-800 flex items-center gap-2">
                                <Trophy size={16} className="text-yellow-600" />
                                {tournament.champion.name}
                              </p>
                              <p className="text-xs text-gray-600">
                                {tournament.champion.player1} & {tournament.champion.player2}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {showAllTimeStats && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[80vh] overflow-hidden">
              <div className="bg-gradient-to-r from-orange-600 to-red-600 p-6 flex items-center justify-between">
                <h3 className="text-2xl font-bold text-white flex items-center gap-2">
                  <TrendingUp size={24} /> All-Time Player Statistics
                </h3>
                <button onClick={() => setShowAllTimeStats(false)} className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-lg transition-all">
                  <X size={24} />
                </button>
              </div>
              <div className="overflow-y-auto max-h-[calc(80vh-88px)]">
                {allTimeStats.length === 0 ? (
                  <div className="p-12 text-center text-gray-500">
                    <TrendingUp size={48} className="mx-auto mb-4 text-gray-300" />
                    <p>No player statistics available yet</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-100 sticky top-0">
                        <tr>
                          <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">Rank</th>
                          <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">Player</th>
                          <th className="px-4 py-3 text-center text-sm font-bold text-gray-700">🏆</th>
                          <th className="px-4 py-3 text-center text-sm font-bold text-gray-700">Tournaments</th>
                          <th className="px-4 py-3 text-center text-sm font-bold text-gray-700">Played</th>
                          <th className="px-4 py-3 text-center text-sm font-bold text-gray-700">Won</th>
                          <th className="px-4 py-3 text-center text-sm font-bold text-gray-700">Win %</th>
                          <th className="px-4 py-3 text-center text-sm font-bold text-gray-700">Avg Score</th>
                        </tr>
                      </thead>
                      <tbody>
                        {allTimeStats.map((player, index) => (
                          <tr key={player.name} className="border-b border-gray-200 hover:bg-gray-50">
                            <td className="px-4 py-4 text-center font-bold text-lg">
                              {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}
                            </td>
                            <td className="px-4 py-4">
                              <p className="font-bold text-gray-800">{player.name}</p>
                            </td>
                            <td className="px-4 py-4 text-center">
                              <span className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full font-bold text-sm">
                                {player.championships}
                              </span>
                            </td>
                            <td className="px-4 py-4 text-center font-semibold">{player.tournamentsPlayed}</td>
                            <td className="px-4 py-4 text-center font-semibold">{player.matchesPlayed}</td>
                            <td className="px-4 py-4 text-center font-semibold text-green-600">{player.matchesWon}</td>
                            <td className="px-4 py-4 text-center">
                              <span className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full font-bold text-sm">
                                {player.winPercentage}%
                              </span>
                            </td>
                            <td className="px-4 py-4 text-center font-semibold text-blue-600">{player.avgScorePerMatch}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {showEloLeaderboard && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[80vh] overflow-hidden">
              <div className="bg-gradient-to-r from-yellow-600 to-orange-600 p-6 flex items-center justify-between">
                <h3 className="text-2xl font-bold text-white flex items-center gap-2">
                  <Trophy size={24} /> ELO Rating Leaderboard
                </h3>
                <button onClick={() => setShowEloLeaderboard(false)} className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-lg transition-all">
                  <X size={24} />
                </button>
              </div>
              <div className="overflow-y-auto max-h-[calc(80vh-88px)]">
                {eloLeaderboard.length === 0 ? (
                  <div className="p-12 text-center text-gray-500">
                    <Trophy size={48} className="mx-auto mb-4 text-gray-300" />
                    <p>No ELO ratings yet. Complete matches to build the leaderboard!</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-100 sticky top-0">
                        <tr>
                          <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">Rank</th>
                          <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">Player</th>
                          <th className="px-4 py-3 text-center text-sm font-bold text-gray-700">Rating</th>
                          <th className="px-4 py-3 text-center text-sm font-bold text-gray-700">Matches</th>
                          <th className="px-4 py-3 text-center text-sm font-bold text-gray-700">Last Change</th>
                        </tr>
                      </thead>
                      <tbody>
                        {eloLeaderboard.map((player, index) => {
                          const lastMatch = player.history && player.history.length > 0 ? player.history[player.history.length - 1] : null;
                          return (
                            <tr key={player.name} className="border-b border-gray-200 hover:bg-gray-50">
                              <td className="px-4 py-4 text-center font-bold text-lg">
                                {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}
                              </td>
                              <td className="px-4 py-4">
                                <p className="font-bold text-gray-800">{player.name}</p>
                              </td>
                              <td className="px-4 py-4 text-center">
                                <span className={`px-4 py-2 rounded-full font-bold text-lg ${
                                  player.rating >= 1200 ? 'bg-yellow-100 text-yellow-700' :
                                  player.rating >= 1000 ? 'bg-green-100 text-green-700' :
                                  'bg-gray-100 text-gray-700'
                                }`}>
                                  {player.rating}
                                </span>
                              </td>
                              <td className="px-4 py-4 text-center font-semibold">{player.matchesPlayed}</td>
                              <td className="px-4 py-4 text-center">
                                {lastMatch && (
                                  <span className={`font-bold ${lastMatch.change > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {lastMatch.change > 0 ? '+' : ''}{lastMatch.change}
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    <div className="p-4 bg-gray-50 text-xs text-gray-600">
                      <p><strong>How ELO works:</strong> All players start at 1000. Beating higher-rated players gains more points. Ratings update after each match.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderTeamsEntry = () => (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-6 md:p-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold text-gray-800">Enter Team Details</h2>
              <p className="text-sm text-gray-500 mt-1 flex items-center gap-1">
                {playerDatabase.length > 0 ? (
                  <>
                    <ChevronDown size={14} className="text-blue-500" />
                    Start typing to see {playerDatabase.length} saved player names
                  </>
                ) : (
                  'Player names will be saved for future use'
                )}
              </p>
            </div>
            <button onClick={() => setStep('setup')} className="text-gray-600 hover:text-gray-800 text-sm flex items-center gap-1">
              ← Back
            </button>
          </div>
          {teams.length > 0 && (
            <div className="space-y-4 mb-6">
              {teams.map((team, index) => (
                <div key={team.id} className="border-2 border-gray-200 rounded-2xl p-4 md:p-6 hover:border-blue-300 transition-all">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="text-3xl bg-gray-50 rounded-xl p-3 cursor-pointer" onClick={() => {
                      const emojis = ['🔥', '⚡', '🌟', '💎', '🎯', '🚀', '👑', '🌊', '🏆', '⭐', '🎨', '🌈', '💪', '🎪', '🎭'];
                      const currentIndex = emojis.indexOf(team.emoji);
                      const nextEmoji = emojis[(currentIndex + 1) % emojis.length];
                      const newTeams = [...teams];
                      newTeams[index].emoji = nextEmoji;
                      setTeams(newTeams);
                    }}>
                      {team.emoji}
                    </div>
                    <input type="text" value={team.name} onChange={(e) => {
                      const newTeams = [...teams];
                      newTeams[index].name = e.target.value;
                      setTeams(newTeams);
                    }} placeholder="Team Name" className="flex-1 px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-blue-500 outline-none font-semibold" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-gray-600 mb-1 block flex items-center gap-1">
                        Player 1
                        {playerDatabase.length > 0 && <ChevronDown size={12} className="text-blue-500" />}
                      </label>
                      <AutocompleteInput value={team.player1} onChange={(value) => {
                        const newTeams = [...teams];
                        newTeams[index].player1 = value;
                        setTeams(newTeams);
                      }} placeholder="Player 1 Name" playerDatabase={playerDatabase} />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-600 mb-1 block flex items-center gap-1">
                        Player 2
                        {playerDatabase.length > 0 && <ChevronDown size={12} className="text-blue-500" />}
                      </label>
                      <AutocompleteInput value={team.player2} onChange={(value) => {
                        const newTeams = [...teams];
                        newTeams[index].player2 = value;
                        setTeams(newTeams);
                      }} placeholder="Player 2 Name" playerDatabase={playerDatabase} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          <button onClick={generateFixtures} disabled={loading || teams.some(t => !t.name || !t.player1 || !t.player2)}
            className="w-full mt-6 bg-gradient-to-r from-green-600 to-blue-600 text-white py-4 rounded-xl font-semibold text-lg hover:shadow-xl transform hover:scale-[1.02] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
            <Calendar size={20} />
            {loading ? 'Generating Fixtures...' : 'Generate Fixtures & Start Tournament'}
          </button>
        </div>
      </div>
    </div>
  );

const renderTournament = () => {
    const pointsTable = calculatePointsTable(teams, fixtures);
    const playerStats = calculatePlayerStats(teams, fixtures);
    const finalists = getFinalists();

    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
        <div className="sticky top-0 bg-white shadow-md z-10">
          <div className="max-w-6xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <div className="flex-1">
                {isEditingName ? (
                  <div className="flex items-center gap-2">
                    <input type="text" value={tempTournamentName} onChange={(e) => setTempTournamentName(e.target.value)}
                      className="text-2xl md:text-3xl font-bold text-gray-800 border-2 border-blue-500 rounded-lg px-3 py-1 outline-none"
                      autoFocus
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          setTournamentName(tempTournamentName);
                          setIsEditingName(false);
                        }
                      }}
                    />
                    <button onClick={() => {
                      setTournamentName(tempTournamentName);
                      setIsEditingName(false);
                    }} className="text-green-600 hover:text-green-700 p-2">✓</button>
                    <button onClick={() => {
                      setTempTournamentName(tournamentName);
                      setIsEditingName(false);
                    }} className="text-red-600 hover:text-red-700 p-2">✕</button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <h1 className="text-2xl md:text-3xl font-bold text-gray-800">🏸 {tournamentName}</h1>
                    <button onClick={() => {
                      setTempTournamentName(tournamentName);
                      setIsEditingName(true);
                    }} className="text-gray-400 hover:text-gray-600 p-1" title="Edit tournament name">
                      <Edit2 size={18} />
                    </button>
                  </div>
                )}
                <p className="text-sm text-gray-600">{format} League Match(es) + Final</p>
              </div>
              <div className="flex gap-2 flex-wrap">
                {champion && (
                  <button onClick={rerunTournament} className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl hover:shadow-lg transition-all font-semibold">
                    <RefreshCw size={18} />
                    <span className="hidden md:inline">Re-run with Same Teams</span>
                    <span className="md:hidden">Rematch</span>
                  </button>
                )}
                <button onClick={resetTournament} className="flex items-center gap-2 px-4 py-2 bg-red-100 text-red-600 rounded-xl hover:bg-red-200 transition-all">
                  <RotateCcw size={18} />
                  <span className="hidden md:inline">New</span>
                </button>
              </div>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-2">
              <button onClick={() => setActiveTab('fixtures')} className={`px-4 py-2 rounded-full font-semibold transition-all whitespace-nowrap ${
                activeTab === 'fixtures' ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                Fixtures
              </button>
              <button onClick={() => setActiveTab('table')} className={`px-4 py-2 rounded-full font-semibold transition-all whitespace-nowrap ${
                activeTab === 'table' ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                Points Table
              </button>
              <button onClick={() => setActiveTab('stats')} className={`px-4 py-2 rounded-full font-semibold transition-all whitespace-nowrap ${
                activeTab === 'stats' ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                Player Stats
              </button>
              <button onClick={() => setActiveTab('elo')} className={`px-4 py-2 rounded-full font-semibold transition-all whitespace-nowrap ${
                activeTab === 'elo' ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                ELO Ratings
              </button>
              <button onClick={() => setActiveTab('final')} className={`px-4 py-2 rounded-full font-semibold transition-all whitespace-nowrap ${
                activeTab === 'final' ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                Final
              </button>
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-4 py-6">
          {activeTab === 'fixtures' && (
            <div className="space-y-4">
              {fixtures.length > 0 && (
                <div className="bg-white rounded-2xl p-6 shadow-lg mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold text-lg text-gray-800">League Progress</h3>
                    <span className="text-sm font-semibold text-gray-600">
                      {fixtures.filter(f => f.completed).length} / {fixtures.length} matches
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                    <div className="bg-gradient-to-r from-green-500 to-blue-500 h-4 rounded-full transition-all duration-500"
                      style={{ width: `${(fixtures.filter(f => f.completed).length / fixtures.length) * 100}%` }} />
                  </div>
                  {allLeagueMatchesComplete() && (
                    <p className="text-center text-sm font-semibold text-green-600 mt-3">
                      ✅ All league matches completed! View the Final →
                    </p>
                  )}
                </div>
              )}
              {fixtures.map((match) => (
                <MatchCard key={match.id} match={match} onSave={saveMatchResult} />
              ))}
            </div>
          )}

{activeTab === 'table' && (
            <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
              <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6">
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                  <Trophy size={24} /> Points Table
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">Pos</th>
                      <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">Team</th>
                      <th className="px-4 py-3 text-center text-sm font-bold text-gray-700">P</th>
                      <th className="px-4 py-3 text-center text-sm font-bold text-gray-700">W</th>
                      <th className="px-4 py-3 text-center text-sm font-bold text-gray-700">L</th>
                      <th className="px-4 py-3 text-center text-sm font-bold text-gray-700">Pts</th>
                      <th className="px-4 py-3 text-center text-sm font-bold text-gray-700">For</th>
                      <th className="px-4 py-3 text-center text-sm font-bold text-gray-700">Against</th>
                      <th className="px-4 py-3 text-center text-sm font-bold text-gray-700">Diff</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pointsTable.map((team, index) => (
                      <tr key={team.id} className={`border-b border-gray-200 hover:bg-gray-50 ${index < 2 ? 'bg-green-50' : ''}`}>
                        <td className="px-4 py-4">
                          <span className="font-bold text-lg">
                            {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">{team.emoji}</span>
                            <div>
                              <p className="font-bold text-gray-800">{team.name}</p>
                              <p className="text-xs text-gray-600">{team.player1} & {team.player2}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-center font-semibold">{team.played}</td>
                        <td className="px-4 py-4 text-center font-semibold text-green-600">{team.won}</td>
                        <td className="px-4 py-4 text-center font-semibold text-red-600">{team.lost}</td>
                        <td className="px-4 py-4 text-center">
                          <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full font-bold">{team.points}</span>
                        </td>
                        <td className="px-4 py-4 text-center font-semibold">{team.scoreFor}</td>
                        <td className="px-4 py-4 text-center font-semibold">{team.scoreAgainst}</td>
                        <td className={`px-4 py-4 text-center font-bold ${
                          team.scoreDiff > 0 ? 'text-green-600' : team.scoreDiff < 0 ? 'text-red-600' : 'text-gray-600'}`}>
                          {team.scoreDiff > 0 ? '+' : ''}{team.scoreDiff}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {pointsTable.length > 0 && (
                <div className="p-4 bg-gray-50 text-xs text-gray-600">
                  <p className="mb-1"><strong>Note:</strong> Top 2 teams qualify for the final</p>
                  <p>Points = score margin | Tiebreaker: score difference</p>
                </div>
              )}
            </div>
          )}

{activeTab === 'stats' && (
            <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
              <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-6">
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                  <TrendingUp size={24} /> Player Statistics
                </h2>
              </div>
              {playerStats.length === 0 ? (
                <div className="p-12 text-center text-gray-500">
                  <Users size={48} className="mx-auto mb-4 text-gray-300" />
                  <p>No match results yet. Complete matches to see player stats.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">Rank</th>
                        <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">Player</th>
                        <th className="px-4 py-3 text-center text-sm font-bold text-gray-700">Played</th>
                        <th className="px-4 py-3 text-center text-sm font-bold text-gray-700">Won</th>
                        <th className="px-4 py-3 text-center text-sm font-bold text-gray-700">Win %</th>
                        <th className="px-4 py-3 text-center text-sm font-bold text-gray-700">Scored</th>
                        <th className="px-4 py-3 text-center text-sm font-bold text-gray-700">Conceded</th>
                      </tr>
                    </thead>
                    <tbody>
                      {playerStats.map((player, index) => (
                        <tr key={player.name} className="border-b border-gray-200 hover:bg-gray-50">
                          <td className="px-4 py-4 text-center font-bold text-lg">
                            {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-3">
                              <span className="text-xl">{player.teamEmoji}</span>
                              <div>
                                <p className="font-bold text-gray-800">{player.name}</p>
                                <p className="text-xs text-gray-600">{player.team}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-center font-semibold">{player.matchesPlayed}</td>
                          <td className="px-4 py-4 text-center font-semibold text-green-600">{player.matchesWon}</td>
                          <td className="px-4 py-4 text-center">
                            <span className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full font-bold text-sm">
                              {player.winPercentage}%
                            </span>
                          </td>
                          <td className="px-4 py-4 text-center font-semibold text-blue-600">{player.totalScored}</td>
                          <td className="px-4 py-4 text-center font-semibold text-red-600">{player.totalConceded}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

{activeTab === 'elo' && (
            <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
              <div className="bg-gradient-to-r from-yellow-600 to-orange-600 p-6">
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                  <Trophy size={24} /> ELO Rating Leaderboard
                </h2>
              </div>
              {getPlayerLeaderboard(playerRatings).length === 0 ? (
                <div className="p-12 text-center text-gray-500">
                  <Trophy size={48} className="mx-auto mb-4 text-gray-300" />
                  <p>No ELO ratings yet. Complete matches to build the leaderboard!</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">Rank</th>
                        <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">Player</th>
                        <th className="px-4 py-3 text-center text-sm font-bold text-gray-700">Rating</th>
                        <th className="px-4 py-3 text-center text-sm font-bold text-gray-700">Matches</th>
                        <th className="px-4 py-3 text-center text-sm font-bold text-gray-700">Last Change</th>
                      </tr>
                    </thead>
                    <tbody>
                      {getPlayerLeaderboard(playerRatings).map((player, index) => {
                        const lastMatch = player.history && player.history.length > 0 ? player.history[player.history.length - 1] : null;
                        return (
                          <tr key={player.name} className="border-b border-gray-200 hover:bg-gray-50">
                            <td className="px-4 py-4 text-center font-bold text-lg">
                              {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}
                            </td>
                            <td className="px-4 py-4">
                              <p className="font-bold text-gray-800">{player.name}</p>
                            </td>
                            <td className="px-4 py-4 text-center">
                              <span className={`px-4 py-2 rounded-full font-bold text-lg ${
                                player.rating >= 1200 ? 'bg-yellow-100 text-yellow-700' :
                                player.rating >= 1000 ? 'bg-green-100 text-green-700' :
                                'bg-gray-100 text-gray-700'
                              }`}>
                                {player.rating}
                              </span>
                            </td>
                            <td className="px-4 py-4 text-center font-semibold">{player.matchesPlayed}</td>
                            <td className="px-4 py-4 text-center">
                              {lastMatch && (
                                <span className={`font-bold ${lastMatch.change > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {lastMatch.change > 0 ? '+' : ''}{lastMatch.change}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <div className="p-4 bg-gray-50 text-xs text-gray-600">
                    <p><strong>How ELO works:</strong> All players start at 1000. Beating higher-rated players gains more points. Ratings update after each match.</p>
                  </div>
                </div>
              )}
            </div>
          )}

{activeTab === 'final' && (
            <div className="space-y-6">
              {!finalists ? (
                <div className="bg-white rounded-2xl p-12 text-center">
                  <Trophy size={64} className="mx-auto text-gray-300 mb-4" />
                  <p className="text-gray-500">Complete all league matches to unlock the final</p>
                  <p className="text-sm text-gray-400 mt-2">
                    {fixtures.filter(f => f.completed).length} / {fixtures.length} matches completed
                  </p>
                </div>
              ) : champion ? (
                <div>
                  <div className="bg-gradient-to-br from-yellow-100 via-orange-100 to-red-100 rounded-3xl p-8 mb-6 text-center">
                    <div className="text-6xl mb-4">🏆 TOURNAMENT COMPLETE 🏆</div>
                    <h2 className="text-3xl font-bold text-gray-800 mb-8">{tournamentName}</h2>
                    <div className="bg-white rounded-2xl p-6 max-w-md mx-auto">
                      <div className="text-5xl mb-3">{champion.emoji}</div>
                      <h3 className="text-2xl font-bold text-gray-800 mb-2">{champion.name}</h3>
                      <p className="text-gray-600">{champion.player1} & {champion.player2}</p>
                      <div className="mt-4 bg-yellow-100 rounded-lg py-2">
                        <p className="text-lg font-bold text-gray-800">CHAMPIONS!</p>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <button onClick={shareTournament} className="flex items-center justify-center gap-2 bg-green-600 text-white py-4 rounded-xl font-semibold hover:bg-green-700 transition-all shadow-lg">
                      <Share2 size={20} /> Share to WhatsApp
                    </button>
                    <button onClick={rerunTournament} className="flex items-center justify-center gap-2 bg-blue-600 text-white py-4 rounded-xl font-semibold hover:bg-blue-700 transition-all shadow-lg">
                      <RefreshCw size={20} /> Rematch
                    </button>
                  </div>
                </div>
              ) : (
                <FinalMatchCard finalists={finalists} onSave={saveFinalResult} />
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      {step === 'setup' && renderSetup()}
      {step === 'teams' && renderTeamsEntry()}
      {step === 'tournament' && renderTournament()}
      <ConfirmActionModal
        open={Boolean(confirmDialog)}
        title={confirmDialog?.title}
        message={confirmDialog?.message}
        confirmLabel={confirmDialog?.confirmLabel}
        cancelLabel={confirmDialog?.cancelLabel}
        tone={confirmDialog?.tone}
        onConfirm={() => closeConfirmDialog(true)}
        onCancel={() => closeConfirmDialog(false)}
      />
      <Toast message={toast?.message} type={toast?.type} />
    </>
  );
};

export default BadmintonFixtureGenerator;
