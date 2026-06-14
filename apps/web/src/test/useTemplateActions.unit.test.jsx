import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useTemplateActions } from '../hooks/useTemplateActions';
import { STORAGE_KEYS } from '../platform/storageKeys';

describe('useTemplateActions', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('saves a template to local storage in local mode', () => {
    const setTournamentTemplates = vi.fn((updater) => {
      if (typeof updater === 'function') {
        return updater([]);
      }
      return updater;
    });
    const showToast = vi.fn();

    const { result } = renderHook(() => useTemplateActions({
      tournamentTemplates: [],
      setTournamentTemplates,
      showToast,
    }));

    act(() => {
      result.current.saveTournamentTemplate({
        name: 'Weekend League',
        teams: [{ name: 'A', player1: 'P1', player2: 'P2' }],
      });
    });

    expect(setTournamentTemplates).toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith('Template saved');
    expect(localStorage.getItem(STORAGE_KEYS.TEMPLATES)).toContain('Weekend League');
  });

  it('requires a template name', () => {
    const showToast = vi.fn();
    const { result } = renderHook(() => useTemplateActions({
      setTournamentTemplates: vi.fn(),
      showToast,
    }));

    const response = result.current.saveTournamentTemplate({ name: '   ' });
    expect(response.success).toBe(false);
    expect(showToast).toHaveBeenCalledWith('Template name is required', 'error');
  });

  it('deletes a template in local mode', () => {
    const setTournamentTemplates = vi.fn((updater) => updater([
      { id: 'template-1', name: 'Old Template', teams: [] },
    ]));
    const showToast = vi.fn();

    const { result } = renderHook(() => useTemplateActions({
      tournamentTemplates: [{ id: 'template-1', name: 'Old Template', teams: [] }],
      setTournamentTemplates,
      showToast,
      assertCanDelete: () => true,
    }));

    act(() => {
      result.current.deleteTournamentTemplate('template-1');
    });

    expect(showToast).toHaveBeenCalledWith('Template deleted');
    expect(localStorage.getItem(STORAGE_KEYS.TEMPLATES)).toBe('[]');
  });
});
