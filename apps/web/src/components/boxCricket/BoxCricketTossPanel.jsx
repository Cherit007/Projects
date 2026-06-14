import React from 'react';

const TossOption = ({ selected, onClick, children, className = '' }) => (
  <button
    type="button"
    className={`box-cricket-mode-btn ${selected ? 'is-active' : ''} ${className}`.trim()}
    onClick={onClick}
  >
    {children}
  </button>
);

const BoxCricketTossPanel = ({
  team1,
  team2,
  tossWinnerTeamId,
  electedTo,
  onChangeTossWinner,
  onChangeElectedTo,
  onContinue,
  continueDisabled = false,
}) => (
  <div className="box-cricket-toss-panel">
    <header className="box-cricket-toss-head">
      <p className="box-cricket-toss-eyebrow">Before the match</p>
      <h3 className="box-cricket-toss-title">Toss</h3>
      <p className="box-cricket-toss-copy">Who won the toss, and what did they choose?</p>
    </header>

    <div className="box-cricket-toss-section">
      <p className="box-cricket-toss-label">Toss won by</p>
      <div className="box-cricket-series-options">
        <TossOption
          selected={String(tossWinnerTeamId) === String(team1?.id)}
          onClick={() => onChangeTossWinner(team1?.id)}
        >
          {team1?.emoji} {team1?.name || 'Team 1'}
        </TossOption>
        <TossOption
          selected={String(tossWinnerTeamId) === String(team2?.id)}
          onClick={() => onChangeTossWinner(team2?.id)}
        >
          {team2?.emoji} {team2?.name || 'Team 2'}
        </TossOption>
      </div>
    </div>

    <div className="box-cricket-toss-section">
      <p className="box-cricket-toss-label">Elected to</p>
      <div className="box-cricket-series-options">
        <TossOption
          selected={electedTo === 'bat'}
          onClick={() => onChangeElectedTo('bat')}
        >
          🏏 Bat first
        </TossOption>
        <TossOption
          selected={electedTo === 'bowl'}
          onClick={() => onChangeElectedTo('bowl')}
        >
          🎯 Bowl first
        </TossOption>
      </div>
    </div>

    <button
      type="button"
      className="box-cricket-toss-continue"
      disabled={continueDisabled}
      onClick={onContinue}
    >
      Continue to scoring
    </button>
  </div>
);

export default BoxCricketTossPanel;
