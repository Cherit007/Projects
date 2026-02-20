import React, { useState } from 'react';
import { Users, Calendar, History, TrendingUp, Trophy, Share2, RefreshCw, X } from 'lucide-react';
import TournamentViewer from './TournamentViewer';

const SetupScreen = ({ 
  tournamentName, 
  setTournamentName,
  numTeams,
  setNumTeams,
  format,
  setFormat,
  gameMode,
  setGameMode,
  tournamentFormat,
  setTournamentFormat,
  onNext,
  onRecordCasualMatch,
  lastTournamentConfig,
  onReuseTournament,
  tournamentHistory,
  casualMatches,
  showHistory,
  setShowHistory,
  showCasualHistory,
  setShowCasualHistory,
  showAllTimeStats,
  setShowAllTimeStats,
  showEloLeaderboard,
  setShowEloLeaderboard,
  onDeleteTournament,
  onDeleteCasualMatch,
  onViewTournament,
  allTimeStats,
  eloLeaderboard
}) => {
  const [selectedTournament, setSelectedTournament] = useState(null);
  const formatCasualTeam = (team) => {
    if (!team) return 'Unknown';
    if (team.player) return team.player;
    return [team.player1, team.player2].filter(Boolean).join(' & ');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">🏸</div>
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
            Badminton Tournament
          </h1>
          <p className="text-gray-600">Professional tournament management</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-6 md:p-8 mb-6">
          {lastTournamentConfig && (
            <div className="mb-6 bg-gradient-to-r from-green-50 to-blue-50 border-2 border-green-300 rounded-xl p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-700 mb-1">🔄 Previous Tournament Available</p>
                  <p className="text-xs text-gray-600">"{lastTournamentConfig.name}" - {lastTournamentConfig.numTeams} teams</p>
                </div>
                <button onClick={onReuseTournament} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-all font-semibold text-sm whitespace-nowrap">
                  <RefreshCw size={16} /> Reuse
                </button>
              </div>
            </div>
          )}

          <div className="mb-6 grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
            <button onClick={() => setShowHistory(true)} className="flex items-center justify-center gap-1 sm:gap-2 px-2 sm:px-4 py-2 sm:py-3 bg-purple-100 text-purple-600 rounded-lg sm:rounded-xl hover:bg-purple-200 transition-all font-semibold text-xs sm:text-sm">
              <History size={14} className="sm:w-4 sm:h-4" /> 
              <span className="hidden xs:inline">History</span>
              <span className="xs:hidden">📜</span>
              <span className="hidden sm:inline">({tournamentHistory.length})</span>
            </button>
            <button onClick={() => setShowCasualHistory(true)} className="flex items-center justify-center gap-1 sm:gap-2 px-2 sm:px-4 py-2 sm:py-3 bg-green-100 text-green-700 rounded-lg sm:rounded-xl hover:bg-green-200 transition-all font-semibold text-xs sm:text-sm">
              <Calendar size={14} className="sm:w-4 sm:h-4" />
              <span className="hidden xs:inline">Casual</span>
              <span className="xs:hidden">🎯</span>
              <span className="hidden sm:inline">({casualMatches.length})</span>
            </button>
            <button onClick={() => setShowAllTimeStats(true)} className="flex items-center justify-center gap-1 sm:gap-2 px-2 sm:px-4 py-2 sm:py-3 bg-orange-100 text-orange-600 rounded-lg sm:rounded-xl hover:bg-orange-200 transition-all font-semibold text-xs sm:text-sm">
              <TrendingUp size={14} className="sm:w-4 sm:h-4" /> 
              <span className="hidden xs:inline">All-Time</span>
              <span className="xs:hidden">📊</span>
            </button>
            <button onClick={() => setShowEloLeaderboard(true)} className="flex items-center justify-center gap-1 sm:gap-2 px-2 sm:px-4 py-2 sm:py-3 bg-yellow-100 text-yellow-700 rounded-lg sm:rounded-xl hover:bg-yellow-200 transition-all font-semibold text-xs sm:text-sm">
              <Trophy size={14} className="sm:w-4 sm:h-4" /> 
              <span className="hidden xs:inline">ELO Rank</span>
              <span className="xs:hidden">🏆</span>
            </button>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Game Mode</label>
              <select value={gameMode} onChange={(e) => setGameMode(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 outline-none transition-all bg-white">
                <option value="doubles">🏸 Doubles (2 players per team)</option>
                <option value="singles">👤 Singles (1 player per team)</option>
                <option value="mixed">⚡ Mixed Doubles</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Tournament Format</label>
              <select value={tournamentFormat} onChange={(e) => {
                setTournamentFormat(e.target.value);
                if (e.target.value === 'semiFinal') setNumTeams(4);
                else if (e.target.value === 'fullKnockout') setNumTeams(8);
                else setNumTeams(3);
              }}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 outline-none transition-all bg-white">
                <option value="league">📊 League + Final</option>
                <option value="semiFinal">🏆 Semi Final + Final (4 teams)</option>
                <option value="fullKnockout">⚔️ Full Knockout (8 teams)</option>
              </select>
              {tournamentFormat === 'league' && (
                <select value={format} onChange={(e) => setFormat(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 outline-none transition-all bg-white mt-2">
                  <option value="1">1 match per pair</option>
                  <option value="2">2 matches per pair</option>
                </select>
              )}
              <p className="text-xs text-gray-500 mt-2">
                {tournamentFormat === 'semiFinal' && '4 teams: 2 semi finals → 1 final'}
                {tournamentFormat === 'fullKnockout' && '8 teams: quarters → semis → final'}
                {tournamentFormat === 'league' && 'Round-robin, top 2 advance to final'}
              </p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Tournament Name</label>
              <input type="text" value={tournamentName} onChange={(e) => setTournamentName(e.target.value)} placeholder="e.g., Summer Smash 2024"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 outline-none transition-all" />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Number of Teams</label>
              <input type="number" min="3" max="12" value={numTeams}
                disabled={tournamentFormat !== 'league'}
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
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 outline-none transition-all disabled:bg-gray-100" />
              <p className="text-xs text-gray-500 mt-1">
                {tournamentFormat === 'league' ? 'Min: 3, Max: 12 teams' : 'Fixed for this format'}
              </p>
            </div>

            {/* Record Casual Match Button */}
            <button 
              onClick={onRecordCasualMatch}
              className="w-full bg-gradient-to-r from-green-600 to-teal-600 text-white py-4 rounded-xl font-semibold text-lg hover:shadow-xl transform hover:scale-[1.02] transition-all mb-3"
            >
              <div className="flex items-center justify-center gap-2">
                <Trophy size={20} /> Record Casual Match
              </div>
            </button>

            <button onClick={onNext} disabled={!tournamentName.trim()}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-4 rounded-xl font-semibold text-lg hover:shadow-xl transform hover:scale-[1.02] transition-all disabled:opacity-50">
              <div className="flex items-center justify-center gap-2">
                <Users size={20} /> Start Tournament
              </div>
            </button>

            <p className="text-center text-xs text-gray-500 mt-3">
              💡 Record individual matches or start a full tournament
            </p>
          </div>
        </div>
      </div>

      {/* History Modal */}
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
                    <div key={tournament.id} className="border-2 border-gray-200 rounded-xl p-4 hover:border-purple-300 transition-all bg-gradient-to-r from-white to-gray-50">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-lg text-gray-800 mb-1">{tournament.name}</h4>
                          <p className="text-xs text-gray-500">{tournament.date} • {tournament.teams?.length || 0} teams</p>
                        </div>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => setSelectedTournament(tournament)}
                            className="text-blue-600 hover:text-blue-700 text-xs px-3 py-1 rounded-lg hover:bg-blue-50 transition-all font-semibold whitespace-nowrap">
                            View
                          </button>
                          <button onClick={() => onDeleteTournament(tournament.id)}
                            className="text-red-500 hover:text-red-700 text-xs px-3 py-1 rounded-lg hover:bg-red-50 transition-all font-semibold whitespace-nowrap">
                            Delete
                          </button>
                        </div>
                      </div>
                      {tournament.champion && (
                        <div className="flex items-center gap-3 bg-gradient-to-r from-yellow-50 to-orange-50 p-3 rounded-lg border-2 border-yellow-200">
                          <span className="text-3xl">{tournament.champion.emoji}</span>
                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-gray-800 flex items-center gap-2">
                              <Trophy size={16} className="text-yellow-600" />
                              {tournament.champion.name}
                            </p>
                            <p className="text-xs text-gray-600">
                              {tournament.champion.player || tournament.champion.player1}
                              {tournament.champion.player2 && ` & ${tournament.champion.player2}`}
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

      {/* Casual Match History Modal */}
      {showCasualHistory && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="bg-gradient-to-r from-green-600 to-teal-600 p-6 flex items-center justify-between">
              <h3 className="text-2xl font-bold text-white flex items-center gap-2">
                <Calendar size={24} /> Casual Match History
              </h3>
              <button onClick={() => setShowCasualHistory(false)} className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-lg transition-all">
                <X size={24} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[calc(80vh-88px)]">
              {casualMatches.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Calendar size={48} className="mx-auto mb-4 text-gray-300" />
                  <p>No casual match history yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {casualMatches.map((match, index) => {
                    const team1Name = formatCasualTeam(match.team1);
                    const team2Name = formatCasualTeam(match.team2);
                    const score1 = Number(match.score1);
                    const score2 = Number(match.score2);
                    const isTeam1Winner = score1 > score2;
                    const matchId = match.id || match.appwriteId;
                    return (
                      <div key={matchId || index} className="border-2 border-gray-200 rounded-xl p-4 bg-gradient-to-r from-white to-gray-50">
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="min-w-0">
                            <p className="text-xs text-gray-500 mb-1">
                              {match.matchType === 'doubles' ? '👥 Doubles' : '🎯 Singles'} • {new Date(match.date || match.createdAt || Date.now()).toLocaleString()}
                            </p>
                            <p className="font-semibold text-gray-800 truncate">
                              <span className={isTeam1Winner ? 'text-green-700' : ''}>{team1Name}</span> vs <span className={!isTeam1Winner ? 'text-green-700' : ''}>{team2Name}</span>
                            </p>
                            <p className="text-sm text-gray-700 mt-1">Score: {score1} - {score2}</p>
                          </div>
                          <button
                            onClick={() => onDeleteCasualMatch(matchId)}
                            disabled={!matchId}
                            className="text-red-500 hover:text-red-700 text-xs px-3 py-1 rounded-lg hover:bg-red-50 transition-all font-semibold whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* All-Time Stats Modal */}
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

      {/* ELO Leaderboard Modal */}
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
                              <span className={`px-3 py-1 rounded-full font-bold text-sm ${
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
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Tournament Viewer Modal */}
      {selectedTournament && (
        <TournamentViewer
          tournament={selectedTournament}
          onClose={() => setSelectedTournament(null)}
        />
      )}
    </div>
  );
};

export default SetupScreen;
