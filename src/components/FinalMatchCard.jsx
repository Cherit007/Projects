import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, RefreshCw, Sparkles, Trophy, Zap } from 'lucide-react';

const FinalMatchCard = ({ finalists, onSave, playerRatings = {}, syncState = null }) => {
  const [score1, setScore1] = useState('');
  const [score2, setScore2] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitFeedbackState, setSubmitFeedbackState] = useState('idle');
  const score1Ref = useRef(null);
  const score2Ref = useRef(null);
  const submitFeedbackTimerRef = useRef(null);
  const finalistOneId = finalists?.[0]?.id;
  const finalistTwoId = finalists?.[1]?.id;

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
  }, [finalistOneId, finalistTwoId]);

  useEffect(() => () => {
    if (submitFeedbackTimerRef.current) {
      clearTimeout(submitFeedbackTimerRef.current);
      submitFeedbackTimerRef.current = null;
    }
  }, []);

  if (!finalists || finalists.length < 2) {
    return (
      <div className="variant-a-card">
        <div className="variant-a-empty-card">
          <p>Finalists will be determined after league matches.</p>
        </div>
      </div>
    );
  }

  const getPlayerRating = (playerName) => playerRatings[playerName]?.rating || 1000;

  const team1Rating = Math.round((
    getPlayerRating(finalists[0].player || finalists[0].player1) +
    (finalists[0].player2 ? getPlayerRating(finalists[0].player2) : 0)
  ) / (finalists[0].player2 ? 2 : 1));

  const team2Rating = Math.round((
    getPlayerRating(finalists[1].player || finalists[1].player1) +
    (finalists[1].player2 ? getPlayerRating(finalists[1].player2) : 0)
  ) / (finalists[1].player2 ? 2 : 1));

  const handleSubmit = async () => {
    if (!score1 || !score2 || score1 === score2 || isSubmitting) return;
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
    <div className="variant-a-card variant-a-final-input-shell">
      <p className="variant-a-section-label">Grand final</p>

      <div className="variant-a-score-card variant-a-score-card-final">
        <div className="variant-a-score-side">
          <span className="variant-a-team-dot variant-a-team-dot-lg">{finalists[0].emoji}</span>
          <p className="variant-a-upcoming-team-name">{finalists[0].name}</p>
          <p className="variant-a-score-names">
            {finalists[0].player || finalists[0].player1}
            {finalists[0].player2 && ` & ${finalists[0].player2}`}
          </p>
          <div className="variant-a-score-elo">
            <Sparkles size={11} />
            <span>{team1Rating}</span>
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
              }
            }}
            placeholder="0"
            className="variant-a-score-input"
            disabled={isSubmitting}
            data-no-gesture="true"
          />
        </div>

        <div className="variant-a-vs">VS</div>

        <div className="variant-a-score-side">
          <span className="variant-a-team-dot variant-a-team-dot-lg">{finalists[1].emoji}</span>
          <p className="variant-a-upcoming-team-name">{finalists[1].name}</p>
          <p className="variant-a-score-names">
            {finalists[1].player || finalists[1].player1}
            {finalists[1].player2 && ` & ${finalists[1].player2}`}
          </p>
          <div className="variant-a-score-elo">
            <Sparkles size={11} />
            <span>{team2Rating}</span>
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
                void handleSubmit();
              }
            }}
            placeholder="0"
            className="variant-a-score-input"
            disabled={isSubmitting}
            data-no-gesture="true"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3" data-no-gesture="true">
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

      <div className="variant-a-submit-row mt-3">
        <button
          onClick={() => { void handleSubmit(); }}
          disabled={!score1 || !score2 || score1 === score2 || isSubmitting || submitFeedbackState === 'success'}
          className={`variant-a-submit-btn action-feedback-btn ${isSubmitting ? 'is-busy' : ''} ${submitFeedbackState === 'success' ? 'submit-feedback-success' : ''}`}
          data-no-gesture="true"
        >
          {(isSubmitting || submitFeedbackState === 'loading') ? (
            <>
              <RefreshCw size={16} className="animate-spin" />
              <span>Saving...</span>
            </>
          ) : submitFeedbackState === 'success' ? (
            <>
              <CheckCircle2 size={16} />
              <span>Champion Saved</span>
            </>
          ) : (
            <>
              <Trophy size={16} />
              <span>Declare Champion</span>
            </>
          )}
        </button>

        {syncState?.status && (
          <div className={`variant-a-inline-sync live-inline-sync live-inline-sync-${syncState.status} live-inline-sync-inline`}>
            {syncState.status === 'syncing' && <RefreshCw size={13} className="animate-spin" />}
            {syncState.status === 'saved' && <CheckCircle2 size={13} />}
            {syncState.status === 'error' && <AlertTriangle size={13} />}
            <span>{syncState.label || (syncState.status === 'saved' ? 'Saved' : (syncState.status === 'error' ? 'Retry' : 'Saving...'))}</span>
          </div>
        )}
      </div>

      {score1 === score2 && score1 !== '' && (
        <p className="variant-a-error-copy">Scores must be different.</p>
      )}
    </div>
  );
};

export default FinalMatchCard;
