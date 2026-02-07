import React, { useState, useEffect } from 'react';
import { Trophy, Users, Calendar, RotateCcw, Check, Edit2, Share2, History, TrendingUp } from 'lucide-react';

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

  // State Management
  const [step, setStep] = useState('setup'); // setup, teams, tournament
  const [tournamentName, setTournamentName] = useState('');
  const [numTeams, setNumTeams] = useState(4);
  const [format, setFormat] = useState('1');
  const [teams, setTeams] = useState([]);
  const [fixtures, setFixtures] = useState([]);
  const [activeTab, setActiveTab] = useState('fixtures');
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(false);
  const [tournamentHistory, setTournamentHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showMatchHistory, setShowMatchHistory] = useState(false);

  // Load tournament history from localStorage on mount
  useEffect(() => {
    const savedHistory = localStorage.getItem('badmintonTournamentHistory');
    if (savedHistory) {
      try {
        setTournamentHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error('Error loading history:', e);
      }
    }
  }, []);

  // Save tournament history to localStorage whenever it changes
  useEffect(() => {
    if (tournamentHistory.length > 0) {
      localStorage.setItem('badmintonTournamentHistory', JSON.stringify(tournamentHistory));
    }
  }, [tournamentHistory]);

  // Initialize teams array when number changes
  useEffect(() => {
    if (step === 'teams') {
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

  // Generate Fixtures
  const generateFixtures = () => {
    setLoading(true);
    setTimeout(() => {
      const matchesPerPair = parseInt(format);
      const newFixtures = [];
      let matchId = 1;

      for (let i = 0; i < teams.length; i++) {
        for (let j = i + 1; j < teams.length; j++) {
          for (let round = 0; round < matchesPerPair; round++) {
            newFixtures.push({
              id: matchId++,
              team1: teams[i],
              team2: teams[j],
              score1: null,
              score2: null,
              completed: false,
              round: round + 1,
            });
          }
        }
      }

      setFixtures(newFixtures);
      setStep('tournament');
      setLoading(false);
      showToast('Fixtures generated successfully! 🏸');
    }, 800);
  };

  // Calculate Points Table
  const calculatePointsTable = () => {
    const table = teams.map(team => ({
      ...team,
      played: 0,
      won: 0,
      lost: 0,
      points: 0,
      scoreFor: 0,
      scoreAgainst: 0,
      scoreDiff: 0,
    }));

    fixtures.forEach(match => {
      if (match.completed) {
        const team1Index = table.findIndex(t => t.id === match.team1.id);
        const team2Index = table.findIndex(t => t.id === match.team2.id);

        table[team1Index].played++;
        table[team2Index].played++;
        table[team1Index].scoreFor += match.score1;
        table[team1Index].scoreAgainst += match.score2;
        table[team2Index].scoreFor += match.score2;
        table[team2Index].scoreAgainst += match.score1;

        if (match.score1 > match.score2) {
          table[team1Index].won++;
          table[team1Index].points += 2;
          table[team2Index].lost++;
        } else {
          table[team2Index].won++;
          table[team2Index].points += 2;
          table[team1Index].lost++;
        }
      }
    });

    table.forEach(team => {
      team.scoreDiff = team.scoreFor - team.scoreAgainst;
    });

    return table.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      return b.scoreDiff - a.scoreDiff;
    });
  };

  // Calculate Player Statistics
  const calculatePlayerStats = () => {
    const playerStats = {};

    // Initialize all players
    teams.forEach(team => {
      [team.player1, team.player2].forEach(player => {
        if (player && !playerStats[player]) {
          playerStats[player] = {
            name: player,
            team: team.name,
            teamEmoji: team.emoji,
            matchesPlayed: 0,
            matchesWon: 0,
            totalScored: 0,
            totalConceded: 0,
            winPercentage: 0,
          };
        }
      });
    });

    // Calculate stats from completed matches
    fixtures.forEach(match => {
      if (match.completed) {
        const team1Won = match.score1 > match.score2;
        
        // Team 1 players
        [match.team1.player1, match.team1.player2].forEach(player => {
          if (player && playerStats[player]) {
            playerStats[player].matchesPlayed++;
            playerStats[player].totalScored += match.score1;
            playerStats[player].totalConceded += match.score2;
            if (team1Won) playerStats[player].matchesWon++;
          }
        });

        // Team 2 players
        [match.team2.player1, match.team2.player2].forEach(player => {
          if (player && playerStats[player]) {
            playerStats[player].matchesPlayed++;
            playerStats[player].totalScored += match.score2;
            playerStats[player].totalConceded += match.score1;
            if (!team1Won) playerStats[player].matchesWon++;
          }
        });
      }
    });

    // Calculate win percentage
    Object.values(playerStats).forEach(player => {
      if (player.matchesPlayed > 0) {
        player.winPercentage = ((player.matchesWon / player.matchesPlayed) * 100).toFixed(1);
      }
    });

    return Object.values(playerStats).sort((a, b) => b.matchesWon - a.matchesWon);
  };

  // Calculate cumulative player stats across ALL tournaments
  const calculateCumulativePlayerStats = () => {
    const cumulativeStats = {};

    // Process all tournaments in history
    tournamentHistory.forEach(tournament => {
      // Process all fixtures in the tournament
      tournament.fixtures?.forEach(match => {
        if (match.completed) {
          const team1Won = match.score1 > match.score2;
          
          // Team 1 players
          [match.team1.player1, match.team1.player2].forEach(player => {
            if (player) {
              if (!cumulativeStats[player]) {
                cumulativeStats[player] = {
                  name: player,
                  tournamentsPlayed: new Set(),
                  matchesPlayed: 0,
                  matchesWon: 0,
                  totalScored: 0,
                  totalConceded: 0,
                  championships: 0,
                };
              }
              cumulativeStats[player].tournamentsPlayed.add(tournament.id);
              cumulativeStats[player].matchesPlayed++;
              cumulativeStats[player].totalScored += match.score1;
              cumulativeStats[player].totalConceded += match.score2;
              if (team1Won) cumulativeStats[player].matchesWon++;
            }
          });

          // Team 2 players
          [match.team2.player1, match.team2.player2].forEach(player => {
            if (player) {
              if (!cumulativeStats[player]) {
                cumulativeStats[player] = {
                  name: player,
                  tournamentsPlayed: new Set(),
                  matchesPlayed: 0,
                  matchesWon: 0,
                  totalScored: 0,
                  totalConceded: 0,
                  championships: 0,
                };
              }
              cumulativeStats[player].tournamentsPlayed.add(tournament.id);
              cumulativeStats[player].matchesPlayed++;
              cumulativeStats[player].totalScored += match.score2;
              cumulativeStats[player].totalConceded += match.score1;
              if (!team1Won) cumulativeStats[player].matchesWon++;
            }
          });
        }
      });

      // Count championships
      if (tournament.champion) {
        [tournament.champion.player1, tournament.champion.player2].forEach(player => {
          if (player && cumulativeStats[player]) {
            cumulativeStats[player].championships++;
          }
        });
      }
    });

    // Calculate additional stats
    const statsArray = Object.values(cumulativeStats).map(player => ({
      ...player,
      tournamentsPlayed: player.tournamentsPlayed.size,
      winPercentage: player.matchesPlayed > 0 
        ? ((player.matchesWon / player.matchesPlayed) * 100).toFixed(1)
        : 0,
      avgScorePerMatch: player.matchesPlayed > 0
        ? (player.totalScored / player.matchesPlayed).toFixed(1)
        : 0,
      scoreDiff: player.totalScored - player.totalConceded,
    }));

    return statsArray.sort((a, b) => {
      if (b.championships !== a.championships) return b.championships - a.championships;
      if (b.matchesWon !== a.matchesWon) return b.matchesWon - a.matchesWon;
      return b.winPercentage - a.winPercentage;
    });
  };

  // Calculate Player Statistics
  const calculatePlayerStatsOld = () => {
    const playerStats = {};

    // Initialize all players
    teams.forEach(team => {
      [team.player1, team.player2].forEach(player => {
        if (player && !playerStats[player]) {
          playerStats[player] = {
            name: player,
            team: team.name,
            teamEmoji: team.emoji,
            matchesPlayed: 0,
            matchesWon: 0,
            totalScored: 0,
            totalConceded: 0,
            winPercentage: 0,
          };
        }
      });
    });

    // Calculate stats from completed matches
    fixtures.forEach(match => {
      if (match.completed) {
        const team1Won = match.score1 > match.score2;
        
        // Team 1 players
        [match.team1.player1, match.team1.player2].forEach(player => {
          if (player && playerStats[player]) {
            playerStats[player].matchesPlayed++;
            playerStats[player].totalScored += match.score1;
            playerStats[player].totalConceded += match.score2;
            if (team1Won) playerStats[player].matchesWon++;
          }
        });

        // Team 2 players
        [match.team2.player1, match.team2.player2].forEach(player => {
          if (player && playerStats[player]) {
            playerStats[player].matchesPlayed++;
            playerStats[player].totalScored += match.score2;
            playerStats[player].totalConceded += match.score1;
            if (!team1Won) playerStats[player].matchesWon++;
          }
        });
      }
    });

    // Add final match stats if completed
    if (finalMatch && finalMatch.completed) {
      const finalists = getFinalists();
      if (finalists) {
        const team1Won = finalMatch.score1 > finalMatch.score2;
        
        [finalists[0].player1, finalists[0].player2].forEach(player => {
          if (player && playerStats[player]) {
            playerStats[player].matchesPlayed++;
            playerStats[player].totalScored += finalMatch.score1;
            playerStats[player].totalConceded += finalMatch.score2;
            if (team1Won) playerStats[player].matchesWon++;
          }
        });

        [finalists[1].player1, finalists[1].player2].forEach(player => {
          if (player && playerStats[player]) {
            playerStats[player].matchesPlayed++;
            playerStats[player].totalScored += finalMatch.score2;
            playerStats[player].totalConceded += finalMatch.score1;
            if (!team1Won) playerStats[player].matchesWon++;
          }
        });
      }
    }

    // Calculate win percentage
    Object.values(playerStats).forEach(player => {
      if (player.matchesPlayed > 0) {
        player.winPercentage = Math.round((player.matchesWon / player.matchesPlayed) * 100);
      }
    });

    return Object.values(playerStats).sort((a, b) => b.winPercentage - a.winPercentage || b.totalScored - a.totalScored);
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
    const table = calculatePointsTable();
    return [table[0], table[1]];
  };

  // Final match state
  const [finalMatch, setFinalMatch] = useState(null);
  const [champion, setChampion] = useState(null);

  // Save final result
  const saveFinalResult = (score1, score2) => {
    if (score1 === '' || score2 === '' || score1 === score2) {
      showToast('Please enter valid scores (must be different)', 'error');
      return;
    }

    const finalists = getFinalists();
    const winner = parseInt(score1) > parseInt(score2) ? finalists[0] : finalists[1];
    setFinalMatch({ score1: parseInt(score1), score2: parseInt(score2), completed: true });
    setChampion(winner);
    showToast('🎉 Tournament Complete!');
  };

  // Toast notification
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Reset Tournament
  const resetTournament = () => {
    if (confirm('Are you sure you want to start a new tournament? Current tournament will be saved to history.')) {
      // Save current tournament to history if it has data
      if (tournamentName && fixtures.length > 0) {
        const completedTournament = {
          id: Date.now(),
          name: tournamentName,
          date: new Date().toLocaleDateString(),
          teams: teams,
          fixtures: fixtures,
          champion: champion,
          finalMatch: finalMatch,
          format: format,
        };
        setTournamentHistory(prev => [completedTournament, ...prev]);
      }
      
      // Reset all state
      setStep('setup');
      setTournamentName('');
      setNumTeams(4);
      setFormat('1');
      setTeams([]);
      setFixtures([]);
      setFinalMatch(null);
      setChampion(null);
      setActiveTab('fixtures');
      showToast('New tournament started. Previous tournament saved to history.');
    }
  };

  // Export all data
  const exportAllData = () => {
    const exportData = {
      exportDate: new Date().toISOString(),
      tournamentHistory: tournamentHistory,
      version: '1.0'
    };
    
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `badminton-tournaments-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('Tournament data exported successfully! 📥');
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
          showToast('Tournament data imported successfully! 📤');
        } else {
          showToast('Invalid file format', 'error');
        }
      } catch (error) {
        showToast('Error importing data', 'error');
        console.error('Import error:', error);
      }
    };
    reader.readAsText(file);
    // Reset file input
    event.target.value = '';
  };

  // Start new tournament after completion
  const startNewTournament = () => {
    if (champion) {
      // Save to history
      const completedTournament = {
        id: Date.now(),
        name: tournamentName,
        date: new Date().toLocaleDateString(),
        teams: teams,
        fixtures: fixtures,
        champion: champion,
        finalMatch: finalMatch,
        format: format,
      };
      setTournamentHistory(prev => [completedTournament, ...prev]);
      
      // Reset
      setStep('setup');
      setTournamentName('');
      setNumTeams(4);
      setFormat('1');
      setTeams([]);
      setFixtures([]);
      setFinalMatch(null);
      setChampion(null);
      setActiveTab('fixtures');
      showToast('🏆 Tournament saved! Start a new one.');
    }
  };

  // Share tournament summary
  const shareTournament = (tournament) => {
    const summary = `
🏸 ${tournament.name} 🏸
📅 ${tournament.date}

🏆 CHAMPION: ${tournament.champion.name}
${tournament.champion.player1} & ${tournament.champion.player2}

📊 Final Score: ${tournament.finalMatch.score1} - ${tournament.finalMatch.score2}

🎯 Tournament Format: ${tournament.format} League Match(es) + Final
👥 Teams: ${tournament.teams.length}

Generated with Badminton Fixture Maker
    `.trim();
    
    copyToClipboard(summary);
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      showToast('Tournament summary copied! Share it on WhatsApp.');
    }).catch(() => {
      // Fallback: create a text area
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      showToast('Tournament summary copied! Share it on WhatsApp.');
    });
  };

  // Render Setup Screen
  const renderSetup = () => (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 p-4">
      <div className="max-w-2xl mx-auto pt-8">
        <div className="bg-white rounded-3xl shadow-2xl p-8 transform transition-all hover:scale-[1.02]">
          <div className="text-center mb-8">
            <div className="text-6xl mb-4">🏸</div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
              Doubles Fixture Maker
            </h1>
            <p className="text-gray-600">Create badminton fixtures in seconds</p>
          </div>

          {/* Quick Actions */}
          {tournamentHistory.length > 0 && (
            <div className="mb-6 grid grid-cols-2 gap-3">
              <button
                onClick={() => setShowHistory(true)}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-purple-100 text-purple-600 rounded-xl hover:bg-purple-200 transition-all font-semibold"
              >
                <History size={18} />
                History ({tournamentHistory.length})
              </button>
              <button
                onClick={exportAllData}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-green-100 text-green-600 rounded-xl hover:bg-green-200 transition-all font-semibold"
              >
                <Share2 size={18} />
                Export Data
              </button>
            </div>
          )}

          {/* Import Data */}
          <div className="mb-6">
            <label className="block w-full">
              <input
                type="file"
                accept=".json"
                onChange={importData}
                className="hidden"
                id="import-file"
              />
              <div className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-100 text-blue-600 rounded-xl hover:bg-blue-200 transition-all font-semibold cursor-pointer">
                <Calendar size={18} />
                Import Previous Data
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
                placeholder="e.g., Summer Badminton Cup"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
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
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
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
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all bg-white"
              >
                <option value="1">1 League Match + Final</option>
                <option value="2">2 League Matches + Final</option>
              </select>
            </div>

            <button
              onClick={() => tournamentName ? setStep('teams') : showToast('Please enter tournament name', 'error')}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-4 rounded-xl font-semibold text-lg hover:shadow-xl transform hover:scale-[1.02] transition-all flex items-center justify-center gap-2"
            >
              <Users size={20} />
              Generate Teams Form
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // Render Teams Entry
  const renderTeamsEntry = () => (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 p-4">
      <div className="max-w-4xl mx-auto pt-8">
        <div className="bg-white rounded-3xl shadow-2xl p-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-3xl font-bold text-gray-800">Enter Team Details</h2>
              <p className="text-sm text-gray-500 mt-1">Teams are pre-filled, but you can customize them</p>
            </div>
            <button
              onClick={() => setStep('setup')}
              className="text-gray-600 hover:text-gray-800 font-medium px-4 py-2 rounded-lg hover:bg-gray-100 transition-all"
            >
              ← Back
            </button>
          </div>

          {loading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="bg-gray-100 rounded-2xl h-40 animate-pulse"></div>
              ))}
            </div>
          ) : (
            <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-2">
              {teams.map((team, index) => (
                <div key={team.id} className="bg-gradient-to-r from-blue-50 to-purple-50 p-6 rounded-2xl border-2 border-transparent hover:border-blue-300 transition-all hover:shadow-lg">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="text-4xl bg-white w-16 h-16 rounded-xl flex items-center justify-center shadow-md">
                        {team.emoji}
                      </div>
                      <div className="flex-1">
                        <input
                          type="text"
                          value={team.name}
                          onChange={(e) => {
                            const newTeams = [...teams];
                            newTeams[index].name = e.target.value;
                            setTeams(newTeams);
                          }}
                          placeholder="Team Name"
                          className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-blue-500 outline-none transition-all font-semibold text-lg"
                        />
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        const emojis = ['🔥', '⚡', '🌟', '💎', '🎯', '🚀', '👑', '🌊', '🏆', '⭐', '🎨', '🌈', '💪', '🎪', '🎭', '🎸'];
                        const currentIndex = emojis.indexOf(team.emoji);
                        const nextEmoji = emojis[(currentIndex + 1) % emojis.length];
                        const newTeams = [...teams];
                        newTeams[index].emoji = nextEmoji;
                        setTeams(newTeams);
                      }}
                      className="bg-white p-2 rounded-lg hover:bg-gray-100 transition-all shadow-sm"
                      title="Change emoji"
                    >
                      <Edit2 size={18} className="text-gray-600" />
                    </button>
                  </div>
                  
                  <div className="grid md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-gray-600 mb-1 block">Player 1</label>
                      <input
                        type="text"
                        value={team.player1}
                        onChange={(e) => {
                          const newTeams = [...teams];
                          newTeams[index].player1 = e.target.value;
                          setTeams(newTeams);
                        }}
                        placeholder="Player 1 Name"
                        className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-blue-500 outline-none transition-all"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-600 mb-1 block">Player 2</label>
                      <input
                        type="text"
                        value={team.player2}
                        onChange={(e) => {
                          const newTeams = [...teams];
                          newTeams[index].player2 = e.target.value;
                          setTeams(newTeams);
                        }}
                        placeholder="Player 2 Name"
                        className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-purple-500 outline-none transition-all"
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
    const pointsTable = calculatePointsTable();
    const finalists = getFinalists();

    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
        {/* Header */}
        <div className="sticky top-0 bg-white shadow-md z-10">
          <div className="max-w-6xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-gray-800">🏸 {tournamentName}</h1>
                <p className="text-sm text-gray-600">{format} League Match(es) + Final</p>
              </div>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => setShowMatchHistory(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-600 rounded-xl hover:bg-blue-200 transition-all"
                  title="View match history"
                >
                  <Calendar size={18} />
                  <span className="hidden md:inline">Matches</span>
                </button>
                <button
                  onClick={() => setActiveTab('playerstats')}
                  className="flex items-center gap-2 px-4 py-2 bg-green-100 text-green-600 rounded-xl hover:bg-green-200 transition-all"
                  title="View player statistics"
                >
                  <TrendingUp size={18} />
                  <span className="hidden md:inline">Stats</span>
                </button>
                {tournamentHistory.length > 0 && (
                  <button
                    onClick={() => setShowHistory(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-100 text-purple-600 rounded-xl hover:bg-purple-200 transition-all"
                    title="View tournament history"
                  >
                    <History size={18} />
                    <span className="hidden md:inline">History ({tournamentHistory.length})</span>
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
            <div className="flex gap-2 overflow-x-auto">
              <button
                onClick={() => setActiveTab('fixtures')}
                className={`px-6 py-2 rounded-full font-semibold transition-all whitespace-nowrap ${
                  activeTab === 'fixtures'
                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Fixtures
              </button>
              <button
                onClick={() => setActiveTab('table')}
                className={`px-6 py-2 rounded-full font-semibold transition-all whitespace-nowrap ${
                  activeTab === 'table'
                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Points Table
              </button>
              <button
                onClick={() => setActiveTab('playerstats')}
                className={`px-6 py-2 rounded-full font-semibold transition-all whitespace-nowrap ${
                  activeTab === 'playerstats'
                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Player Stats
              </button>
              <button
                onClick={() => setActiveTab('final')}
                className={`px-6 py-2 rounded-full font-semibold transition-all whitespace-nowrap ${
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
          {/* Fixtures Tab */}
          {activeTab === 'fixtures' && (
            <div className="space-y-4">
              {/* Progress Indicator */}
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
                      className="bg-gradient-to-r from-green-500 to-blue-500 h-4 rounded-full transition-all duration-500 flex items-center justify-end pr-2"
                      style={{ width: `${(fixtures.filter(f => f.completed).length / fixtures.length) * 100}%` }}
                    >
                      {fixtures.filter(f => f.completed).length > 0 && (
                        <span className="text-xs font-bold text-white">
                          {Math.round((fixtures.filter(f => f.completed).length / fixtures.length) * 100)}%
                        </span>
                      )}
                    </div>
                  </div>
                  {allLeagueMatchesComplete() && (
                    <p className="text-center text-sm font-semibold text-green-600 mt-3">
                      ✅ All league matches completed! View the Final →
                    </p>
                  )}
                </div>
              )}
              
              {fixtures.length === 0 ? (
                <div className="bg-white rounded-2xl p-12 text-center">
                  <Calendar size={64} className="mx-auto text-gray-300 mb-4" />
                  <p className="text-gray-500">No fixtures generated yet</p>
                </div>
              ) : (
                fixtures.map((match) => (
                  <MatchCard key={match.id} match={match} onSave={saveMatchResult} />
                ))
              )}
            </div>
          )}

          {/* Points Table Tab */}
          {activeTab === 'table' && (
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
              {pointsTable.length === 0 ? (
                <div className="p-12 text-center">
                  <Users size={64} className="mx-auto text-gray-300 mb-4" />
                  <p className="text-gray-500">No results yet</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
                      <tr>
                        <th className="px-4 py-4 text-left">Rank</th>
                        <th className="px-4 py-4 text-left">Team</th>
                        <th className="px-4 py-4 text-center">Played</th>
                        <th className="px-4 py-4 text-center">Won</th>
                        <th className="px-4 py-4 text-center">Lost</th>
                        <th className="px-4 py-4 text-center">Points</th>
                        <th className="px-4 py-4 text-center">+/-</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pointsTable.map((team, index) => (
                        <tr
                          key={team.id}
                          className={`border-b hover:bg-gray-50 transition-colors ${
                            index < 2 ? 'bg-gradient-to-r from-green-50 to-emerald-50' : ''
                          }`}
                        >
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-2">
                              {index === 0 && <span className="text-2xl">🥇</span>}
                              {index === 1 && <span className="text-2xl">🥈</span>}
                              {index === 2 && <span className="text-2xl">🥉</span>}
                              {index > 2 && <span className="font-bold text-gray-600">{index + 1}</span>}
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-3">
                              <div className="text-2xl bg-white w-10 h-10 rounded-lg flex items-center justify-center shadow-sm">
                                {team.emoji}
                              </div>
                              <div>
                                <div className="font-bold text-gray-800">{team.name}</div>
                                <div className="text-xs text-gray-500">
                                  {team.player1} & {team.player2}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-center font-semibold">{team.played}</td>
                          <td className="px-4 py-4 text-center">
                            <span className="bg-green-100 text-green-700 px-2 py-1 rounded-lg font-bold">
                              {team.won}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-center">
                            <span className="bg-red-100 text-red-700 px-2 py-1 rounded-lg font-bold">
                              {team.lost}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-center">
                            <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-lg font-bold text-lg">
                              {team.points}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-center">
                            <span className={`font-bold text-lg ${team.scoreDiff >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {team.scoreDiff > 0 ? '+' : ''}{team.scoreDiff}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {allLeagueMatchesComplete() && (
                    <div className="bg-gradient-to-r from-yellow-50 to-orange-50 p-4 border-t-2 border-yellow-300">
                      <p className="text-center text-sm font-semibold text-gray-700">
                        🏆 Top 2 teams qualify for the final! Check the <button onClick={() => setActiveTab('final')} className="text-blue-600 underline">Final tab</button>
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Player Stats Tab */}
          {activeTab === 'playerstats' && (
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
              {(() => {
                const playerStats = calculatePlayerStats();
                return playerStats.length === 0 || playerStats.every(p => p.matchesPlayed === 0) ? (
                  <div className="p-12 text-center">
                    <TrendingUp size={64} className="mx-auto text-gray-300 mb-4" />
                    <p className="text-gray-500">No player statistics yet</p>
                    <p className="text-sm text-gray-400 mt-2">Complete some matches to see player stats</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gradient-to-r from-purple-600 to-pink-600 text-white">
                        <tr>
                          <th className="px-4 py-4 text-left">Rank</th>
                          <th className="px-4 py-4 text-left">Player</th>
                          <th className="px-4 py-4 text-center">Played</th>
                          <th className="px-4 py-4 text-center">Won</th>
                          <th className="px-4 py-4 text-center">Points</th>
                          <th className="px-4 py-4 text-center">Win %</th>
                        </tr>
                      </thead>
                      <tbody>
                        {playerStats.map((player, index) => (
                          <tr
                            key={player.name}
                            className={`border-b hover:bg-gray-50 transition-colors ${
                              index < 3 ? 'bg-gradient-to-r from-purple-50 to-pink-50' : ''
                            }`}
                          >
                            <td className="px-4 py-4">
                              <div className="flex items-center gap-2">
                                {index === 0 && <span className="text-2xl">🥇</span>}
                                {index === 1 && <span className="text-2xl">🥈</span>}
                                {index === 2 && <span className="text-2xl">🥉</span>}
                                {index > 2 && <span className="font-bold text-gray-600">{index + 1}</span>}
                              </div>
                            </td>
                            <td className="px-4 py-4">
                              <div className="flex items-center gap-3">
                                <div className="text-2xl bg-white w-10 h-10 rounded-lg flex items-center justify-center shadow-sm">
                                  {player.teamEmoji}
                                </div>
                                <div>
                                  <div className="font-bold text-gray-800">{player.name}</div>
                                  <div className="text-xs text-gray-500">{player.team}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-4 text-center font-semibold">{player.matchesPlayed}</td>
                            <td className="px-4 py-4 text-center">
                              <span className="bg-green-100 text-green-700 px-2 py-1 rounded-lg font-bold">
                                {player.matchesWon}
                              </span>
                            </td>
                            <td className="px-4 py-4 text-center">
                              <div className="text-sm">
                                <span className="text-green-600 font-bold">{player.totalScored}</span>
                                <span className="text-gray-400 mx-1">/</span>
                                <span className="text-red-600 font-bold">{player.totalConceded}</span>
                              </div>
                            </td>
                            <td className="px-4 py-4 text-center">
                              <div className="flex items-center justify-center gap-2">
                                <div className="relative w-16 h-16">
                                  <svg className="transform -rotate-90" width="64" height="64">
                                    <circle
                                      cx="32"
                                      cy="32"
                                      r="28"
                                      fill="none"
                                      stroke="#e5e7eb"
                                      strokeWidth="6"
                                    />
                                    <circle
                                      cx="32"
                                      cy="32"
                                      r="28"
                                      fill="none"
                                      stroke={player.winPercentage >= 70 ? '#10b981' : player.winPercentage >= 50 ? '#f59e0b' : '#ef4444'}
                                      strokeWidth="6"
                                      strokeDasharray={`${(player.winPercentage / 100) * 175.93} 175.93`}
                                      strokeLinecap="round"
                                    />
                                  </svg>
                                  <div className="absolute inset-0 flex items-center justify-center">
                                    <span className={`text-sm font-bold ${player.winPercentage >= 70 ? 'text-green-600' : player.winPercentage >= 50 ? 'text-orange-600' : 'text-red-600'}`}>
                                      {player.winPercentage}%
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Final Tab */}
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
                  {/* Podium Display */}
                  <div className="bg-gradient-to-br from-yellow-100 via-orange-100 to-red-100 rounded-3xl p-8 mb-6">
                    <div className="text-center mb-8">
                      <div className="text-6xl mb-4">🏆 TOURNAMENT COMPLETE 🏆</div>
                      <h2 className="text-3xl font-bold text-gray-800">{tournamentName}</h2>
                    </div>

                    {/* Podium */}
                    <div className="flex items-end justify-center gap-4 mb-8 max-w-3xl mx-auto">
                      {/* 2nd Place */}
                      {pointsTable[1] && (
                        <div className="flex-1 max-w-xs">
                          <div className="bg-gradient-to-br from-gray-300 to-gray-400 rounded-t-3xl p-6 text-center text-white shadow-xl transform hover:scale-105 transition-all" style={{height: '200px'}}>
                            <div className="text-5xl mb-3">{pointsTable[1].emoji}</div>
                            <div className="text-6xl mb-2">🥈</div>
                            <h3 className="font-bold text-xl mb-1">{pointsTable[1].name}</h3>
                            <p className="text-sm opacity-90">{pointsTable[1].player1}</p>
                            <p className="text-sm opacity-90">{pointsTable[1].player2}</p>
                            <div className="mt-3 bg-white bg-opacity-30 rounded-lg py-1">
                              <p className="text-sm font-bold">{pointsTable[1].points} points</p>
                            </div>
                          </div>
                          <div className="bg-gray-400 h-24 rounded-b-xl flex items-center justify-center text-white font-bold text-2xl">
                            2nd
                          </div>
                        </div>
                      )}

                      {/* 1st Place - Champion */}
                      <div className="flex-1 max-w-xs -mt-8">
                        <div className="bg-gradient-to-br from-yellow-400 to-orange-500 rounded-t-3xl p-8 text-center text-white shadow-2xl transform hover:scale-105 transition-all" style={{height: '280px'}}>
                          <div className="text-6xl mb-3 animate-bounce">{champion.emoji}</div>
                          <div className="text-7xl mb-2">🥇</div>
                          <h3 className="font-bold text-2xl mb-2">{champion.name}</h3>
                          <p className="text-base opacity-95">{champion.player1}</p>
                          <p className="text-base opacity-95">{champion.player2}</p>
                          <div className="mt-4 bg-white bg-opacity-30 rounded-lg py-2">
                            <p className="text-lg font-bold">CHAMPIONS!</p>
                            <p className="text-sm font-bold">{champion.points} points</p>
                          </div>
                        </div>
                        <div className="bg-gradient-to-br from-yellow-500 to-orange-600 h-32 rounded-b-xl flex items-center justify-center text-white font-bold text-3xl shadow-lg">
                          1st
                        </div>
                      </div>

                      {/* 3rd Place */}
                      {pointsTable[2] && (
                        <div className="flex-1 max-w-xs">
                          <div className="bg-gradient-to-br from-amber-600 to-amber-700 rounded-t-3xl p-6 text-center text-white shadow-xl transform hover:scale-105 transition-all" style={{height: '160px'}}>
                            <div className="text-4xl mb-2">{pointsTable[2].emoji}</div>
                            <div className="text-5xl mb-2">🥉</div>
                            <h3 className="font-bold text-lg mb-1">{pointsTable[2].name}</h3>
                            <p className="text-xs opacity-90">{pointsTable[2].player1}</p>
                            <p className="text-xs opacity-90">{pointsTable[2].player2}</p>
                            <div className="mt-2 bg-white bg-opacity-30 rounded-lg py-1">
                              <p className="text-xs font-bold">{pointsTable[2].points} points</p>
                            </div>
                          </div>
                          <div className="bg-amber-700 h-16 rounded-b-xl flex items-center justify-center text-white font-bold text-xl">
                            3rd
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Final Match Result */}
                    <div className="max-w-2xl mx-auto bg-white rounded-2xl p-6 shadow-lg">
                      <h3 className="text-center text-xl font-bold text-gray-800 mb-4">🏆 Final Match Result</h3>
                      <div className="flex items-center justify-center gap-8">
                        <div className="text-center">
                          <div className="text-3xl mb-2">{pointsTable[0].emoji}</div>
                          <p className="font-bold text-gray-800">{pointsTable[0].name}</p>
                          <p className="text-3xl font-bold text-green-600 mt-2">{finalMatch.score1}</p>
                        </div>
                        <div className="text-4xl font-bold text-gray-400">-</div>
                        <div className="text-center">
                          <div className="text-3xl mb-2">{pointsTable[1].emoji}</div>
                          <p className="font-bold text-gray-800">{pointsTable[1].name}</p>
                          <p className="text-3xl font-bold text-red-600 mt-2">{finalMatch.score2}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Action buttons after tournament completion */}
                  <div className="grid md:grid-cols-2 gap-4">
                    <button
                      onClick={() => shareTournament({
                        id: Date.now(),
                        name: tournamentName,
                        date: new Date().toLocaleDateString(),
                        teams: teams,
                        fixtures: fixtures,
                        champion: champion,
                        finalMatch: finalMatch,
                        format: format,
                      })}
                      className="flex items-center justify-center gap-2 bg-green-600 text-white py-4 rounded-xl font-semibold hover:bg-green-700 transition-all shadow-lg"
                    >
                      <Share2 size={20} />
                      Share to WhatsApp
                    </button>
                    <button
                      onClick={startNewTournament}
                      className="flex items-center justify-center gap-2 bg-blue-600 text-white py-4 rounded-xl font-semibold hover:bg-blue-700 transition-all shadow-lg"
                    >
                      <Trophy size={20} />
                      New Tournament
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

      {/* Match History Modal */}
      {showMatchHistory && typeof showMatchHistory !== 'object' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] min-h-[400px] flex flex-col overflow-hidden shadow-2xl my-auto">
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6 flex-shrink-0">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold flex items-center gap-2">
                    <Calendar size={24} />
                    Match History
                  </h2>
                  <p className="text-sm opacity-90 mt-1">{tournamentName}</p>
                </div>
                <button
                  onClick={() => setShowMatchHistory(false)}
                  className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition-all"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 min-h-0">
              {fixtures.filter(f => f.completed).length === 0 ? (
                <div className="text-center text-gray-500 py-12">
                  <Calendar size={64} className="mx-auto mb-4 opacity-30" />
                  <p className="text-lg font-semibold">No completed matches yet</p>
                  <p className="text-sm mt-2">Complete some fixtures to see match history</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {fixtures
                    .filter(f => f.completed)
                    .map((match) => (
                      <div key={match.id} className="bg-gray-50 rounded-xl p-4 border-2 border-gray-200 hover:border-blue-300 transition-all">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-bold text-gray-600">Match {match.id}</span>
                          <div className="flex items-center gap-2">
                            {match.round > 1 && (
                              <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-xs font-bold">
                                Round {match.round}
                              </span>
                            )}
                            <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs font-bold">
                              Completed
                            </span>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2 items-center">
                          <div className="text-center">
                            <div className="text-2xl mb-1">{match.team1.emoji}</div>
                            <p className="text-sm font-bold text-gray-800">{match.team1.name}</p>
                            <p className="text-xs text-gray-600">{match.team1.player1} & {match.team1.player2}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-2xl font-bold">
                              <span className={match.score1 > match.score2 ? 'text-green-600' : 'text-gray-400'}>{match.score1}</span>
                              <span className="text-gray-400 mx-1">-</span>
                              <span className={match.score2 > match.score1 ? 'text-green-600' : 'text-gray-400'}>{match.score2}</span>
                            </p>
                            <p className="text-xs text-gray-500 mt-1 font-semibold">
                              {match.score1 > match.score2 ? '← Winner' : 'Winner →'}
                            </p>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl mb-1">{match.team2.emoji}</div>
                            <p className="text-sm font-bold text-gray-800">{match.team2.name}</p>
                            <p className="text-xs text-gray-600">{match.team2.player1} & {match.team2.player2}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
            
            <div className="p-6 border-t bg-gray-50 flex-shrink-0">
              <button
                onClick={() => setShowMatchHistory(false)}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 rounded-xl font-semibold hover:shadow-lg transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tournament History Modal */}
      {showHistory && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] min-h-[400px] flex flex-col overflow-hidden shadow-2xl my-auto">
            <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white p-6 flex-shrink-0">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-3xl font-bold flex items-center gap-2">
                    <Trophy size={32} />
                    Tournament History
                  </h2>
                  <p className="text-sm opacity-90 mt-1">Past tournaments and champions</p>
                </div>
                <button
                  onClick={() => setShowHistory(false)}
                  className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition-all"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 min-h-0">
              {tournamentHistory.length === 0 ? (
                <div className="text-center text-gray-500 py-12">
                  <Trophy size={64} className="mx-auto mb-4 opacity-30" />
                  <p className="text-lg font-semibold">No tournament history yet</p>
                  <p className="text-sm mt-2">Complete tournaments to build your history</p>
                </div>
              ) : (
                <>
                  {/* Cumulative Stats Button */}
                  <div className="mb-6">
                    <button
                      onClick={() => {
                        const stats = calculateCumulativePlayerStats();
                        setShowMatchHistory({ 
                          name: 'All-Time Player Statistics',
                          isAllTimeStats: true,
                          cumulativeStats: stats 
                        });
                      }}
                      className="w-full bg-gradient-to-r from-green-600 to-blue-600 text-white py-3 rounded-xl font-semibold hover:shadow-lg transition-all flex items-center justify-center gap-2"
                    >
                      <TrendingUp size={20} />
                      View All-Time Player Stats
                    </button>
                  </div>

                  <div className="space-y-4">
                    {tournamentHistory.map((tournament) => (
                      <div key={tournament.id} className="bg-gradient-to-br from-gray-50 to-blue-50 rounded-2xl p-6 border-2 border-gray-200 hover:border-blue-300 transition-all shadow-sm hover:shadow-md">
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <h3 className="font-bold text-xl text-gray-800 mb-1">{tournament.name}</h3>
                            <p className="text-sm text-gray-600">{tournament.date}</p>
                          </div>
                          <button
                            onClick={() => setShowMatchHistory(tournament)}
                            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-all text-sm font-semibold"
                          >
                            View Details
                          </button>
                        </div>
                        
                        {tournament.champion && (
                          <div className="bg-gradient-to-r from-yellow-100 to-orange-100 rounded-xl p-4 border-2 border-yellow-300">
                            <div className="flex items-center gap-3">
                              <div className="text-3xl">{tournament.champion.emoji}</div>
                              <div className="flex-1">
                                <p className="text-xs font-semibold text-yellow-700 uppercase mb-1">Champion</p>
                                <p className="font-bold text-lg text-gray-800">{tournament.champion.name}</p>
                                <p className="text-sm text-gray-600">{tournament.champion.player1} & {tournament.champion.player2}</p>
                              </div>
                              <Trophy size={32} className="text-yellow-600" />
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
            
            <div className="p-6 border-t bg-gray-50 flex-shrink-0">
              <button
                onClick={() => setShowHistory(false)}
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3 rounded-xl font-semibold hover:shadow-lg transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detailed Match History from Tournament History Modal */}
      {showMatchHistory && typeof showMatchHistory === 'object' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] min-h-[400px] flex flex-col overflow-hidden shadow-2xl my-auto">
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6 flex-shrink-0">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold">📋 {showMatchHistory.name}</h2>
                  <p className="text-sm opacity-90 mt-1">Match Results & History</p>
                </div>
                <button
                  onClick={() => setShowMatchHistory(false)}
                  className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition-all"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 min-h-0">
              {showMatchHistory.isAllTimeStats ? (
                /* All-Time Player Stats View */
                <div className="space-y-3">
                  {showMatchHistory.cumulativeStats && showMatchHistory.cumulativeStats.length > 0 ? (
                    showMatchHistory.cumulativeStats.map((player, index) => (
                      <div key={player.name} className="bg-gradient-to-br from-white to-blue-50 rounded-xl p-4 border-2 border-gray-200 hover:border-blue-300 transition-all">
                        <div className="flex items-center gap-4 mb-3">
                          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold text-xl">
                            {index + 1}
                          </div>
                          <div className="flex-1">
                            <h3 className="font-bold text-lg text-gray-800">{player.name}</h3>
                            <div className="flex gap-2 mt-1">
                              {player.championships > 0 && (
                                <span className="bg-yellow-500 text-white px-2 py-0.5 rounded-full text-xs font-bold flex items-center gap-1">
                                  <Trophy size={12} />
                                  {player.championships}
                                </span>
                              )}
                              <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs font-semibold">
                                {player.tournamentsPlayed} tournaments
                              </span>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-bold text-green-600">{player.matchesWon}</p>
                            <p className="text-xs text-gray-600">wins</p>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-4 gap-2">
                          <div className="bg-white rounded-lg p-2 text-center border border-gray-200">
                            <p className="text-xs text-gray-600">Win %</p>
                            <p className="font-bold text-sm text-blue-600">{player.winPercentage}%</p>
                          </div>
                          <div className="bg-white rounded-lg p-2 text-center border border-gray-200">
                            <p className="text-xs text-gray-600">Matches</p>
                            <p className="font-bold text-sm">{player.matchesPlayed}</p>
                          </div>
                          <div className="bg-white rounded-lg p-2 text-center border border-gray-200">
                            <p className="text-xs text-gray-600">Avg Score</p>
                            <p className="font-bold text-sm text-purple-600">{player.avgScorePerMatch}</p>
                          </div>
                          <div className="bg-white rounded-lg p-2 text-center border border-gray-200">
                            <p className="text-xs text-gray-600">+/-</p>
                            <p className={`font-bold text-sm ${player.scoreDiff >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {player.scoreDiff > 0 ? '+' : ''}{player.scoreDiff}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center text-gray-500 py-12">
                      <TrendingUp size={64} className="mx-auto mb-4 opacity-30" />
                      <p className="text-lg font-semibold">No player statistics yet</p>
                    </div>
                  )}
                </div>
              ) : (
                /* Tournament Match History View */
                <div className="space-y-3">{showMatchHistory.fixtures?.map((match) => (
                  <div key={match.id} className="bg-gray-50 rounded-xl p-4 border-2 border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-bold text-gray-600">Match {match.id}</span>
                      <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs font-bold">
                        Completed
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 items-center">
                      <div className="text-center">
                        <div className="text-2xl mb-1">{match.team1.emoji}</div>
                        <p className="text-sm font-bold text-gray-800">{match.team1.name}</p>
                        <p className="text-xs text-gray-600">{match.team1.player1} & {match.team1.player2}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold">
                          <span className={match.score1 > match.score2 ? 'text-green-600' : 'text-red-600'}>{match.score1}</span>
                          <span className="text-gray-400 mx-1">-</span>
                          <span className={match.score2 > match.score1 ? 'text-green-600' : 'text-red-600'}>{match.score2}</span>
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {match.score1 > match.score2 ? '← Winner' : 'Winner →'}
                        </p>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl mb-1">{match.team2.emoji}</div>
                        <p className="text-sm font-bold text-gray-800">{match.team2.name}</p>
                        <p className="text-xs text-gray-600">{match.team2.player1} & {match.team2.player2}</p>
                      </div>
                    </div>
                  </div>
                ))}
                
                {/* Final Match */}
                {showMatchHistory.finalMatch && (
                  <div className="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-xl p-4 border-2 border-yellow-300 mt-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-bold text-gray-800">🏆 FINAL MATCH</span>
                      <span className="bg-yellow-500 text-white px-2 py-1 rounded-full text-xs font-bold">
                        Championship
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 items-center">
                      <div className="text-center">
                        <div className="text-3xl mb-1">{showMatchHistory.champion?.emoji}</div>
                        <p className="text-sm font-bold text-gray-800">{showMatchHistory.champion?.name}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-3xl font-bold">
                          <span className="text-green-600">{showMatchHistory.finalMatch.score1}</span>
                          <span className="text-gray-400 mx-1">-</span>
                          <span className="text-red-600">{showMatchHistory.finalMatch.score2}</span>
                        </p>
                        <p className="text-xs text-yellow-700 font-bold mt-1">CHAMPIONS!</p>
                      </div>
                      <div className="text-center">
                        <div className="text-3xl mb-1">{showMatchHistory.teams?.[1]?.emoji}</div>
                        <p className="text-sm font-bold text-gray-800">{showMatchHistory.teams?.[1]?.name}</p>
                      </div>
                    </div></div>
                )}
              </div>
              )}
            </div>
            
            <div className="p-6 border-t bg-gray-50 flex-shrink-0">
              <button
                onClick={() => {
                  setShowMatchHistory(false);
                  setShowHistory(true);
                }}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 rounded-xl font-semibold hover:shadow-lg transition-all"
              >
                ← Back to Tournament History
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-50 animate-slide-up">
          <div
            className={`px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 ${
              toast.type === 'error'
                ? 'bg-red-500 text-white'
                : 'bg-green-500 text-white'
            }`}
          >
            {toast.type === 'success' && <Check size={20} />}
            <span className="font-semibold">{toast.message}</span>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes slide-up {
          from {
            transform: translateY(100px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </>
  );
};

// Match Card Component
const MatchCard = ({ match, onSave }) => {
  const [score1, setScore1] = useState(match.score1 !== null ? match.score1 : '');
  const [score2, setScore2] = useState(match.score2 !== null ? match.score2 : '');
  const [isEditing, setIsEditing] = useState(!match.completed);

  // Update local state when match props change
  useEffect(() => {
    setScore1(match.score1 !== null ? match.score1 : '');
    setScore2(match.score2 !== null ? match.score2 : '');
  }, [match.score1, match.score2]);

  const handleSave = () => {
    onSave(match.id, score1, score2);
    setIsEditing(false);
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  return (
    <div className={`bg-white rounded-2xl shadow-lg p-6 transition-all relative ${
      match.completed ? 'border-2 border-green-400 bg-green-50/30' : 'border-2 border-gray-200 hover:border-blue-400 hover:shadow-xl'
    }`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-3 py-1 rounded-full text-sm font-bold">
            Match {match.id}
          </span>
          {match.round && parseInt(match.round) > 1 && (
            <span className="bg-gray-200 text-gray-700 px-2 py-1 rounded-full text-xs font-semibold">
              Round {match.round}
            </span>
          )}
        </div>
        {match.completed && (
          <div className="flex items-center gap-2">
            <span className="bg-green-500 text-white px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1">
              <Check size={14} /> Done
            </span>
            {!isEditing && (
              <button
                onClick={handleEdit}
                className="text-blue-600 hover:text-blue-700 p-1"
                title="Edit result"
              >
                <Edit2 size={16} />
              </button>
            )}
          </div>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-4 relative">
        {/* Team 1 */}
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl p-5 border-2 border-blue-200">
          <div className="flex items-center gap-3 mb-3">
            <div className="text-3xl bg-white w-12 h-12 rounded-xl flex items-center justify-center shadow-md">
              {match.team1.emoji}
            </div>
            <div>
              <h3 className="font-bold text-lg text-gray-800">{match.team1.name}</h3>
              <p className="text-xs text-gray-600">{match.team1.player1} & {match.team1.player2}</p>
            </div>
          </div>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={score1}
            onChange={(e) => {
              const value = e.target.value;
              if (value === '' || /^\d+$/.test(value)) {
                setScore1(value);
              }
            }}
            disabled={!isEditing}
            placeholder="Score"
            className="w-full px-4 py-3 border-2 border-blue-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none disabled:bg-gray-100 text-center text-2xl font-bold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
        </div>

        {/* VS Badge */}
        <div className="hidden md:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-gradient-to-r from-blue-600 to-purple-600 text-white w-14 h-14 rounded-full items-center justify-center font-bold shadow-xl z-10 text-sm">
          VS
        </div>
        <div className="md:hidden text-center my-2">
          <span className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-1 rounded-full text-sm font-bold">
            VS
          </span>
        </div>

        {/* Team 2 */}
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-2xl p-5 border-2 border-purple-200">
          <div className="flex items-center gap-3 mb-3">
            <div className="text-3xl bg-white w-12 h-12 rounded-xl flex items-center justify-center shadow-md">
              {match.team2.emoji}
            </div>
            <div>
              <h3 className="font-bold text-lg text-gray-800">{match.team2.name}</h3>
              <p className="text-xs text-gray-600">{match.team2.player1} & {match.team2.player2}</p>
            </div>
          </div>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={score2}
            onChange={(e) => {
              const value = e.target.value;
              if (value === '' || /^\d+$/.test(value)) {
                setScore2(value);
              }
            }}
            disabled={!isEditing}
            placeholder="Score"
            className="w-full px-4 py-3 border-2 border-purple-300 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none disabled:bg-gray-100 text-center text-2xl font-bold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
        </div>
      </div>

      {isEditing && (
        <button
          onClick={handleSave}
          className="w-full mt-4 bg-gradient-to-r from-green-600 to-blue-600 text-white py-3 rounded-xl font-semibold hover:shadow-lg transform hover:scale-[1.02] transition-all flex items-center justify-center gap-2"
        >
          <Check size={18} />
          {match.completed ? 'Update Result' : 'Save Result'}
        </button>
      )}
      
      {match.completed && match.score1 !== null && match.score2 !== null && !isEditing && (
        <div className="mt-4 text-center">
          <p className="text-sm font-semibold text-gray-600">
            Winner: <span className={`${match.score1 > match.score2 ? 'text-blue-600' : 'text-purple-600'} font-bold`}>
              {match.score1 > match.score2 ? match.team1.name : match.team2.name}
            </span>
          </p>
        </div>
      )}
    </div>
  );
};

// Final Match Card Component
const FinalMatchCard = ({ finalists, onSave }) => {
  const [score1, setScore1] = useState('');
  const [score2, setScore2] = useState('');

  const handleSave = () => {
    onSave(score1, score2);
  };

  return (
    <div className="bg-gradient-to-br from-yellow-100 via-orange-100 to-red-100 rounded-3xl shadow-2xl p-8 border-4 border-yellow-400">
      <div className="text-center mb-8">
        <div className="text-7xl mb-4 animate-bounce">🏆</div>
        <h2 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-yellow-600 to-red-600 bg-clip-text text-transparent mb-2">
          FINAL MATCH
        </h2>
        <p className="text-gray-700 font-semibold text-lg">Top 2 teams battle for the championship!</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6 relative mb-6">
        {/* Finalist 1 */}
        <div className="bg-white rounded-2xl p-6 shadow-xl transform hover:scale-105 transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-gradient-to-r from-yellow-400 to-yellow-500 text-white text-xs font-bold px-3 py-1 rounded-full">
              🥇 1st Place
            </div>
            <div className="text-4xl">
              {finalists[0].emoji}
            </div>
          </div>
          <h3 className="font-bold text-2xl mb-2">{finalists[0].name}</h3>
          <p className="text-sm text-gray-600 mb-4">{finalists[0].player1} & {finalists[0].player2}</p>
          <div className="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg p-4 mb-4 border border-yellow-200">
            <div className="flex justify-between text-sm mb-2">
              <span className="font-semibold text-gray-700">League Points:</span>
              <span className="font-bold text-blue-600 text-lg">{finalists[0].points}</span>
            </div>
            <div className="flex justify-between text-sm mb-2">
              <span className="font-semibold text-gray-700">Matches Won:</span>
              <span className="font-bold text-green-600">{finalists[0].won}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="font-semibold text-gray-700">Score Difference:</span>
              <span className={`font-bold ${finalists[0].scoreDiff >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {finalists[0].scoreDiff > 0 ? '+' : ''}{finalists[0].scoreDiff}
              </span>
            </div>
          </div>
          <label className="block text-sm font-bold text-gray-700 mb-2">Final Match Score</label>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={score1}
            onChange={(e) => {
              const value = e.target.value;
              if (value === '' || /^\d+$/.test(value)) {
                setScore1(value);
              }
            }}
            placeholder="Enter score"
            className="w-full px-4 py-4 border-3 border-yellow-400 rounded-xl focus:border-yellow-500 focus:ring-4 focus:ring-yellow-200 outline-none text-2xl font-bold text-center bg-gradient-to-r from-yellow-50 to-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
        </div>

        {/* VS Badge */}
        <div className="hidden md:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-gradient-to-r from-yellow-500 via-orange-500 to-red-500 text-white w-20 h-20 rounded-full items-center justify-center font-bold text-2xl shadow-2xl z-10 animate-pulse">
          VS
        </div>
        <div className="md:hidden text-center my-4">
          <span className="bg-gradient-to-r from-yellow-500 to-red-500 text-white px-6 py-2 rounded-full text-lg font-bold shadow-lg">
            VS
          </span>
        </div>

        {/* Finalist 2 */}
        <div className="bg-white rounded-2xl p-6 shadow-xl transform hover:scale-105 transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-gradient-to-r from-gray-400 to-gray-500 text-white text-xs font-bold px-3 py-1 rounded-full">
              🥈 2nd Place
            </div>
            <div className="text-4xl">
              {finalists[1].emoji}
            </div>
          </div>
          <h3 className="font-bold text-2xl mb-2">{finalists[1].name}</h3>
          <p className="text-sm text-gray-600 mb-4">{finalists[1].player1} & {finalists[1].player2}</p>
          <div className="bg-gradient-to-r from-gray-50 to-slate-50 rounded-lg p-4 mb-4 border border-gray-200">
            <div className="flex justify-between text-sm mb-2">
              <span className="font-semibold text-gray-700">League Points:</span>
              <span className="font-bold text-blue-600 text-lg">{finalists[1].points}</span>
            </div>
            <div className="flex justify-between text-sm mb-2">
              <span className="font-semibold text-gray-700">Matches Won:</span>
              <span className="font-bold text-green-600">{finalists[1].won}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="font-semibold text-gray-700">Score Difference:</span>
              <span className={`font-bold ${finalists[1].scoreDiff >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {finalists[1].scoreDiff > 0 ? '+' : ''}{finalists[1].scoreDiff}
              </span>
            </div>
          </div>
          <label className="block text-sm font-bold text-gray-700 mb-2">Final Match Score</label>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={score2}
            onChange={(e) => {
              const value = e.target.value;
              if (value === '' || /^\d+$/.test(value)) {
                setScore2(value);
              }
            }}
            placeholder="Enter score"
            className="w-full px-4 py-4 border-3 border-gray-400 rounded-xl focus:border-gray-500 focus:ring-4 focus:ring-gray-200 outline-none text-2xl font-bold text-center bg-gradient-to-r from-gray-50 to-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={!score1 || !score2 || score1 === score2}
        className="w-full bg-gradient-to-r from-yellow-500 via-orange-500 to-red-500 text-white py-5 rounded-2xl font-bold text-xl hover:shadow-2xl transform hover:scale-[1.02] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
      >
        <Trophy size={24} />
        Declare Champion!
      </button>
      {score1 === score2 && score1 !== '' && (
        <p className="text-center text-red-600 text-sm mt-2 font-semibold">
          Scores must be different to declare a winner
        </p>
      )}
    </div>
  );
};

export default BadmintonFixtureGenerator;