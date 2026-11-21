export type ColorScheme = 'light' | 'dark';

const light = {
  background: '#F3F4F9',
  surface: '#FFFFFF',
  surfaceMuted: '#F7F8FC',
  border: '#E4E7F0',
  track: '#E6E8F2',
  text: '#121826',
  textMuted: '#6B7385',
  primary: '#4F46E5',
  primarySoft: '#EEF0FF',
  primaryBorder: '#D9DCFF',
  onPrimary: '#FFFFFF',
  income: '#0E9F6E',
  incomeSoft: '#E3F8EF',
  expense: '#E0475B',
  expenseSoft: '#FDECEE',
  transfer: '#64748B',
  transferSoft: '#EEF1F5',
  warning: '#B7791F',
  warningSoft: '#FFF6E0',
  danger: '#E0475B',
  heroStart: '#4F46E5',
  heroEnd: '#7C3AED',
};

export type Palette = typeof light;

const dark: Palette = {
  background: '#0B0F1A',
  surface: '#161B29',
  surfaceMuted: '#1D2333',
  border: '#2A3145',
  track: '#232A3B',
  text: '#E9ECF5',
  textMuted: '#9AA3B8',
  primary: '#8B93FF',
  primarySoft: '#23284D',
  primaryBorder: '#353B6E',
  onPrimary: '#0B0F1A',
  income: '#34D399',
  incomeSoft: '#10302A',
  expense: '#F87185',
  expenseSoft: '#3A1B22',
  transfer: '#94A3B8',
  transferSoft: '#1F2636',
  warning: '#FBBF24',
  warningSoft: '#3A2E12',
  danger: '#F87185',
  heroStart: '#4338CA',
  heroEnd: '#6D28D9',
};

const palettes: Record<ColorScheme, Palette> = { light, dark };
let active: ColorScheme = 'light';

/**
 * Switches the palette. Components read `colors` while rendering, so the
 * app root remounts after calling this (see `ThemeProvider`).
 */
export function setActiveScheme(scheme: ColorScheme): void {
  active = scheme;
}

export function activeScheme(): ColorScheme {
  return active;
}

/** The current palette. Each property is read live, so read it during render, not at module load. */
export const colors: Readonly<Palette> = Object.defineProperties(
  {},
  Object.fromEntries(
    (Object.keys(light) as (keyof Palette)[]).map(key => [
      key,
      { enumerable: true, get: () => palettes[active][key] },
    ]),
  ),
) as Palette;

/**
 * A style sheet built from `colors`, rebuilt for each colour scheme. Use it
 * at module level in place of `StyleSheet.create`; `styles.x` then always
 * matches the current scheme.
 */
export function themedStyles<T extends object>(build: () => T): T {
  const cache: Partial<Record<ColorScheme, T>> = {};
  const current = (): T => (cache[active] ??= build());
  return new Proxy({} as T, {
    get: (_, key) => current()[key as keyof T],
    has: (_, key) => key in current(),
    ownKeys: () => Reflect.ownKeys(current()),
    getOwnPropertyDescriptor: (_, key) => Object.getOwnPropertyDescriptor(current(), key),
  });
}

export const radius = { sm: 10, md: 14, lg: 20, pill: 999 } as const;

export const shadow = {
  shadowColor: '#1B2559',
  shadowOpacity: 0.08,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 4 },
  elevation: 2,
} as const;
