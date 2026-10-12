export const colors = {
  background: '#F3F4F9',
  surface: '#FFFFFF',
  surfaceMuted: '#F7F8FC',
  border: '#E4E7F0',
  text: '#121826',
  textMuted: '#6B7385',
  primary: '#4F46E5',
  primarySoft: '#EEF0FF',
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
} as const;

export const radius = { sm: 10, md: 14, lg: 20, pill: 999 } as const;

export const shadow = {
  shadowColor: '#1B2559',
  shadowOpacity: 0.08,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 4 },
  elevation: 2,
} as const;
