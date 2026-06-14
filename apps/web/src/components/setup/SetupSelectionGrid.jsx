import React from 'react';

const SetupSelectionGrid = ({
  legend,
  step,
  options = [],
  value,
  onChange,
  columns = 2,
  disabled = false,
}) => (
  <div className="tournament-setup-field">
    {step && <p className="tournament-setup-step">{step}</p>}
    {legend && (
      <p className="tournament-setup-label" id={`${legend.replace(/\s+/g, '-').toLowerCase()}-label`}>
        {legend}
      </p>
    )}
    <div
      className={`tournament-setup-grid tournament-setup-grid-cols-${columns}`}
      role="radiogroup"
      aria-labelledby={legend ? `${legend.replace(/\s+/g, '-').toLowerCase()}-label` : undefined}
    >
      {options.map((option) => {
        const selected = value === option.value;
        const isDisabled = disabled || option.disabled;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={option.badge ? `${option.label} (${option.badge})` : option.label}
            disabled={isDisabled}
            onClick={() => {
              if (!isDisabled) onChange(option.value);
            }}
            className={`tournament-setup-option ${selected ? 'is-selected' : ''} ${isDisabled ? 'is-disabled' : ''}`}
          >
            {option.icon && <span className="tournament-setup-option-icon" aria-hidden>{option.icon}</span>}
            <span className="tournament-setup-option-label">{option.label}</span>
            {option.description && (
              <span className="tournament-setup-option-desc">{option.description}</span>
            )}
            {option.badge && (
              <span className="tournament-setup-option-badge">{option.badge}</span>
            )}
          </button>
        );
      })}
    </div>
  </div>
);

export default SetupSelectionGrid;
