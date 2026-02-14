import React, { useState } from 'react';
import { Trophy, RotateCcw, RefreshCw, Edit2, TrendingUp, Users } from 'lucide-react';
import LiveMatchView from './LiveMatchView';
import MatchCard from './MatchCard';
import FinalMatchCard from './FinalMatchCard';
import BracketView from './BracketView';
import BracketMatchModal from './BracketMatchModal';

const TournamentView = ({
  tournamentName,
  setTournamentName,
  format,
  tournamentFormat,
  fixtures,
  bracket,
  teams,
  champion,
  playerRatings,
  onSaveMatchResult,
  onSaveBracketResult,
  onSaveFinalResult,
  onResetTournament,
  onRerunTournament,
  calculatePointsTable,
  calculatePlayerStats,
  getPlayerLeaderboard
}) => {
  const [activeTab, setActiveTab] = useState('fixtures');
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempTournamentName, setTempTournamentName] = useState(tournamentName);
  const [selectedBracketMatch, setSelectedBracketMatch] = useState(null);

  // Find current match (first incomplete)
  const currentMatch = tournamentFormat === 'league' 
    ? fixtures.find(m => !m.completed)
    : null;

  // Get next matches
  const nextMatches = tournamentFormat === 'league'
    ? fixtures.filter(m => !m.completed).slice(1, 4)
    : [];

  const pointsTable = tournamentFormat === 'league' ? calculatePointsTable(teams, fixtures) : [];
  const playerStats = tournamentFormat === 'league' ? calculatePlayerStats(teams, fixtures) : [];
  
  // Filter ELO leaderboard to only show players in current tournament
  const currentTournamentPlayers = new Set();
  teams.forEach(team => {
    if (team.player) currentTournamentPlayers.add(team.player);
    if (team.player1) currentTournamentPlayers.add(team.player1);
    if (team.player2) currentTournamentPlayers.add(team.player2);
  });
  
  const allEloLeaderboard = getPlayerLeaderboard(playerRatings);
  const eloLeaderboard = allEloLeaderboard.filter(player => currentTournamentPlayers.has(player.name));

  const allLeagueMatchesComplete = () => {
    return fixtures.length > 0 && fixtures.every(match => match.completed);
  };

  const getFinalists = () => {
    if (!allLeagueMatchesComplete()) return null;
    const table = calculatePointsTable(teams, fixtures);
    return [table[0], table[1]];
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      {/* Header */}
      <div className="sticky top-0 bg-white shadow-md z-10">
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
                  <h1 className="text-2xl md:text-3xl font-bold text-gray-800">🏸 {tournamentName}</h1>
                  <button onClick={() => { setTempTournamentName(tournamentName); setIsEditingName(true); }}
                    className="text-gray-400 hover:text-gray-600 p-1">
                    <Edit2 size={18} />
                  </button>
                </div>
              )}
              <p className="text-sm text-gray-600">
                {tournamentFormat === 'league' && `${format} League Match(es) + Final`}
                {tournamentFormat === 'semiFinal' && 'Semi Final + Final'}
                {tournamentFormat === 'fullKnockout' && 'Full Knockout Bracket'}
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              {champion && (
                <button onClick={onRerunTournament}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl hover:shadow-lg transition-all font-semibold">
                  <RefreshCw size={18} />
                  <span className="hidden md:inline">Rematch</span>
                </button>
              )}
              <button onClick={onResetTournament}
                className="flex items-center gap-2 px-4 py-2 bg-red-100 text-red-600 rounded-xl hover:bg-red-200 transition-all">
                <RotateCcw size={18} />
                <span className="hidden md:inline">New</span>
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            <button onClick={() => setActiveTab('fixtures')}
              className={`px-3 sm:px-4 py-2 rounded-full font-semibold transition-all whitespace-nowrap text-sm sm:text-base ${
                activeTab === 'fixtures' ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              Fixtures
            </button>
            {tournamentFormat === 'league' && (
              <>
                <button onClick={() => setActiveTab('table')}
                  className={`px-3 sm:px-4 py-2 rounded-full font-semibold transition-all whitespace-nowrap text-sm sm:text-base ${
                    activeTab === 'table' ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  Table
                </button>
                <button onClick={() => setActiveTab('stats')}
                  className={`px-3 sm:px-4 py-2 rounded-full font-semibold transition-all whitespace-nowrap text-sm sm:text-base ${
                    activeTab === 'stats' ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  Stats
                </button>
              </>
            )}
            <button onClick={() => setActiveTab('elo')}
              className={`px-3 sm:px-4 py-2 rounded-full font-semibold transition-all whitespace-nowrap text-sm sm:text-base ${
                activeTab === 'elo' ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              ELO
            </button>
            <button onClick={() => setActiveTab('final')}
              className={`px-3 sm:px-4 py-2 rounded-full font-semibold transition-all whitespace-nowrap text-sm sm:text-base ${
                activeTab === 'final' ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              Final
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {activeTab === 'fixtures' && (
          <div className="space-y-6">
            {tournamentFormat === 'league' ? (
              <>
                {/* Live Match View */}
                {currentMatch && (
                  <LiveMatchView
                    currentMatch={currentMatch}
                    onSaveScore={onSaveMatchResult}
                    nextMatches={nextMatches}
                    tournamentName={tournamentName}
                    playerRatings={playerRatings}
                  />
                )}

                {/* Completed Matches */}
                {fixtures.filter(m => m.completed).length > 0 && (
                  <div>
                    <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                      <Trophy size={20} className="text-green-600" />
                      Completed Matches ({fixtures.filter(m => m.completed).length}/{fixtures.length})
                    </h3>
                    <div className="space-y-4">
                      {fixtures.filter(m => m.completed).map(match => (
                        <MatchCard key={match.id} match={match} onSave={onSaveMatchResult} />
                      ))}
                    </div>
                  </div>
                )}

                {allLeagueMatchesComplete() && (
                  <div className="bg-green-50 border-2 border-green-300 rounded-2xl p-6 text-center">
                    <Trophy size={48} className="mx-auto text-green-600 mb-3" />
                    <p className="text-lg font-bold text-green-700">All league matches completed!</p>
                    <p className="text-sm text-gray-600 mt-2">Top 2 teams will play in the final</p>
                  </div>
                )}
              </>
            ) : (
              <>
                <BracketView bracket={bracket} onMatchClick={(match) => setSelectedBracketMatch(match)} />
                {selectedBracketMatch && (
                  <BracketMatchModal
                    match={selectedBracketMatch}
                    onSave={onSaveBracketResult}
                    onClose={() => setSelectedBracketMatch(null)}
                  />
                )}
              </>
            )}
          </div>
        )}

        {activeTab === 'table' && tournamentFormat === 'league' && (
          <div className="bg-white rounded-xl sm:rounded-2xl shadow-xl overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-4 sm:p-6">
              <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
                <Trophy size={20} className="sm:w-6 sm:h-6" /> Points Table
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px]">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-2 sm:px-4 py-3 text-left text-xs sm:text-sm font-bold text-gray-700">Pos</th>
                    <th className="px-2 sm:px-4 py-3 text-left text-xs sm:text-sm font-bold text-gray-700">Team</th>
                    <th className="px-2 sm:px-4 py-3 text-center text-xs sm:text-sm font-bold text-gray-700">P</th>
                    <th className="px-2 sm:px-4 py-3 text-center text-xs sm:text-sm font-bold text-gray-700">W</th>
                    <th className="px-2 sm:px-4 py-3 text-center text-xs sm:text-sm font-bold text-gray-700">L</th>
                    <th className="px-2 sm:px-4 py-3 text-center text-xs sm:text-sm font-bold text-gray-700">Pts</th>
                    <th className="px-2 sm:px-4 py-3 text-center text-xs sm:text-sm font-bold text-gray-700">Diff</th>
                  </tr>
                </thead>
                <tbody>
                  {pointsTable.map((team, index) => (
                    <tr key={team.id} className={`border-b border-gray-200 hover:bg-gray-50 ${index < 2 ? 'bg-green-50' : ''}`}>
                      <td className="px-2 sm:px-4 py-3 sm:py-4">
                        <span className="font-bold text-base sm:text-lg">
                          {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}
                        </span>
                      </td>
                      <td className="px-2 sm:px-4 py-3 sm:py-4">
                        <div className="flex items-center gap-2 sm:gap-3">
                          <span className="text-lg sm:text-2xl">{team.emoji}</span>
                          <div className="min-w-0">
                            <p className="font-bold text-sm sm:text-base text-gray-800 truncate">{team.name}</p>
                            <p className="text-xs text-gray-600 truncate">{team.player || team.player1}{team.player2 && ` & ${team.player2}`}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-2 sm:px-4 py-3 sm:py-4 text-center font-semibold text-sm">{team.played}</td>
                      <td className="px-2 sm:px-4 py-3 sm:py-4 text-center font-semibold text-green-600 text-sm">{team.won}</td>
                      <td className="px-2 sm:px-4 py-3 sm:py-4 text-center font-semibold text-red-600 text-sm">{team.lost}</td>
                      <td className="px-2 sm:px-4 py-3 sm:py-4 text-center">
                        <span className="bg-blue-100 text-blue-700 px-2 sm:px-3 py-1 rounded-full font-bold text-xs sm:text-sm">{team.points}</span>
                      </td>
                      <td className={`px-2 sm:px-4 py-3 sm:py-4 text-center font-bold text-sm ${team.scoreDiff > 0 ? 'text-green-600' : team.scoreDiff < 0 ? 'text-red-600' : 'text-gray-600'}`}>
                        {team.scoreDiff > 0 ? '+' : ''}{team.scoreDiff}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-3 sm:p-4 bg-gray-50 text-xs text-gray-600">
              <p>Top 2 teams qualify for the final • Win = 2 points</p>
            </div>
          </div>
        )}

        {activeTab === 'stats' && tournamentFormat === 'league' && (
          <div className="bg-white rounded-xl sm:rounded-2xl shadow-xl overflow-hidden">
            <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-4 sm:p-6">
              <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
                <TrendingUp size={20} className="sm:w-6 sm:h-6" /> Player Statistics
              </h2>
            </div>
            {playerStats.length === 0 ? (
              <div className="p-8 sm:p-12 text-center text-gray-500">
                <Users size={40} className="mx-auto mb-4 text-gray-300 sm:w-12 sm:h-12" />
                <p className="text-sm sm:text-base">No match results yet. Complete matches to see player stats.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[500px]">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-2 sm:px-4 py-3 text-left text-xs sm:text-sm font-bold text-gray-700">Rank</th>
                      <th className="px-2 sm:px-4 py-3 text-left text-xs sm:text-sm font-bold text-gray-700">Player</th>
                      <th className="px-2 sm:px-4 py-3 text-center text-xs sm:text-sm font-bold text-gray-700">Played</th>
                      <th className="px-2 sm:px-4 py-3 text-center text-xs sm:text-sm font-bold text-gray-700">Won</th>
                      <th className="px-2 sm:px-4 py-3 text-center text-xs sm:text-sm font-bold text-gray-700">Win %</th>
                      <th className="px-2 sm:px-4 py-3 text-center text-xs sm:text-sm font-bold text-gray-700">Scored</th>
                    </tr>
                  </thead>
                  <tbody>
                    {playerStats.map((player, index) => (
                      <tr key={player.name} className="border-b border-gray-200 hover:bg-gray-50">
                        <td className="px-2 sm:px-4 py-3 sm:py-4 text-center font-bold text-base sm:text-lg">
                          {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}
                        </td>
                        <td className="px-2 sm:px-4 py-3 sm:py-4">
                          <div className="flex items-center gap-2 sm:gap-3">
                            <span className="text-lg sm:text-xl">{player.teamEmoji}</span>
                            <div className="min-w-0">
                              <p className="font-bold text-sm sm:text-base text-gray-800 truncate">{player.name}</p>
                              <p className="text-xs text-gray-600 truncate">{player.team}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-2 sm:px-4 py-3 sm:py-4 text-center font-semibold text-sm">{player.matchesPlayed}</td>
                        <td className="px-2 sm:px-4 py-3 sm:py-4 text-center font-semibold text-green-600 text-sm">{player.matchesWon}</td>
                        <td className="px-2 sm:px-4 py-3 sm:py-4 text-center">
                          <span className="bg-purple-100 text-purple-700 px-2 sm:px-3 py-1 rounded-full font-bold text-xs sm:text-sm">
                            {player.winPercentage}%
                          </span>
                        </td>
                        <td className="px-2 sm:px-4 py-3 sm:py-4 text-center font-semibold text-blue-600 text-sm">{player.totalScored}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'elo' && (
          <div className="bg-white rounded-xl sm:rounded-2xl shadow-xl overflow-hidden">
            <div className="bg-gradient-to-r from-yellow-600 to-orange-600 p-4 sm:p-6">
              <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
                <Trophy size={20} className="sm:w-6 sm:h-6" /> ELO Leaderboard
              </h2>
            </div>
            {eloLeaderboard.length === 0 ? (
              <div className="p-8 sm:p-12 text-center text-gray-500">
                <Trophy size={40} className="mx-auto mb-4 text-gray-300 sm:w-12 sm:h-12" />
                <p className="text-sm sm:text-base">Complete matches to build the leaderboard!</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[500px]">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-2 sm:px-4 py-3 text-left text-xs sm:text-sm font-bold text-gray-700">Rank</th>
                      <th className="px-2 sm:px-4 py-3 text-left text-xs sm:text-sm font-bold text-gray-700">Player</th>
                      <th className="px-2 sm:px-4 py-3 text-center text-xs sm:text-sm font-bold text-gray-700">Rating</th>
                      <th className="px-2 sm:px-4 py-3 text-center text-xs sm:text-sm font-bold text-gray-700">Matches</th>
                      <th className="px-2 sm:px-4 py-3 text-center text-xs sm:text-sm font-bold text-gray-700">Change</th>
                    </tr>
                  </thead>
                  <tbody>
                    {eloLeaderboard.map((player, index) => {
                      const lastMatch = player.history?.[player.history.length - 1];
                      return (
                        <tr key={player.name} className="border-b border-gray-200 hover:bg-gray-50">
                          <td className="px-2 sm:px-4 py-3 sm:py-4 text-center font-bold text-base sm:text-lg">
                            {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}
                          </td>
                          <td className="px-2 sm:px-4 py-3 sm:py-4">
                            <p className="font-bold text-sm sm:text-base text-gray-800 truncate">{player.name}</p>
                          </td>
                          <td className="px-2 sm:px-4 py-3 sm:py-4 text-center">
                            <span className={`px-2 sm:px-4 py-1 sm:py-2 rounded-full font-bold text-sm sm:text-base ${
                              player.rating >= 1200 ? 'bg-yellow-100 text-yellow-700' :
                              player.rating >= 1000 ? 'bg-green-100 text-green-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {player.rating}
                            </span>
                          </td>
                          <td className="px-2 sm:px-4 py-3 sm:py-4 text-center font-semibold text-sm">{player.matchesPlayed}</td>
                          <td className="px-2 sm:px-4 py-3 sm:py-4 text-center">
                            {lastMatch && (
                              <span className={`font-bold text-sm ${lastMatch.change > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {lastMatch.change > 0 ? '+' : ''}{lastMatch.change}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div className="p-3 sm:p-4 bg-gray-50 text-xs text-gray-600">
                  <p>All players start at 1000 • Ratings update after each match</p>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'final' && (
          <div className="space-y-6">
            {tournamentFormat === 'league' ? (
              <>
                {champion ? (
                  <div className="bg-white rounded-2xl p-8 sm:p-12 text-center">
                    <div className="text-5xl sm:text-6xl mb-4">🏆</div>
                    <h2 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-4">Tournament Complete!</h2>
                    <div className="bg-yellow-50 rounded-2xl p-4 sm:p-6 max-w-md mx-auto">
                      <div className="text-4xl sm:text-5xl mb-3">{champion.emoji}</div>
                      <h3 className="text-xl sm:text-2xl font-bold text-gray-800 mb-2">{champion.name}</h3>
                      <p className="text-sm sm:text-base text-gray-600">
                        {champion.player || champion.player1}
                        {champion.player2 && ` & ${champion.player2}`}
                      </p>
                      <div className="mt-4 bg-yellow-100 rounded-lg py-2">
                        <p className="text-base sm:text-lg font-bold text-gray-800">🥇 CHAMPIONS!</p>
                      </div>
                    </div>
                  </div>
                ) : allLeagueMatchesComplete() ? (
                  <FinalMatchCard
                    finalists={getFinalists()}
                    onSave={onSaveFinalResult}
                    playerRatings={playerRatings}
                  />
                ) : (
                  <div className="bg-white rounded-xl sm:rounded-2xl p-8 sm:p-12 text-center">
                    <Trophy size={48} className="mx-auto text-yellow-500 mb-4 sm:w-16 sm:h-16" />
                    <p className="text-base sm:text-lg text-gray-500 mb-4">Complete all league matches first</p>
                    <p className="text-sm text-gray-400">
                      {fixtures.filter(f => f.completed).length} / {fixtures.length} matches completed
                    </p>
                  </div>
                )}
              </>
            ) : (
              <div className="bg-white rounded-2xl p-8 sm:p-12 text-center">
                <Trophy size={48} className="mx-auto text-yellow-500 mb-4 sm:w-16 sm:h-16" />
                {champion ? (
                  <div>
                    <div className="text-5xl sm:text-6xl mb-4">🏆</div>
                    <h2 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-4">Tournament Complete!</h2>
                    <div className="bg-yellow-50 rounded-2xl p-4 sm:p-6 max-w-md mx-auto">
                      <div className="text-4xl sm:text-5xl mb-3">{champion.emoji}</div>
                      <h3 className="text-xl sm:text-2xl font-bold text-gray-800 mb-2">{champion.name}</h3>
                      <p className="text-sm sm:text-base text-gray-600">
                        {champion.player || champion.player1}
                        {champion.player2 && ` & ${champion.player2}`}
                      </p>
                      <div className="mt-4 bg-yellow-100 rounded-lg py-2">
                        <p className="text-base sm:text-lg font-bold text-gray-800">🥇 CHAMPIONS!</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>
                    <p className="text-lg sm:text-xl font-bold text-gray-800 mb-4">Bracket in Progress</p>
                    <p className="text-sm sm:text-base text-gray-600">Complete all matches to determine the champion</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default TournamentView;