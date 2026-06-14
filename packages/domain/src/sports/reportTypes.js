/** @typedef {{ id: string, label: string, description?: string }} SportReportTypeDefinition */

/** @typedef {{ type: string, title: string, summary?: string, rows: Array<{ rank?: number, label: string, value: string, detail?: string }> }} SportReportResult */

/**
 * @param {string} reportType
 * @param {SportReportTypeDefinition[]} catalog
 * @returns {SportReportTypeDefinition|undefined}
 */
export const findReportTypeDefinition = (reportType, catalog) => (
  catalog.find((entry) => entry.id === reportType)
);

/**
 * @param {SportReportTypeDefinition[]} catalog
 * @returns {() => string[]}
 */
export const createListReportTypes = (catalog) => () => catalog.map((entry) => entry.id);

/**
 * @param {SportReportTypeDefinition[]} catalog
 * @param {(reportType: string, context: Object) => SportReportResult|null} generator
 * @returns {(context: Object) => SportReportResult|null}
 */
export const createGenerateReport = (catalog, generator) => (context) => {
  const reportType = String(context?.reportType || '').trim();
  if (!reportType) return null;
  if (!catalog.some((entry) => entry.id === reportType)) return null;
  return generator(reportType, context);
};
