import React from 'react';

const OVERS_OPTIONS = [4, 5, 6, 8, 10];

export { OVERS_OPTIONS };

const BoxCricketRulesPanel = ({
  ruleConfig = {},
  setRuleConfig,
}) => {
  const updateRule = (key, value) => {
    setRuleConfig?.((prev) => ({
      ...(prev && typeof prev === 'object' ? prev : {}),
      [key]: value,
    }));
  };

  const readNumber = (key, fallback = 0) => Number(ruleConfig?.[key] ?? fallback);

  return (
    <div className="tournament-setup-field box-cricket-rules-panel">
      <p className="tournament-setup-step">Box cricket rules</p>
      <p className="tournament-setup-hint mb-3">Optional house rules — applied to scoring and tie-breakers.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
        <label className="tournament-setup-input-group">
          <span className="tournament-setup-label">Overs per innings</span>
          <select
            className="tournament-setup-input"
            value={String(readNumber('oversLimit', 6))}
            onChange={(event) => updateRule('oversLimit', Number(event.target.value))}
          >
            {OVERS_OPTIONS.map((overs) => (
              <option key={overs} value={overs}>{overs}</option>
            ))}
          </select>
        </label>
        <label className="tournament-setup-input-group">
          <span className="tournament-setup-label">Ball type</span>
          <select
            className="tournament-setup-input"
            value={ruleConfig?.ballType === 'tennis' ? 'tennis' : 'standard'}
            onChange={(event) => updateRule('ballType', event.target.value)}
          >
            <option value="standard">Standard</option>
            <option value="tennis">Tennis ball</option>
          </select>
        </label>
        <label className="tournament-setup-input-group">
          <span className="tournament-setup-label">Powerplay overs</span>
          <input
            type="number"
            min="0"
            max="6"
            className="tournament-setup-input"
            value={readNumber('powerplayOvers', 0)}
            onChange={(event) => updateRule('powerplayOvers', Number(event.target.value) || 0)}
          />
        </label>
        <label className="tournament-setup-input-group">
          <span className="tournament-setup-label">Bonus runs per wicket</span>
          <input
            type="number"
            min="0"
            max="10"
            className="tournament-setup-input"
            value={readNumber('bonusRunsPerWicket', 0)}
            onChange={(event) => updateRule('bonusRunsPerWicket', Number(event.target.value) || 0)}
          />
        </label>
      </div>

      <div className="box-cricket-rules-checks flex flex-wrap gap-4 text-sm">
        <label className="inline-flex items-center gap-2 box-cricket-rules-check">
          <input
            type="checkbox"
            checked={Boolean(ruleConfig?.superOverEnabled ?? true)}
            onChange={(event) => updateRule('superOverEnabled', event.target.checked)}
          />
          Super over on tie
        </label>
        <label className="inline-flex items-center gap-2 box-cricket-rules-check">
          <input
            type="checkbox"
            checked={Boolean(ruleConfig?.lastManStanding)}
            onChange={(event) => updateRule('lastManStanding', event.target.checked)}
          />
          Last man standing
        </label>
        <label className="inline-flex items-center gap-2 box-cricket-rules-check">
          <input
            type="checkbox"
            checked={Boolean(ruleConfig?.retiredOutAllowed)}
            onChange={(event) => updateRule('retiredOutAllowed', event.target.checked)}
          />
          Retired out allowed
        </label>
      </div>
    </div>
  );
};

export default BoxCricketRulesPanel;
