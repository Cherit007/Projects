import React from 'react';

const BoxCricketSummaryScorePanel = ({
  team1,
  team2,
  innings1,
  innings2,
  superOverMode,
  activeOversLimit,
  isSubmitting,
  onUpdateInnings,
}) => {
  const renderInningsBlock = (team, teamKey, innings, accentClass) => (
    <div className={`variant-a-score-side ${accentClass}`}>
      <p className="variant-a-score-team">{team?.name}</p>
      <div className="box-cricket-innings-grid">
        <label className="box-cricket-innings-field">
          <span>Runs</span>
          <input
            type="text"
            inputMode="numeric"
            value={innings.runs}
            onChange={(event) => onUpdateInnings(teamKey, 'runs', event.target.value)}
            placeholder="0"
            className="variant-a-score-input"
            disabled={isSubmitting}
            aria-label={`${team?.name || 'Team'} runs`}
          />
        </label>
        <label className="box-cricket-innings-field">
          <span>Wkts</span>
          <input
            type="text"
            inputMode="numeric"
            value={innings.wickets}
            onChange={(event) => onUpdateInnings(teamKey, 'wickets', event.target.value)}
            placeholder="0"
            className="variant-a-score-input"
            disabled={isSubmitting}
          />
        </label>
        <label className="box-cricket-innings-field">
          <span>Overs</span>
          <input
            type="text"
            inputMode="decimal"
            value={superOverMode ? '1' : innings.overs}
            onChange={(event) => onUpdateInnings(teamKey, 'overs', event.target.value)}
            placeholder={String(activeOversLimit)}
            className="variant-a-score-input"
            disabled={isSubmitting || superOverMode}
          />
        </label>
      </div>
    </div>
  );

  return (
    <div className="variant-a-score-grid box-cricket-score-grid">
      {renderInningsBlock(team1, 1, innings1, 'quick-score-team-pad-one')}
      <div className="variant-a-vs">VS</div>
      {renderInningsBlock(team2, 2, innings2, 'quick-score-team-pad-two')}
    </div>
  );
};

export default BoxCricketSummaryScorePanel;
