import React, { useState, useEffect } from 'react';
import { Trophy, Clock, TrendingUp, Users } from 'lucide-react';

const LiveMatchView = ({ 
  currentMatch, 
  onSaveScore, 
  nextMatches = [],
  tournamentName,
  playerRatings = {}
}) => {
  const [score1, setScore1] = useState('');
  const [score2, setScore2] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [celebrationActive, setCelebrationActive] = useState(false);

  const handleSubmit = async () => {
    if (!score1 || !score2 || score1 === score2) return;
    
    setIsSubmitting(true);
    setCelebrationActive(true);
    
    // Celebration effect
    setTimeout(() => {
      onSaveScore(currentMatch.id, parseInt(score1), parseInt(score2));
      setScore1('');
      setScore2('');
      setIsSubmitting(false);
      setCelebrationActive(false);
    }, 1500);
  };

  const getPlayerRating = (playerName) => {
    return playerRatings[playerName]?.rating || 1000;
  };

  const team1Rating = currentMatch.team1 ? 
    Math.round(((getPlayerRating(currentMatch.team1.player || currentMatch.team1.player1) + 
    (currentMatch.team1.player2 ? getPlayerRating(currentMatch.team1.player2) : 0)) / 
    (currentMatch.team1.player2 ? 2 : 1))) : 1000;

  const team2Rating = currentMatch.team2 ? 
    Math.round(((getPlayerRating(currentMatch.team2.player || currentMatch.team2.player1) + 
    (currentMatch.team2.player2 ? getPlayerRating(currentMatch.team2.player2) : 0)) / 
    (currentMatch.team2.player2 ? 2 : 1))) : 1000;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Live Match Header */}
      <div className="bg-gradient-to-r from-red-500 via-orange-500 to-yellow-500 text-white rounded-xl sm:rounded-2xl p-3 sm:p-4 shadow-2xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-2 h-2 sm:w-3 sm:h-3 bg-red-600 rounded-full animate-pulse"></div>
            <span className="font-bold text-base sm:text-lg">LIVE NOW</span>
          </div>
          <div className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
            <Clock size={14} className="sm:w-4 sm:h-4" />
            <span>Match {currentMatch.id}</span>
          </div>
        </div>
      </div>

      {/* Main Match Card */}
      <div className={`relative bg-white rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden transition-all duration-500 ${
        celebrationActive ? 'scale-105 ring-4 ring-yellow-400' : ''
      }`}>
        {/* Celebration Confetti Effect */}
        {celebrationActive && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden z-10">
            {[...Array(20)].map((_, i) => (
              <div
                key={i}
                className="absolute w-2 h-2 bg-yellow-400 rounded-full animate-ping"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 0.5}s`
                }}
              />
            ))}
          </div>
        )}

        {/* Tournament Name */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 sm:px-6 py-3 sm:py-4 text-center">
          <h2 className="text-lg sm:text-2xl font-bold">{tournamentName}</h2>
          <p className="text-xs sm:text-sm opacity-90">Current Match</p>
        </div>

        <div className="p-4 sm:p-8">
          {/* Teams Display */}
          <div className="grid grid-cols-1 gap-4 sm:gap-6 mb-6 sm:mb-8">
            {/* Team 1 */}
            <div className="relative">
              <div className="absolute -top-2 -left-2 bg-blue-500 text-white text-xs font-bold px-2 sm:px-3 py-1 rounded-full">
                Team 1
              </div>
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl sm:rounded-2xl p-4 sm:p-6 border-2 sm:border-4 border-blue-300">
                <div className="flex items-center gap-3 sm:gap-4 mb-3 sm:mb-4">
                  <div className="text-3xl sm:text-5xl bg-white w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-lg">
                    {currentMatch.team1.emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-lg sm:text-2xl text-gray-800 mb-1 truncate">{currentMatch.team1.name}</h3>
                    <p className="text-xs sm:text-sm text-gray-600 truncate">
                      {currentMatch.team1.player || currentMatch.team1.player1}
                      {currentMatch.team1.player2 && <> & {currentMatch.team1.player2}</>}
                    </p>
                  </div>
                </div>
                
                {/* ELO Rating */}
                <div className="bg-white rounded-lg p-2 sm:p-3 mb-3 sm:mb-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-600">ELO Rating</span>
                    <div className="flex items-center gap-1">
                      <TrendingUp size={12} className="text-blue-600 sm:w-3.5 sm:h-3.5" />
                      <span className="font-bold text-blue-600 text-sm sm:text-base">{team1Rating}</span>
                    </div>
                  </div>
                </div>

                {/* Score Input */}
                <div>
                  <label className="block text-xs sm:text-sm font-bold text-gray-700 mb-2">Score</label>
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
                    placeholder="0"
                    className="w-full px-4 sm:px-6 py-3 sm:py-4 border-2 sm:border-4 border-blue-400 rounded-xl sm:rounded-2xl focus:border-blue-600 focus:ring-2 sm:focus:ring-4 focus:ring-blue-200 outline-none text-center text-3xl sm:text-4xl font-bold bg-white transition-all"
                    disabled={isSubmitting}
                  />
                </div>
              </div>
            </div>

            {/* VS Badge - Hidden on mobile, shown on larger screens */}
            <div className="hidden md:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-gradient-to-r from-orange-500 to-red-500 text-white w-16 h-16 sm:w-20 sm:h-20 rounded-full items-center justify-center font-bold text-xl sm:text-2xl shadow-2xl z-10 animate-pulse">
              VS
            </div>

            {/* Mobile VS separator */}
            <div className="md:hidden flex items-center justify-center -my-2">
              <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white px-6 py-2 rounded-full font-bold text-lg shadow-lg">
                VS
              </div>
            </div>

            {/* Team 2 */}
            <div className="relative">
              <div className="absolute -top-2 -right-2 bg-purple-500 text-white text-xs font-bold px-2 sm:px-3 py-1 rounded-full">
                Team 2
              </div>
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl sm:rounded-2xl p-4 sm:p-6 border-2 sm:border-4 border-purple-300">
                <div className="flex items-center gap-3 sm:gap-4 mb-3 sm:mb-4">
                  <div className="text-3xl sm:text-5xl bg-white w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-lg">
                    {currentMatch.team2.emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-lg sm:text-2xl text-gray-800 mb-1 truncate">{currentMatch.team2.name}</h3>
                    <p className="text-xs sm:text-sm text-gray-600 truncate">
                      {currentMatch.team2.player || currentMatch.team2.player1}
                      {currentMatch.team2.player2 && <> & {currentMatch.team2.player2}</>}
                    </p>
                  </div>
                </div>

                {/* ELO Rating */}
                <div className="bg-white rounded-lg p-2 sm:p-3 mb-3 sm:mb-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-600">ELO Rating</span>
                    <div className="flex items-center gap-1">
                      <TrendingUp size={12} className="text-purple-600 sm:w-3.5 sm:h-3.5" />
                      <span className="font-bold text-purple-600 text-sm sm:text-base">{team2Rating}</span>
                    </div>
                  </div>
                </div>

                {/* Score Input */}
                <div>
                  <label className="block text-xs sm:text-sm font-bold text-gray-700 mb-2">Score</label>
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
                    placeholder="0"
                    className="w-full px-4 sm:px-6 py-3 sm:py-4 border-2 sm:border-4 border-purple-400 rounded-xl sm:rounded-2xl focus:border-purple-600 focus:ring-2 sm:focus:ring-4 focus:ring-purple-200 outline-none text-center text-3xl sm:text-4xl font-bold bg-white transition-all"
                    disabled={isSubmitting}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <button
            onClick={handleSubmit}
            disabled={!score1 || !score2 || score1 === score2 || isSubmitting}
            className="w-full bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500 text-white py-4 sm:py-6 rounded-xl sm:rounded-2xl font-bold text-base sm:text-xl hover:shadow-2xl transform hover:scale-[1.02] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 sm:gap-3 relative overflow-hidden"
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 sm:h-6 sm:w-6 border-b-2 border-white"></div>
                <span className="text-sm sm:text-base">Saving Result...</span>
              </>
            ) : (
              <>
                <Trophy size={20} className="sm:w-6 sm:h-6" />
                <span className="text-sm sm:text-base">Submit & Continue</span>
              </>
            )}
          </button>

          {score1 === score2 && score1 !== '' && (
            <p className="text-center text-red-600 text-xs sm:text-sm mt-2 sm:mt-3 font-semibold animate-bounce">
              ⚠️ Scores must be different
            </p>
          )}
        </div>
      </div>

      {/* Next Matches Preview */}
      {nextMatches.length > 0 && (
        <div className="bg-white rounded-xl sm:rounded-2xl shadow-xl p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-3 sm:mb-4">
            <Users size={16} className="text-gray-600 sm:w-5 sm:h-5" />
            <h3 className="font-bold text-base sm:text-lg text-gray-800">Coming Up Next</h3>
          </div>
          <div className="space-y-2 sm:space-y-3">
            {nextMatches.slice(0, 3).map((match, index) => (
              <div key={match.id} className="bg-gray-50 rounded-lg sm:rounded-xl p-3 sm:p-4 border border-gray-200">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                    <span className="text-xs font-bold text-gray-500">#{index + 1}</span>
                    <span className="text-base sm:text-lg">{match.team1?.emoji}</span>
                    <span className="text-xs sm:text-sm font-semibold text-gray-700 truncate">
                      {match.team1?.name}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500 mx-1 sm:mx-2">vs</span>
                  <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0 justify-end">
                    <span className="text-xs sm:text-sm font-semibold text-gray-700 truncate">
                      {match.team2?.name}
                    </span>
                    <span className="text-base sm:text-lg">{match.team2?.emoji}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default LiveMatchView;