import { renderHook, act } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useThemeMode } from '../hooks/useThemeMode';
import { STORAGE_KEYS } from '../platform/storageKeys';

describe('useThemeMode', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.removeAttribute('data-theme');
  });

  it('defaults to dark when no saved theme exists', () => {
    const { result } = renderHook(() => useThemeMode());
    expect(result.current.themeMode).toBe('dark');
    expect(document.body.getAttribute('data-theme')).toBe('dark');
  });

  it('loads saved theme from storage', () => {
    localStorage.setItem(STORAGE_KEYS.THEME_MODE, 'light');
    const { result } = renderHook(() => useThemeMode());
    expect(result.current.themeMode).toBe('light');
  });

  it('migrates legacy theme key on load', () => {
    localStorage.setItem('badminton_theme_mode', 'light');
    const { result } = renderHook(() => useThemeMode());
    expect(result.current.themeMode).toBe('light');
  });

  it('toggles theme mode', () => {
    const { result } = renderHook(() => useThemeMode());
    act(() => {
      result.current.toggleThemeMode();
    });
    expect(result.current.themeMode).toBe('light');
    act(() => {
      result.current.toggleThemeMode();
    });
    expect(result.current.themeMode).toBe('dark');
  });
});
