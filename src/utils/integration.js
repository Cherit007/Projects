/**
 * INTEGRATION PATCH FOR BADMINTON TOURNAMENT APP
 * 
 * This file contains all the code additions needed to add:
 * - Knockout Bracket Mode (Semi Finals + Final, Full Knockout)
 * - Game Modes (Singles, Doubles, Mixed Doubles)
 * 
 * Apply these changes to BadmintonFixtureGenerator.jsx
 */

// ========== 1. UPDATE IMPORTS ==========
// Replace the existing imports section with:
/*
import React, { useState, useEffect } from 'react';
import { Trophy, Users, Calendar, RotateCcw, Share2, History, TrendingUp, RefreshCw, ChevronDown, Edit2, X } from 'lucide-react';
import AutocompleteInput from './AutocompleteInput';
import MatchCard from './MatchCard';
import FinalMatchCard from './FinalMatchCard';
import BracketView from './BracketView';
import BracketMatchModal from './BracketMatchModal';
import Toast from './Toast';
import { 
  calculatePointsTable, 
  calculatePlayerStats, 
  calculateCumulativePlayerStats,
  generateFixtures as createFixtures,
  updatePlayerRatingsAfterMatch,
  getPlayerLeaderboard,
  generateKnockoutBracket,
  updateBracket
} from './calculations';
*/

// ========== 2. ADD STATE VARIABLES ==========
// Add these after the existing state declarations (around line 48):
/*
const [gameMode, setGameMode] = useState('doubles'); // 'doubles' | 'singles' | 'mixed'
const [tournamentFormat, setTournamentFormat] = useState('league'); // 'league' | 'semiFinal' | 'fullKnockout'
const [bracket, setBracket] = useState([]);
const [selectedBracketMatch, setSelectedBracketMatch] = useState(null);
*/

// ========== 3. UPDATE generateFixtures FUNCTION ==========
// Replace the generateFixtures function with:
const generateFixtures = () => {
    setLoading(true);
    setLastTournamentConfig({ name: tournamentName, numTeams: numTeams, format: format, teams: teams, gameMode: gameMode, tournamentFormat: tournamentFormat });
    localStorage.setItem('badmintonLastConfig', JSON.stringify({ name: tournamentName, numTeams: numTeams, format: format, teams: teams, gameMode: gameMode, tournamentFormat: tournamentFormat }));
    teams.forEach(team => {
      updatePlayerDatabase(team.player1 || team.player);
      if (team.player2) updatePlayerDatabase(team.player2);
    });
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
      showToast('Tournament generated successfully! 🏸');
    }, 800);
  };
  
  // ========== 4. ADD BRACKET MATCH HANDLER ==========
  // Add this new function after saveFinalResult:
  const saveBracketMatchResult = (matchId, score1, score2) => {
    const updatedBracket = updateBracket(bracket, matchId, score1, score2);
    setBracket(updatedBracket);
    
    // Update ELO for the match
    let match = null;
    for (const round of updatedBracket) {
      match = round.find(m => m.id === matchId);
      if (match) break;
    }
    if (match && match.completed) {
      const updatedRatings = updatePlayerRatingsAfterMatch(playerRatings, match);
      setPlayerRatings(updatedRatings);
      
      // Check if tournament is complete (final match completed)
      const finalRound = updatedBracket[updatedBracket.length - 1];
      const finalMatch = finalRound[0];
      if (finalMatch.completed) {
        const winner = finalMatch.score1 > finalMatch.score2 ? finalMatch.team1 : finalMatch.team2;
        setChampion(winner);
        const tournament = {
          id: Date.now(), name: tournamentName, date: new Date().toLocaleDateString(), teams: teams,
          bracket: updatedBracket, champion: winner, format: tournamentFormat, gameMode: gameMode
        };
        setTournamentHistory(prev => [tournament, ...prev]);
      }
    }
    
    showToast('Result saved! ✓');
  };
  
  // ========== 5. UPDATE renderSetup() ==========
  // In the renderSetup function, REPLACE the "Tournament Format" dropdown section with:
  /*
  <div>
    <label className="block text-sm font-semibold text-gray-700 mb-2">Game Mode</label>
    <select value={gameMode} onChange={(e) => setGameMode(e.target.value)}
      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 outline-none transition-all bg-white">
      <option value="doubles">🏸 Doubles (2 players per team)</option>
      <option value="singles">👤 Singles (1 player per team)</option>
      <option value="mixed">⚡ Mixed Doubles (Male & Female)</option>
    </select>
  </div>
  
  <div>
    <label className="block text-sm font-semibold text-gray-700 mb-2">Tournament Format</label>
    <select value={tournamentFormat} onChange={(e) => {
      setTournamentFormat(e.target.value);
      if (e.target.value === 'semiFinal') setNumTeams(4);
      else if (e.target.value === 'fullKnockout') setNumTeams(8);
      else if (e.target.value === 'league') setNumTeams(3);
    }}
      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 outline-none transition-all bg-white">
      <option value="league">📊 League (Round-Robin) + Final</option>
      <option value="semiFinal">🏆 Semi Final + Final (4 teams)</option>
      <option value="fullKnockout">⚔️ Full Knockout Bracket (8 teams)</option>
    </select>
    {tournamentFormat === 'league' && (
      <select value={format} onChange={(e) => setFormat(e.target.value)}
        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 outline-none transition-all bg-white mt-3">
        <option value="1">1 League Match per pair</option>
        <option value="2">2 League Matches per pair</option>
      </select>
    )}
    <p className="text-xs text-gray-500 mt-1">
      {tournamentFormat === 'semiFinal' && '4 teams: 2 semi finals → 1 final'}
      {tournamentFormat === 'fullKnockout' && '8 teams: 4 quarters → 2 semis → 1 final'}
      {tournamentFormat === 'league' && 'All teams play each other, top 2 advance to final'}
    </p>
  </div>
  */
  
  // ========== 6. UPDATE renderTeamsEntry() ==========
  // In renderTeamsEntry, update the player input section to handle singles mode:
  /*
  {gameMode === 'singles' ? (
    <div>
      <label className="text-xs font-semibold text-gray-600 mb-1 block flex items-center gap-1">
        Player Name
        {playerDatabase.length > 0 && <ChevronDown size={12} className="text-blue-500" />}
      </label>
      <AutocompleteInput value={team.player1 || team.player} onChange={(value) => {
        const newTeams = [...teams];
        newTeams[index].player = value;
        newTeams[index].player1 = value; // For compatibility
        setTeams(newTeams);
      }} placeholder="Player Name" playerDatabase={playerDatabase} />
    </div>
  ) : (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div>
        <label className="text-xs font-semibold text-gray-600 mb-1 block flex items-center gap-1">
          {gameMode === 'mixed' ? 'Player 1 (Male/Female)' : 'Player 1'}
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
          {gameMode === 'mixed' ? 'Player 2 (Male/Female)' : 'Player 2'}
          {playerDatabase.length > 0 && <ChevronDown size={12} className="text-blue-500" />}
        </label>
        <AutocompleteInput value={team.player2} onChange={(value) => {
          const newTeams = [...teams];
          newTeams[index].player2 = value;
          setTeams(newTeams);
        }} placeholder="Player 2 Name" playerDatabase={playerDatabase} />
      </div>
    </div>
  )}
  */
  
  // ========== 7. UPDATE renderTournament() ==========
  // In the renderTournament function, in the fixtures tab content, ADD:
  /*
  {tournamentFormat !== 'league' ? (
    // Knockout Bracket View
    <div className="space-y-4">
      <BracketView 
        bracket={bracket} 
        onMatchClick={(match) => setSelectedBracketMatch(match)}
      />
      {selectedBracketMatch && (
        <BracketMatchModal
          match={selectedBracketMatch}
          onSave={saveBracketMatchResult}
          onClose={() => setSelectedBracketMatch(null)}
        />
      )}
    </div>
  ) : (
    // League fixtures view (existing code)
    <div className="space-y-4">
      {fixtures.length > 0 && (
        // ... existing progress bar code ...
      )}
      {fixtures.map((match) => (
        <MatchCard key={match.id} match={match} onSave={saveMatchResult} />
      ))}
    </div>
  )}
  */
  
  // ========== 8. UPDATE NUMBER OF TEAMS INPUT ==========
  // In renderSetup(), update the numTeams input to be disabled for knockout formats:
  /*
  <div>
    <label className="block text-sm font-semibold text-gray-700 mb-2">Number of Teams</label>
    <input type="text" inputMode="numeric" pattern="[0-9]*" value={String(numTeams)}
      disabled={tournamentFormat !== 'league'}
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
      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 outline-none transition-all disabled:bg-gray-100 disabled:cursor-not-allowed" />
    <p className="text-xs text-gray-500 mt-1">
      {tournamentFormat === 'league' ? 'Min: 3, Max: 12 teams' : 'Fixed for this format'}
    </p>
  </div>
  */
  
  console.log('Patch file ready! Apply these changes to BadmintonFixtureGenerator.jsx');
