import { parseBankSms } from '../src/domain/upi/bankSms';

const NOW = Date.parse('2026-11-14T10:00:00.000Z');

describe('bank alerts with safety warnings and email wording', () => {
  it('reads an HDFC UPI debit email despite its "never share your OTP" footer', () => {
    const email = `Dear Customer,
Greetings from HDFC Bank!
Rs.20.00 has been debited from account **1234 to VPA paytmqr281005050101xyz@paytm KATA SURESH on 14-11-26.
Your UPI transaction reference number is 631812345678.
If you did not authorize this transaction, please report it immediately by calling 18002586161.
Please never share your OTP, UPI PIN or CVV with anyone. HDFC Bank never asks for them.
Warm Regards,
HDFC Bank`;
    expect(parseBankSms(email, NOW)).toMatchObject({
      status: 'success',
      direction: 'debit',
      amountMinor: 2_000,
      counterparty: 'KATA SURESH',
      reference: '631812345678',
      sourceApp: 'HDFC Bank SMS',
      accountLast4: '1234',
      card: false,
    });
  });

  it('reads a credit email and finds the payer after a greeting that mentions the bank', () => {
    const email = `Dear Customer, Greetings from HDFC Bank! Rs.450.00 has been credited to your account **1234 by VPA ravi.kumar@okaxis RAVI KUMAR on 14-11-26. Your UPI transaction reference number is 631899990000. Do not share your OTP with anyone.`;
    expect(parseBankSms(email, NOW)).toMatchObject({
      direction: 'credit',
      amountMinor: 45_000,
      counterparty: 'RAVI KUMAR',
      reference: '631899990000',
    });
  });

  it('still drops real OTP messages, even when they also carry the warning', () => {
    expect(parseBankSms('123456 is your OTP for a transaction of Rs.5,000.00 at AMAZON. Never share it with anyone.', NOW)).toBeNull();
    expect(parseBankSms('Use OTP 445566 to approve Rs.250 debited to SWIGGY. Do not share this OTP.', NOW)).toBeNull();
  });

  it('keeps SMS that end with the bank warning', () => {
    expect(
      parseBankSms('Rs.250.00 debited from A/c XX1234 to SWIGGY on 14-11-26. UPI Ref 631812340000. Never share OTP/PIN. -SBI', NOW),
    ).toMatchObject({ direction: 'debit', amountMinor: 25_000, counterparty: 'SWIGGY', sourceApp: 'SBI SMS' });
  });
});
