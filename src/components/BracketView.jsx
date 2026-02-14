import React from 'react';
import { Trophy } from 'lucide-react';

const BracketView = ({ bracket, onMatchClick }) => {
  const renderMatch = (match, roundIndex, matchIndex) => {
    if (!match) return null;
    
    const isCompleted = match.completed;
    const winner = isCompleted && match.score1 !== null && match.score2 !== null
      ? (match.score1 > match.score2 ? match.team1 : match.team2)
      : null;

    return (
      <div
        key={`${roundIndex}-${matchIndex}`}
        className={`bg-white rounded-lg shadow-md p-3 mb-4 cursor-pointer border-2 transition-all ${
          isCompleted ? 'border-green-400' : 'border-gray-200 hover:border-blue-400'
        }`}
        onClick={() => onMatchClick(match)}
      >
        <div className="text-xs text-gray-500 mb-2 font-semibold">
          Match {match.id}
        </div>
        
        {/* Team 1 */}
        <div className={`flex items-center justify-between p-2 rounded mb-1 ${
          winner?.id === match.team1?.id ? 'bg-green-50 border border-green-300' : 'bg-gray-50'
        }`}>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="text-lg">{match.team1?.emoji || '❓'}</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold truncate">{match.team1?.name || 'TBD'}</p>
              {match.team1 && (
                <p className="text-xs text-gray-600 truncate">
                  {match.team1.player || match.team1.player1}{match.team1.player2 && ` & ${match.team1.player2}`}
                </p>
              )}
            </div>
          </div>
          {isCompleted && (
            <span className="font-bold text-lg ml-2">{match.score1}</span>
          )}
        </div>

        {/* Team 2 */}
        <div className={`flex items-center justify-between p-2 rounded ${
          winner?.id === match.team2?.id ? 'bg-green-50 border border-green-300' : 'bg-gray-50'
        }`}>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="text-lg">{match.team2?.emoji || '❓'}</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold truncate">{match.team2?.name || 'TBD'}</p>
              {match.team2 && (
                <p className="text-xs text-gray-600 truncate">
                  {match.team2.player || match.team2.player1}{match.team2.player2 && ` & ${match.team2.player2}`}
                </p>
              )}
            </div>
          </div>
          {isCompleted && (
            <span className="font-bold text-lg ml-2">{match.score2}</span>
          )}
        </div>
      </div>
    );
  };

  const renderRound = (round, roundIndex) => {
    const roundNames = {
      0: bracket.length === 3 ? 'Quarter Finals' : 'Semi Finals',
      1: bracket.length === 3 ? 'Semi Finals' : 'Final',
      2: 'Final'
    };

    return (
      <div key={roundIndex} className="flex-1 min-w-[280px]">
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-2 rounded-t-lg font-bold text-center">
          {roundNames[roundIndex] || `Round ${roundIndex + 1}`}
        </div>
        <div className="bg-gray-50 p-4 rounded-b-lg min-h-[200px]">
          {round.map((match, matchIndex) => renderMatch(match, roundIndex, matchIndex))}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl p-6 overflow-x-auto">
      <div className="flex items-center gap-2 mb-6">
        <Trophy size={24} className="text-yellow-600" />
        <h2 className="text-2xl font-bold text-gray-800">Knockout Bracket</h2>
      </div>
      <div className="flex gap-4">
        {bracket.map((round, roundIndex) => renderRound(round, roundIndex))}
      </div>
    </div>
  );
};

export default BracketView;