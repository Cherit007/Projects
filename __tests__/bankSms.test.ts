import { parseBankSms } from '../src/domain/upi/bankSms';
import { dedupeKey, initialReviewState } from '../src/domain/upi/parser';

const AT = 1_760_000_000_000;
const parse = (text: string) => parseBankSms(text, AT);

describe('parseBankSms: debits', () => {
  it('HDFC', () => {
    expect(
      parse(
        'Sent Rs.250.00 From HDFC Bank A/C *1234 To SWIGGY On 12/10/26 Ref 412345678901 Not You? Call 18002586161/SMS BLOCK UPI to 7308080808',
      ),
    ).toMatchObject({
      sourceApp: 'HDFC Bank SMS',
      status: 'success',
      direction: 'debit',
      amountMinor: 25000,
      counterparty: 'SWIGGY',
      reference: '412345678901',
    });
  });

  it('SBI, where the amount has no currency marker', () => {
    expect(
      parse(
        'Dear UPI user A/C X1234 debited by 250.0 on date 12Oct26 trf to ZOMATO LTD Refno 412345678902. If not u? call 1800111109. -SBI',
      ),
    ).toMatchObject({
      sourceApp: 'SBI SMS',
      direction: 'debit',
      amountMinor: 25000,
      counterparty: 'ZOMATO LTD',
      reference: '412345678902',
    });
  });

  it('ICICI, which names the payee before "credited"', () => {
    expect(
      parse(
        'ICICI Bank Acct XX123 debited for Rs 1,499.00 on 12-Oct-26; AMAZON PAY credited. UPI:412345678903. Call 18002662 for dispute. SMS BLOCK 123 to 9215676766.',
      ),
    ).toMatchObject({
      direction: 'debit',
      amountMinor: 149900,
      counterparty: 'AMAZON PAY',
      reference: '412345678903',
    });
  });

  it('Axis, with the payee inside the UPI path', () => {
    expect(
      parse('INR 99.00 debited A/c no. XX1234 12-10-26, 10:30:15 UPI/P2M/412345678904/UBER INDIA Not you? SMS BLOCKUPI Cust ID to 919951860002 Axis Bank'),
    ).toMatchObject({ sourceApp: 'Axis Bank SMS', amountMinor: 9900, counterparty: 'UBER', reference: '412345678904' });
  });

  it('Kotak, paying a UPI ID', () => {
    expect(
      parse('Sent Rs.120.00 from Kotak Bank AC X1234 to blinkit@icici on 12-10-26.UPI Ref 412345678905. Not you, https://kotak.com/KBANKT/Fraud'),
    ).toMatchObject({ direction: 'debit', amountMinor: 12000, counterparty: 'blinkit', reference: '412345678905' });
  });
});

describe('parseBankSms: credits', () => {
  it('money received', () => {
    expect(
      parse('Rs.500.00 credited to HDFC Bank A/c XX1234 on 12-10-26 from VPA rahul.sharma@okaxis (UPI 412345678906)'),
    ).toMatchObject({ direction: 'credit', amountMinor: 50000, counterparty: 'rahul.sharma', reference: '412345678906' });
  });

  it('SBI credit without a payer name', () => {
    expect(
      parse('Dear SBI UPI User, ur A/cX1234 credited by Rs500 on 12Oct26 by (Ref no 412345678907)'),
    ).toMatchObject({ direction: 'credit', amountMinor: 50000, counterparty: null, reference: '412345678907' });
  });
});

describe('parseBankSms: ignored and rejected messages', () => {
  it('rejects OTP messages entirely', () => {
    expect(parse('123456 is the OTP for txn of Rs 500.00 at AMAZON on HDFC Bank card. Do not share.')).toBeNull();
  });

  it('rejects messages that are not transactions', () => {
    expect(parse('Get a pre-approved personal loan of Rs 5,00,000 from HDFC Bank. Apply now!')).toBeNull();
    expect(parse('Hi, are we meeting today?')).toBeNull();
  });

  it('keeps failed payments as ignored', () => {
    const parsed = parse('Your UPI transaction of Rs 250.00 to SWIGGY has failed. Amount if debited will be refunded. -HDFC Bank');
    expect(parsed).toMatchObject({ status: 'failed' });
    expect(initialReviewState(parsed!)).toBe('ignored');
  });

  it('keeps payment requests as ignored', () => {
    const parsed = parse('RAHUL SHARMA has requested Rs 300.00 from you on UPI. Approve only if you know them. -SBI');
    expect(parsed).toMatchObject({ status: 'request', counterparty: 'RAHUL SHARMA' });
    expect(initialReviewState(parsed!)).toBe('ignored');
  });
});

describe('dedupe with app notifications', () => {
  it('shares the reference key, so the same payment is not added twice', () => {
    const sms = parse('Sent Rs.250.00 From HDFC Bank A/C *1234 To SWIGGY On 12/10/26 Ref 412345678901');
    expect(dedupeKey(sms!)).toBe('ref:412345678901');
  });
});
