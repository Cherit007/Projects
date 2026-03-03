import React, { useState, useEffect } from 'react';
import { Check, Edit2 } from 'lucide-react';

const MatchCard = ({ match, onSave }) => {
  const [score1, setScore1] = useState(match.score1 !== null ? match.score1 : '');
  const [score2, setScore2] = useState(match.score2 !== null ? match.score2 : '');
  const [isEditing, setIsEditing] = useState(!match.completed);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setScore1(match.score1 !== null ? match.score1 : '');
    setScore2(match.score2 !== null ? match.score2 : '');
  }, [match.score1, match.score2]);

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      await Promise.resolve(onSave(match.id, score1, score2));
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  return (
    <div className={`match-card bg-white rounded-2xl shadow-lg p-4 sm:p-6 transition-all relative ${
      match.completed ? 'border-2 border-green-400 bg-green-50/30 match-card-completed' : 'border-2 border-gray-200 hover:border-blue-400 hover:shadow-xl'
    }`}>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
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
            {match.upsetAlert && (
              <span className="bg-red-500 text-white px-3 py-1 rounded-full text-xs font-semibold">
                UPSET
              </span>
            )}
            <span className="bg-green-500 text-white px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1">
              <Check size={14} /> Done
            </span>
            {!isEditing && (
              <button
                onClick={handleEdit}
                disabled={isSaving}
                className="text-blue-600 hover:text-blue-700 p-1"
                title="Edit result"
              >
                <Edit2 size={16} />
              </button>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative">
        {/* Team 1 */}
        <div className="match-card-team team-one bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl p-4 sm:p-5 border-2 border-blue-200">
          <div className="flex items-center gap-3 mb-3">
            <div className="text-2xl sm:text-3xl bg-white w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center shadow-md flex-shrink-0">
              {match.team1.emoji}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-bold text-base sm:text-lg text-gray-800 break-words">{match.team1.name}</h3>
              <p className="text-xs text-gray-600 break-words">{match.team1.player1} & {match.team1.player2}</p>
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
            disabled={!isEditing || isSaving}
            placeholder="Score"
            className="w-full px-4 py-3 border-2 border-blue-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none disabled:bg-gray-100 text-center text-xl sm:text-2xl font-bold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
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
        <div className="match-card-team team-two bg-gradient-to-br from-purple-50 to-purple-100 rounded-2xl p-4 sm:p-5 border-2 border-purple-200">
          <div className="flex items-center gap-3 mb-3">
            <div className="text-2xl sm:text-3xl bg-white w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center shadow-md flex-shrink-0">
              {match.team2.emoji}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-bold text-base sm:text-lg text-gray-800 break-words">{match.team2.name}</h3>
              <p className="text-xs text-gray-600 break-words">{match.team2.player1} & {match.team2.player2}</p>
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
            disabled={!isEditing || isSaving}
            placeholder="Score"
            className="w-full px-4 py-3 border-2 border-purple-300 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none disabled:bg-gray-100 text-center text-2xl font-bold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
        </div>
      </div>

      {isEditing && (
        <button
          onClick={() => { void handleSave(); }}
          disabled={isSaving || score1 === '' || score2 === '' || score1 === score2}
          className="w-full mt-4 bg-gradient-to-r from-green-600 to-blue-600 text-white py-3 rounded-xl font-semibold hover:shadow-lg transform hover:scale-[1.02] transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          <Check size={18} />
          {isSaving ? 'Saving...' : (match.completed ? 'Update Result' : 'Save Result')}
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

export default MatchCard;
