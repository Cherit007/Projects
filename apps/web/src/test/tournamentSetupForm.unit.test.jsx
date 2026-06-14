// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TournamentSetupForm from '../components/setup/TournamentSetupForm';
import { applyTournamentFormatChange } from '../components/setup/tournamentSetupUtils';
import { getFormatHint, getSportSetupConfig } from '../components/setup/sportSetupConfig';

describe('tournament setup utils', () => {
  it('sets team count when semi-final format is selected', () => {
    const setTournamentFormat = vi.fn();
    const setNumTeams = vi.fn();
    const setNumTeamsInput = vi.fn();

    applyTournamentFormatChange('semiFinal', {
      setTournamentFormat,
      setNumTeams,
      setNumTeamsInput,
    });

    expect(setTournamentFormat).toHaveBeenCalledWith('semiFinal');
    expect(setNumTeams).toHaveBeenCalledWith(4);
    expect(setNumTeamsInput).toHaveBeenCalledWith('4');
  });
});

describe('sportSetupConfig', () => {
  it('exposes badminton modes and formats', () => {
    const config = getSportSetupConfig('badminton');
    expect(config.gameModes).toHaveLength(3);
    expect(config.formats.map((entry) => entry.value)).toContain('league');
    expect(getFormatHint('badminton', 'league')).toMatch(/Round-robin/i);
  });

  it('maps pickleball from the domain registry including mixed doubles', () => {
    const config = getSportSetupConfig('pickleball');
    expect(config.gameModes.map((mode) => mode.value)).toEqual(['doubles', 'singles', 'mixed']);
  });
});

describe('TournamentSetupForm', () => {
  it('renders sport-first steps and submits when valid', () => {
    const onNext = vi.fn();
    render(
      <TournamentSetupForm
        gameMode="doubles"
        setGameMode={vi.fn()}
        tournamentFormat="league"
        setTournamentFormat={vi.fn()}
        format="1"
        setFormat={vi.fn()}
        numTeamsInput="6"
        setNumTeamsInput={vi.fn()}
        setNumTeams={vi.fn()}
        tournamentName="Spring League"
        setTournamentName={vi.fn()}
        onNext={onNext}
      />,
    );

    expect(screen.getByText('Step 1')).toBeTruthy();
    expect(screen.getByText('Badminton')).toBeTruthy();
    expect(screen.getByText('Pickleball')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Continue to Teams/i })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Continue to Teams/i }));
    expect(onNext).toHaveBeenCalledWith('6');
  });
});
