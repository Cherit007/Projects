/**
 * Money is stored as integer minor units (e.g. paise for INR) to avoid
 * binary floating-point rounding errors.
 */
export type MinorUnits = number;

const MINOR_PER_MAJOR = 100;

export function assertMinorUnits(value: number): asserts value is MinorUnits {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`Invalid minor-unit amount: ${value}`);
  }
}

/**
 * Parses a user-entered decimal string such as "1,234.50" into minor units.
 * Returns null for malformed input or more than two decimal places.
 */
export function parseToMinor(input: string): MinorUnits | null {
  const normalized = input.replace(/[,\s₹]/g, '');
  const match = /^(-)?(\d+)(?:\.(\d{1,2}))?$/.exec(normalized);
  if (!match) {
    return null;
  }
  const [, sign, whole, fraction = ''] = match;
  const minor =
    Number(whole) * MINOR_PER_MAJOR + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(minor)) {
    return null;
  }
  return sign ? -minor : minor;
}

export function sumMinor(amounts: readonly MinorUnits[]): MinorUnits {
  let total = 0;
  for (const amount of amounts) {
    assertMinorUnits(amount);
    total += amount;
  }
  assertMinorUnits(total);
  return total;
}

export function formatMinor(
  amount: MinorUnits,
  currency = 'INR',
  locale = 'en-IN',
): string {
  assertMinorUnits(amount);
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount / MINOR_PER_MAJOR);
}
