import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Trophy,
  Clock,
  TrendingUp,
  Users,
  CheckCircle2,
  AlertTriangle,
  Zap,
  RefreshCw,
  Plus,
  Minus,
  Hand,
  X,
} from 'lucide-react';
import MatchPredictionCard from './predictions/MatchPredictionCard';
import PlayerAvatar from './PlayerAvatar';
import { predictMatchOutcome, getUpsetAlert } from '../utils/matchPredictions';
import { buildLiveTopTwoWatch } from '../utils/qualificationScenarios';
import { hapticError, hapticSubmit, hapticSuccess, hapticTap } from '../utils/haptics';
import LiveNarrativePanel from './live/LiveNarrativePanel';

const QUICK_SCORE_MODE_ENABLED = false;

const LiveMatchView = ({ 
  currentMatch, 
  onSaveScore, 
  nextMatches = [],
  onSelectUpcomingMatch,
  playerRatings = {},
  playerPhotos = {},
  pointsTable = [],
  tournamentHistory = [],
  casualMatches = [],
  syncState = null,
  completedMatchesCount = 0,
  totalMatchesCount = 0,
}) => {
  const [score1, setScore1] = useState('');
  const [score2, setScore2] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitFeedbackState, setSubmitFeedbackState] = useState('idle');
  const [isQuickScoreModeOpen, setIsQuickScoreModeOpen] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(max-width: 767px)').matches;
  });
  const score1InputRef = useRef(null);
  const score2InputRef = useRef(null);
  const submitFeedbackTimerRef = useRef(null);

  useEffect(() => {
    setScore1('');
    setScore2('');
    setSubmitFeedbackState('idle');
    if (submitFeedbackTimerRef.current) {
      clearTimeout(submitFeedbackTimerRef.current);
      submitFeedbackTimerRef.current = null;
    }
    setIsQuickScoreModeOpen(QUICK_SCORE_MODE_ENABLED && isMobileViewport);
    requestAnimationFrame(() => {
      score1InputRef.current?.focus();
    });
  }, [currentMatch?.id, isMobileViewport]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const media = window.matchMedia('(max-width: 767px)');
    const syncViewport = () => setIsMobileViewport(media.matches);
    syncViewport();
    if (media.addEventListener) {
      media.addEventListener('change', syncViewport);
    } else {
      media.addListener(syncViewport);
    }
    return () => {
      if (media.removeEventListener) {
        media.removeEventListener('change', syncViewport);
      } else {
        media.removeListener(syncViewport);
      }
    };
  }, []);

  useEffect(() => {
    if (!QUICK_SCORE_MODE_ENABLED) {
      setIsQuickScoreModeOpen(false);
      return;
    }
    if (!isQuickScoreModeOpen || typeof document === 'undefined') return undefined;
    const { body } = document;
    const previousOverflow = body.style.overflow;
    body.style.overflow = 'hidden';
    return () => {
      body.style.overflow = previousOverflow;
    };
  }, [isQuickScoreModeOpen]);

  useEffect(() => () => {
    if (submitFeedbackTimerRef.current) {
      clearTimeout(submitFeedbackTimerRef.current);
      submitFeedbackTimerRef.current = null;
    }
  }, []);

  const getQuickWinnerScores = (winnerTeam) => {
    const current1 = Number.parseInt(score1, 10);
    const current2 = Number.parseInt(score2, 10);
    if (winnerTeam === 1) {
      const loserScore = Number.isFinite(current2) ? Math.max(0, current2) : 0;
      const winnerScore = Math.max(21, loserScore + (loserScore >= 20 ? 2 : 1), Number.isFinite(current1) ? current1 : 0);
      return { nextScore1: String(winnerScore), nextScore2: String(loserScore) };
    }
    const loserScore = Number.isFinite(current1) ? Math.max(0, current1) : 0;
    const winnerScore = Math.max(21, loserScore + (loserScore >= 20 ? 2 : 1), Number.isFinite(current2) ? current2 : 0);
    return { nextScore1: String(loserScore), nextScore2: String(winnerScore) };
  };

  const setTeamScore = (teamIndex, nextValue) => {
    const normalized = Number.isFinite(Number(nextValue))
      ? String(Math.max(0, Math.min(99, Number(nextValue))))
      : '';
    if (teamIndex === 1) {
      setScore1(normalized);
      return;
    }
    setScore2(normalized);
  };

  const adjustTeamScore = (teamIndex, delta) => {
    const currentRaw = teamIndex === 1 ? score1 : score2;
    const currentValue = Number.parseInt(currentRaw, 10);
    const safeValue = Number.isFinite(currentValue) ? currentValue : 0;
    setTeamScore(teamIndex, Math.max(0, safeValue + delta));
    hapticTap();
  };

  const applyQuickWinner = (winnerTeam) => {
    const { nextScore1, nextScore2 } = getQuickWinnerScores(winnerTeam);
    setScore1(nextScore1);
    setScore2(nextScore2);
    hapticTap();
    requestAnimationFrame(() => {
      score2InputRef.current?.focus();
    });
  };

  const handleSubmit = async () => {
    if (!score1 || !score2 || score1 === score2) return;
    const draftScore1 = score1;
    const draftScore2 = score2;
    const parsedScore1 = Number.parseInt(draftScore1, 10);
    const parsedScore2 = Number.parseInt(draftScore2, 10);
    if (!Number.isFinite(parsedScore1) || !Number.isFinite(parsedScore2)) return;

    setIsSubmitting(true);
    setSubmitFeedbackState('loading');
    hapticSubmit();
    setScore1('');
    setScore2('');

    try {
      const result = await Promise.resolve(onSaveScore(currentMatch.id, parsedScore1, parsedScore2));
      if (result === false) {
        setScore1(draftScore1);
        setScore2(draftScore2);
        setSubmitFeedbackState('idle');
        hapticError();
        return;
      }
      hapticSuccess();
      setSubmitFeedbackState('success');
      if (submitFeedbackTimerRef.current) {
        clearTimeout(submitFeedbackTimerRef.current);
      }
      submitFeedbackTimerRef.current = setTimeout(() => {
        setSubmitFeedbackState('idle');
        submitFeedbackTimerRef.current = null;
      }, 360);
      setIsQuickScoreModeOpen(false);
      requestAnimationFrame(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        score1InputRef.current?.focus();
      });
    } catch {
      setScore1(draftScore1);
      setScore2(draftScore2);
      setSubmitFeedbackState('idle');
      hapticError();
      // Parent handles user-facing errors via toasts.
    } finally {
      setIsSubmitting(false);
    }
  };

  const getPlayerRating = (playerName) => {
    return playerRatings[playerName]?.rating || 1000;
  };

  const getTeamPlayers = (team = {}) => {
    const primary = team.player || team.player1;
    return [primary, team.player2].filter(Boolean);
  };

  const team1Rating = currentMatch.team1 ? 
    Math.round(((getPlayerRating(currentMatch.team1.player || currentMatch.team1.player1) + 
    (currentMatch.team1.player2 ? getPlayerRating(currentMatch.team1.player2) : 0)) / 
    (currentMatch.team1.player2 ? 2 : 1))) : 1000;

  const team2Rating = currentMatch.team2 ? 
    Math.round(((getPlayerRating(currentMatch.team2.player || currentMatch.team2.player1) + 
    (currentMatch.team2.player2 ? getPlayerRating(currentMatch.team2.player2) : 0)) / 
    (currentMatch.team2.player2 ? 2 : 1))) : 1000;

  const currentMatchPrediction = useMemo(() => predictMatchOutcome({
    match: currentMatch,
    playerRatings,
    tournamentHistory,
    casualMatches,
  }), [currentMatch, playerRatings, tournamentHistory, casualMatches]);
  const upcomingPredictions = useMemo(() => {
    const predictionMap = {};
    nextMatches.forEach((match) => {
      predictionMap[match.id] = predictMatchOutcome({
        match,
        playerRatings,
        tournamentHistory,
        casualMatches,
      });
    });
    return predictionMap;
  }, [nextMatches, playerRatings, tournamentHistory, casualMatches]);

  const parsedScore1 = Number.parseInt(score1, 10);
  const parsedScore2 = Number.parseInt(score2, 10);
  const hasValidProjection = Number.isFinite(parsedScore1) && Number.isFinite(parsedScore2) && parsedScore1 !== parsedScore2;
  const upsetAlert = getUpsetAlert({
    prediction: currentMatchPrediction,
    score1,
    score2,
    team1Name: currentMatch.team1?.name,
    team2Name: currentMatch.team2?.name,
  });
  const team1Players = getTeamPlayers(currentMatch.team1);
  const team2Players = getTeamPlayers(currentMatch.team2);
  const oddPlayerMeta = currentMatch?.oddPlayerMeta || null;
  const primaryUpcomingMatch = nextMatches[0] || null;
  const remainingUpcomingMatches = nextMatches.slice(1);
  const fallbackTotalMatches = completedMatchesCount + nextMatches.length + 1;
  const displayTotalMatches = totalMatchesCount || fallbackTotalMatches;
  const displayCurrentMatchNumber = Math.min(displayTotalMatches, completedMatchesCount + 1);
  const primaryUpcomingPrediction = primaryUpcomingMatch ? upcomingPredictions[primaryUpcomingMatch.id] : null;
  const primaryUpcomingUpsetAlert = primaryUpcomingMatch ? getUpsetAlert({
    prediction: primaryUpcomingPrediction,
    score1: '',
    score2: '',
    team1Name: primaryUpcomingMatch.team1?.name,
    team2Name: primaryUpcomingMatch.team2?.name,
  }) : null;
  const leadTeam = hasValidProjection
    ? (parsedScore1 > parsedScore2 ? 1 : 2)
    : null;
  const topTwoWatch = useMemo(() => buildLiveTopTwoWatch({
    standings: pointsTable,
    currentMatch,
    nextMatches,
    score1,
    score2,
  }), [pointsTable, currentMatch, nextMatches, score1, score2]);

  return (
    <div className="space-y-3 sm:space-y-4 app-screen-live">
      <div className={`variant-a-card variant-a-live-shell submit-feedback-${submitFeedbackState}`}>
        <div className={`live-submit-flash ${submitFeedbackState === 'success' ? 'is-active' : ''}`} />

        <div className="variant-a-live-row">
          <div className="variant-a-live-pill live-pill">
            <span className="variant-a-live-dot blink" />
            <span>LIVE NOW</span>
          </div>
          <span className="variant-a-context-chip">
            Match {displayCurrentMatchNumber} of {displayTotalMatches}
          </span>
        </div>

        {QUICK_SCORE_MODE_ENABLED && (
          <div className="variant-a-quick-entry" data-no-gesture="true">
            <button
              type="button"
              onClick={() => setIsQuickScoreModeOpen(true)}
              disabled={isSubmitting}
              className="quick-score-launch-btn"
            >
              <Hand size={14} />
              <span>Open Quick Score</span>
            </button>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
              <button
                type="button"
                onClick={() => applyQuickWinner(1)}
                disabled={isSubmitting}
                className="score-quick-btn score-quick-btn-one"
              >
                <Zap size={13} />
                <span>{currentMatch.team1.name} wins</span>
              </button>
              <button
                type="button"
                onClick={() => applyQuickWinner(2)}
                disabled={isSubmitting}
                className="score-quick-btn score-quick-btn-two"
              >
                <Zap size={13} />
                <span>{currentMatch.team2.name} wins</span>
              </button>
            </div>
          </div>
        )}

        <div className="variant-a-score-card">
          <div className="variant-a-score-side">
            <div className="variant-a-avatar-stack">
              {team1Players.map((playerName, index) => (
                <div key={`${currentMatch.team1.id}-${playerName}-${index}`} className="variant-a-avatar-shell">
                  <PlayerAvatar
                    name={playerName}
                    photoUrl={playerPhotos[playerName]}
                    size="md"
                    className="variant-a-avatar"
                  />
                </div>
              ))}
            </div>
            <div className="variant-a-score-names">
              {team1Players.map((playerName, index) => (
                <span key={`${playerName}-${index}`}>{playerName}</span>
              ))}
            </div>
            <div className="variant-a-score-elo">
              <TrendingUp size={11} />
              <span>{currentMatch.team1.name} · {team1Rating}</span>
            </div>
            <input
              ref={score1InputRef}
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
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  score2InputRef.current?.focus();
                }
              }}
              placeholder="0"
              className={`variant-a-score-input ${leadTeam === 1 ? 'variant-a-score-input-win' : ''}`}
              disabled={isSubmitting}
              aria-label={`${currentMatch.team1.name} score`}
              data-no-gesture="true"
            />
          </div>

          <div className="variant-a-vs">VS</div>

          <div className="variant-a-score-side">
            <div className="variant-a-avatar-stack">
              {team2Players.map((playerName, index) => (
                <div key={`${currentMatch.team2.id}-${playerName}-${index}`} className="variant-a-avatar-shell">
                  <PlayerAvatar
                    name={playerName}
                    photoUrl={playerPhotos[playerName]}
                    size="md"
                    className="variant-a-avatar"
                  />
                </div>
              ))}
            </div>
            <div className="variant-a-score-names">
              {team2Players.map((playerName, index) => (
                <span key={`${playerName}-${index}`}>{playerName}</span>
              ))}
            </div>
            <div className="variant-a-score-elo">
              <TrendingUp size={11} />
              <span>{currentMatch.team2.name} · {team2Rating}</span>
            </div>
            <input
              ref={score2InputRef}
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
              className={`variant-a-score-input ${leadTeam === 2 ? 'variant-a-score-input-win' : ''}`}
              disabled={isSubmitting}
              aria-label={`${currentMatch.team2.name} score`}
              data-no-gesture="true"
            />
          </div>
        </div>

        <div className="variant-a-qualify-card">
          {oddPlayerMeta && (
            <p className="variant-a-qualify-copy mb-2">
              Odd-player swap: <strong>{oddPlayerMeta.activeOddPlayerName}</strong> in for{' '}
              <strong>{oddPlayerMeta.swapTeamName}</strong>; <strong>{oddPlayerMeta.sittingOutPlayerName}</strong> sits out.
            </p>
          )}
          <p className="variant-a-qualify-title">Top 2 watch</p>
          <div className="variant-a-qualify-copy">
            <p className="variant-a-qualify-highlight">{topTwoWatch.headline}</p>
            {topTwoWatch.lines.map((line, index) => (
              <p key={`${currentMatch.id}-top-two-${index}`}>{line}</p>
            ))}
          </div>
        </div>

        <div className="variant-a-submit-row" data-no-gesture="true">
          <button
            onClick={handleSubmit}
            disabled={!score1 || !score2 || score1 === score2 || isSubmitting || submitFeedbackState === 'success'}
            className={`variant-a-submit-btn action-feedback-btn ${isSubmitting ? 'is-busy' : ''} ${submitFeedbackState === 'success' ? 'submit-feedback-success' : ''}`}
          >
            {(isSubmitting || submitFeedbackState === 'loading') ? (
              <>
                <RefreshCw size={16} className="animate-spin" />
                <span>Saving...</span>
              </>
            ) : submitFeedbackState === 'success' ? (
              <>
                <CheckCircle2 size={16} />
                <span>Saved</span>
              </>
            ) : (
              <>
                <Trophy size={16} />
                <span>Submit &amp; Continue</span>
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

      {!primaryUpcomingMatch && currentMatchPrediction && (
        <div className="variant-a-card">
          <p className="variant-a-section-label">Match story</p>
          <LiveNarrativePanel
            prediction={currentMatchPrediction}
            upsetAlert={upsetAlert}
            currentMatch={currentMatch}
          />
        </div>
      )}

      {primaryUpcomingMatch && (
        <div className="variant-a-card variant-a-upcoming-shell">
          <p className="variant-a-section-label">Coming up</p>
          <div className="variant-a-upcoming-head">
            <span className="variant-a-meta-copy">Round {primaryUpcomingMatch.round} · Match {primaryUpcomingMatch.id}</span>
            <span className="variant-a-badge">Next up</span>
          </div>

          <div className="variant-a-upcoming-teams">
            <div className="variant-a-upcoming-side">
              <div className="variant-a-avatar-stack">
                {getTeamPlayers(primaryUpcomingMatch.team1).map((playerName, index) => (
                  <div key={`${primaryUpcomingMatch.id}-upcoming-1-${playerName}-${index}`} className="variant-a-avatar-shell">
                    <PlayerAvatar
                      name={playerName}
                      photoUrl={playerPhotos[playerName]}
                      size="sm"
                      className="variant-a-avatar variant-a-avatar-sm"
                    />
                  </div>
                ))}
              </div>
              <p className="variant-a-upcoming-team-name">{primaryUpcomingMatch.team1?.name}</p>
            </div>

            <div className="variant-a-vs variant-a-vs-sm">VS</div>

            <div className="variant-a-upcoming-side variant-a-upcoming-side-right">
              <div className="variant-a-avatar-stack justify-end">
                {getTeamPlayers(primaryUpcomingMatch.team2).map((playerName, index) => (
                  <div key={`${primaryUpcomingMatch.id}-upcoming-2-${playerName}-${index}`} className="variant-a-avatar-shell">
                    <PlayerAvatar
                      name={playerName}
                      photoUrl={playerPhotos[playerName]}
                      size="sm"
                      className="variant-a-avatar variant-a-avatar-sm"
                    />
                  </div>
                ))}
              </div>
              <p className="variant-a-upcoming-team-name">{primaryUpcomingMatch.team2?.name}</p>
            </div>
          </div>

          <MatchPredictionCard
            match={primaryUpcomingMatch}
            prediction={primaryUpcomingPrediction}
            title="Prediction"
            compact
          />

          <LiveNarrativePanel
            prediction={primaryUpcomingPrediction}
            upsetAlert={primaryUpcomingUpsetAlert}
            currentMatch={primaryUpcomingMatch}
          />

          {typeof onSelectUpcomingMatch === 'function' && (
            <button
              type="button"
              onClick={() => onSelectUpcomingMatch(primaryUpcomingMatch.id)}
              className="variant-a-secondary-btn"
            >
              Start this match
            </button>
          )}
        </div>
      )}

      {QUICK_SCORE_MODE_ENABLED && isQuickScoreModeOpen && (
        <div
          className="quick-score-overlay app-overlay fixed inset-0 z-[255] p-0 sm:p-4 flex items-end sm:items-center justify-center"
          onClick={() => setIsQuickScoreModeOpen(false)}
        >
          <div
            className="quick-score-sheet app-modal-shell w-full max-w-2xl"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Quick score mode"
          >
            <div className="quick-score-sheet-header">
              <div>
                <p className="quick-score-sheet-title">Quick Score Mode</p>
                <p className="quick-score-sheet-copy">Tap large pads for fast scoring.</p>
              </div>
              <button
                type="button"
                className="quick-score-close-btn"
                onClick={() => setIsQuickScoreModeOpen(false)}
                aria-label="Close quick score mode"
              >
                <X size={18} />
              </button>
            </div>

            <div className="quick-score-sheet-body">
              <div className="quick-score-grid">
                <div className="quick-score-team-pad quick-score-team-pad-one">
                  <p className="quick-score-team-name">{currentMatch.team1.name}</p>
                  <div className="quick-score-controls">
                    <button
                      type="button"
                      className="quick-score-adjust-btn"
                      onClick={() => adjustTeamScore(1, -1)}
                      disabled={isSubmitting}
                      aria-label={`Decrease ${currentMatch.team1.name} score`}
                    >
                      <Minus size={20} />
                    </button>
                    <div className="quick-score-value">{score1 || '0'}</div>
                    <button
                      type="button"
                      className="quick-score-adjust-btn"
                      onClick={() => adjustTeamScore(1, 1)}
                      disabled={isSubmitting}
                      aria-label={`Increase ${currentMatch.team1.name} score`}
                    >
                      <Plus size={20} />
                    </button>
                  </div>
                  <button
                    type="button"
                    className="quick-score-winner-chip score-quick-btn score-quick-btn-one"
                    onClick={() => applyQuickWinner(1)}
                    disabled={isSubmitting}
                  >
                    <Zap size={14} />
                    <span>{currentMatch.team1.name} wins</span>
                  </button>
                </div>

                <div className="quick-score-team-pad quick-score-team-pad-two">
                  <p className="quick-score-team-name">{currentMatch.team2.name}</p>
                  <div className="quick-score-controls">
                    <button
                      type="button"
                      className="quick-score-adjust-btn"
                      onClick={() => adjustTeamScore(2, -1)}
                      disabled={isSubmitting}
                      aria-label={`Decrease ${currentMatch.team2.name} score`}
                    >
                      <Minus size={20} />
                    </button>
                    <div className="quick-score-value">{score2 || '0'}</div>
                    <button
                      type="button"
                      className="quick-score-adjust-btn"
                      onClick={() => adjustTeamScore(2, 1)}
                      disabled={isSubmitting}
                      aria-label={`Increase ${currentMatch.team2.name} score`}
                    >
                      <Plus size={20} />
                    </button>
                  </div>
                  <button
                    type="button"
                    className="quick-score-winner-chip score-quick-btn score-quick-btn-two"
                    onClick={() => applyQuickWinner(2)}
                    disabled={isSubmitting}
                  >
                    <Zap size={14} />
                    <span>{currentMatch.team2.name} wins</span>
                  </button>
                </div>
              </div>

              <div className="quick-score-submit-row">
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!score1 || !score2 || score1 === score2 || isSubmitting || submitFeedbackState === 'success'}
                  className={`quick-score-submit-btn submit-slab action-feedback-btn ${isSubmitting ? 'is-busy' : ''} ${submitFeedbackState === 'success' ? 'submit-feedback-success' : ''}`}
                >
                  {(isSubmitting || submitFeedbackState === 'loading')
                    ? 'Saving...'
                    : submitFeedbackState === 'success'
                      ? 'Saved'
                      : 'Submit & Continue'}
                </button>
                {syncState?.status && (
                  <div className={`live-inline-sync live-inline-sync-${syncState.status} live-inline-sync-inline`}>
                    {syncState.status === 'syncing' && <RefreshCw size={14} className="animate-spin" />}
                    {syncState.status === 'saved' && <CheckCircle2 size={14} />}
                    {syncState.status === 'error' && <AlertTriangle size={14} />}
                    <span>{syncState.label || (syncState.status === 'saved' ? 'Saved' : (syncState.status === 'error' ? 'Retry' : 'Saving...'))}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {remainingUpcomingMatches.length > 0 && (
        <div className="variant-a-card">
          <div className="variant-a-history-head">
            <p className="variant-a-section-label !mb-0">Queue</p>
            <span className="variant-a-meta-copy">{remainingUpcomingMatches.length} matches</span>
          </div>
          <div className="space-y-0">
            {remainingUpcomingMatches.map((match) => (
              <button
                key={match.id}
                type="button"
                onClick={() => onSelectUpcomingMatch?.(match.id)}
                className="variant-a-history-row variant-a-history-row-action"
              >
                <div>
                  <p className="variant-a-history-title">{match.team1?.name} vs {match.team2?.name}</p>
                  <p className="variant-a-history-copy">Round {match.round} · Match {match.id}</p>
                </div>
                <span className="variant-a-meta-copy">Live now</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default LiveMatchView;
