import React, { useState, useEffect } from 'react';
import { Trophy, Users, Calendar, RotateCcw, Share2, History, TrendingUp, RefreshCw, ChevronDown, Edit2, X } from 'lucide-react';
import AutocompleteInput from './components/AutocompleteInput';
import MatchCard from './components/MatchCard';
import FinalMatchCard from './components/FinalMatchCard';
import Toast from './components/Toast';
import { 
  calculatePointsTable, 
  calculatePlayerStats, 
  calculateCumulativePlayerStats,
  generateFixtures as createFixtures 
} from './utils/calculations';

const BadmintonFixtureGenerator = () => {
  // Default team configurations
  const defaultTeamConfigs = [
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

  // ALL STATE DECLARATIONS
  const [step, setStep] = useState('setup');
  const [tournamentName, setTournamentName] = useState('');
  const [numTeams, setNumTeams] = useState(3);
  const [format, setFormat] = useState('1');
  const [teams, setTeams] = useState([]);
  const [fixtures, setFixtures] = useState([]);
  const [activeTab, setActiveTab] = useState('fixtures');
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(false);
  const [tournamentHistory, setTournamentHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showAllTimeStats, setShowAllTimeStats] = useState(false);
  const [finalMatch, setFinalMatch] = useState(null);
  const [champion, setChampion] = useState(null);
  
  // Player database and last tournament config
  const [playerDatabase, setPlayerDatabase] = useState([]);
  const [lastTournamentConfig, setLastTournamentConfig] = useState(null);

  // Load data from localStorage on mount (including current tournament state)
  useEffect(() => {
    // Load tournament history
    const savedHistory = localStorage.getItem('badmintonTournamentHistory');
    if (savedHistory) {
      try {
        const history = JSON.parse(savedHistory);
        setTournamentHistory(history);
        
        // Extract all unique players from history
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

    // Load last tournament config
    const savedConfig = localStorage.getItem('badmintonLastConfig');
    if (savedConfig) {
      try {
        setLastTournamentConfig(JSON.parse(savedConfig));
      } catch (e) {
        console.error('Error loading last config:', e);
      }
    }

    // NEW: Load current tournament state (for refresh persistence)
    const savedCurrentState = localStorage.getItem('badmintonCurrentTournament');
    if (savedCurrentState) {
      try {
        const currentState = JSON.parse(savedCurrentState);
        // Restore the entire tournament state
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

  // Save current tournament state to localStorage whenever it changes
  useEffect(() => {
    if (step !== 'setup' && tournamentName) {
      const currentState = {
        step,
        tournamentName,
        numTeams,
        format,
        teams,
        fixtures,
        activeTab,
        finalMatch,
        champion,
      };
      localStorage.setItem('badmintonCurrentTournament', JSON.stringify(currentState));
    }
  }, [step, tournamentName, numTeams, format, teams, fixtures, activeTab, finalMatch, champion]);

  // Save tournament history to localStorage
  useEffect(() => {
    if (tournamentHistory.length > 0) {
      localStorage.setItem('badmintonTournamentHistory', JSON.stringify(tournamentHistory));
    }
  }, [tournamentHistory]);

  // Initialize teams when step changes
  useEffect(() => {
    if (step === 'teams' && teams.length === 0) {
      const newTeams = Array.from({ length: numTeams }, (_, i) => ({
        id: i + 1,
        emoji: defaultTeamConfigs[i]?.emoji || '🏸',
        name: defaultTeamConfigs[i]?.name || `Team ${i + 1}`,
        player1: defaultTeamConfigs[i]?.player1 || '',
        player2: defaultTeamConfigs[i]?.player2 || '',
      }));
      setTeams(newTeams);
    }
  }, [step, numTeams]);

  // Update player database
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

  // Reuse last tournament configuration
  const reuseTournamentConfig = () => {
    if (lastTournamentConfig) {
      setTournamentName(lastTournamentConfig.name + ' (Rematch)');
      setNumTeams(lastTournamentConfig.numTeams);
      setFormat(lastTournamentConfig.format);
      setTeams(lastTournamentConfig.teams.map((team, i) => ({
        ...team,
        id: i + 1,
      })));
      setStep('teams');
      showToast('Previous tournament loaded! Edit teams or proceed.');
    }
  };

  // Generate Fixtures
  const generateFixtures = () => {
    setLoading(true);
    
    // Save current configuration
    setLastTournamentConfig({
      name: tournamentName,
      numTeams: numTeams,
      format: format,
      teams: teams,
    });
    localStorage.setItem('badmintonLastConfig', JSON.stringify({
      name: tournamentName,
      numTeams: numTeams,
      format: format,
      teams: teams,
    }));

    // Update player database
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

  // Save Match Result
  const saveMatchResult = (matchId, score1, score2) => {
    if (score1 === '' || score2 === '' || score1 === score2) {
      showToast('Please enter valid scores (must be different)', 'error');
      return;
    }

    setFixtures(prev =>
      prev.map(match =>
        match.id === matchId
          ? { ...match, score1: parseInt(score1), score2: parseInt(score2), completed: true }
          : match
      )
    );
    showToast('Result saved! ✓');
  };

  // Check if all league matches are complete
  const allLeagueMatchesComplete = () => {
    return fixtures.length > 0 && fixtures.every(match => match.completed);
  };

  // Get finalists
  const getFinalists = () => {
    if (!allLeagueMatchesComplete()) return null;
    const table = calculatePointsTable(teams, fixtures);
    return [table[0], table[1]];
  };

  // Save final result
  const saveFinalResult = (score1, score2) => {
    if (score1 === '' || score2 === '' || score1 === score2) {
      showToast('Please enter valid scores (must be different)', 'error');
      return;
    }

    const finalists = getFinalists();
    const winner = parseInt(score1) > parseInt(score2) ? finalists[0] : finalists[1];
    
    setFinalMatch({
      team1: finalists[0],
      team2: finalists[1],
      score1: parseInt(score1),
      score2: parseInt(score2),
    });
    setChampion(winner);

    // Save to history
    const tournament = {
      id: Date.now(),
      name: tournamentName,
      date: new Date().toLocaleDateString(),
      teams: teams,
      fixtures: fixtures,
      finalMatch: {
        team1: finalists[0],
        team2: finalists[1],
        score1: parseInt(score1),
        score2: parseInt(score2),
      },
      champion: winner,
      format: format,
    };

    setTournamentHistory(prev => [tournament, ...prev]);
    showToast(`🎉 ${winner.name} are the champions!`);
  };

  // Reset Tournament
  const resetTournament = () => {
    if (window.confirm('Are you sure you want to start a new tournament?')) {
      // Clear current tournament from localStorage
      localStorage.removeItem('badmintonCurrentTournament');
      
      setStep('setup');
      setTournamentName('');
      setNumTeams(3);
      setTeams([]);
      setFixtures([]);
      setChampion(null);
      setFinalMatch(null);
      setActiveTab('fixtures');
    }
  };

  // Re-run tournament with same teams
  const rerunTournament = () => {
    setFixtures([]);
    setChampion(null);
    setFinalMatch(null);
    setActiveTab('fixtures');
    
    setTimeout(() => {
      const newFixtures = createFixtures(teams, format);
      setFixtures(newFixtures);
      showToast('Rematch started! Same teams, fresh tournament! 🏸');
    }, 500);
  };

  // Share Tournament
  const shareTournament = () => {
    if (!champion) return;
    
    const pointsTable = calculatePointsTable(teams, fixtures);
    let message = `🏸 *${tournamentName}*\n\n`;
    message += `🏆 *CHAMPIONS:* ${champion.name}\n`;
    message += `   ${champion.player1} & ${champion.player2}\n\n`;
    
    if (finalMatch) {
      message += `⚡ *FINAL MATCH*\n`;
      message += `${finalMatch.team1.name}: ${finalMatch.score1}\n`;
      message += `${finalMatch.team2.name}: ${finalMatch.score2}\n\n`;
    }
    
    message += `📊 *LEAGUE STANDINGS*\n`;
    pointsTable.forEach((team, idx) => {
      const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`;
      message += `${medal} ${team.name} - ${team.points}pts\n`;
    });

    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/?text=${encodedMessage}`, '_blank');
  };

  // Show Toast
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Delete tournament from history
  const deleteTournamentFromHistory = (tournamentId) => {
    if (window.confirm('Delete this tournament from history?')) {
      setTournamentHistory(prev => prev.filter(t => t.id !== tournamentId));
      showToast('Tournament deleted from history');
    }
  };

  // Export data
  const exportAllData = () => {
    const exportData = {
      exportDate: new Date().toISOString(),
      tournamentHistory: tournamentHistory,
      playerDatabase: playerDatabase,
      version: '2.0'
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

  // Import data
  const importData = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importedData = JSON.parse(e.target.result);
        if (importedData.tournamentHistory) {
          setTournamentHistory(importedData.tournamentHistory);
        }
        if (importedData.playerDatabase) {
          setPlayerDatabase(importedData.playerDatabase);
        }
        showToast('Data imported successfully! 📤');
      } catch (error) {
        showToast('Error importing data', 'error');
        console.error('Import error:', error);
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  // Render Setup Screen
  const renderSetup = () => {
    const allTimeStats = calculateCumulativePlayerStats(tournamentHistory);

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
            {/* Quick action to reuse last tournament */}
            {lastTournamentConfig && (
              <div className="mb-6 bg-gradient-to-r from-green-50 to-blue-50 border-2 border-green-300 rounded-xl p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-700 mb-1">🔄 Previous Tournament Available</p>
                    <p className="text-xs text-gray-600">"{lastTournamentConfig.name}" - {lastTournamentConfig.numTeams} teams</p>
                  </div>
                  <button
                    onClick={reuseTournamentConfig}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-all font-semibold text-sm whitespace-nowrap"
                  >
                    <RefreshCw size={16} />
                    Reuse Teams
                  </button>
                </div>
              </div>
            )}

            {/* Quick Actions */}
            <div className="mb-6 grid grid-cols-2 gap-3">
              {tournamentHistory.length > 0 && (
                <>
                  <button
                    onClick={() => setShowHistory(true)}
                    className="flex items-center justify-center gap-2 px-4 py-3 bg-purple-100 text-purple-600 rounded-xl hover:bg-purple-200 transition-all font-semibold"
                  >
                    <History size={18} />
                    History ({tournamentHistory.length})
                  </button>
                  <button
                    onClick={() => setShowAllTimeStats(true)}
                    className="flex items-center justify-center gap-2 px-4 py-3 bg-orange-100 text-orange-600 rounded-xl hover:bg-orange-200 transition-all font-semibold"
                  >
                    <TrendingUp size={18} />
                    All-Time Stats
                  </button>
                </>
              )}
              {tournamentHistory.length > 0 && (
                <button
                  onClick={exportAllData}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-green-100 text-green-600 rounded-xl hover:bg-green-200 transition-all font-semibold"
                >
                  <Share2 size={18} />
                  Export Data
                </button>
              )}
              <label className="block">
                <input
                  type="file"
                  accept=".json"
                  onChange={importData}
                  className="hidden"
                />
                <div className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-100 text-blue-600 rounded-xl hover:bg-blue-200 transition-all font-semibold cursor-pointer">
                  <Calendar size={18} />
                  Import Data
                </div>
              </label>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Tournament Name
                </label>
                <input
                  type="text"
                  value={tournamentName}
                  onChange={(e) => setTournamentName(e.target.value)}
                  placeholder="e.g., Summer Smash 2024"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Number of Teams
                </label>
                <input
                  type="number"
                  min="3"
                  max="12"
                  value={numTeams}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === '') {
                      setNumTeams(3);
                    } else {
                      const num = parseInt(value);
                      if (!isNaN(num)) {
                        setNumTeams(Math.max(3, Math.min(12, num)));
                      }
                    }
                  }}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 outline-none transition-all"
                />
                <p className="text-xs text-gray-500 mt-1">Min: 3, Max: 12 teams</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Tournament Format
                </label>
                <select
                  value={format}
                  onChange={(e) => setFormat(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 outline-none transition-all bg-white"
                >
                  <option value="1">1 League Match + Final</option>
                  <option value="2">2 League Matches + Final</option>
                </select>
              </div>

              <button
                onClick={() => tournamentName ? setStep('teams') : showToast('Please enter tournament name', 'error')}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-4 rounded-xl font-semibold text-lg hover:shadow-xl transform hover:scale-[1.02] transition-all"
              >
                <div className="flex items-center justify-center gap-2">
                  <Users size={20} />
                  Next: Enter Teams
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* History Modal */}
        {showHistory && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
              <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-6 flex items-center justify-between">
                <h3 className="text-2xl font-bold text-white flex items-center gap-2">
                  <History size={24} />
                  Tournament History
                </h3>
                <button
                  onClick={() => setShowHistory(false)}
                  className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-lg transition-all"
                >
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
                          <button
                            onClick={() => deleteTournamentFromHistory(tournament.id)}
                            className="text-red-500 hover:text-red-700 text-xs px-3 py-1 rounded-lg hover:bg-red-50 transition-all flex-shrink-0"
                          >
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

        {/* All-Time Player Stats Modal */}
        {showAllTimeStats && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[80vh] overflow-hidden">
              <div className="bg-gradient-to-r from-orange-600 to-red-600 p-6 flex items-center justify-between">
                <h3 className="text-2xl font-bold text-white flex items-center gap-2">
                  <TrendingUp size={24} />
                  All-Time Player Statistics
                </h3>
                <button
                  onClick={() => setShowAllTimeStats(false)}
                  className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-lg transition-all"
                >
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
      </div>
    );
  };

  // Render Teams Entry Screen
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
            <button
              onClick={() => setStep('setup')}
              className="text-gray-600 hover:text-gray-800 text-sm flex items-center gap-1"
            >
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
                    <input
                      type="text"
                      value={team.name}
                      onChange={(e) => {
                        const newTeams = [...teams];
                        newTeams[index].name = e.target.value;
                        setTeams(newTeams);
                      }}
                      placeholder="Team Name"
                      className="flex-1 px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-blue-500 outline-none font-semibold"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-gray-600 mb-1 block flex items-center gap-1">
                        Player 1
                        {playerDatabase.length > 0 && <ChevronDown size={12} className="text-blue-500" />}
                      </label>
                      <AutocompleteInput
                        value={team.player1}
                        onChange={(value) => {
                          const newTeams = [...teams];
                          newTeams[index].player1 = value;
                          setTeams(newTeams);
                        }}
                        placeholder="Player 1 Name"
                        playerDatabase={playerDatabase}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-600 mb-1 block flex items-center gap-1">
                        Player 2
                        {playerDatabase.length > 0 && <ChevronDown size={12} className="text-blue-500" />}
                      </label>
                      <AutocompleteInput
                        value={team.player2}
                        onChange={(value) => {
                          const newTeams = [...teams];
                          newTeams[index].player2 = value;
                          setTeams(newTeams);
                        }}
                        placeholder="Player 2 Name"
                        playerDatabase={playerDatabase}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={generateFixtures}
            disabled={loading || teams.some(t => !t.name || !t.player1 || !t.player2)}
            className="w-full mt-6 bg-gradient-to-r from-green-600 to-blue-600 text-white py-4 rounded-xl font-semibold text-lg hover:shadow-xl transform hover:scale-[1.02] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Calendar size={20} />
            {loading ? 'Generating Fixtures...' : 'Generate Fixtures & Start Tournament'}
          </button>
        </div>
      </div>
    </div>
  );

  // Render Tournament View
  const renderTournament = () => {
    const pointsTable = calculatePointsTable(teams, fixtures);
    const playerStats = calculatePlayerStats(teams, fixtures);
    const finalists = getFinalists();

    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
        {/* Header */}
        <div className="sticky top-0 bg-white shadow-md z-10">
          <div className="max-w-6xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-gray-800">🏸 {tournamentName}</h1>
                <p className="text-sm text-gray-600">{format} League Match(es) + Final</p>
              </div>
              <div className="flex gap-2 flex-wrap">
                {champion && (
                  <button
                    onClick={rerunTournament}
                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl hover:shadow-lg transition-all font-semibold"
                  >
                    <RefreshCw size={18} />
                    <span className="hidden md:inline">Re-run with Same Teams</span>
                    <span className="md:hidden">Rematch</span>
                  </button>
                )}
                <button
                  onClick={resetTournament}
                  className="flex items-center gap-2 px-4 py-2 bg-red-100 text-red-600 rounded-xl hover:bg-red-200 transition-all"
                >
                  <RotateCcw size={18} />
                  <span className="hidden md:inline">New</span>
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 overflow-x-auto pb-2">
              <button
                onClick={() => setActiveTab('fixtures')}
                className={`px-4 py-2 rounded-full font-semibold transition-all whitespace-nowrap ${
                  activeTab === 'fixtures'
                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Fixtures
              </button>
              <button
                onClick={() => setActiveTab('table')}
                className={`px-4 py-2 rounded-full font-semibold transition-all whitespace-nowrap ${
                  activeTab === 'table'
                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Points Table
              </button>
              <button
                onClick={() => setActiveTab('stats')}
                className={`px-4 py-2 rounded-full font-semibold transition-all whitespace-nowrap ${
                  activeTab === 'stats'
                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Player Stats
              </button>
              <button
                onClick={() => setActiveTab('final')}
                className={`px-4 py-2 rounded-full font-semibold transition-all whitespace-nowrap ${
                  activeTab === 'final'
                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Final
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
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
                    <div
                      className="bg-gradient-to-r from-green-500 to-blue-500 h-4 rounded-full transition-all duration-500"
                      style={{ width: `${(fixtures.filter(f => f.completed).length / fixtures.length) * 100}%` }}
                    />
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
                  <Trophy size={24} />
                  Points Table
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
                      <tr key={team.id} className={`border-b border-gray-200 hover:bg-gray-50 ${
                        index < 2 ? 'bg-green-50' : ''
                      }`}>
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
                          <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full font-bold">
                            {team.points}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center font-semibold">{team.scoreFor}</td>
                        <td className="px-4 py-4 text-center font-semibold">{team.scoreAgainst}</td>
                        <td className={`px-4 py-4 text-center font-bold ${
                          team.scoreDiff > 0 ? 'text-green-600' : team.scoreDiff < 0 ? 'text-red-600' : 'text-gray-600'
                        }`}>
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
                  <p>Win = 2 points | Tiebreaker: Score difference</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'stats' && (
            <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
              <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-6">
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                  <TrendingUp size={24} />
                  Player Statistics
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
                    <button
                      onClick={shareTournament}
                      className="flex items-center justify-center gap-2 bg-green-600 text-white py-4 rounded-xl font-semibold hover:bg-green-700 transition-all shadow-lg"
                    >
                      <Share2 size={20} />
                      Share to WhatsApp
                    </button>
                    <button
                      onClick={rerunTournament}
                      className="flex items-center justify-center gap-2 bg-blue-600 text-white py-4 rounded-xl font-semibold hover:bg-blue-700 transition-all shadow-lg"
                    >
                      <RefreshCw size={20} />
                      Rematch
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
      
      <Toast message={toast?.message} type={toast?.type} />
    </>
  );
};

export default BadmintonFixtureGenerator;