import React from 'react';
import { Trophy, Star, Undo2, RotateCcw, CheckCircle2 } from 'lucide-react';

const HighlightCard = ({ label, name, stat, substat }) => (
  <div className="box-cricket-highlight-card">
    <span className="box-cricket-highlight-label">{label}</span>
    <strong className="box-cricket-highlight-name">{name || '—'}</strong>
    <span className="box-cricket-highlight-stat">{stat}</span>
    {substat ? <span className="box-cricket-highlight-sub">{substat}</span> : null}
  </div>
);

const formatBoundaryLine = (batter) => {
  if (!batter) return null;
  const parts = [];
  if (batter.fours > 0) parts.push(`${batter.fours}×4`);
  if (batter.sixes > 0) parts.push(`${batter.sixes}×6`);
  return parts.length ? parts.join(' · ') : null;
};

const BoxCricketMatchResult = ({
  highlights,
  onUndo,
  canUndo = false,
  onStartNewMatch,
  startingNewMatch = false,
  rematchLabel = 'Start new match',
  onFinish,
  finishing = false,
  finishLabel = 'Finish',
  actionError = '',
}) => {
  if (!highlights) return null;

  const {
    winnerTeam,
    summary,
    chaseWon,
    scorecard1,
    scorecard2,
    topBatter,
    topBowler,
    firstBattingTeam,
    secondBattingTeam,
  } = highlights;

  const boundaryLine = formatBoundaryLine(topBatter);

  return (
    <div className="box-cricket-match-result box-cricket-panel-enter">
      <div className="box-cricket-match-result-banner">
        <Trophy size={28} aria-hidden />
        <div>
          <p className="box-cricket-match-result-eyebrow">Match complete</p>
          <h3 className="box-cricket-match-result-title">{winnerTeam?.name || 'Winner'} wins!</h3>
          <p className="box-cricket-match-result-summary">{summary}</p>
          {chaseWon && (
            <p className="box-cricket-match-result-chase">Target chased down</p>
          )}
        </div>
      </div>

      <div className="box-cricket-match-result-scores">
        <div className="box-cricket-match-result-score">
          <span>{firstBattingTeam?.name || '1st inn'}</span>
          <strong>{scorecard1?.total || '—'}</strong>
        </div>
        <div className="box-cricket-match-result-score">
          <span>{secondBattingTeam?.name || '2nd inn'}</span>
          <strong>{scorecard2?.total || '—'}</strong>
        </div>
      </div>

      <div className="box-cricket-match-highlights">
        <h4 className="box-cricket-match-highlights-title">
          <Star size={16} aria-hidden />
          Player of the match
        </h4>
        <div className="box-cricket-match-highlights-grid">
          <HighlightCard
            label="Top batter"
            name={topBatter?.name}
            stat={topBatter ? `${topBatter.runs} (${topBatter.balls})` : '—'}
            substat={boundaryLine}
          />
          <HighlightCard
            label="Top bowler"
            name={topBowler?.name}
            stat={topBowler ? `${topBowler.wickets}/${topBowler.overs}` : '—'}
            substat={topBowler ? `${topBowler.runs} runs conceded` : null}
          />
        </div>
      </div>

      <div className="box-cricket-match-result-actions">
        {actionError ? (
          <p className="box-cricket-match-result-error" role="alert">{actionError}</p>
        ) : null}
        {typeof onStartNewMatch === 'function' && (
          <button
            type="button"
            className="box-cricket-match-result-rematch"
            onClick={onStartNewMatch}
            disabled={startingNewMatch || finishing}
          >
            <RotateCcw size={16} className={startingNewMatch ? 'animate-spin' : ''} />
            <span>{startingNewMatch ? 'Saving…' : rematchLabel}</span>
          </button>
        )}
        {typeof onFinish === 'function' && (
          <button
            type="button"
            className="box-cricket-match-result-finish"
            onClick={onFinish}
            disabled={startingNewMatch || finishing}
          >
            <CheckCircle2 size={16} className={finishing ? 'animate-spin' : ''} />
            <span>{finishing ? 'Saving…' : finishLabel}</span>
          </button>
        )}
        {canUndo && typeof onUndo === 'function' && (
          <button type="button" className="box-cricket-match-result-undo" onClick={onUndo}>
            <Undo2 size={16} />
            <span>Undo last ball</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default BoxCricketMatchResult;
