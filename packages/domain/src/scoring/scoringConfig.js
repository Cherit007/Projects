/** Default badminton league + ELO settings. */
export const DEFAULT_SCORING_CONFIG = {
  pointsPerWin: 2,
  kFactor: 32,
  defaultRating: 1000,
};

export const BADMINTON_SCORING_CONFIG = DEFAULT_SCORING_CONFIG;

export const resolveScoringConfig = (config = {}) => ({
  ...DEFAULT_SCORING_CONFIG,
  ...config,
});
