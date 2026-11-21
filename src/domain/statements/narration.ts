import { detectPayeeKind, type PayeeKind } from '../upi/payeeKind';

export type Channel =
  | 'upi'
  | 'imps'
  | 'neft'
  | 'ach'
  | 'atm'
  | 'card'
  | 'interest'
  | 'charges'
  | 'cash'
  | 'topup'
  | 'cashback'
  | 'other';

export interface NarrationInfo {
  channel: Channel;
  payee: string | null;
  /** UPI or IMPS reference, when the description has one. */
  reference: string | null;
  payeeKind: PayeeKind | null;
  /** First four letters of the other side's IFSC (e.g. "SBIN"), for transfers between the user's accounts. */
  otherBank: string | null;
  /** The description marks it as salary ("SAL", "SALARY"). */
  salary: boolean;
}

const TITLE = /^(?:MR|MRS|MS|MISS|DR|SHRI|SMT|M\/S)\.?\s+/i;

/** Words banks run together in company names ("LICHOUSINGFINANCELTD"). */
const GLUED = [
  'TECHNOLOGIES', 'ENTERPRISES', 'INSURANCE', 'SOLUTIONS', 'SERVICES', 'SOFTWARE', 'PRIVATE', 'LIMITED',
  'HOUSING', 'FINANCE', 'MEDICAL', 'GENERAL', 'TRADERS', 'SYSTEMS', 'STORES', 'FOODS', 'INDIA', 'TECH',
  'BANK', 'MART', 'PVT', 'LTD', 'IND',
];
function unglueWord(word: string): string {
  if (word.length < 10 || word !== word.toUpperCase()) {
    return word;
  }
  const pieces: string[] = [];
  let pending = '';
  for (let at = 0; at < word.length; ) {
    const known = GLUED.find(glued => word.startsWith(glued, at));
    if (known) {
      pieces.push(...(pending ? [pending] : []), known);
      pending = '';
      at += known.length;
    } else {
      pending += word[at];
      at += 1;
    }
  }
  if (pending) {
    pieces.push(pending);
  }
  return pieces.some(piece => piece.length < 2) ? word : pieces.join(' ');
}

function unglue(name: string): string {
  return name.split(' ').map(unglueWord).join(' ');
}

/** "MR SRIRAM ANAND KUM" → "Sriram Anand Kum"; names in mixed case are kept as they are. */
export function tidyPayee(value: string | null | undefined): string | null {
  let name = value?.replace(/\s+/g, ' ').trim().replace(TITLE, '');
  if (!name) {
    return null;
  }
  name = unglue(name).replace(/\s+/g, ' ').replace(/[\s.,-]+$/, '').trim();
  if (name.length < 2 || !/\p{L}/u.test(name)) {
    return null;
  }
  if (name !== name.toUpperCase()) {
    return name;
  }
  return name.toLowerCase().replace(/(^|[\s.'&-])(\p{L})/gu, (_, gap: string, letter: string) => gap + letter.toUpperCase());
}

/** UPI IDs in SBI statements are cut short and often lose the "@bank" part. */
function kindFromUpiId(id: string): PayeeKind | null {
  return detectPayeeKind(`${id.replace(/@.*$/, '')}@upi`);
}

const IFSC = /\b([A-Z]{4})0[A-Z0-9]{6}/;

function result(channel: Channel, payee: string | null, extra: Partial<NarrationInfo> = {}): NarrationInfo {
  return { channel, payee: tidyPayee(payee), reference: null, payeeKind: null, otherBank: null, salary: false, ...extra };
}

/**
 * Payee and kind of payment from a bank statement's description, e.g.
 * "UPI-KATA SURESH-PAYTMQR6YE97N@PTYS-YESB0PTMUPI-620781503748-SENT USING
 * PAYTM U" (HDFC) or "WDL TFR UPI/DR/618570103119/AMSHETTI/YESB/paytm.s2fn/Sent"
 * (SBI). Best-effort: unknown formats give no payee.
 */
export function parseNarration(narration: string): NarrationInfo {
  const text = narration
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^(?:WDL TFR|DEP TFR|BY TRANSFER-?|TO TRANSFER-?|BY CLG-?|TO CLG-?)\s*/i, '');

  let match = /^UPI-([^-]*)-(.*)$/i.exec(text);
  if (match) {
    const rest = match[2].replace(/\s+/g, '');
    return result('upi', match[1], {
      reference: /-(\d{12})-/.exec(rest)?.[1] ?? /(\d{12})/.exec(rest)?.[1] ?? null,
      payeeKind: detectPayeeKind(rest),
      otherBank: IFSC.exec(rest)?.[1] ?? null,
    });
  }

  match = /^UPI\/(?:DR|CR)\/(\d+)\/([^/]*)\/([^/]*)\/([^/\s]*)/i.exec(text);
  if (match) {
    return result('upi', match[2], {
      reference: match[1],
      payeeKind: kindFromUpiId(match[4]),
      otherBank: /^[A-Z]{4}$/i.test(match[3]) ? match[3].toUpperCase() : null,
    });
  }

  match = /^IMPS[-/](\d+)[-/]([^/]*)/i.exec(text);
  if (match) {
    // HDFC: "IMPS-<ref>-<name>-<bank>-…"; SBI: "IMPS/<ref>/<bank>-<account>-<name>/…".
    const parts = match[2].split('-');
    const name = text.includes('/') ? parts[parts.length - 1] : parts[0];
    return result('imps', name, { reference: match[1] });
  }

  match = /^(?:NEFT|RTGS)\s*(?:CR|DR)?[-*]([A-Z]{4}0[A-Z0-9]{6})[-*](?:\w+\*)?([^-*]+)/i.exec(text);
  if (match) {
    return result('neft', match[2], { otherBank: match[1].slice(0, 4).toUpperCase() });
  }

  match = /^ACH\s*([CD])-\s*(.*)$/i.exec(text);
  if (match) {
    const parts = match[2].split('-').map(part => part.trim());
    const salary = match[1].toUpperCase() === 'C' && parts.some(part => /^SAL(?:ARY)?\b/i.test(part));
    const name = parts.find(part => !/^SAL(?:ARY)?\w*$/i.test(part) && /[A-Z]{3}/i.test(part) && !/\d{4}/.test(part));
    return result('ach', name ?? null, { salary });
  }

  match = /^CEMTEX\s+DEP\s+ACHCr\s+\S+\s+(.+)$/i.exec(text);
  if (match) {
    return result('ach', match[1]);
  }

  if (/^(?:ATW|NWD|EAW|ATM)\b|ATM\s*(?:WDL|CASH)|CASH\s+WITHDRAWAL/i.test(text)) {
    return result('atm', 'Cash withdrawal');
  }

  match = /^POS\s+\S*X{4,}\S*\s+(.+?)(?:\s+POS\s+DEBIT)?$/i.exec(text);
  if (match) {
    return result('card', match[1], { payeeKind: 'merchant' });
  }

  if (/^INT(?:EREST)?\b.*\b(?:CREDIT|PAID|PD)\b|^INTEREST\b|\bINT\.?\s*PD\b/i.test(text)) {
    return result('interest', 'Interest');
  }
  if (/\bCHARGES?\b|\bCHRGS?\b|\bFEES?\b|\bGST\b|SMS\s+ALERT/i.test(text)) {
    return result('charges', 'Bank charges');
  }
  if (/\bCASH\s*DEP|\bBY\s+CASH\b/i.test(text)) {
    return result('cash', 'Cash deposit');
  }
  if (/^DIRECT\s+DR\b/i.test(text)) {
    return result('other', 'Direct debit');
  }

  // Wallet statements (MobiKwik) describe entries in plain words.
  if (/^Add\s+money$/i.test(text)) {
    return result('topup', 'Wallet top-up');
  }
  if (/cashback/i.test(text)) {
    return result('cashback', 'Cashback');
  }
  match = /^Bank\s+transfer\s+to\s+(.+?)\s*\(([^)]*)\)$/i.exec(text);
  if (match) {
    return result('upi', match[1], { payeeKind: kindFromUpiId(match[2]) });
  }
  match = /^(?:Paid\s+to|Refund\s+from|Money\s+received\s+from)\s+(.+)$/i.exec(text);
  if (match) {
    const name = match[1].replace(/^M\/s\.?\s*/i, '');
    return result('upi', name.charAt(0).toUpperCase() + name.slice(1));
  }
  return result('other', null);
}
