/** What a payment message says about the other side, independent of the name. */
export type PayeeKind = 'merchant' | 'person';

/** Bank SMS mark UPI payments to merchants "P2M" and to people "P2A" (or "P2P"). */
const P2M = /\bP2M\b/i;
const P2A = /\bP2[AP]\b/i;
/** UPI IDs of QR codes and payment gateways, e.g. paytmqr281005@paytm, Q123456789@ybl. */
const MERCHANT_VPA =
  /\b(?:paytmqr[\w.-]*|q\d{6,}|bharatpe[\w.-]*|mab\.[\w.-]+|[\w.-]*\.rzp|razorpay[\w.-]*|cf\.[\w.-]+|pinelabs[\w.-]*|ezetap[\w.-]*|mswipe[\w.-]*|gpay-\d+|[\w.-]*merchant[\w.-]*)@[a-z]+/i;
/** Personal UPI IDs are often the mobile number. */
const MOBILE_VPA = /(?:^|[^\w.])(?:\+?91)?[6-9]\d{9}@[a-z]+/i;

export function detectPayeeKind(text: string): PayeeKind | null {
  if (P2M.test(text) || MERCHANT_VPA.test(text)) {
    return 'merchant';
  }
  if (P2A.test(text) || MOBILE_VPA.test(text)) {
    return 'person';
  }
  return null;
}
