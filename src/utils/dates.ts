const pad = (n: number) => String(n).padStart(2, '0');

/** Formats a timestamp as a local `YYYY-MM-DD` date for text entry. */
export function toLocalDateInput(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Parses a local `YYYY-MM-DD` date into a UTC ISO timestamp, keeping the time
 * of day from `timeSourceIso` so edits don't move a transaction across days.
 * Returns null for invalid dates.
 */
export function fromLocalDateInput(
  value: string,
  timeSourceIso: string = new Date().toISOString(),
): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) {
    return null;
  }
  const [year, month, day] = match.slice(1).map(Number);
  const time = new Date(timeSourceIso);
  const date = new Date(
    year,
    month - 1,
    day,
    time.getHours(),
    time.getMinutes(),
    time.getSeconds(),
    time.getMilliseconds(),
  );
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return date.toISOString();
}

/** Formats a local `YYYY-MM-DD` date as e.g. "7 Nov". */
export function formatShortLocalDate(value: string, locale = 'en-IN'): string {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(locale, { day: 'numeric', month: 'short' });
}

export function formatDisplayDate(iso: string, locale = 'en-IN'): string {
  return new Date(iso).toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
