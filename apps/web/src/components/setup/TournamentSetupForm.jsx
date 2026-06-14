import React, { useMemo } from 'react';
import { Users, ArrowRight } from 'lucide-react';
import SetupSelectionGrid from './SetupSelectionGrid';
import {
  DEFAULT_SPORT_ID,
  SPORT_CATALOG,
  getFormatHint,
  getSportSetupConfig,
  getTeamCountHint,
  isTeamCountEditable,
  TOURNAMENT_NAME_PLACEHOLDER,
} from './sportSetupConfig';
import { applyTournamentFormatChange, applySportChange } from './tournamentSetupUtils';
import BoxCricketRulesPanel from './BoxCricketRulesPanel';

const TournamentSetupForm = ({
  sportId = DEFAULT_SPORT_ID,
  setSportId,
  ruleConfig = {},
  setRuleConfig,
  gameMode,
  setGameMode,
  tournamentFormat,
  setTournamentFormat,
  format,
  setFormat,
  numTeamsInput,
  setNumTeamsInput,
  setNumTeams,
  tournamentName,
  setTournamentName,
  onNext,
  startTournamentPending = false,
  showSportStep = true,
  showHeader = true,
  submitLabel = 'Continue to Teams',
  className = '',
}) => {
  const setupConfig = useMemo(() => getSportSetupConfig(sportId), [sportId]);
  const formatHint = getFormatHint(sportId, tournamentFormat);
  const teamCountEditable = isTeamCountEditable(tournamentFormat);

  const handleFormatChange = (nextFormat) => {
    applyTournamentFormatChange(nextFormat, {
      setTournamentFormat,
      setNumTeams,
      setNumTeamsInput,
    });
  };

  const sportOptions = SPORT_CATALOG.map((sport) => ({
    value: sport.id,
    label: sport.label,
    icon: sport.icon,
    badge: sport.badge,
    disabled: !sport.available,
  }));

  return (
    <div className={`tournament-setup-form ${className}`.trim()}>
      {showHeader && (
        <header className="tournament-setup-header">
          <p className="tournament-setup-eyebrow">Create tournament</p>
          <h2 className="tournament-setup-title">Set up your event</h2>
          <p className="tournament-setup-subtitle">
            Sport-first flow — works on mobile, web, and future native apps.
          </p>
        </header>
      )}

      <div className="tournament-setup-body">
        {showSportStep && (
          <SetupSelectionGrid
            step="Step 1"
            legend="Sport"
            options={sportOptions}
            value={sportId}
            columns={3}
            onChange={(nextSportId) => {
              const sport = SPORT_CATALOG.find((entry) => entry.id === nextSportId);
              if (!sport?.available) return;
              applySportChange(nextSportId, {
                setSportId,
                setRuleConfig,
                gameMode,
                setGameMode,
                tournamentFormat,
                setTournamentFormat,
                format,
                setFormat,
                setNumTeams,
                setNumTeamsInput,
                getSportSetupConfig,
              });
            }}
          />
        )}

        <SetupSelectionGrid
          step="Step 2"
          legend="Game mode"
          options={setupConfig.gameModes}
          value={gameMode}
          columns={3}
          onChange={setGameMode}
        />

        <div className="tournament-setup-field">
          <SetupSelectionGrid
            step="Step 3"
            legend="Tournament format"
            options={setupConfig.formats}
            value={tournamentFormat}
            columns={2}
            onChange={handleFormatChange}
          />
          <p className="tournament-setup-hint">{formatHint}</p>
          {tournamentFormat === 'league' && (
            <div className="tournament-setup-nested">
              <SetupSelectionGrid
                legend="Matches per pair"
                options={setupConfig.matchesPerPair}
                value={format}
                columns={2}
                onChange={setFormat}
              />
            </div>
          )}
        </div>

        <div className="tournament-setup-field">
          <p className="tournament-setup-step">Step 4</p>
          <div className="tournament-setup-row">
            <div className="tournament-setup-input-group">
              <label className="tournament-setup-label" htmlFor="tournament-setup-team-count">
                Teams
              </label>
              <input
                id="tournament-setup-team-count"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={numTeamsInput}
                disabled={!teamCountEditable}
                onChange={(event) => setNumTeamsInput(event.target.value.replace(/\D/g, ''))}
                className="tournament-setup-input"
              />
              <p className="tournament-setup-hint">{getTeamCountHint(tournamentFormat)}</p>
            </div>
            <div className="tournament-setup-input-group tournament-setup-input-grow">
              <label className="tournament-setup-label" htmlFor="tournament-setup-name">
                Tournament name
              </label>
              <input
                id="tournament-setup-name"
                type="text"
                value={tournamentName}
                onChange={(event) => setTournamentName(event.target.value)}
                placeholder={TOURNAMENT_NAME_PLACEHOLDER}
                className="tournament-setup-input"
              />
            </div>
          </div>
        </div>

        {sportId === 'boxCricket' && (
          <BoxCricketRulesPanel ruleConfig={ruleConfig} setRuleConfig={setRuleConfig} />
        )}
      </div>

      <div className="tournament-setup-actions">
        <button
          type="button"
          onClick={() => onNext?.(numTeamsInput)}
          disabled={!tournamentName.trim() || startTournamentPending}
          className={`tournament-setup-submit ${startTournamentPending ? 'is-busy' : ''}`}
        >
          <Users size={18} aria-hidden />
          <span>{startTournamentPending ? 'Starting…' : submitLabel}</span>
          {!startTournamentPending && <ArrowRight size={16} aria-hidden className="tournament-setup-submit-arrow" />}
        </button>
        <p className="tournament-setup-footnote">Auto-saved · synced when online</p>
      </div>
    </div>
  );
};

export default TournamentSetupForm;
