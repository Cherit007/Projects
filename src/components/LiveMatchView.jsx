import React, { useMemo, useState } from 'react';
import { Trophy, Clock, TrendingUp, Users } from 'lucide-react';
import MatchPredictionCard from './predictions/MatchPredictionCard';
import PlayerAvatar from './PlayerAvatar';
import { predictMatchOutcome, getUpsetAlert } from '../utils/matchPredictions';

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
  casualMatches = []
}) => {
  const [score1, setScore1] = useState('');
  const [score2, setScore2] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [celebrationActive, setCelebrationActive] = useState(false);

  const handleSubmit = async () => {
    if (!score1 || !score2 || score1 === score2) return;
    
    setIsSubmitting(true);
    setCelebrationActive(true);

    try {
      await Promise.resolve(onSaveScore(currentMatch.id, parseInt(score1, 10), parseInt(score2, 10)));
      setScore1('');
      setScore2('');
    } catch (_error) {
      // Parent handles user-facing errors via toasts.
    } finally {
      setIsSubmitting(false);
      setCelebrationActive(false);
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
    <div className="space-y-4 sm:space-y-6">
      <div className={`live-board transition-all duration-500 ${celebrationActive ? 'scale-[1.01]' : ''}`}>
        {celebrationActive && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden z-20">
            {[...Array(16)].map((_, i) => (
              <div
                key={i}
                className="absolute w-2 h-2 bg-cyan-300 rounded-full animate-ping"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 0.45}s`
                }}
              />
            ))}
          </div>
        )}

        <div className="relative z-10 p-4 sm:p-6 lg:p-8">
          <div className="flex items-center justify-between gap-3">
            <div className="live-pill inline-flex items-center gap-2 sm:gap-3 rounded-2xl px-4 sm:px-5 py-2 sm:py-3">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-100 animate-pulse" />
              <span className="font-extrabold tracking-wide text-white text-sm sm:text-base">LIVE NOW</span>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-400/30 bg-slate-900/50 px-3 py-1.5 text-slate-200 text-xs sm:text-sm">
              <Clock size={14} />
              <span>Match {currentMatch.id}</span>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-slate-600/30 bg-slate-950/40 px-3 py-2 text-center">
            <h2 className="text-sm sm:text-base font-semibold text-sky-100">{tournamentName}</h2>
          </div>

          <section className="mt-6">
            <p className="text-sky-300 text-sm sm:text-base font-semibold">Team 1</p>
            <div className="mt-2 flex items-start justify-between gap-3">
              <h3 className="text-3xl sm:text-5xl font-extrabold text-slate-50 leading-none tracking-tight">
                {currentMatch.team1.name}
              </h3>
              <div className="elo-pill inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sky-300">
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
                  className="score-input w-24 sm:w-28 rounded-2xl px-2 py-2 text-center text-5xl sm:text-6xl font-black leading-none outline-none"
                  disabled={isSubmitting}
                  aria-label={`${currentMatch.team1.name} score`}
                />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:text-base text-slate-100">
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
            <span className="vs-halo text-4xl sm:text-6xl font-black text-slate-200">VS</span>
            <span className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-400/60 to-transparent" />
          </div>

          <section>
            <p className="text-violet-300 text-sm sm:text-base font-semibold">Team 2</p>
            <div className="mt-2 flex items-start justify-between gap-3">
              <h3 className="text-3xl sm:text-5xl font-extrabold text-slate-50 leading-none tracking-tight">
                {currentMatch.team2.name}
              </h3>
              <div className="elo-pill inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-violet-300">
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
                  className="score-input w-24 sm:w-28 rounded-2xl px-2 py-2 text-center text-5xl sm:text-6xl font-black leading-none outline-none"
                  disabled={isSubmitting}
                  aria-label={`${currentMatch.team2.name} score`}
                />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:text-base text-slate-100">
                {getTeamPlayers(currentMatch.team2).map((playerName, index) => (
                  <p key={`${currentMatch.team2.name}-name-${playerName}-${index}`} className="truncate font-medium">
                    {playerName}
                  </p>
                ))}
              </div>
            </div>
          </section>

          <button
            onClick={handleSubmit}
            disabled={!score1 || !score2 || score1 === score2 || isSubmitting}
            className="submit-slab mt-6 sm:mt-8 w-full rounded-2xl py-4 sm:py-5 text-base sm:text-2xl font-extrabold tracking-wide text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 sm:gap-3"
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 sm:h-6 sm:w-6 border-b-2 border-white" />
                <span>Saving Result...</span>
              </>
            ) : (
              <>
                <Trophy size={20} className="sm:w-6 sm:h-6" />
                <span>SUBMIT &amp; CONTINUE</span>
              </>
            )}
          </button>

          {score1 === score2 && score1 !== '' && (
            <p className="text-center text-rose-300 text-xs sm:text-sm mt-3 font-semibold">
              Scores must be different.
            </p>
          )}

          <div className="mt-4 rounded-2xl border border-slate-500/35 bg-slate-950/45 p-3 sm:p-4">
            <h4 className="font-bold text-slate-100 text-sm sm:text-base mb-2">Top 2 Qualification Watch</h4>
            <div className="space-y-1.5 text-xs sm:text-sm text-slate-300">
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
                <p className="pt-1 font-semibold text-cyan-300">
                  If this score is submitted, {(parsedScore1 > parsedScore2 ? currentMatch.team1.name : currentMatch.team2.name)} will move to rank #{projectedWinnerRank}.
                </p>
              )}
            </div>
          </div>

          <div className="mt-4">
            <MatchPredictionCard match={currentMatch} prediction={currentMatchPrediction} />
          </div>

          {upsetAlert && (
            <div className="mt-3 rounded-xl border border-rose-400/35 bg-rose-950/40 p-3">
              <p className="text-sm font-semibold text-rose-200">⚠️ {upsetAlert.title}</p>
              <p className="text-xs sm:text-sm text-rose-100 mt-1">{upsetAlert.message}</p>
            </div>
          )}
        </div>
      </div>

      {/* Next Matches Preview */}
      {nextMatches.length > 0 && (
        <div className="theme-card rounded-xl sm:rounded-2xl p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-3 sm:mb-4">
            <Users size={16} className="text-slate-300 sm:w-5 sm:h-5" />
            <h3 className="font-bold text-base sm:text-lg text-slate-100">Coming Up Next ({nextMatches.length})</h3>
          </div>
          <p className="text-xs text-slate-400 mb-3">Click a match to make it LIVE NOW.</p>
          <div className="space-y-2 sm:space-y-3 max-h-80 overflow-y-auto pr-1">
            {nextMatches.map((match, index) => (
              <button
                key={match.id}
                type="button"
                onClick={() => onSelectUpcomingMatch?.(match.id)}
                className="w-full text-left rounded-lg sm:rounded-xl p-3 sm:p-4 border border-slate-500/35 bg-slate-900/55 hover:border-cyan-400/60 hover:bg-slate-900 transition-all"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                    <span className="text-xs font-bold text-slate-400">#{index + 1}</span>
                    <span className="text-base sm:text-lg">{match.team1?.emoji}</span>
                    <span className="text-xs sm:text-sm font-semibold text-slate-100 truncate">
                      {match.team1?.name}
                    </span>
                  </div>
                  <span className="text-xs text-slate-400 mx-1 sm:mx-2">vs</span>
                  <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0 justify-end">
                    <span className="text-xs sm:text-sm font-semibold text-slate-100 truncate">
                      {match.team2?.name}
                    </span>
                    <span className="text-base sm:text-lg">{match.team2?.emoji}</span>
                  </div>
                </div>
                <div className="mt-2 text-xs text-cyan-300 font-semibold">
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
