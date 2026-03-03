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
import { hapticError, hapticSubmit, hapticSuccess, hapticTap } from '../utils/haptics';

const QUICK_SCORE_MODE_ENABLED = false;

const LiveMatchView = ({ 
  currentMatch, 
  onSaveScore, 
  nextMatches = [],
  onSelectUpcomingMatch,
  tournamentName,
  playerRatings = {},
  playerPhotos = {},
  pointsTable = [],
  tournamentHistory = [],
  casualMatches = [],
  syncState = null,
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
    } catch (_error) {
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

  const getProjectedTable = (winnerId, margin) => {
    const table = pointsTable.map(team => ({ ...team }));
    const winner = table.find(team => team.id === winnerId);
    const loserId = winnerId === currentMatch.team1.id ? currentMatch.team2.id : currentMatch.team1.id;
    const loser = table.find(team => team.id === loserId);

    if (!winner || !loser) return [];

    winner.played += 1;
    loser.played += 1;
    winner.won += 1;
    loser.lost += 1;
    winner.points += 2;
    winner.scoreDiff += margin;
    loser.scoreDiff -= margin;
    winner.netMatchRate = winner.played > 0 ? winner.scoreDiff / winner.played : 0;
    loser.netMatchRate = loser.played > 0 ? loser.scoreDiff / loser.played : 0;

    return table.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.netMatchRate !== a.netMatchRate) return b.netMatchRate - a.netMatchRate;
      return b.scoreDiff - a.scoreDiff;
    });
  };

  const getRankAfterOutcome = (teamId, winnerId, margin) => {
    const projected = getProjectedTable(winnerId, margin);
    return projected.findIndex(team => team.id === teamId) + 1;
  };

  const getMinWinningMarginForTop2 = (teamId) => {
    const maxMarginToCheck = 80;
    for (let margin = 1; margin <= maxMarginToCheck; margin += 1) {
      const rank = getRankAfterOutcome(teamId, teamId, margin);
      if (rank > 0 && rank <= 2) return margin;
    }
    return null;
  };

  const team1MinMargin = getMinWinningMarginForTop2(currentMatch.team1.id);
  const team2MinMargin = getMinWinningMarginForTop2(currentMatch.team2.id);

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
  const projectedWinnerId = hasValidProjection
    ? (parsedScore1 > parsedScore2 ? currentMatch.team1.id : currentMatch.team2.id)
    : null;
  const projectedMargin = hasValidProjection ? Math.abs(parsedScore1 - parsedScore2) : null;
  const projectedWinnerRank = hasValidProjection ? getRankAfterOutcome(projectedWinnerId, projectedWinnerId, projectedMargin) : null;
  const upsetAlert = getUpsetAlert({
    prediction: currentMatchPrediction,
    score1,
    score2,
    team1Name: currentMatch.team1?.name,
    team2Name: currentMatch.team2?.name,
  });

  return (
    <div className="space-y-4 sm:space-y-6 app-screen-live">
      <div className={`live-board app-surface-card app-card-tier-primary submit-feedback-${submitFeedbackState}`}>
        <div className={`live-submit-flash ${submitFeedbackState === 'success' ? 'is-active' : ''}`} />

        <div className="relative z-10 p-4 sm:p-6 lg:p-8">
          <div className="flex items-center justify-between gap-3">
            <div className="live-pill inline-flex items-center gap-2 sm:gap-3 rounded-2xl px-4 sm:px-5 py-2 sm:py-3">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-100 animate-pulse" />
              <span className="font-extrabold tracking-wide text-white text-sm sm:text-base">LIVE NOW</span>
            </div>
            <div className="live-meta-chip inline-flex items-center gap-2 rounded-full border border-slate-400/30 bg-slate-900/50 px-3 py-1.5 text-slate-200 text-xs sm:text-sm">
              <Clock size={14} />
              <span>Match {currentMatch.id}</span>
            </div>
          </div>

          <div className="live-title-chip mt-4 rounded-2xl border border-slate-600/30 bg-slate-950/40 px-3 py-2 text-center">
            <h2 className="live-title-text app-section-heading text-sm sm:text-base font-semibold text-sky-100">{tournamentName}</h2>
          </div>

          {QUICK_SCORE_MODE_ENABLED && (
            <div className="quick-score-primary mt-4 rounded-2xl border border-cyan-400/30 bg-cyan-950/35 p-3 sm:p-4" data-no-gesture="true">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <p className="text-cyan-100 text-sm sm:text-base font-bold">Quick Score Mode</p>
                  <p className="text-cyan-200/80 text-xs">Primary scoring flow with large tap controls.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsQuickScoreModeOpen(true)}
                  disabled={isSubmitting}
                  className="quick-score-launch-btn"
                >
                  <Hand size={15} />
                  <span>Open Quick Score</span>
                </button>
              </div>
              <div className="live-quick-mode mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={() => applyQuickWinner(1)}
                  disabled={isSubmitting}
                  className="score-quick-btn score-quick-btn-one"
                >
                  <Zap size={14} />
                  <span>{currentMatch.team1.name} wins</span>
                </button>
                <button
                  type="button"
                  onClick={() => applyQuickWinner(2)}
                  disabled={isSubmitting}
                  className="score-quick-btn score-quick-btn-two"
                >
                  <Zap size={14} />
                  <span>{currentMatch.team2.name} wins</span>
                </button>
              </div>
            </div>
          )}

          <p className="manual-score-note mt-4 text-[11px] sm:text-xs text-slate-300">
            Manual score entry:
          </p>

          <section className="mt-6">
            <p className="live-team-label live-team-label-one text-sky-300 text-sm sm:text-base font-semibold">Team 1</p>
            <div className="mt-2 flex items-start justify-between gap-3">
              <h3 className="live-team-heading text-3xl sm:text-5xl font-extrabold text-slate-50 leading-none tracking-tight">
                {currentMatch.team1.name}
              </h3>
              <div className="elo-pill live-elo-pill live-elo-pill-one inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sky-300">
                <TrendingUp size={14} />
                <span className="font-bold">{team1Rating}</span>
              </div>
            </div>
            <div className="team-glass team-one mt-4 rounded-3xl p-4 sm:p-5">
              <div className="flex items-center justify-between gap-4 sm:gap-6">
                <div className="flex items-center gap-3 sm:gap-4">
                  {getTeamPlayers(currentMatch.team1).map((playerName, index) => (
                    <div key={`${currentMatch.team1.id}-${playerName}-${index}`} className="player-orb player-orb-one">
                      <PlayerAvatar
                        name={playerName}
                        photoUrl={playerPhotos[playerName]}
                        size="xl"
                        className="w-16 h-16 sm:w-20 sm:h-20 border-0"
                      />
                    </div>
                  ))}
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
                  className="score-input w-24 sm:w-28 rounded-2xl px-2 py-2 text-center text-5xl sm:text-6xl font-black leading-none outline-none"
                  disabled={isSubmitting}
                  aria-label={`${currentMatch.team1.name} score`}
                  data-no-gesture="true"
                />
              </div>
              <div className="live-team-roster mt-3 grid grid-cols-2 gap-2 text-xs sm:text-base text-slate-100">
                {getTeamPlayers(currentMatch.team1).map((playerName, index) => (
                  <p key={`${currentMatch.team1.name}-name-${playerName}-${index}`} className="truncate font-medium">
                    {playerName}
                  </p>
                ))}
              </div>
            </div>
          </section>

          <div className="my-6 sm:my-8 flex items-center gap-3 sm:gap-4">
            <span className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-400/60 to-transparent" />
            <span className="vs-halo live-vs-text text-4xl sm:text-6xl font-black text-slate-200">VS</span>
            <span className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-400/60 to-transparent" />
          </div>

          <section>
            <p className="live-team-label live-team-label-two text-violet-300 text-sm sm:text-base font-semibold">Team 2</p>
            <div className="mt-2 flex items-start justify-between gap-3">
              <h3 className="live-team-heading text-3xl sm:text-5xl font-extrabold text-slate-50 leading-none tracking-tight">
                {currentMatch.team2.name}
              </h3>
              <div className="elo-pill live-elo-pill live-elo-pill-two inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-violet-300">
                <TrendingUp size={14} />
                <span className="font-bold">{team2Rating}</span>
              </div>
            </div>
            <div className="team-glass team-two mt-4 rounded-3xl p-4 sm:p-5">
              <div className="flex items-center justify-between gap-4 sm:gap-6">
                <div className="flex items-center gap-3 sm:gap-4">
                  {getTeamPlayers(currentMatch.team2).map((playerName, index) => (
                    <div key={`${currentMatch.team2.id}-${playerName}-${index}`} className="player-orb player-orb-two">
                      <PlayerAvatar
                        name={playerName}
                        photoUrl={playerPhotos[playerName]}
                        size="xl"
                        className="w-16 h-16 sm:w-20 sm:h-20 border-0"
                      />
                    </div>
                  ))}
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
                  className="score-input w-24 sm:w-28 rounded-2xl px-2 py-2 text-center text-5xl sm:text-6xl font-black leading-none outline-none"
                  disabled={isSubmitting}
                  aria-label={`${currentMatch.team2.name} score`}
                  data-no-gesture="true"
                />
              </div>
              <div className="live-team-roster mt-3 grid grid-cols-2 gap-2 text-xs sm:text-base text-slate-100">
                {getTeamPlayers(currentMatch.team2).map((playerName, index) => (
                  <p key={`${currentMatch.team2.name}-name-${playerName}-${index}`} className="truncate font-medium">
                    {playerName}
                  </p>
                ))}
              </div>
            </div>
          </section>

          <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3" data-no-gesture="true">
            <button
              onClick={handleSubmit}
              disabled={!score1 || !score2 || score1 === score2 || isSubmitting || submitFeedbackState === 'success'}
              className={`submit-slab action-feedback-btn ${isSubmitting ? 'is-busy' : ''} ${submitFeedbackState === 'success' ? 'submit-feedback-success' : ''} w-full sm:flex-1 rounded-2xl py-4 sm:py-5 text-base sm:text-2xl font-extrabold tracking-wide text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 sm:gap-3`}
            >
              {(isSubmitting || submitFeedbackState === 'loading') ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 sm:h-6 sm:w-6 border-b-2 border-white" />
                  <span>Saving...</span>
                </>
              ) : submitFeedbackState === 'success' ? (
                <>
                  <CheckCircle2 size={20} className="sm:w-6 sm:h-6" />
                  <span>Saved</span>
                </>
              ) : (
                <>
                  <Trophy size={20} className="sm:w-6 sm:h-6" />
                  <span>SUBMIT &amp; CONTINUE</span>
                </>
              )}
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

          {score1 === score2 && score1 !== '' && (
            <p className="live-tie-warning text-center text-rose-300 text-xs sm:text-sm mt-3 font-semibold">
              Scores must be different.
            </p>
          )}

          <div className="live-watch-shell mt-4 rounded-2xl border border-slate-500/35 bg-slate-950/45 p-3 sm:p-4">
            <h4 className="live-watch-title font-bold text-slate-100 text-sm sm:text-base mb-2">Top 2 Qualification Watch</h4>
            <div className="live-watch-copy space-y-1.5 text-xs sm:text-sm text-slate-300">
              <p>
                <span className="font-semibold text-slate-100">{currentMatch.team1.name}:</span>{' '}
                {team1MinMargin
                  ? `win by ${team1MinMargin}+ to enter Top 2 after this match.`
                  : 'cannot reach Top 2 from this match alone.'}
              </p>
              <p>
                <span className="font-semibold text-slate-100">{currentMatch.team2.name}:</span>{' '}
                {team2MinMargin
                  ? `win by ${team2MinMargin}+ to enter Top 2 after this match.`
                  : 'cannot reach Top 2 from this match alone.'}
              </p>
              {hasValidProjection && (
                <p className="live-watch-projection pt-1 font-semibold text-cyan-300">
                  If this score is submitted, {(parsedScore1 > parsedScore2 ? currentMatch.team1.name : currentMatch.team2.name)} will move to rank #{projectedWinnerRank}.
                </p>
              )}
            </div>
          </div>

          <div className="mt-4">
            <MatchPredictionCard match={currentMatch} prediction={currentMatchPrediction} />
          </div>

          {upsetAlert && (
            <div className="live-upset-shell mt-3 rounded-xl border border-rose-400/35 bg-rose-950/40 p-3">
              <p className="live-upset-title text-sm font-semibold text-rose-200">⚠️ {upsetAlert.title}</p>
              <p className="live-upset-copy text-xs sm:text-sm text-rose-100 mt-1">{upsetAlert.message}</p>
            </div>
          )}
        </div>
      </div>

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

      {/* Next Matches Preview */}
      {nextMatches.length > 0 && (
        <div className="theme-card live-next-shell app-surface-card app-card-tier-secondary rounded-xl sm:rounded-2xl p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-3 sm:mb-4">
            <Users size={16} className="live-next-icon text-slate-300 sm:w-5 sm:h-5" />
            <h3 className="live-next-title font-bold text-base sm:text-lg text-slate-100">Coming Up Next ({nextMatches.length})</h3>
          </div>
          <p className="live-next-note text-xs text-slate-400 mb-3">Click a match to make it LIVE NOW.</p>
          <div className="space-y-2 sm:space-y-3 max-h-80 overflow-y-auto pr-1">
            {nextMatches.map((match, index) => (
              <button
                key={match.id}
                type="button"
                onClick={() => onSelectUpcomingMatch?.(match.id)}
                className="live-upcoming-card w-full text-left rounded-lg sm:rounded-xl p-3 sm:p-4 border border-slate-500/35 bg-slate-900/55 hover:border-cyan-400/60 hover:bg-slate-900 transition-all"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                    <span className="live-upcoming-index text-xs font-bold text-slate-400">#{index + 1}</span>
                    <span className="text-base sm:text-lg">{match.team1?.emoji}</span>
                    <span className="live-upcoming-team text-xs sm:text-sm font-semibold text-slate-100 truncate">
                      {match.team1?.name}
                    </span>
                  </div>
                  <span className="live-upcoming-vs text-xs text-slate-400 mx-1 sm:mx-2">vs</span>
                  <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0 justify-end">
                    <span className="live-upcoming-team text-xs sm:text-sm font-semibold text-slate-100 truncate">
                      {match.team2?.name}
                    </span>
                    <span className="text-base sm:text-lg">{match.team2?.emoji}</span>
                  </div>
                </div>
                <div className="live-upcoming-round mt-2 text-xs text-cyan-300 font-semibold">
                  Round {match.round} • Match {match.id}
                </div>
                <div className="mt-2">
                  <MatchPredictionCard
                    match={match}
                    prediction={upcomingPredictions[match.id]}
                    title="Prediction"
                    compact
                  />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default LiveMatchView;
