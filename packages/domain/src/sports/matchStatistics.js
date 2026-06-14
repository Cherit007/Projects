/** @param {unknown} statistics */
export const serializeMatchStatistics = (statistics) => {
  if (!statistics || typeof statistics !== 'object') return '';
  try {
    return JSON.stringify(statistics);
  } catch {
    return '';
  }
};

/** @param {unknown} statisticsJson @returns {Object|null} */
export const parseMatchStatistics = (statisticsJson) => {
  if (statisticsJson == null || statisticsJson === '') return null;
  if (typeof statisticsJson === 'object') return statisticsJson;
  if (typeof statisticsJson !== 'string') return null;
  try {
    const parsed = JSON.parse(statisticsJson);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
};
