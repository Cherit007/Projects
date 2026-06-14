/** No-op adapter — default until a provider (PostHog, Firebase, etc.) is wired. */
export const createNoopAnalyticsAdapter = () => ({
  track: () => {},
});
