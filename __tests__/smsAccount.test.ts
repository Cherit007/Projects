import { parseBankSms } from '../src/domain/upi/bankSms';
import { accountForDetectedPayment } from '../src/domain/upi/smsAccount';
import type { Account } from '../src/domain/types';

const account = (name: string, type: Account['type']): Account => ({
  id: name,
  name,
  type,
  openingBalanceMinor: 0,
  currency: 'INR',
  isArchived: false,
  createdAt: '',
});

const NOW = Date.parse('2026-11-14T10:00:00.000Z');
const hdfc = account('HDFC Bank', 'bank');
const sbi = account('SBI', 'bank');
const wallet = account('MobiKwik', 'wallet');
const cash = account('Cash', 'cash');
const cards = account('Credit cards', 'card');

function route(text: string, accounts: Account[]) {
  const parsed = parseBankSms(text, NOW);
  if (!parsed) {
    throw new Error(`not parsed: ${text}`);
  }
  return accountForDetectedPayment(
    { sourceApp: parsed.sourceApp, card: parsed.card ?? false, accountLast4: parsed.accountLast4 ?? null },
    accounts,
  )?.name ?? null;
}

describe('parseBankSms account details', () => {
  it('spots credit card messages and the last four digits', () => {
    const card = parseBankSms('INR 2,059.94 spent using ICICI Bank Card XX4005 on 16-Oct-26 on MOBIKWIK. Avl Limit: INR 1,20,000', NOW);
    expect(card).toMatchObject({ card: true, accountLast4: '4005', direction: 'debit', amountMinor: 205_994, sourceApp: 'ICICI Bank SMS' });
    const paid = parseBankSms('Payment of INR 9,910.63 has been received on your ICICI Bank Credit Card Account 4xxx4005 on 20-Oct-26', NOW);
    expect(paid).toMatchObject({ card: true, accountLast4: '4005', direction: 'credit' });
    const bank = parseBankSms('Sent Rs.250.00 From HDFC Bank A/C *1234 To SWIGGY On 15/10/26 Ref 529100000001', NOW);
    expect(bank).toMatchObject({ card: false, accountLast4: '1234', sourceApp: 'HDFC Bank SMS' });
  });
});

describe('accountForDetectedPayment', () => {
  const all = [cash, hdfc, sbi, wallet, cards];

  it('files bank, wallet and card messages under the right account', () => {
    expect(route('Sent Rs.250.00 From HDFC Bank A/C *1234 To SWIGGY On 15/10/26 Ref 529100000001', all)).toBe('HDFC Bank');
    expect(route('Your A/C XXXXX0501 debited by 250.0 on 15Oct26 trf to SWIGGY Refno 529100000002 -SBI', all)).toBe('SBI');
    expect(route('Rs.500.00 paid from your MobiKwik wallet to Dontula Anusha', all)).toBe('MobiKwik');
    expect(route('INR 2,059.94 spent using ICICI Bank Card XX4005 on 16-Oct-26 on MOBIKWIK.', all)).toBe('Credit cards');
  });

  it('prefers the card whose name has the same last four digits', () => {
    const icici = account('ICICI Amazon Pay 4005', 'card');
    const axis = account('Axis Flipkart 0171', 'card');
    expect(route('INR 120.00 spent using ICICI Bank Card XX4005 on 16-Oct-26 on ZOMATO.', [hdfc, icici, axis])).toBe(
      'ICICI Amazon Pay 4005',
    );
    // Two cards and no matching digits: unclear.
    expect(route('INR 120.00 spent using ICICI Bank Card XX9999 on 16-Oct-26 on ZOMATO.', [hdfc, icici, axis])).toBeNull();
  });

  it('waits for review instead of guessing between accounts', () => {
    // Card message but no card account.
    expect(route('INR 120.00 spent using ICICI Bank Card XX4005 on 16-Oct-26 on ZOMATO.', [hdfc, sbi])).toBeNull();
    // A bank the user has no account at, while the only account is named for another bank.
    expect(route('Rs.250.00 debited from ICICI Bank A/c XX7777 to SWIGGY', [hdfc])).toBeNull();
    // An unknown bank with two accounts.
    expect(route('Rs.250.00 debited from your A/c XX7777 to SWIGGY', [hdfc, sbi])).toBeNull();
  });

  it('uses a lone account when nothing contradicts it, and cash only without any', () => {
    expect(route('Sent Rs.250.00 From HDFC Bank A/C *1234 To SWIGGY', [account('My savings', 'bank')])).toBe('My savings');
    expect(route('Sent Rs.250.00 From HDFC Bank A/C *1234 To SWIGGY', [cash])).toBe('Cash');
    expect(route('Rs.250.00 debited from your A/c XX7777 to SWIGGY', [hdfc])).toBe('HDFC Bank');
  });
});
