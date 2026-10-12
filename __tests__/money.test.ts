import {
  formatMinor,
  parseToMinor,
  sumMinor,
} from '../src/domain/money/money';

describe('parseToMinor', () => {
  it.each([
    ['0', 0],
    ['12', 1200],
    ['12.5', 1250],
    ['12.05', 1205],
    ['1,234.50', 123450],
    ['₹ 99.99', 9999],
    ['-10.10', -1010],
  ])('parses %s', (input, expected) => {
    expect(parseToMinor(input)).toBe(expected);
  });

  it.each(['', 'abc', '1.234', '1..2', '.5'])('rejects %s', input => {
    expect(parseToMinor(input)).toBeNull();
  });
});

describe('sumMinor', () => {
  it('avoids floating-point drift', () => {
    expect(sumMinor([10, 20])).toBe(30);
    expect(sumMinor(Array(1000).fill(1))).toBe(1000);
  });

  it('rejects non-integer amounts', () => {
    expect(() => sumMinor([0.1])).toThrow(RangeError);
  });
});

describe('formatMinor', () => {
  it('formats INR', () => {
    expect(formatMinor(123450)).toContain('1,234.50');
  });
});
