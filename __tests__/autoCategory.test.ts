import { guessCategoryName } from '../src/domain/categories/autoCategory';

describe('guessCategoryName', () => {
  it('recognises common merchants', () => {
    expect(guessCategoryName('SWIGGY', 'expense')).toBe('Food and dining');
    expect(guessCategoryName('Zomato Ltd', 'expense')).toBe('Food and dining');
    expect(guessCategoryName('BLINKIT COMMERCE', 'expense')).toBe('Groceries');
    expect(guessCategoryName('Uber India', 'expense')).toBe('Transport');
    expect(guessCategoryName('AMAZON PAY', 'expense')).toBe('Shopping');
    expect(guessCategoryName('Airtel Prepaid Recharge', 'expense')).toBe('Utilities and bills');
    expect(guessCategoryName('NETFLIX.COM', 'expense')).toBe('Entertainment');
    expect(guessCategoryName('IRCTC', 'expense')).toBe('Travel');
  });

  it('matches UPI handles', () => {
    expect(guessCategoryName('swiggy@icici', 'expense')).toBe('Food and dining');
    expect(guessCategoryName('paytm-uber@paytm', 'expense')).toBe('Transport');
  });

  it('matches whole words only', () => {
    expect(guessCategoryName('Olaf Kumar', 'expense')).toBeNull();
    expect(guessCategoryName('Vinay', 'expense')).toBeNull();
    expect(guessCategoryName('Parent', 'expense')).toBeNull();
  });

  it('leaves people and unknown payees for review', () => {
    expect(guessCategoryName('RAHUL SHARMA', 'expense')).toBeNull();
    expect(guessCategoryName(null, 'expense')).toBeNull();
  });

  it('only uses rules for the right direction', () => {
    expect(guessCategoryName('ACME PAYROLL SALARY', 'income')).toBe('Salary');
    expect(guessCategoryName('ACME PAYROLL SALARY', 'expense')).toBeNull();
    expect(guessCategoryName('SWIGGY', 'income')).toBeNull();
  });
});
