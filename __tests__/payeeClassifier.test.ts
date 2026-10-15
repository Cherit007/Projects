import { predictCategoryName } from '../src/domain/categories/autoCategory';
import { classifyPayee, isPersonPayee } from '../src/domain/categories/payeeClassifier';

// Realistic names written independently of the training lists.
const EXPECTED: [string, string][] = [
  ['SRI SAI TIFFIN CENTRE', 'Food and dining'],
  ['Hotel Annapoorna Pure Veg', 'Food and dining'],
  ['UDUPI KRISHNA BHAVAN', 'Food and dining'],
  ['Hyderabadi Biryani Point', 'Food and dining'],
  ['RAMESH KIRANA AND GENERAL STORES', 'Groceries'],
  ['Fresh Vegetables and Fruits', 'Groceries'],
  ['BALAJI MEDICAL HALL', 'Healthcare'],
  ['Sanjeevani Chemists', 'Healthcare'],
  ['City Dental Clinic', 'Healthcare'],
  ['KUMAR PETROLEUM SERVICE STATION', 'Transport'],
  ['Mahalakshmi Fuels', 'Transport'],
  ['NEW FASHION GARMENTS', 'Shopping'],
  ['Laxmi Jewellers', 'Shopping'],
  ['Sri Venkateswara Tours and Travels', 'Travel'],
  ['Green Valley Public School', 'Education'],
  ['Bright Coaching Centre', 'Education'],
];

const PEOPLE = ['RAHUL SHARMA', 'Priya Venkatesh', 'K SRINIVASA RAO', 'MOHAMMED IRFAN', 'Anjali Deshmukh'];

describe('classifyPayee', () => {
  it('categorises most realistic shop names correctly', () => {
    const results = EXPECTED.map(([payee, category]) => ({ payee, category, got: classifyPayee(payee) }));
    const correct = results.filter(r => r.got === r.category).length;
    const wrong = results.filter(r => r.got !== null && r.got !== r.category);
    expect(wrong).toEqual([]);
    expect(correct / EXPECTED.length).toBeGreaterThanOrEqual(0.75);
  });

  it('does not give people a shop category', () => {
    for (const payee of PEOPLE) {
      expect(classifyPayee(payee)).toBeNull();
    }
  });

  it('recognises people, and not shops or vague businesses', () => {
    const people = [...PEOPLE, 'rahul.sharma', 'Mrs Kavitha Reddy'].filter(isPersonPayee);
    expect(people.length).toBeGreaterThanOrEqual(5);
    for (const payee of ['BALAJI MEDICAL HALL', 'Sri Lakshmi Enterprises', 'KUMAR PETROLEUM', 'Vinayaka Agencies']) {
      expect(isPersonPayee(payee)).toBe(false);
    }
  });

  it('handles empty input', () => {
    expect(classifyPayee(null)).toBeNull();
    expect(classifyPayee('  ')).toBeNull();
    expect(classifyPayee('9876543210@ybl')).toBeNull();
  });
});

describe('predictCategoryName', () => {
  it('files payments to and from people under Friends', () => {
    expect(predictCategoryName('RAHUL SHARMA', 'expense')).toBe('Friends');
    expect(predictCategoryName('RAHUL SHARMA', 'income')).toBe('Friends');
  });

  it('prefers merchant rules and shop categories over Friends', () => {
    expect(predictCategoryName('SWIGGY', 'expense')).toBe('Food and dining');
    expect(predictCategoryName('BALAJI MEDICAL HALL', 'expense')).toBe('Healthcare');
    expect(predictCategoryName('ACME PAYROLL', 'income')).toBe('Salary');
  });

  it('still asks about vague business names', () => {
    expect(predictCategoryName('SRI LAKSHMI ENTERPRISES', 'expense')).toBeNull();
  });
});
