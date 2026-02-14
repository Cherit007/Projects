import React, { useState, useEffect } from 'react';
import SetupScreen from './components/SetupScreen';
import TeamEntry from './components/Teamentry';
import TournamentView from './components/Tournamentview';
import Toast from './components/Toast';
import { 
  calculatePointsTable, 
  calculatePlayerStats, 
  calculateCumulativePlayerStats,
  generateFixtures as createFixtures,
  updatePlayerRatingsAfterMatch,
  getPlayerLeaderboard,
  generateKnockoutBracket,
  updateBracket
} from './utils/calculations';

const App = () => {
  const defaultTeamConfigs = [
    { emoji: '🔥', name: 'Fire Smashers', player1: 'Alex Chen', player2: 'Sarah Kim' },
    { emoji: '⚡', name: 'Thunder Shots', player1: 'Mike Johnson', player2: 'Emma Davis' },
    { emoji: '🌟', name: 'Star Rallyers', player1: 'David Lee', player2: 'Lisa Wang' },
    { emoji: '💎', name: 'Diamond Drops', player1: 'Chris Brown', player2: 'Amy Liu' },
    { emoji: '🎯', name: 'Ace Strikers', player1: 'Tom Wilson', player2: 'Kate Zhang' },
    { emoji: '🚀', name: 'Rocket Serves', player1: 'Ryan Park', player2: 'Mia Chen' },
    { emoji: '👑', name: 'Royal Netters', player1: 'James Garcia', player2: 'Sophia Lee' },
    { emoji: '🌊', name: 'Wave Smashers', player1: 'Daniel Kim', player2: 'Olivia Wu' },
  ];

  const [step, setStep] = useState('setup');
  const [tournamentName, setTournamentName] = useState('');
  const [numTeams, setNumTeams] = useState(3);
  const [format, setFormat] = useState('1');
  const [gameMode, setGameMode] = useState('doubles');
  const [tournamentFormat, setTournamentFormat] = useState('league');
  const [teams, setTeams] = useState([]);
  const [fixtures, setFixtures] = useState([]);
  const [bracket, setBracket] = useState([]);
  const [champion, setChampion] = useState(null);
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(false);
  const [playerDatabase, setPlayerDatabase] = useState([]);
  const [playerRatings, setPlayerRatings] = useState({});
  const [tournamentHistory, setTournamentHistory] = useState([]);
  const [lastTournamentConfig, setLastTournamentConfig] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showAllTimeStats, setShowAllTimeStats] = useState(false);
  const [showEloLeaderboard, setShowEloLeaderboard] = useState(false);

  // Load from localStorage
  useEffect(() => {
    const savedHistory = localStorage.getItem('badmintonTournamentHistory');
    if (savedHistory) {
      try {
        const history = JSON.parse(savedHistory);
        setTournamentHistory(history);
        const allPlayers = new Set();
        history.forEach(t => t.teams?.forEach(team => {
          if (team.player1 || team.player) allPlayers.add(team.player1 || team.player);
          if (team.player2) allPlayers.add(team.player2);
        }));
        setPlayerDatabase(Array.from(allPlayers));
      } catch (e) {}
    }

    const savedRatings = localStorage.getItem('badmintonPlayerRatings');
    if (savedRatings) {
      try {
        setPlayerRatings(JSON.parse(savedRatings));
      } catch (e) {}
    }

    const savedConfig = localStorage.getItem('badmintonLastConfig');
    if (savedConfig) {
      try {
        setLastTournamentConfig(JSON.parse(savedConfig));
      } catch (e) {}
    }

    const savedCurrentState = localStorage.getItem('badmintonCurrentTournament');
    if (savedCurrentState) {
      try {
        const state = JSON.parse(savedCurrentState);
        setStep(state.step);
        setTournamentName(state.tournamentName);
        setNumTeams(state.numTeams);
        setFormat(state.format);
        setGameMode(state.gameMode || 'doubles');
        setTournamentFormat(state.tournamentFormat || 'league');
        setTeams(state.teams);
        setFixtures(state.fixtures || []);
        setBracket(state.bracket || []);
        setChampion(state.champion);
      } catch (e) {}
    }
  }, []);

  // Save to localStorage
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
    if (step !== 'setup' && tournamentName) {
      localStorage.setItem('badmintonCurrentTournament', JSON.stringify({
        step, tournamentName, numTeams, format, gameMode, tournamentFormat, teams, fixtures, bracket, champion
      }));
    }
  }, [step, tournamentName, numTeams, format, gameMode, tournamentFormat, teams, fixtures, bracket, champion]);

  // Initialize teams
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

  const generateFixtures = () => {
    setLoading(true);
    
    setLastTournamentConfig({ name: tournamentName, numTeams, format, teams, gameMode, tournamentFormat });
    localStorage.setItem('badmintonLastConfig', JSON.stringify({ name: tournamentName, numTeams, format, teams, gameMode, tournamentFormat }));

    // Initialize ELO ratings for all tournament players
    const updatedRatings = { ...playerRatings };
    teams.forEach(team => {
      const player1 = team.player || team.player1;
      const player2 = team.player2;
      
      updatePlayerDatabase(player1);
      if (player2) updatePlayerDatabase(player2);
      
      // Initialize rating if new player
      if (player1 && !updatedRatings[player1]) {
        updatedRatings[player1] = { rating: 1000, matchesPlayed: 0, history: [] };
      }
      if (player2 && !updatedRatings[player2]) {
        updatedRatings[player2] = { rating: 1000, matchesPlayed: 0, history: [] };
      }
    });
    setPlayerRatings(updatedRatings);

    setTimeout(() => {
      if (tournamentFormat === 'league') {
        const newFixtures = createFixtures(teams, format);
        setFixtures(newFixtures);
      } else {
        const newBracket = generateKnockoutBracket(teams, tournamentFormat);
        setBracket(newBracket);
      }
      setStep('tournament');
      setLoading(false);
      showToast('Tournament generated! 🏸');
    }, 800);
  };

  const saveMatchResult = (matchId, score1, score2) => {
    if (score1 === '' || score2 === '' || score1 === score2) {
      showToast('Invalid scores', 'error');
      return;
    }

    const match = fixtures.find(m => m.id === matchId);
    const completedMatch = { ...match, score1: parseInt(score1), score2: parseInt(score2), completed: true };

    const updatedRatings = updatePlayerRatingsAfterMatch(playerRatings, completedMatch);
    setPlayerRatings(updatedRatings);

    setFixtures(prev => prev.map(m => m.id === matchId ? completedMatch : m));
    showToast('Result saved! ✓');
  };

  const saveBracketMatchResult = (matchId, score1, score2) => {
    const updatedBracket = updateBracket(bracket, matchId, score1, score2);
    setBracket(updatedBracket);
    
    let match = null;
    for (const round of updatedBracket) {
      match = round.find(m => m.id === matchId);
      if (match) break;
    }
    if (match && match.completed) {
      const updatedRatings = updatePlayerRatingsAfterMatch(playerRatings, match);
      setPlayerRatings(updatedRatings);
      
      const finalRound = updatedBracket[updatedBracket.length - 1];
      const finalMatch = finalRound[0];
      if (finalMatch.completed) {
        const winner = finalMatch.score1 > finalMatch.score2 ? finalMatch.team1 : finalMatch.team2;
        setChampion(winner);
        setTournamentHistory(prev => [{ 
          id: Date.now(), name: tournamentName, date: new Date().toLocaleDateString(), 
          teams, bracket: updatedBracket, champion: winner, format: tournamentFormat, gameMode 
        }, ...prev]);
      }
    }
    
    showToast('Result saved! ✓');
  };

  const saveFinalResult = (score1, score2) => {
    if (score1 === '' || score2 === '' || score1 === score2) {
      showToast('Invalid scores', 'error');
      return;
    }

    const pointsTable = calculatePointsTable(teams, fixtures);
    const finalists = [pointsTable[0], pointsTable[1]];
    const winner = score1 > score2 ? finalists[0] : finalists[1];
    
    const finalMatch = {
      id: 'final',
      team1: finalists[0],
      team2: finalists[1],
      score1: parseInt(score1),
      score2: parseInt(score2),
      completed: true
    };

    const updatedRatings = updatePlayerRatingsAfterMatch(playerRatings, finalMatch);
    setPlayerRatings(updatedRatings);
    setChampion(winner);

    setTournamentHistory(prev => [{
      id: Date.now(),
      name: tournamentName,
      date: new Date().toLocaleDateString(),
      teams,
      fixtures,
      finalMatch,
      champion: winner,
      format,
      gameMode
    }, ...prev]);

    showToast(`🎉 ${winner.name} are the champions!`);
  };

  const resetTournament = () => {
    if (window.confirm('Start new tournament?')) {
      localStorage.removeItem('badmintonCurrentTournament');
      setStep('setup');
      setTournamentName('');
      setNumTeams(3);
      setTeams([]);
      setFixtures([]);
      setBracket([]);
      setChampion(null);
    }
  };

  const rerunTournament = () => {
    setFixtures([]);
    setBracket([]);
    setChampion(null);
    setTimeout(() => {
      if (tournamentFormat === 'league') {
        const newFixtures = createFixtures(teams, format);
        setFixtures(newFixtures);
      } else {
        const newBracket = generateKnockoutBracket(teams, tournamentFormat);
        setBracket(newBracket);
      }
      showToast('Rematch started! 🏸');
    }, 500);
  };

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const exportAllData = () => {
    const dataStr = JSON.stringify({ 
      exportDate: new Date().toISOString(), 
      tournamentHistory, 
      playerDatabase, 
      playerRatings, 
      version: '3.0' 
    }, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `badminton-data-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('Data exported! 📥');
  };

  const importData = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (data.tournamentHistory) setTournamentHistory(data.tournamentHistory);
        if (data.playerDatabase) setPlayerDatabase(data.playerDatabase);
        if (data.playerRatings) setPlayerRatings(data.playerRatings);
        showToast('Data imported! 📤');
      } catch (error) {
        showToast('Import failed', 'error');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const deletePlayer = (playerName) => {
    if (window.confirm(`Delete ${playerName} from leaderboard?`)) {
      const updatedRatings = { ...playerRatings };
      delete updatedRatings[playerName];
      setPlayerRatings(updatedRatings);
      localStorage.setItem('badmintonPlayerRatings', JSON.stringify(updatedRatings));
      showToast(`${playerName} deleted from leaderboard`);
    }
  };

  // Make delete function available globally for modal
  useEffect(() => {
    window.onDeletePlayer = deletePlayer;
    return () => {
      delete window.onDeletePlayer;
    };
  }, [playerRatings]);

  return (
    <>
      {step === 'setup' && (
        <SetupScreen
          tournamentName={tournamentName}
          setTournamentName={setTournamentName}
          numTeams={numTeams}
          setNumTeams={setNumTeams}
          format={format}
          setFormat={setFormat}
          gameMode={gameMode}
          setGameMode={setGameMode}
          tournamentFormat={tournamentFormat}
          setTournamentFormat={setTournamentFormat}
          onNext={() => setStep('teams')}
          lastTournamentConfig={lastTournamentConfig}
          onReuseTournament={() => {
            if (lastTournamentConfig) {
              setTournamentName(lastTournamentConfig.name + ' (Rematch)');
              setNumTeams(lastTournamentConfig.numTeams);
              setFormat(lastTournamentConfig.format);
              setGameMode(lastTournamentConfig.gameMode || 'doubles');
              setTournamentFormat(lastTournamentConfig.tournamentFormat || 'league');
              setTeams(lastTournamentConfig.teams.map((team, i) => ({ ...team, id: i + 1 })));
              setStep('teams');
              showToast('Tournament loaded!');
            }
          }}
          tournamentHistory={tournamentHistory}
          showHistory={showHistory}
          setShowHistory={setShowHistory}
          showAllTimeStats={showAllTimeStats}
          setShowAllTimeStats={setShowAllTimeStats}
          showEloLeaderboard={showEloLeaderboard}
          setShowEloLeaderboard={setShowEloLeaderboard}
          onExportData={exportAllData}
          onImportData={importData}
          onDeleteTournament={(id) => {
            if (window.confirm('Delete this tournament?')) {
              setTournamentHistory(prev => prev.filter(t => t.id !== id));
              showToast('Tournament deleted');
            }
          }}
          allTimeStats={calculateCumulativePlayerStats(tournamentHistory)}
          eloLeaderboard={getPlayerLeaderboard(playerRatings)}
        />
      )}

      {step === 'teams' && (
        <TeamEntry
          teams={teams}
          setTeams={setTeams}
          gameMode={gameMode}
          playerDatabase={playerDatabase}
          onGenerate={generateFixtures}
          loading={loading}
          onBack={() => setStep('setup')}
        />
      )}

      {step === 'tournament' && (
        <TournamentView
          tournamentName={tournamentName}
          setTournamentName={setTournamentName}
          format={format}
          tournamentFormat={tournamentFormat}
          fixtures={fixtures}
          bracket={bracket}
          teams={teams}
          champion={champion}
          playerRatings={playerRatings}
          onSaveMatchResult={saveMatchResult}
          onSaveBracketResult={saveBracketMatchResult}
          onSaveFinalResult={saveFinalResult}
          onResetTournament={resetTournament}
          onRerunTournament={rerunTournament}
          calculatePointsTable={calculatePointsTable}
          calculatePlayerStats={calculatePlayerStats}
          getPlayerLeaderboard={getPlayerLeaderboard}
        />
      )}

      <Toast message={toast?.message} type={toast?.type} />
    </>
  );
};

export default App;