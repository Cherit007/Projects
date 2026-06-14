// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { applySportChange } from '../components/setup/tournamentSetupUtils';

describe('applySportChange', () => {
  it('keeps game mode when supported by the next sport', () => {
    const setSportId = vi.fn();
    const setGameMode = vi.fn();
    applySportChange('pickleball', {
      setSportId,
      gameMode: 'doubles',
      setGameMode,
      tournamentFormat: 'league',
      format: '1',
      getSportSetupConfig: () => ({
        gameModes: [{ value: 'doubles' }, { value: 'singles' }, { value: 'mixed' }],
        formats: [{ value: 'league' }],
        matchesPerPair: [{ value: '1' }],
      }),
    });
    expect(setSportId).toHaveBeenCalledWith('pickleball');
    expect(setGameMode).not.toHaveBeenCalled();
  });

  it('resets game mode when unsupported by the next sport', () => {
    const setSportId = vi.fn();
    const setGameMode = vi.fn();
    applySportChange('pickleball', {
      setSportId,
      gameMode: 'unsupported',
      setGameMode,
      tournamentFormat: 'league',
      format: '1',
      getSportSetupConfig: () => ({
        gameModes: [{ value: 'doubles' }, { value: 'singles' }],
        formats: [{ value: 'league' }],
        matchesPerPair: [{ value: '1' }],
      }),
    });
    expect(setSportId).toHaveBeenCalledWith('pickleball');
    expect(setGameMode).toHaveBeenCalledWith('doubles');
  });

  it('resets tournament format when unsupported by the next sport', () => {
    const setSportId = vi.fn();
    const setTournamentFormat = vi.fn();
    const setNumTeams = vi.fn();
    const setNumTeamsInput = vi.fn();
    applySportChange('badminton', {
      setSportId,
      gameMode: 'doubles',
      tournamentFormat: 'unsupported',
      setTournamentFormat,
      format: '1',
      setNumTeams,
      setNumTeamsInput,
      getSportSetupConfig: () => ({
        gameModes: [{ value: 'doubles' }],
        formats: [{ value: 'league' }],
        matchesPerPair: [{ value: '1' }],
      }),
    });
    expect(setTournamentFormat).toHaveBeenCalledWith('league');
    expect(setNumTeams).toHaveBeenCalledWith(3);
  });
});
