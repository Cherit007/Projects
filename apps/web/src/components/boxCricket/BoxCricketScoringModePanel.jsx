import React from 'react';
import { ChevronRight } from 'lucide-react';

const BoxCricketScoringModePanel = ({
  value,
  onChange,
  onContinue,
  continueDisabled = false,
  backLabel = '',
  onBack,
}) => (
  <div className="box-cricket-scoring-mode-panel box-cricket-panel-enter">
    {onBack && (
      <button type="button" className="start-match-back-link" onClick={onBack}>
        {backLabel || '← Back'}
      </button>
    )}
    <h3 className="box-cricket-lineup-title">How do you want to score?</h3>
    <p className="box-cricket-lineup-copy">
      Pick before the first ball. You won&apos;t be able to switch mid-match.
    </p>
    <div className="box-cricket-scoring-mode-toggle">
      <button
        type="button"
        className={`box-cricket-mode-btn ${value === 'summary' ? 'is-active' : ''}`}
        onClick={() => onChange('summary')}
      >
        Runs & wickets
      </button>
      <button
        type="button"
        className={`box-cricket-mode-btn ${value === 'ballByBall' ? 'is-active' : ''}`}
        onClick={() => onChange('ballByBall')}
      >
        Ball by ball
      </button>
    </div>
    <p className="box-cricket-scoring-mode-hint">
      {value === 'ballByBall'
        ? 'Record every ball with striker rotation, overs, and undo.'
        : 'Enter final runs, wickets, and overs for each innings.'}
    </p>
    <button
      type="button"
      className="box-cricket-lineup-confirm box-cricket-lineup-confirm-inline"
      disabled={continueDisabled || !value}
      onClick={onContinue}
    >
      Start match
      <ChevronRight size={16} aria-hidden />
    </button>
  </div>
);

export default BoxCricketScoringModePanel;
