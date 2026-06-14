export const parseRuleConfig = (value) => {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) return { ...value };
  if (typeof value !== 'string') return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
};

export const serializeRuleConfig = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return '';
  if (Object.keys(value).length === 0) return '';
  return JSON.stringify(value);
};
