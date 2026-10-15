import { guessCategoryName, predictCategoryName } from '../src/domain/categories/autoCategory';
import { classifyPayee, isPersonPayee, predictPayee } from '../src/domain/categories/payeeClassifier';
import { decidePayee, payeeFeatures, scorePayee } from '../src/domain/categories/payeeFeatures';
import { isOwnName, lastWord, learnedCategoryId, learnWords } from '../src/domain/categories/payeeHistory';
import { detectPayeeKind } from '../src/domain/upi/payeeKind';

describe('model input edge cases', () => {
  it.each([null, '', '   ', '12345', '@ybl', '!!!', '🙂🙂', 'राहुल शर्मा', 'A', 'x y z'])(
    '%p has no usable words and goes to Other',
    payee => {
      expect(predictPayee(payee)).toEqual({ person: false, category: null });
      expect(predictCategoryName(payee, 'expense')).toBe('Other');
      expect(predictCategoryName(payee, 'income')).toBe('Other income');
    },
  );

  it('handles very long and punctuated names without failing', () => {
    const long = 'SRI '.repeat(200) + 'MEDICALS';
    expect(() => predictCategoryName(long, 'expense')).not.toThrow();
    expect(predictCategoryName('M/S. SHARMA & SONS (PVT) LTD.', 'expense')).toEqual(expect.any(String));
    expect(predictCategoryName("D'SOUZA'S BAKERY", 'expense')).toBe('Food and dining');
  });

  it('ignores letter case and accents the same way', () => {
    for (const payee of ['Balaji Medical Hall', 'BALAJI MEDICAL HALL', 'balaji medical hall']) {
      expect(classifyPayee(payee)).toBe('Healthcare');
    }
    expect(predictCategoryName('Café Coffee Day', 'expense')).toBe('Food and dining');
  });

  it('reads UPI IDs: mobile numbers are people, merchant QR codes are not', () => {
    expect(isPersonPayee('9876543210@ybl')).toBe(true);
    expect(isPersonPayee('+919876543210@paytm')).toBe(true);
    expect(isPersonPayee('1234567890@ybl')).toBe(false);
    expect(isPersonPayee('paytmqr281005050101@paytm')).toBe(false);
    expect(predictCategoryName('swiggy@icici', 'expense')).toBe('Food and dining');
  });

  it('never gives a category to a person or a person flag together with a category', () => {
    for (const payee of ['RAHUL SHARMA', 'Priya', 'MOHAMMED IRFAN', 'BALAJI MEDICAL HALL', 'HDFC BANK']) {
      const { person, category } = predictPayee(payee);
      expect(person && category !== null).toBe(false);
    }
  });

  it('treats merchant hints as businesses even for person-like names', () => {
    expect(predictPayee('RAHUL SHARMA', true).person).toBe(false);
    expect(predictPayee('9876543210@ybl', true).person).toBe(false);
  });

  it('scores unknown run-together words by the known words they end with', () => {
    const model = { classes: ['A', 'B'], logPriors: [Math.log(0.5), Math.log(0.5)] };
    const weights = { 'w:restaurant': [-1, -6], 'w:maharaja': [-3, -3] };
    const [a, b] = scorePayee('maharajarestaurant@oksbi', model.logPriors, weights);
    expect(a).toBeGreaterThan(b);
    expect(payeeFeatures('maharajarestaurant@oksbi')[0][0]).toBe('w:maharajarestaurant');
  });

  it('decides safely with degenerate scores', () => {
    expect(decidePayee('shop', ['__person__'], [0])).toEqual({ person: true, category: null });
    expect(decidePayee('shop', ['__person__'], [0], true)).toEqual({ person: false, category: null });
    expect(decidePayee('shop', ['A', 'B'], [0, 0])).toEqual({ person: false, category: null });
  });
});

describe('merchant rules edge cases', () => {
  it('matches whole words only', () => {
    expect(guessCategoryName('OLAF KUMAR', 'expense')).toBeNull();
    expect(guessCategoryName('Sachin Tendulkar', 'expense')).toBeNull();
    expect(guessCategoryName('NATURALS ICE CREAM', 'expense')).not.toBe('Personal care');
    expect(guessCategoryName('Dhan Laxmi Stores', 'expense')).not.toBe('Investments');
  });

  it('does not apply expense rules to income or the other way round', () => {
    expect(guessCategoryName('ZERODHA', 'income')).toBeNull();
    expect(guessCategoryName('ACME SALARY', 'expense')).toBeNull();
  });
});

describe('payee kind edge cases', () => {
  it.each([
    ['upi/p2m/123456789012/shop', 'merchant'],
    ['UPI/P2P/123/x', 'person'],
    ['to XP2MX', null],
    ['to Q12345@ybl', null],
    ['to q1234567@ybl', 'merchant'],
    ['to 5876543210@ybl', null],
    ['to 919876543210@ybl', 'person'],
    ['to rahul.9876543210@ybl', null],
    ['', null],
  ])('%p → %p', (text, kind) => {
    expect(detectPayeeKind(text)).toBe(kind);
  });
});

describe('own name edge cases', () => {
  it.each([
    ['MR CHERIT REDDY', 'Cherit Reddy', true],
    ['Cherit  Reddy.', 'cherit reddy', true],
    ['C R', 'Cherit Reddy', false],
    ['CHERIT', 'Cherit Reddy', true],
    ['CHE', 'Cherit Reddy', false],
    ['CHERIT KUMAR', 'Cherit Reddy', false],
    ['CHERIT REDDY', 'Mr Cherit Reddy', true],
    ['CHERIT REDDY', 'Mr', false],
    ['', '', false],
  ])('%p for owner %p → %p', (payee, owner, expected) => {
    expect(isOwnName(payee, owner)).toBe(expected);
  });
});

describe('learning edge cases', () => {
  it('needs a last word of 3+ letters in a name of 2+ words', () => {
    expect(lastWord('A B')).toBeNull();
    expect(lastWord('SWIGGY')).toBeNull();
    expect(lastWord('sharma.sweets@ybl')).toBe('sweets');
  });

  it('counts the same payee once and splits ties', () => {
    const learned = learnWords([
      { payee: 'sharma sweets', type: 'expense', categoryId: 'food' },
      { payee: 'SHARMA SWEETS ', type: 'expense', categoryId: 'food' },
      { payee: 'gupta sweets', type: 'expense', categoryId: 'shopping' },
      { payee: 'jain sweets', type: 'expense', categoryId: 'food' },
    ]);
    expect(learnedCategoryId(learned, 'Agarwal Sweets', 'expense')).toBeNull();
    expect(learnedCategoryId(learnWords([]), 'Agarwal Sweets', 'expense')).toBeNull();
    expect(learnedCategoryId(learned, null, 'expense')).toBeNull();
  });
});
