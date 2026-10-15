import { predictCategoryName } from '../src/domain/categories/autoCategory';
import {
  isOwnName,
  lastWord,
  learnedCategoryId,
  learnWords,
  type CategorisedPayee,
} from '../src/domain/categories/payeeHistory';
import { parseBankSms } from '../src/domain/upi/bankSms';
import { detectPayeeKind } from '../src/domain/upi/payeeKind';

describe('isOwnName', () => {
  it('matches the user in the ways banks write names', () => {
    for (const payee of ['CHERIT REDDY', 'Reddy Cherit', 'CHERIT R', 'cherit', 'cherit.reddy@okaxis']) {
      expect(isOwnName(payee, 'Cherit Reddy')).toBe(true);
    }
  });

  it('does not match other people or missing names', () => {
    expect(isOwnName('RAHUL REDDY', 'Cherit Reddy')).toBe(false);
    expect(isOwnName('R REDDY', 'Cherit Reddy')).toBe(true);
    expect(isOwnName('CHERIT REDDY STORES', 'Cherit Reddy')).toBe(false);
    expect(isOwnName('CHERIT REDDY', '')).toBe(false);
    expect(isOwnName(null, 'Cherit Reddy')).toBe(false);
  });
});

describe('learned categories', () => {
  const rows: CategorisedPayee[] = [
    { payee: 'sharma sweets', type: 'expense', categoryId: 'food' },
    { payee: 'gupta sweets', type: 'expense', categoryId: 'food' },
    { payee: 'balaji medicals', type: 'expense', categoryId: 'health' },
    { payee: 'rahul sharma', type: 'expense', categoryId: 'friends' },
    { payee: 'priya sharma', type: 'expense', categoryId: 'family' },
  ];
  const learned = learnWords(rows);

  it('uses the last word', () => {
    expect(lastWord('Agarwal Sweets')).toBe('sweets');
    expect(lastWord('SWIGGY')).toBeNull();
  });

  it('applies a category two different payees agree on', () => {
    expect(learnedCategoryId(learned, 'AGARWAL SWEETS', 'expense')).toBe('food');
  });

  it('needs at least two payees, agreement and the same type', () => {
    expect(learnedCategoryId(learned, 'Sri Ram Medicals', 'expense')).toBeNull();
    expect(learnedCategoryId(learned, 'Anil Sharma', 'expense')).toBeNull();
    expect(learnedCategoryId(learned, 'Agarwal Sweets', 'income')).toBeNull();
  });
});

describe('payee kind', () => {
  it('reads P2M/P2A and UPI IDs', () => {
    expect(detectPayeeKind('Sent Rs.120 UPI/P2M/529100000001/NANDINI')).toBe('merchant');
    expect(detectPayeeKind('Sent Rs.120 UPI/P2A/529100000001/KUMAR PETROLEUM')).toBe('person');
    expect(detectPayeeKind('Paid to paytmqr281005050101@paytm')).toBe('merchant');
    expect(detectPayeeKind('Paid to Q123456789@ybl')).toBe('merchant');
    expect(detectPayeeKind('Received from 9876543210@ybl')).toBe('person');
    expect(detectPayeeKind('Sent Rs.120 To RAHUL SHARMA')).toBeNull();
  });

  it('is recorded by the bank SMS parser', () => {
    const sms = 'Rs.150.00 debited from A/c XX1234 on 15-10-26 UPI/P2M/529100000012/NANDINI. Not you? Call 1800';
    expect(parseBankSms(sms, Date.now())?.payeeKind).toBe('merchant');
  });

  it('overrides what the name suggests', () => {
    expect(predictCategoryName('NANDINI', 'expense', 'merchant')).not.toBe('Friends');
    expect(predictCategoryName('KUMAR PETROLEUM', 'expense', 'person')).toBe('Friends');
    expect(predictCategoryName('RAHUL SHARMA', 'expense', null)).toBe('Friends');
  });
});

describe('new categories', () => {
  it('recognises investments, insurance, personal care, fitness and donations', () => {
    expect(predictCategoryName('ZERODHA BROKING', 'expense')).toBe('Investments');
    expect(predictCategoryName('LIC OF INDIA', 'expense')).toBe('Insurance');
    expect(predictCategoryName('Green Trends Unisex Salon', 'expense')).toBe('Personal care');
    expect(predictCategoryName('Golds Gym', 'expense')).toBe('Fitness');
    expect(predictCategoryName('SRI VENKATESWARA TEMPLE', 'expense')).toBe('Donations');
  });
});
