import React from 'react';
import TournamentSetupForm from '../setup/TournamentSetupForm';

const StartTournamentLane = ({
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
  showSportStep = true,
}) => (
  <section className="setup-home-lane setup-home-lane-start tournament-setup-shell">
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
      submitLabel="Start Tournament"
      className="tournament-setup-form-embedded"
    />
  </section>
);

export default StartTournamentLane;
