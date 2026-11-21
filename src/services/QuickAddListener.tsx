import { router } from 'expo-router';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { bankSmsNative } from './upi/bankSmsSync';

/** Requests older than this were not just made; the user has moved on. */
const FRESH_MS = 5 * 60 * 1000;

/**
 * Opens a new expense filled in from the "Add expense" action (Siri, the
 * Action button, Back Tap or a Control Center shortcut), which opens the app.
 * Rendered inside the tabs so navigation is ready.
 */
export function QuickAddListener() {
  useEffect(() => {
    const check = () => {
      const request = bankSmsNative?.takeQuickAdd?.();
      if (!request || !(request.amount > 0) || Date.now() - request.at > FRESH_MS) {
        return;
      }
      router.push({
        pathname: '/transaction/[id]',
        params: { id: 'new', amount: String(request.amount), counterparty: request.paidTo ?? '' },
      });
    };
    check();
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') {
        check();
      }
    });
    return () => subscription.remove();
  }, []);
  return null;
}
