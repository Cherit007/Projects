import React from 'react';
import SetupSelectionGrid from './SetupSelectionGrid';

const MATCH_TYPE_OPTIONS = [
  {
    value: 'casual',
    label: 'Casual Match',
    icon: '🤝',
    description: 'One-off game — pick players, score, and save',
  },
  {
    value: 'tournament',
    label: 'Tournament',
    icon: '🏆',
    description: 'League, knockout, or bracket with multiple teams',
  },
];

const MatchTypePicker = ({
  value = '',
  onChange,
  legend = 'What are you playing?',
  className = '',
}) => (
  <div className={`start-match-type-picker ${className}`.trim()}>
    <header className="tournament-setup-header">
      <p className="tournament-setup-eyebrow">Start match</p>
      <h2 className="tournament-setup-title">Choose format</h2>
      <p className="tournament-setup-subtitle">
        Casual for a single result, or a full tournament with fixtures and standings.
      </p>
    </header>
    <SetupSelectionGrid
      step="Step 1"
      legend={legend}
      options={MATCH_TYPE_OPTIONS}
      value={value}
      columns={2}
      onChange={onChange}
    />
  </div>
);

export default MatchTypePicker;
