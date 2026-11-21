import { Fragment, type ReactNode } from 'react';

import { usePreferences } from '@/services/PreferencesProvider';

/**
 * Wraps each screen (as a navigator's `screenLayout`) and redraws it when the
 * colour scheme changes, since styles are read from the current palette
 * while rendering. Navigation history is kept.
 */
export function ThemedScreen({ children }: { children: ReactNode }) {
  const { scheme } = usePreferences();
  return <Fragment key={scheme}>{children}</Fragment>;
}
