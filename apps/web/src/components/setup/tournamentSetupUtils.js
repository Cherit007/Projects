import { getSport } from '@fixture-maker/domain/sports';

export const applyTournamentFormatChange = (
  nextFormat,
  { setTournamentFormat, setNumTeams, setNumTeamsInput },
) => {
  setTournamentFormat(nextFormat);
  if (nextFormat === 'knockoutByes' || nextFormat === 'semiFinal') {
    setNumTeams(4);
    setNumTeamsInput('4');
  } else if (nextFormat === 'fullKnockout') {
    setNumTeams(8);
    setNumTeamsInput('8');
  } else {
    setNumTeams(3);
    setNumTeamsInput('3');
  }
};

export const applySportChange = (
  nextSportId,
  {
    setSportId,
    gameMode,
    setGameMode,
    tournamentFormat,
    setTournamentFormat,
    format,
    setFormat,
    setNumTeams,
    setNumTeamsInput,
    getSportSetupConfig,
    setRuleConfig,
  },
) => {
  const setupConfig = getSportSetupConfig(nextSportId);
  const sport = getSport(nextSportId);
  const allowedModes = new Set(setupConfig.gameModes.map((mode) => mode.value));
  const allowedFormats = new Set(setupConfig.formats.map((entry) => entry.value));
  const allowedMatchesPerPair = new Set(setupConfig.matchesPerPair.map((entry) => entry.value));

  setSportId?.(nextSportId);
  setRuleConfig?.({ ...(sport.defaultRuleConfig || {}) });

  if (!allowedModes.has(gameMode)) {
    setGameMode?.(setupConfig.gameModes[0]?.value || 'doubles');
  }

  if (!allowedFormats.has(tournamentFormat)) {
    applyTournamentFormatChange(setupConfig.formats[0]?.value || 'league', {
      setTournamentFormat,
      setNumTeams,
      setNumTeamsInput,
    });
    return;
  }

  if (!allowedMatchesPerPair.has(format)) {
    setFormat?.(setupConfig.matchesPerPair[0]?.value || '1');
  }
};
