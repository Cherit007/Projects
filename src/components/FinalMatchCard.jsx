import React, { useEffect, useRef, useState } from 'react';
import { Trophy, Sparkles, Zap, RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react';

const FinalMatchCard = ({ finalists, onSave, playerRatings = {}, syncState = null }) => {
  const [score1, setScore1] = useState('');
  const [score2, setScore2] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitFeedbackState, setSubmitFeedbackState] = useState('idle');
  const score1Ref = useRef(null);
  const score2Ref = useRef(null);
  const submitFeedbackTimerRef = useRef(null);

  useEffect(() => {
    setScore1('');
    setScore2('');
    setSubmitFeedbackState('idle');
    if (submitFeedbackTimerRef.current) {
      clearTimeout(submitFeedbackTimerRef.current);
      submitFeedbackTimerRef.current = null;
    }
    requestAnimationFrame(() => {
      score1Ref.current?.focus();
    });
  }, [finalists?.[0]?.id, finalists?.[1]?.id]);

  useEffect(() => () => {
    if (submitFeedbackTimerRef.current) {
      clearTimeout(submitFeedbackTimerRef.current);
      submitFeedbackTimerRef.current = null;
    }
  }, []);

  if (!finalists || finalists.length < 2) {
    return (
      <div className="bg-white rounded-xl sm:rounded-2xl p-6 sm:p-8 text-center tour-final-shell app-surface-card app-card-tier-secondary">
        <Trophy size={40} className="mx-auto text-gray-300 mb-4 sm:w-12 sm:h-12" />
        <p className="text-gray-500 text-sm sm:text-base">Finalists will be determined after league matches</p>
      </div>
    );
  }

  const getPlayerRating = (playerName) => {
    return playerRatings[playerName]?.rating || 1000;
  };

  const team1Rating = Math.round((
    getPlayerRating(finalists[0].player || finalists[0].player1) + 
    (finalists[0].player2 ? getPlayerRating(finalists[0].player2) : 0)
  ) / (finalists[0].player2 ? 2 : 1));

  const team2Rating = Math.round((
    getPlayerRating(finalists[1].player || finalists[1].player1) + 
    (finalists[1].player2 ? getPlayerRating(finalists[1].player2) : 0)
  ) / (finalists[1].player2 ? 2 : 1));

  const handleSubmit = async () => {
    if (!score1 || !score2 || score1 === score2) return;

    if (isSubmitting) return;
    setIsSubmitting(true);
    setSubmitFeedbackState('loading');
    try {
      const result = await Promise.resolve(onSave(parseInt(score1, 10), parseInt(score2, 10), finalists));
      if (result === false) {
        setSubmitFeedbackState('idle');
        return;
      }
      setSubmitFeedbackState('success');
      if (submitFeedbackTimerRef.current) {
        clearTimeout(submitFeedbackTimerRef.current);
      }
      submitFeedbackTimerRef.current = setTimeout(() => {
        setSubmitFeedbackState('idle');
        submitFeedbackTimerRef.current = null;
      }, 420);
    } catch {
      setSubmitFeedbackState('idle');
    } finally {
      setIsSubmitting(false);
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

  return (
    <div className="bg-white rounded-2xl sm:rounded-3xl overflow-hidden tour-final-shell app-surface-card app-card-tier-primary app-screen-final app-rhythm-panel">
      {/* Header */}
      <div className="app-gradient-band text-white px-4 sm:px-6 py-4 sm:py-6 text-center tour-final-header">
        <div className="flex items-center justify-center gap-2 sm:gap-3 mb-2">
          <Trophy size={24} className="sm:w-8 sm:h-8" />
          <h2 className="text-2xl sm:text-3xl font-bold app-section-heading">GRAND FINAL</h2>
          <Trophy size={24} className="sm:w-8 sm:h-8" />
        </div>
        <p className="text-xs sm:text-sm opacity-90">Top 2 Teams Battle for Championship</p>
      </div>

      <div className="p-4 sm:p-8">
        {/* Finalists Display */}
        <div className="grid grid-cols-1 gap-4 sm:gap-6 mb-6 sm:mb-8">
          {/* Finalist 1 - Champion Position */}
          <div className="relative">
            <div className="absolute -top-2 -left-2 bg-yellow-500 text-white text-xs font-bold px-2 sm:px-3 py-1 rounded-full flex items-center gap-1">
              🥇 1st Place
            </div>
            <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-xl sm:rounded-2xl p-4 sm:p-6 border-2 sm:border-4 border-yellow-400 tour-final-team-card tour-final-team-card-a app-surface-card app-card-tier-secondary">
              <div className="flex items-center gap-3 sm:gap-4 mb-3 sm:mb-4">
                <div className="text-3xl sm:text-5xl bg-white w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-lg ring-2 ring-yellow-400">
                  {finalists[0].emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-lg sm:text-2xl text-gray-800 mb-1 truncate">{finalists[0].name}</h3>
                  <p className="text-xs sm:text-sm text-gray-600 truncate">
                    {finalists[0].player || finalists[0].player1}
                    {finalists[0].player2 && <> & {finalists[0].player2}</>}
                  </p>
                </div>
              </div>

              {/* ELO Rating */}
              <div className="bg-white rounded-lg p-2 sm:p-3 mb-3 sm:mb-4 border border-yellow-300 tour-final-rating-card">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-600">ELO Rating</span>
                  <div className="flex items-center gap-1">
                    <Sparkles size={12} className="text-yellow-600 sm:w-3.5 sm:h-3.5" />
                    <span className="font-bold text-yellow-600 text-sm sm:text-base">{team1Rating}</span>
                  </div>
                </div>
              </div>

              {/* Score Input */}
              <div>
                <label className="block text-xs sm:text-sm font-bold text-gray-700 mb-2">Final Score</label>
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
                    }
                  }}
                  placeholder="0"
                  className="w-full px-4 sm:px-6 py-3 sm:py-4 border-2 sm:border-4 border-yellow-400 rounded-xl sm:rounded-2xl focus:border-yellow-600 focus:ring-2 sm:focus:ring-4 focus:ring-yellow-200 outline-none text-center text-3xl sm:text-4xl font-bold bg-white transition-all tour-final-score-input"
                  disabled={isSubmitting}
                  data-no-gesture="true"
                />
              </div>
            </div>
          </div>

          {/* Mobile VS separator */}
          <div className="flex items-center justify-center -my-2">
            <div className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white px-8 py-2 rounded-full font-bold text-lg sm:text-xl shadow-lg">
              VS
            </div>
          </div>

          {/* Finalist 2 - Runner-up Position */}
          <div className="relative">
            <div className="absolute -top-2 -right-2 bg-gray-400 text-white text-xs font-bold px-2 sm:px-3 py-1 rounded-full flex items-center gap-1">
              🥈 2nd Place
            </div>
            <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl sm:rounded-2xl p-4 sm:p-6 border-2 sm:border-4 border-gray-300 tour-final-team-card tour-final-team-card-b app-surface-card app-card-tier-secondary">
              <div className="flex items-center gap-3 sm:gap-4 mb-3 sm:mb-4">
                <div className="text-3xl sm:text-5xl bg-white w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-lg ring-2 ring-gray-300">
                  {finalists[1].emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-lg sm:text-2xl text-gray-800 mb-1 truncate">{finalists[1].name}</h3>
                  <p className="text-xs sm:text-sm text-gray-600 truncate">
                    {finalists[1].player || finalists[1].player1}
                    {finalists[1].player2 && <> & {finalists[1].player2}</>}
                  </p>
                </div>
              </div>

              {/* ELO Rating */}
              <div className="bg-white rounded-lg p-2 sm:p-3 mb-3 sm:mb-4 border border-gray-300 tour-final-rating-card">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-600">ELO Rating</span>
                  <div className="flex items-center gap-1">
                    <Sparkles size={12} className="text-gray-600 sm:w-3.5 sm:h-3.5" />
                    <span className="font-bold text-gray-600 text-sm sm:text-base">{team2Rating}</span>
                  </div>
                </div>
              </div>

              {/* Score Input */}
              <div>
                <label className="block text-xs sm:text-sm font-bold text-gray-700 mb-2">Final Score</label>
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
                      void handleSubmit();
                    }
                  }}
                  placeholder="0"
                  className="w-full px-4 sm:px-6 py-3 sm:py-4 border-2 sm:border-4 border-gray-400 rounded-xl sm:rounded-2xl focus:border-gray-600 focus:ring-2 sm:focus:ring-4 focus:ring-gray-200 outline-none text-center text-3xl sm:text-4xl font-bold bg-white transition-all tour-final-score-input"
                  disabled={isSubmitting}
                  data-no-gesture="true"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4" data-no-gesture="true">
          <button
            type="button"
            onClick={() => applyQuickWinner(1)}
            disabled={isSubmitting}
            className="score-quick-btn score-quick-btn-one"
          >
            <Zap size={13} />
            <span>{finalists[0].name} wins</span>
          </button>
          <button
            type="button"
            onClick={() => applyQuickWinner(2)}
            disabled={isSubmitting}
            className="score-quick-btn score-quick-btn-two"
          >
            <Zap size={13} />
            <span>{finalists[1].name} wins</span>
          </button>
        </div>

        {/* Submit Button */}
        <button
          onClick={() => { void handleSubmit(); }}
          disabled={!score1 || !score2 || score1 === score2 || isSubmitting || submitFeedbackState === 'success'}
          className={`w-full bg-gradient-to-r from-yellow-500 via-orange-500 to-red-500 text-white py-4 sm:py-6 rounded-xl sm:rounded-2xl font-bold text-base sm:text-xl hover:shadow-2xl transform hover:scale-[1.02] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 sm:gap-3 tour-final-submit-btn action-feedback-btn ${isSubmitting ? 'is-busy' : ''} ${submitFeedbackState === 'success' ? 'submit-feedback-success' : ''}`}
          data-no-gesture="true"
        >
          {(isSubmitting || submitFeedbackState === 'loading') ? (
            <>
                <div className="animate-spin rounded-full h-5 w-5 sm:h-6 sm:w-6 border-b-2 border-white"></div>
                <span className="text-sm sm:text-base">Saving...</span>
              </>
          ) : submitFeedbackState === 'success' ? (
            <>
              <CheckCircle2 size={20} className="sm:w-6 sm:h-6" />
              <span className="text-sm sm:text-base">Champion Saved</span>
            </>
          ) : (
            <>
              <Trophy size={20} className="sm:w-6 sm:h-6" />
              <span className="text-sm sm:text-base">Declare Champion</span>
            </>
          )}
        </button>

        {score1 === score2 && score1 !== '' && (
          <p className="text-center text-red-600 text-xs sm:text-sm mt-2 sm:mt-3 font-semibold">
            ⚠️ Final scores must be different
          </p>
        )}

        {syncState?.status && (
          <div className={`inline-sync-chip inline-sync-chip-${syncState.status} mt-3`}>
            {syncState.status === 'syncing' && <RefreshCw size={13} className="animate-spin" />}
            {syncState.status === 'saved' && <CheckCircle2 size={13} />}
            {syncState.status === 'error' && <AlertTriangle size={13} />}
            <span>{syncState.label || (syncState.status === 'saved' ? 'Saved' : (syncState.status === 'error' ? 'Retry' : 'Saving...'))}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default FinalMatchCard;
