import React, { useState, useEffect, useRef } from 'react';
import { X, Zap } from 'lucide-react';

const BracketMatchModal = ({ match, onSave, onClose }) => {
  const [score1, setScore1] = useState(match.score1 !== null ? match.score1 : '');
  const [score2, setScore2] = useState(match.score2 !== null ? match.score2 : '');
  const [isSaving, setIsSaving] = useState(false);
  const score1Ref = useRef(null);
  const score2Ref = useRef(null);

  useEffect(() => {
    setScore1(match.score1 !== null ? match.score1 : '');
    setScore2(match.score2 !== null ? match.score2 : '');
    requestAnimationFrame(() => {
      score1Ref.current?.focus();
    });
  }, [match]);

  const handleSave = async () => {
    if (score1 === '' || score2 === '' || score1 === score2) {
      return;
    }
    if (isSaving) return;
    setIsSaving(true);
    try {
      await Promise.resolve(onSave(match.id, parseInt(score1, 10), parseInt(score2, 10)));
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const applyQuickWinner = (winnerTeam) => {
    const current1 = Number.parseInt(score1, 10);
    const current2 = Number.parseInt(score2, 10);
    if (winnerTeam === 1) {
      const loserScore = Number.isFinite(current2) ? Math.max(0, current2) : 0;
      const winnerScore = Math.max(21, loserScore + (loserScore >= 20 ? 2 : 1), Number.isFinite(current1) ? current1 : 0);
      setScore1(String(winnerScore));
      setScore2(String(loserScore));
    } else {
      const loserScore = Number.isFinite(current1) ? Math.max(0, current1) : 0;
      const winnerScore = Math.max(21, loserScore + (loserScore >= 20 ? 2 : 1), Number.isFinite(current2) ? current2 : 0);
      setScore1(String(loserScore));
      setScore2(String(winnerScore));
    }
    requestAnimationFrame(() => {
      score2Ref.current?.focus();
    });
  };

  if (!match.team1 || !match.team2) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[240] p-4 app-overlay">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 app-modal-shell bracket-modal-shell">
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[240] p-4 app-overlay">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 app-modal-shell bracket-modal-shell">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-bold">Match {match.id}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative mb-6">
          {/* Team 1 */}
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl p-5 border-2 border-blue-200 bracket-team-card bracket-team-card-one">
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
              ref={score1Ref}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={score1}
              onChange={(e) => {
                const value = e.target.value;
                if (value === '' || /^\d+$/.test(value)) {
                  setScore1(value);
                  if (value !== '' && score2 === '') {
                    requestAnimationFrame(() => {
                      score2Ref.current?.focus();
                    });
                  }
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  score2Ref.current?.focus();
                }
              }}
              disabled={isSaving}
              placeholder="Score"
              className="w-full px-4 py-3 border-2 border-blue-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none text-center text-2xl font-bold"
            />
          </div>

          {/* VS Badge */}
          <div className="hidden md:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-gradient-to-r from-blue-600 to-purple-600 text-white w-14 h-14 rounded-full items-center justify-center font-bold shadow-xl z-10 text-sm">
            VS
          </div>

          {/* Team 2 */}
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-2xl p-5 border-2 border-purple-200 bracket-team-card bracket-team-card-two">
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
              ref={score2Ref}
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
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void handleSave();
                }
              }}
              disabled={isSaving}
              placeholder="Score"
              className="w-full px-4 py-3 border-2 border-purple-300 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none text-center text-2xl font-bold"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
          <button
            type="button"
            onClick={() => applyQuickWinner(1)}
            disabled={isSaving}
            className="score-quick-btn score-quick-btn-one"
          >
            <Zap size={13} />
            <span>{match.team1.name} wins</span>
          </button>
          <button
            type="button"
            onClick={() => applyQuickWinner(2)}
            disabled={isSaving}
            className="score-quick-btn score-quick-btn-two"
          >
            <Zap size={13} />
            <span>{match.team2.name} wins</span>
          </button>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl font-semibold hover:bg-gray-200 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={() => { void handleSave(); }}
            disabled={!score1 || !score2 || score1 === score2 || isSaving}
            className="flex-1 bg-gradient-to-r from-green-600 to-blue-600 text-white py-3 rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isSaving ? 'Saving...' : '✓ Save Result'}
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
