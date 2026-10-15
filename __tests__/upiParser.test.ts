import {
  dedupeKey,
  initialReviewState,
  parseUpiNotification,
  type RawNotification,
} from '../src/domain/upi/parser';

const PHONEPE = 'com.phonepe.app';
const GPAY = 'com.google.android.apps.nbu.paisa.user';
const PAYTM = 'net.one97.paytm';

function raw(packageName: string, title: string | null, text: string | null, postedAt = 1_760_000_000_000): RawNotification {
  return { packageName, title, text, postedAt };
}

describe('parseUpiNotification', () => {
  it('parses a PhonePe payment', () => {
    expect(parseUpiNotification(raw(PHONEPE, '₹250 paid to Swiggy', 'Paid from HDFC Bank XX1234')))
      .toMatchObject({
        sourceApp: 'PhonePe',
        status: 'success',
        direction: 'debit',
        amountMinor: 25000,
        counterparty: 'Swiggy',
      });
  });

  it('uses the title as the payee when the body only has the amount', () => {
    expect(parseUpiNotification(raw(GPAY, 'Swiggy', 'You paid ₹1,250.50')))
      .toMatchObject({ direction: 'debit', amountMinor: 125050, counterparty: 'Swiggy', status: 'success' });
  });

  it('parses money received', () => {
    expect(parseUpiNotification(raw(GPAY, '₹500 received', 'Rahul Sharma sent you money. Received from Rahul Sharma')))
      .toMatchObject({ direction: 'credit', amountMinor: 50000, counterparty: 'Rahul Sharma' });
  });

  it('parses Rs. amounts and a UPI reference', () => {
    expect(parseUpiNotification(raw(PAYTM, 'Payment successful', 'Paid Rs.99 to Zomato Ltd. UPI Ref No 512345678901')))
      .toMatchObject({ amountMinor: 9900, counterparty: 'Zomato Ltd', reference: '512345678901', status: 'success' });
  });

  it('marks failed payments', () => {
    expect(parseUpiNotification(raw(PHONEPE, 'Payment failed', '₹250 to Swiggy could not be completed')))
      .toMatchObject({ status: 'failed', counterparty: 'Swiggy' });
  });

  it('marks payment requests and finds the requester', () => {
    expect(parseUpiNotification(raw(GPAY, 'Rahul has requested ₹200', 'Tap to pay')))
      .toMatchObject({ status: 'request', amountMinor: 20000, counterparty: 'Rahul' });
  });

  it('marks pending payments', () => {
    expect(parseUpiNotification(raw(PHONEPE, 'Payment pending', '₹300 to Uber is processing'))?.status).toBe('pending');
  });

  it('keeps a payment with no amount for review', () => {
    expect(parseUpiNotification(raw(PHONEPE, 'Payment successful', 'Paid to Swiggy')))
      .toMatchObject({ amountMinor: null, counterparty: 'Swiggy', status: 'success' });
  });

  it('ignores unsupported apps', () => {
    expect(parseUpiNotification(raw('com.whatsapp', '₹250 paid to Swiggy', null))).toBeNull();
  });

  it('never processes OTP or PIN messages', () => {
    expect(parseUpiNotification(raw(PHONEPE, 'OTP for payment', '123456 is your OTP for ₹250'))).toBeNull();
    expect(parseUpiNotification(raw(PHONEPE, null, 'Enter your UPI PIN to pay ₹250'))).toBeNull();
  });

  it('ignores non-payment notifications', () => {
    expect(parseUpiNotification(raw(PHONEPE, 'Offers for you', 'Get cashback on recharges'))).toBeNull();
  });

  it('keeps payee names written in other scripts', () => {
    expect(parseUpiNotification(raw(PHONEPE, '₹75 paid to राहुल शर्मा', 'Paid from HDFC Bank'))?.counterparty)
      .toBe('राहुल शर्मा');
    expect(parseUpiNotification(raw(GPAY, '₹500 received', 'Received from முருகன்'))?.counterparty).toBe('முருகன்');
    expect(parseUpiNotification(raw(PHONEPE, '₹90 paid to Café Noir', null))?.counterparty).toBe('Café Noir');
  });

  it('does not treat a bank account as the payee', () => {
    expect(parseUpiNotification(raw(PHONEPE, '₹250 debited', 'from HDFC Bank XX1234'))?.counterparty).toBeNull();
  });
});

describe('dedupeKey', () => {
  const base = parseUpiNotification(raw(PHONEPE, '₹250 paid to Swiggy', null))!;

  it('matches repeated notifications for the same payment', () => {
    const repeat = parseUpiNotification(raw(PHONEPE, '₹250 paid to Swiggy', null, base.postedAt + 5_000))!;
    expect(dedupeKey(repeat)).toBe(dedupeKey(base));
  });

  it('distinguishes the same amount paid to different merchants', () => {
    const other = parseUpiNotification(raw(PHONEPE, '₹250 paid to Zomato', null))!;
    expect(dedupeKey(other)).not.toBe(dedupeKey(base));
  });

  it('tells apart payees written in other scripts', () => {
    const a = parseUpiNotification(raw(PHONEPE, '₹75 paid to राहुल', null))!;
    const b = parseUpiNotification(raw(PHONEPE, '₹75 paid to प्रिया', null))!;
    expect(dedupeKey(a)).not.toBe(dedupeKey(b));
  });

  it('prefers the transaction reference', () => {
    const a = parseUpiNotification(raw(PAYTM, 'Paid Rs.99 to Zomato', 'UPI Ref No 512345678901'))!;
    const b = parseUpiNotification(raw(PAYTM, 'Payment of Rs 99 successful', 'Ref No: 512345678901', a.postedAt + 600_000))!;
    expect(dedupeKey(a)).toBe(dedupeKey(b));
  });
});

describe('initialReviewState', () => {
  it('never suggests failed payments or requests as expenses', () => {
    const failed = parseUpiNotification(raw(PHONEPE, 'Payment failed', '₹250 to Swiggy'))!;
    const request = parseUpiNotification(raw(GPAY, 'Rahul has requested ₹200', null))!;
    const paid = parseUpiNotification(raw(PHONEPE, '₹250 paid to Swiggy', null))!;
    expect(initialReviewState(failed)).toBe('ignored');
    expect(initialReviewState(request)).toBe('ignored');
    expect(initialReviewState(paid)).toBe('needs_review');
  });
});
