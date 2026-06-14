import { beforeEach, describe, expect, it } from 'vitest';
import { webStorage, webSessionStorage } from '../platform/storage';
import { SESSION_STORAGE_KEYS, STORAGE_KEYS } from '../platform/storageKeys';

describe('webStorage', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('reads and writes canonical keys', () => {
    webStorage.setItem(STORAGE_KEYS.THEME_MODE, 'dark');
    expect(webStorage.getItem(STORAGE_KEYS.THEME_MODE)).toBe('dark');
  });

  it('migrates legacy localStorage keys on read', () => {
    localStorage.setItem('badminton_history', JSON.stringify([{ id: 't1' }]));
    expect(webStorage.getJson(STORAGE_KEYS.HISTORY, [])).toEqual([{ id: 't1' }]);
    expect(localStorage.getItem('badminton_history')).toBeNull();
    expect(localStorage.getItem(STORAGE_KEYS.HISTORY)).toBe(JSON.stringify([{ id: 't1' }]));
  });

  it('removes legacy key when writing canonical key', () => {
    localStorage.setItem('badminton_ratings', JSON.stringify({ Alice: { rating: 1200 } }));
    webStorage.setJson(STORAGE_KEYS.RATINGS, { Bob: { rating: 1100 } });
    expect(localStorage.getItem('badminton_ratings')).toBeNull();
    expect(webStorage.getJson(STORAGE_KEYS.RATINGS)).toEqual({ Bob: { rating: 1100 } });
  });
});

describe('webSessionStorage', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('migrates legacy auto-resume suppression key', () => {
    sessionStorage.setItem('badminton_skip_auto_resume_tournament', 'tournament-1');
    expect(webSessionStorage.getItem(SESSION_STORAGE_KEYS.AUTO_RESUME_SUPPRESS)).toBe('tournament-1');
    expect(sessionStorage.getItem('badminton_skip_auto_resume_tournament')).toBeNull();
  });
});
