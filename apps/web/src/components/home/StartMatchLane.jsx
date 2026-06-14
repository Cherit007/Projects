import React, { useState } from 'react';
import TournamentSetupForm from '../setup/TournamentSetupForm';
import MatchTypePicker from '../setup/MatchTypePicker';
import CasualMatchFlow from '../setup/CasualMatchFlow';

const StartMatchLane = ({
  sportId,
  setSportId,
  ruleConfig,
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
  showSportStep = false,
  casualMatchProps = {},
  matchPhase: controlledPhase,
  onMatchPhaseChange,
}) => {
  const [internalPhase, setInternalPhase] = useState('pick');
  const matchPhase = controlledPhase ?? internalPhase;

  const setMatchPhase = (nextPhase) => {
    if (typeof onMatchPhaseChange === 'function') {
      onMatchPhaseChange(nextPhase);
      return;
    }
    setInternalPhase(nextPhase);
  };

  const handleBack = () => setMatchPhase('pick');

  if (matchPhase === 'pick') {
    return (
      <section className="setup-home-lane setup-home-lane-start tournament-setup-shell">
        <MatchTypePicker
          value=""
          onChange={(nextType) => setMatchPhase(nextType === 'casual' ? 'casual' : 'tournament')}
        />
      </section>
    );
  }

  if (matchPhase === 'casual') {
    return (
      <section className="setup-home-lane setup-home-lane-start">
        <button
          type="button"
          className="start-match-back-link"
          onClick={handleBack}
        >
          ← Back to format
        </button>
        <CasualMatchFlow
          layout="inline"
          sportId={sportId}
          ruleConfig={ruleConfig}
          {...casualMatchProps}
          onClose={handleBack}
        />
      </section>
    );
  }

  return (
    <section className="setup-home-lane setup-home-lane-start tournament-setup-shell">
      <button
        type="button"
        className="start-match-back-link"
        onClick={handleBack}
      >
        ← Back to format
      </button>
      <TournamentSetupForm
        sportId={sportId}
        setSportId={setSportId}
        ruleConfig={ruleConfig}
        setRuleConfig={setRuleConfig}
        gameMode={gameMode}
        setGameMode={setGameMode}
        tournamentFormat={tournamentFormat}
        setTournamentFormat={setTournamentFormat}
        format={format}
        setFormat={setFormat}
        numTeamsInput={numTeamsInput}
        setNumTeamsInput={setNumTeamsInput}
        setNumTeams={setNumTeams}
        tournamentName={tournamentName}
        setTournamentName={setTournamentName}
        onNext={onNext}
        startTournamentPending={startTournamentPending}
        showSportStep={showSportStep}
        excludeCasualFormat
        setupEyebrow="Start match"
        setupTitle="Tournament setup"
        setupSubtitle="Configure teams, format, and rules — then continue to team entry."
        submitLabel="Start Tournament"
        className="tournament-setup-form-embedded"
      />
    </section>
  );
};

export default StartMatchLane;
