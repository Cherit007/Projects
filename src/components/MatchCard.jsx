import React, { useState, useEffect, useRef } from 'react';
import { Check, Edit2, RefreshCw, CheckCircle2, AlertTriangle, Zap } from 'lucide-react';
import { hapticError, hapticSubmit, hapticSuccess, hapticTap } from '../utils/haptics';

const MatchCard = ({ match, onSave, syncState = null }) => {
  const [score1, setScore1] = useState(match.score1 !== null ? match.score1 : '');
  const [score2, setScore2] = useState(match.score2 !== null ? match.score2 : '');
  const [isEditing, setIsEditing] = useState(!match.completed);
  const [isSaving, setIsSaving] = useState(false);
  const [saveFeedbackState, setSaveFeedbackState] = useState('idle');
  const score1Ref = useRef(null);
  const score2Ref = useRef(null);
  const saveFeedbackTimerRef = useRef(null);

  useEffect(() => {
    setScore1(match.score1 !== null ? match.score1 : '');
    setScore2(match.score2 !== null ? match.score2 : '');
    setSaveFeedbackState('idle');
    if (saveFeedbackTimerRef.current) {
      clearTimeout(saveFeedbackTimerRef.current);
      saveFeedbackTimerRef.current = null;
    }
  }, [match.score1, match.score2]);

  useEffect(() => () => {
    if (saveFeedbackTimerRef.current) {
      clearTimeout(saveFeedbackTimerRef.current);
      saveFeedbackTimerRef.current = null;
    }
  }, []);

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    setSaveFeedbackState('loading');
    hapticSubmit();
    try {
      const result = await Promise.resolve(onSave(match.id, score1, score2));
      if (result === false) {
        setSaveFeedbackState('idle');
        hapticError();
        return;
      }
      setIsEditing(false);
      setSaveFeedbackState('success');
      if (saveFeedbackTimerRef.current) {
        clearTimeout(saveFeedbackTimerRef.current);
      }
      saveFeedbackTimerRef.current = setTimeout(() => {
        setSaveFeedbackState('idle');
        saveFeedbackTimerRef.current = null;
      }, 360);
      hapticSuccess();
    } catch (_error) {
      setSaveFeedbackState('idle');
      hapticError();
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = () => {
    setIsEditing(true);
    requestAnimationFrame(() => {
      score1Ref.current?.focus();
    });
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
    hapticTap();
  };

  return (
    <div className={`match-card app-surface-card app-card-tier-secondary bg-white rounded-2xl shadow-lg p-4 sm:p-6 transition-all relative ${
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
            disabled={!isEditing || isSaving}
            placeholder="Score"
            className="w-full px-4 py-3 border-2 border-blue-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none disabled:bg-gray-100 text-center text-xl sm:text-2xl font-bold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            data-no-gesture="true"
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
              if (e.key === 'Enter' && isEditing && !isSaving) {
                e.preventDefault();
                void handleSave();
              }
            }}
            disabled={!isEditing || isSaving}
            placeholder="Score"
            className="w-full px-4 py-3 border-2 border-purple-300 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none disabled:bg-gray-100 text-center text-2xl font-bold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            data-no-gesture="true"
          />
        </div>
      </div>

      {isEditing && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4" data-no-gesture="true">
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

          <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-2">
            <button
              onClick={() => { void handleSave(); }}
              disabled={isSaving || score1 === '' || score2 === '' || score1 === score2 || saveFeedbackState === 'success'}
              className={`w-full sm:flex-1 bg-gradient-to-r from-green-600 to-blue-600 text-white py-3 rounded-xl font-semibold hover:shadow-lg transform hover:scale-[1.02] transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 action-feedback-btn ${isSaving ? 'is-busy' : ''} ${saveFeedbackState === 'success' ? 'submit-feedback-success' : ''}`}
              data-no-gesture="true"
            >
              {(isSaving || saveFeedbackState === 'loading') ? (
                <>
                  <RefreshCw size={18} className="animate-spin" />
                  <span>Saving...</span>
                </>
              ) : saveFeedbackState === 'success' ? (
                <>
                  <CheckCircle2 size={18} />
                  <span>Saved</span>
                </>
              ) : (
                <>
                  <Check size={18} />
                  <span>{match.completed ? 'Update Result' : 'Save Result'}</span>
                </>
              )}
            </button>

            {syncState?.status && (
              <div className={`inline-sync-chip inline-sync-chip-${syncState.status} inline-sync-chip-inline`}>
                {syncState.status === 'syncing' && <RefreshCw size={13} className="animate-spin" />}
                {syncState.status === 'saved' && <CheckCircle2 size={13} />}
                {syncState.status === 'error' && <AlertTriangle size={13} />}
                <span>{syncState.label || (syncState.status === 'saved' ? 'Saved' : (syncState.status === 'error' ? 'Retry' : 'Saving...'))}</span>
              </div>
            )}
          </div>
        </>
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
