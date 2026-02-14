import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

const BracketMatchModal = ({ match, onSave, onClose }) => {
  const [score1, setScore1] = useState(match.score1 !== null ? match.score1 : '');
  const [score2, setScore2] = useState(match.score2 !== null ? match.score2 : '');

  useEffect(() => {
    setScore1(match.score1 !== null ? match.score1 : '');
    setScore2(match.score2 !== null ? match.score2 : '');
  }, [match]);

  const handleSave = () => {
    if (score1 === '' || score2 === '' || score1 === score2) {
      return;
    }
    onSave(match.id, parseInt(score1), parseInt(score2));
    onClose();
  };

  if (!match.team1 || !match.team2) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold">Match Not Ready</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X size={24} />
            </button>
          </div>
          <p className="text-gray-600 mb-4">Previous matches must be completed first.</p>
          <button onClick={onClose} className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold">
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-bold">Match {match.id}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative mb-6">
          {/* Team 1 */}
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl p-5 border-2 border-blue-200">
            <div className="flex items-center gap-3 mb-3">
              <div className="text-3xl bg-white w-12 h-12 rounded-xl flex items-center justify-center shadow-md">
                {match.team1.emoji}
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="font-bold text-lg text-gray-800 break-words">{match.team1.name}</h4>
                <p className="text-xs text-gray-600 break-words">
                  {match.team1.player || match.team1.player1}{match.team1.player2 && ` & ${match.team1.player2}`}
                </p>
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
              placeholder="Score"
              className="w-full px-4 py-3 border-2 border-blue-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none text-center text-2xl font-bold"
            />
          </div>

          {/* VS Badge */}
          <div className="hidden md:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-gradient-to-r from-blue-600 to-purple-600 text-white w-14 h-14 rounded-full items-center justify-center font-bold shadow-xl z-10 text-sm">
            VS
          </div>

          {/* Team 2 */}
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-2xl p-5 border-2 border-purple-200">
            <div className="flex items-center gap-3 mb-3">
              <div className="text-3xl bg-white w-12 h-12 rounded-xl flex items-center justify-center shadow-md">
                {match.team2.emoji}
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="font-bold text-lg text-gray-800 break-words">{match.team2.name}</h4>
                <p className="text-xs text-gray-600 break-words">
                  {match.team2.player || match.team2.player1}{match.team2.player2 && ` & ${match.team2.player2}`}
                </p>
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
              placeholder="Score"
              className="w-full px-4 py-3 border-2 border-purple-300 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none text-center text-2xl font-bold"
            />
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl font-semibold hover:bg-gray-200 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!score1 || !score2 || score1 === score2}
            className="flex-1 bg-gradient-to-r from-green-600 to-blue-600 text-white py-3 rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            ✓ Save Result
          </button>
        </div>
        {score1 === score2 && score1 !== '' && (
          <p className="text-center text-red-600 text-sm mt-2 font-semibold">
            Scores must be different
          </p>
        )}
      </div>
    </div>
  );
};

export default BracketMatchModal;