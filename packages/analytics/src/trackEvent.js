/** @typedef {{ track: (name: string, payload?: Record<string, unknown>) => void }} AnalyticsAdapter */

/** @type {AnalyticsAdapter|null} */
let activeAdapter = null;

/** @param {AnalyticsAdapter|null} adapter */
export const setAnalyticsAdapter = (adapter) => {
  activeAdapter = adapter;
};

export const getAnalyticsAdapter = () => activeAdapter;

/** @param {string} name @param {Record<string, unknown>} [payload] */
export const trackEvent = (name, payload = {}) => {
  if (!name) return;

  if (activeAdapter?.track) {
    activeAdapter.track(name, payload);
    return;
  }

  if (import.meta.env.DEV) {
    console.debug('[analytics]', name, payload);
  }
};
