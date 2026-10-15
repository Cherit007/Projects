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

// People, including names that double as shop prefixes ("Sai", "Durga") and UPI IDs.
const PEOPLE = [
  'RAHUL SHARMA',
  'Priya Venkatesh',
  'K SRINIVASA RAO',
  'MOHAMMED IRFAN',
  'Anjali Deshmukh',
  'Mrs Kavitha Reddy',
  'Ramana Reddy',
  'Sai Krishna',
  'Durga Prasad',
  'Kiran Kumar Reddy',
  'JOHN MATHEW',
  'Fatima Begum',
  'rahul.sharma@okaxis',
  '9876543210@ybl',
];

// Businesses whose name says nothing about the spending, banks and payment gateways.
const VAGUE_BUSINESSES = [
  'SRI LAKSHMI ENTERPRISES',
  'Kumar Traders',
  'Patel Brothers',
  'HDFC BANK',
  'KOTAK MAHINDRA BANK',
  'RAZORPAY SOFTWARE',
  'paytmqr281005050101@paytm',
  'Q123456789@ybl',
];

describe('classifyPayee', () => {
  it('categorises realistic shop names correctly', () => {
    const results = EXPECTED.map(([payee, category]) => ({ payee, category, got: classifyPayee(payee) }));
    const correct = results.filter(r => r.got === r.category).length;
    const wrong = results.filter(r => r.got !== null && r.got !== r.category);
    expect(wrong).toEqual([]);
    expect(correct / EXPECTED.length).toBeGreaterThanOrEqual(0.9);
  });

  it('does not give people or vague businesses a shop category', () => {
    for (const payee of [...PEOPLE, ...VAGUE_BUSINESSES]) {
      expect(classifyPayee(payee)).toBeNull();
    }
  });

  it('handles empty input', () => {
    expect(classifyPayee(null)).toBeNull();
    expect(classifyPayee('  ')).toBeNull();
  });
});

describe('isPersonPayee', () => {
  it('recognises people', () => {
    expect(PEOPLE.filter(payee => !isPersonPayee(payee))).toEqual([]);
  });

  it('does not take shops, banks or vague businesses for people', () => {
    const businesses = [...EXPECTED.map(([payee]) => payee), ...VAGUE_BUSINESSES, 'KUMAR PETROLEUM', 'Reddy Medicals'];
    expect(businesses.filter(isPersonPayee)).toEqual([]);
  });
});

describe('predictCategoryName', () => {
  it('files payments to and from people under Friends', () => {
    expect(predictCategoryName('RAHUL SHARMA', 'expense')).toBe('Friends');
    expect(predictCategoryName('RAHUL SHARMA', 'income')).toBe('Friends');
  });

  it('uses merchant rules and shop categories', () => {
    expect(predictCategoryName('SWIGGY', 'expense')).toBe('Food and dining');
    expect(predictCategoryName('BALAJI MEDICAL HALL', 'expense')).toBe('Healthcare');
    expect(predictCategoryName('KUMAR PETROLEUM', 'expense')).toBe('Transport');
    expect(predictCategoryName('ACME PAYROLL', 'income')).toBe('Salary');
  });

  it('files everything else under Other, so every payment can be added', () => {
    for (const payee of [...VAGUE_BUSINESSES, null]) {
      expect(predictCategoryName(payee, 'expense')).toBe('Other');
      expect(predictCategoryName(payee, 'income')).toBe('Other income');
    }
  });
});
