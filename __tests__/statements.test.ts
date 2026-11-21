import type { SQLiteDatabase } from 'expo-sqlite';

import { createTestDb } from '../test-utils/testDb';
import { migrateDbIfNeeded } from '../src/data/local/migrations';
import { createAccount, getAccount, getAccountFlows, listAccounts } from '../src/data/repositories/accounts';
import { accountBalance } from '../src/domain/accounting/accounting';
import { listCategories } from '../src/data/repositories/categories';
import { createTransaction, listTransactions } from '../src/data/repositories/transactions';
import { parseNarration, tidyPayee } from '../src/domain/statements/narration';
import { parseStatement } from '../src/domain/statements/parseStatement';
import { StatementError, type ParsedStatement, type TextItem } from '../src/domain/statements/types';
import {
  applyStatementImport,
  checkStatementBalance,
  matchStatementBalance,
  NEW_ACCOUNT,
  planStatementImport,
  suggestAccount,
} from '../src/services/statements/importStatement';

jest.mock('expo-crypto', () => ({ randomUUID: () => jest.requireActual('node:crypto').randomUUID() }));

/** A text item about as wide as the bank's font makes it (4.4pt a character). */
const t = (s: string, x: number, y: number, w = Math.round(s.length * 4.4)): TextItem => ({ s, x, y, w });

/**
 * Two pages laid out like a MobiKwik wallet statement: amounts sit either next
 * to the sign or on the line below it, a description wraps, a failed payment is
 * refunded, and the last row's amount spills onto page 2.
 */
function mobikwikPages(): TextItem[][] {
  const row = (y: number, date: string, details: string, sign: '+' | '-', amount: string, balance: string, below = false) => [
    t(date, 72, y, 65),
    t(details, 150, y, details.length * 6),
    ...(below
      ? [t(sign, sign === '+' ? 412 : 415, y, sign === '+' ? 7 : 4), t(`Rs. ${amount}`, 346, y - 14, 69)]
      : [t(`${sign} Rs. ${amount}`, 349, y, 70)]),
    t(`Rs. ${balance}`, 449, y, 62),
  ];
  return [
    [
      t('ACCOUNT DETAILS', 418, 800, 90),
      t('8328518201', 437, 790, 70),
      t('Transaction statement for', 87, 785, 230),
      t('2026-08-01 to', 324, 785, 128),
      t('2026-08-31', 87, 780, 103),
      t('Number Of Transactions', 88, 775, 139),
      t('10', 486, 775, 14),
      t('Date', 72, 760, 27),
      t('Transaction Details', 150, 760, 117),
      t('Amount', 368, 760, 47),
      t('Wallet Balance', 431, 760, 90),
      ...row(740, '01-08-2026', 'Add money', '+', '5000.00', '5000.00', true),
      ...row(700, '01-08-2026', 'Paid to Nagoju Cherit Sai', '-', '5000.00', '0.00', true),
      ...row(660, '02-08-2026', 'Add money', '+', '500.00', '500.00'),
      ...row(620, '02-08-2026', 'Paid to Zomato Media Private', '-', '120.00', '380.00'),
      t('Limited', 150, 606, 40),
      ...row(580, '03-08-2026', 'Refund from Ravi Kumar', '+', '200.00', '380.00'),
      ...row(540, '03-08-2026', 'Paid to Ravi Kumar', '-', '200.00', '180.00'),
      ...row(500, '04-08-2026', 'Pocket UPI cashback received', '+', '0.50', '380.50'),
      ...row(460, '05-08-2026', 'Bank transfer to NAGOJU', '-', '300.00', '80.50', true),
      t('CHERIT SAI', 150, 446, 71),
      t('(8328518201@mbkns)', 150, 432, 129),
      t('06-08-2026', 72, 400, 65),
      t('Add money', 150, 400, 64),
      t('+', 412, 400, 7),
      t('Rs. 1080.50', 442, 400, 69),
    ],
    [
      t('Rs. 1000.00', 346, 794, 69),
      ...row(760, '07-08-2026', 'Paid to Swiggy', '-', '1000.00', '80.50'),
      t('NOTE:', 87, 700, 34),
      t('This is a computer generated receipt and does not require physical', 125, 700, 335),
    ],
  ];
}

/** Two pages laid out like an HDFC Bank statement; the salary row continues on page 2. */
function hdfcPages(): TextItem[][] {
  const top = [
    t('MR', 34, 745),
    t('RAVI KUMAR', 58, 745),
    t('Account No : 50100012345678', 340, 687),
    t('From : 01/07/2026', 34, 620),
    t('To : 31/07/2026', 154, 620),
    t('Statement of account', 340, 620),
  ];
  const row = (y: number, date: string, narration: string, amount: string, amountX: number, balance: string) => [
    t(date, 34, y),
    t(narration, 72, y),
    t('0000123456789012', 289, y),
    t(date, 362, y),
    t(amount, amountX, y),
    t(balance, 591, y),
  ];
  return [
    [
      ...top,
      t('Date', 40, 602),
      t('Narration', 144, 602),
      t('Chq./Ref.No.', 284, 602),
      t('Value Dt', 362, 602),
      t('Withdrawal Amt.', 405, 602),
      t('Deposit Amt.', 491, 602),
      t('Closing Balance', 564, 602),
      ...row(584, '01/07/26', 'UPI-SWIGGY-SWIGGY@ICICI-ICIC0000001-1234', '250.00', 452, '9,750.00'),
      t('56789012-PAYMENT', 72, 567),
      ...row(550, '02/07/26', 'UPI-MR RAVI KUMAR', '5,000.00', 438, '4,750.00'),
      t('KUMAR-9876543210@YBL-SBIN0001234-23456', 68, 533, 176),
      t('7890123-SENT USING PAYTM U', 72, 516),
      ...row(499, '03/07/26', 'ATW-512345XXXXXX1234-S1ANHY01-HYDERABAD', '2,000.00', 438, '2,750.00'),
      ...row(482, '25/07/26', 'ACH C- SAL-ACME CORP', '50,000.00', 512, '52,750.00'),
      t('HDFC BANK LIMITED', 28, 50),
    ],
    [
      ...top,
      t('-SALJUL26', 68, 604),
      // Printed in the withdrawal column; the running balance shows it is a credit.
      ...row(587, '31/07/26', 'INTEREST PAID TILL 31-JUL-2026', '12.00', 452, '52,762.00'),
      t('STATEMENT SUMMARY :-', 68, 157),
      t('Opening Balance', 132, 147),
      t('Dr Count', 290, 147),
      t('Cr Count', 361, 147),
      t('Debits', 425, 147),
      t('Credits', 501, 147),
      t('Closing Bal', 572, 147),
      t('10,000.00', 144, 135),
      t('3', 300, 135),
      t('2', 373, 135),
      t('7,250.00', 415, 135),
      t('50,012.00', 493, 135),
      t('52,762.00', 581, 135),
      t('Generated On: 01-Aug-2026 10:00', 83, 77),
    ],
  ];
}

/** Two pages laid out like an SBI statement: each description starts just above its date. */
function sbiPages(): TextItem[][] {
  const row = (y: number, date: string, narration: string, debit: string, credit: string, balance: string) => [
    t(date, 27, y),
    t(date, 82, y),
    t(narration, 138, y, narration.length > 26 ? 127 : narration.length * 4.6),
    t('-', 304, y),
    t(debit, debit === '-' ? 366 : 357, y),
    t(credit, credit === '-' ? 446 : 440, y),
    t(balance, 518, y),
  ];
  return [
    [
      t('Mr. Ravi Kumar', 66, 736),
      t('Account Number', 348, 558),
      t(':', 442, 558),
      t('37887380501', 451, 558),
      t('Statement From', 203, 372),
      t(': 01-07-2026 to 31-07-2026', 285, 372),
      t('State Bank of India', 343, 739),
      t('Balance', 514, 334),
      t('WDL TFR', 138, 304),
      ...row(297, '03/07/2026', 'UPI/DR/165083341846/RAVI', '59.00', '-', '531.34'),
      t('K/HDFC/9876543210/Sent', 138, 286),
      t('0097694162092 AT 12664 UPPAL', 138, 276, 110),
      t('WDL TFR', 138, 263),
      ...row(256, '04/07/2026', 'UPI/DR/777737962922/ASTROTAL', '40.00', '-', '491.34'),
      t('K/YESB/astrotalk@/Pay', 138, 245),
      ...row(226, '25/07/2026', 'INTEREST CREDIT', '-', '3.00', '494.34'),
      t('Page no.', 269, 79),
      t('1', 313, 79),
    ],
    [
      t('Statement Summary', 187, 796),
      t('Brought Forward', 22, 768),
      t('Dr Count', 124, 768),
      t('Cr Count', 179, 768),
      t('Total Debits', 243, 768),
      t('Total Credits', 339, 768),
      t('Closing Balance', 460, 768),
      t('590.34CR', 46, 739),
      t('2', 142, 739),
      t('1', 197, 739),
      t('99.00', 258, 739),
      t('3.00', 359, 739),
      t('494.34CR', 483, 739),
    ],
  ];
}

describe('parseStatement', () => {
  it('reads an HDFC Bank statement, joining wrapped and page-crossing descriptions', () => {
    const statement = parseStatement(hdfcPages());
    expect(statement).toMatchObject({
      bank: 'HDFC Bank',
      holderName: 'Ravi Kumar',
      accountLast4: '5678',
      periodStart: '2026-07-01',
      periodEnd: '2026-07-31',
      openingBalanceMinor: 1_000_000,
      closingBalanceMinor: 5_276_200,
      problems: [],
    });
    expect(statement.rows.map(r => [r.date, r.direction, r.amountMinor])).toEqual([
      ['2026-07-01', 'debit', 25_000],
      ['2026-07-02', 'debit', 500_000],
      ['2026-07-03', 'debit', 200_000],
      ['2026-07-25', 'credit', 5_000_000],
      ['2026-07-31', 'credit', 1_200],
    ]);
    expect(statement.rows[0].narration).toBe('UPI-SWIGGY-SWIGGY@ICICI-ICIC0000001-123456789012-PAYMENT');
    expect(statement.rows[1].narration).toBe('UPI-MR RAVI KUMAR KUMAR-9876543210@YBL-SBIN0001234-234567890123-SENT USING PAYTM U');
    expect(statement.rows[3].narration).toBe('ACH C- SAL-ACME CORP-SALJUL26');
  });

  it('reads an SBI statement, where a description starts above its date', () => {
    const statement = parseStatement(sbiPages());
    expect(statement).toMatchObject({
      bank: 'SBI',
      holderName: 'Ravi Kumar',
      accountLast4: '0501',
      periodStart: '2026-07-01',
      periodEnd: '2026-07-31',
      openingBalanceMinor: 59_034,
      closingBalanceMinor: 49_434,
      problems: [],
    });
    expect(statement.rows.map(r => [r.date, r.direction, r.amountMinor, r.balanceMinor])).toEqual([
      ['2026-07-03', 'debit', 5_900, 53_134],
      ['2026-07-04', 'debit', 4_000, 49_134],
      ['2026-07-25', 'credit', 300, 49_434],
    ]);
    expect(statement.rows[0].narration).toBe(
      'WDL TFR UPI/DR/165083341846/RAVI K/HDFC/9876543210/Sent 0097694162092 AT 12664 UPPAL',
    );
    expect(statement.rows[1].narration).toBe('WDL TFR UPI/DR/777737962922/ASTROTALK/YESB/astrotalk@/Pay');
  });

  it('reads a MobiKwik wallet statement, with amounts below the sign, wrapped text and a page spill', () => {
    const statement = parseStatement(mobikwikPages());
    expect(statement).toMatchObject({
      bank: 'MobiKwik',
      holderName: 'Nagoju Cherit Sai',
      accountLast4: '8201',
      periodStart: '2026-08-01',
      periodEnd: '2026-08-31',
      openingBalanceMinor: 0,
      closingBalanceMinor: 8_050,
      problems: [],
    });
    expect(statement.rows.map(r => [r.date, r.direction, r.amountMinor, r.narration])).toEqual([
      ['2026-08-01', 'credit', 500_000, 'Add money'],
      ['2026-08-01', 'debit', 500_000, 'Paid to Nagoju Cherit Sai'],
      ['2026-08-02', 'credit', 50_000, 'Add money'],
      ['2026-08-02', 'debit', 12_000, 'Paid to Zomato Media Private Limited'],
      ['2026-08-03', 'credit', 20_000, 'Refund from Ravi Kumar'],
      ['2026-08-03', 'debit', 20_000, 'Paid to Ravi Kumar'],
      ['2026-08-04', 'credit', 50, 'Pocket UPI cashback received'],
      ['2026-08-05', 'debit', 30_000, 'Bank transfer to NAGOJU CHERIT SAI (8328518201@mbkns)'],
      ['2026-08-06', 'credit', 100_000, 'Add money'],
      ['2026-08-07', 'debit', 100_000, 'Paid to Swiggy'],
    ]);
  });

  it('reports a MobiKwik statement whose entries are missing or do not add up', () => {
    const pages = mobikwikPages();
    pages[0] = pages[0].filter(item => item.y !== 620 && item.y !== 606);
    expect(parseStatement(pages).problems).toEqual([
      'Read 9 entries; the statement lists 10.',
      'The entries add up to a balance of ₹200.50, which the statement does not show.',
    ]);
  });

  it('reports rows that do not add up with the running balance or the totals', () => {
    const pages = hdfcPages();
    pages[0] = pages[0].map(item => (item.s === '4,750.00' ? { ...item, s: '4,700.00' } : item));
    const { problems } = parseStatement(pages);
    expect(problems).toEqual([expect.stringContaining('do not match the running balance')]);

    const missing = sbiPages();
    missing[0] = missing[0].filter(item => item.y !== 226);
    expect(parseStatement(missing).problems).toEqual([
      'Read 2 debits and 0 credits; the statement lists 2 and 1.',
    ]);
  });

  it('rejects other banks and statements without transactions', () => {
    expect(() => parseStatement([[t('ICICI Bank', 40, 700), t('Withdrawals', 300, 600)]])).toThrow(StatementError);
    expect(() => parseStatement([hdfcPages()[0].filter(item => !/^\d\d\/07\/26$/.test(item.s))])).toThrow(
      'No transactions were found in this statement.',
    );
    expect(() => parseStatement([])).toThrow(StatementError);
  });
});

describe('parseNarration', () => {
  it.each([
    [
      'UPI-KATA SURESH-PAYTMQR6YE97N@PTYS-YESB0PTMUPI-620781503748-SENT USING PAYTM U',
      { channel: 'upi', payee: 'Kata Suresh', payeeKind: 'merchant', reference: '620781503748', otherBank: 'YESB' },
    ],
    [
      'UPI-MR CHERIT SAI-9876543210@YBL-SBIN0001234-234567890123-SENT',
      { channel: 'upi', payee: 'Cherit Sai', payeeKind: 'person', otherBank: 'SBIN' },
    ],
    [
      'WDL TFR UPI/DR/618570093802/Miss ADI/UNBA/bharatpe.9/Pay 0097695162091 AT 12664 UPPAL',
      { channel: 'upi', payee: 'Adi', payeeKind: 'merchant', reference: '618570093802', otherBank: 'UNBA' },
    ],
    [
      'WDL TFR UPI/DR/618572117379/MOHD AYU/YESB/paytm.s1yk/Sent',
      { channel: 'upi', payee: 'Mohd Ayu', payeeKind: 'merchant' },
    ],
    [
      'DEP TFR UPI/CR/559958355247/NAGOJU C/HDFC/8328518201/Paym',
      { channel: 'upi', payee: 'Nagoju C', payeeKind: 'person', otherBank: 'HDFC' },
    ],
    ['ACH D- LICHOUSINGFINANCELTD-700601000285', { channel: 'ach', payee: 'Lic Housing Finance Ltd', salary: false }],
    ['ACH C-SAL-THWORKSTECHINDPV-SALARYJULY46', { channel: 'ach', payee: 'Thworks Tech Ind Pv', salary: true }],
    ['ATW-435584XXXXXX8976-P3FNHY85-HYDERABAD', { channel: 'atm', payee: 'Cash withdrawal' }],
    ['Add money', { channel: 'topup', payee: 'Wallet top-up' }],
    ['Pocket UPI cashback received', { channel: 'cashback', payee: 'Cashback' }],
    ['Paid to M/s.healife Health Care Private Limited', { channel: 'upi', payee: 'Healife Health Care Private Limited' }],
    ['Refund from Vangala Saivikas', { channel: 'upi', payee: 'Vangala Saivikas' }],
    ['Money received from Zepto', { channel: 'upi', payee: 'Zepto' }],
    [
      'Bank transfer to NAGOJU CHERIT SAI (8328518201@mbkns)',
      { channel: 'upi', payee: 'Nagoju Cherit Sai', payeeKind: 'person' },
    ],
    ['IMPS-627356554578-DREAMPLUG TECHNOLOGIES PRIVATE LIMITED-YESB-XX6201', {
      channel: 'imps',
      payee: 'Dreamplug Technologies Private Limited',
      reference: '627356554578',
    }],
    ['DEP TFR IMPS/627319003578/IDF-XX678-IDFC FIR/IMPSTXN', { channel: 'imps', payee: 'Idfc Fir' }],
    ['NEFT CR-ICIC0000104-ACME SOFTWARE PVT LTD-NETBANK-N123456', { channel: 'neft', payee: 'Acme Software Pvt Ltd', otherBank: 'ICIC' }],
    ['POS 416021XXXXXX1234 AMAZON PAY INDIA POS DEBIT', { channel: 'card', payee: 'Amazon Pay India', payeeKind: 'merchant' }],
    ['INTEREST PAID TILL 30-SEP-2026', { channel: 'interest', payee: 'Interest' }],
    ['ACH CHARGES TO TRANSFERINB E mandate SBIN7023009261117020000', { channel: 'charges', payee: 'Bank charges' }],
    ['CEMTEX DEP ACHCr SBIN01680000014926 NHPC LIMITED', { channel: 'ach', payee: 'Nhpc Limited' }],
    ['DIRECT DR 0038237361558 OFMr. Nagoju Cherit Sai AT 12664 UPPAL', { channel: 'other', payee: 'Direct debit' }],
    ['BY CASH DEPOSIT', { channel: 'cash', payee: 'Cash deposit' }],
    ['SOMETHING UNUSUAL 12345', { channel: 'other', payee: null }],
  ])('%s', (narration, expected) => {
    expect(parseNarration(narration)).toMatchObject(expected);
  });

  it('tidies payee names without breaking ordinary words', () => {
    expect(tidyPayee('MR SRIRAM ANAND KUM')).toBe('Sriram Anand Kum');
    expect(tidyPayee('AYODHYAMEDICALGENERA')).toBe('Ayodhya Medical Genera');
    expect(tidyPayee('TECHNOLOGIES')).toBe('Technologies');
    expect(tidyPayee('SMARTPHONES')).toBe('Smartphones');
    expect(tidyPayee('CRED Club')).toBe('CRED Club');
    expect(tidyPayee('  - ')).toBeNull();
    expect(tidyPayee('12345')).toBeNull();
  });
});

async function setup(): Promise<SQLiteDatabase> {
  const db = createTestDb();
  await migrateDbIfNeeded(db);
  return db;
}

async function ids(db: SQLiteDatabase) {
  const accounts = await listAccounts(db);
  const byName = (name: string) => accounts.find(a => a.name === name)!.id;
  return { accounts, byName };
}

async function categoryName(db: SQLiteDatabase, id: string | null) {
  return (await listCategories(db)).find(c => c.id === id)?.name ?? null;
}

describe('statement import', () => {
  let db: SQLiteDatabase;
  let hdfc: ParsedStatement;
  let hdfcId: string;
  let sbiId: string;

  beforeEach(async () => {
    db = await setup();
    hdfcId = await createAccount(db, { name: 'HDFC Savings', type: 'bank', openingBalanceMinor: 0 });
    sbiId = await createAccount(db, { name: 'SBI', type: 'bank', openingBalanceMinor: 0 });
    hdfc = parseStatement(hdfcPages());
  });

  it('suggests the account named after the bank', async () => {
    const { accounts } = await ids(db);
    expect(suggestAccount(accounts, hdfc)?.id).toBe(hdfcId);
    expect(suggestAccount(accounts, parseStatement(sbiPages()))?.id).toBe(sbiId);
    expect(suggestAccount(accounts.filter(a => a.id !== hdfcId), hdfc)).toBeNull();
  });

  it('plans categories, own transfers, cash withdrawals and salary', async () => {
    const { byName } = await ids(db);
    const plan = await planStatementImport(db, hdfc, hdfcId);
    const [swiggy, own, atm, salary, interest] = plan.rows;
    expect(await categoryName(db, swiggy.input.categoryId)).toBe('Food and dining');
    expect(swiggy).toMatchObject({ label: 'Food and dining', reference: '123456789012', existing: null });
    expect(own.input).toMatchObject({ type: 'transfer', accountId: hdfcId, toAccountId: sbiId });
    expect(own.label).toBe('To SBI');
    expect(atm.input).toMatchObject({ type: 'transfer', toAccountId: byName('Cash') });
    expect(salary).toMatchObject({ label: 'Salary', input: { type: 'income', counterparty: 'Acme Corp' } });
    expect(interest).toMatchObject({ label: 'Interest', input: { type: 'income' } });
    expect(new Date(swiggy.input.occurredAt).getHours()).toBe(12);
  });

  it('records an own transfer to an account not in the app as spending, and pays the only card', async () => {
    db = await setup();
    const only = await createAccount(db, { name: 'HDFC', type: 'bank', openingBalanceMinor: 0 });
    const card = await createAccount(db, { name: 'Amex', type: 'card', openingBalanceMinor: 0 });
    const pages = hdfcPages();
    pages[0] = pages[0].map(item =>
      item.s.startsWith('UPI-SWIGGY') ? { ...item, s: 'UPI-CRED CLUB-CRED.CLUB@AXISB-UTIB0000114-' } : item,
    );
    const plan = await planStatementImport(db, parseStatement(pages), only);
    expect(plan.rows[0].input).toMatchObject({ type: 'transfer', accountId: only, toAccountId: card });
    expect(plan.rows[1]).toMatchObject({ label: 'To your other account', input: { type: 'expense' } });
    expect(await categoryName(db, plan.rows[1].input.categoryId)).toBe('Other');
  });

  it('adds the rows once, matches the balance, and adds nothing when imported again', async () => {
    const plan = await planStatementImport(db, hdfc, hdfcId);
    expect(await applyStatementImport(db, plan)).toEqual({ accountId: hdfcId, added: 5, moved: 0 });
    const check = await checkStatementBalance(db, hdfcId, hdfc);
    expect(check).toEqual({ appMinor: 5_276_200 - 1_000_000, statementMinor: 5_276_200 });
    await matchStatementBalance(db, hdfcId, check!);
    expect((await getAccount(db, hdfcId))?.openingBalanceMinor).toBe(1_000_000);
    expect(await checkStatementBalance(db, hdfcId, hdfc)).toEqual({ appMinor: 5_276_200, statementMinor: 5_276_200 });

    const again = await planStatementImport(db, hdfc, hdfcId);
    expect(again.rows.every(row => row.existing?.accountId === hdfcId)).toBe(true);
    expect(await applyStatementImport(db, again)).toEqual({ accountId: hdfcId, added: 0, moved: 0 });
    expect(again.notOnStatement).toBe(0);
    const statementRows = (await listTransactions(db)).filter(tx => tx.source === 'statement');
    expect(statementRows).toHaveLength(5);
  });

  it('recognises the other side of a transfer already imported from the other bank', async () => {
    await applyStatementImport(db, await planStatementImport(db, hdfc, hdfcId));
    const pages = sbiPages();
    pages[0] = pages[0].map(item => {
      if (item.s === 'UPI/DR/165083341846/RAVI') return { ...item, s: 'UPI/CR/165083341846/RAVI' };
      if (item.s === '03/07/2026') return { ...item, s: '02/07/2026' };
      if (item.s === '59.00') return { ...item, s: '5,000.00', x: 440 };
      if (item.s === '531.34') return { ...item, s: '5,590.34' };
      return item;
    });
    const sbi = parseStatement(pages);
    expect(sbi.rows[0]).toMatchObject({ direction: 'credit', amountMinor: 500_000 });
    const plan = await planStatementImport(db, sbi, sbiId);
    expect(plan.rows[0].existing).not.toBeNull();
    expect(plan.rows[1]).toMatchObject({ input: { type: 'expense', counterparty: 'Astrotalk' }, existing: null });
    expect(await applyStatementImport(db, plan)).toMatchObject({ added: 2, moved: 0 });
    expect((await listTransactions(db)).filter(tx => tx.type === 'transfer' && tx.amountMinor === 500_000)).toHaveLength(1);
  });

  it('turns an own transfer imported as spending into a transfer when the other bank is imported later', async () => {
    db = await setup();
    const hdfcOnly = await createAccount(db, { name: 'HDFC Savings', type: 'bank', openingBalanceMinor: 0 });
    await applyStatementImport(db, await planStatementImport(db, hdfc, hdfcOnly));
    const ownSpend = (await listTransactions(db)).find(tx => tx.amountMinor === 500_000);
    expect(ownSpend).toMatchObject({ type: 'expense', accountId: hdfcOnly });
    const hdfcBefore = await checkStatementBalance(db, hdfcOnly, hdfc);

    const pages = sbiPages();
    pages[0] = pages[0].map(item => {
      if (item.s === 'UPI/DR/165083341846/RAVI') return { ...item, s: 'UPI/CR/165083341846/RAVI' };
      if (item.s === '03/07/2026') return { ...item, s: '02/07/2026' };
      if (item.s === '59.00') return { ...item, s: '5,000.00', x: 440 };
      if (item.s === '531.34') return { ...item, s: '5,590.34' };
      return item;
    });
    const plan = await planStatementImport(db, parseStatement(pages), NEW_ACCOUNT);
    expect(plan.rows[0].existing).toEqual({ id: ownSpend!.id, accountId: hdfcOnly, becomesTransfer: true });
    const result = await applyStatementImport(db, plan);
    expect(result).toMatchObject({ added: plan.rows.length - 1, moved: 1 });

    const all = await listTransactions(db);
    const fiveK = all.filter(tx => tx.amountMinor === 500_000);
    expect(fiveK).toHaveLength(1);
    expect(fiveK[0]).toMatchObject({ type: 'transfer', accountId: hdfcOnly, toAccountId: result.accountId, categoryId: null });
    // HDFC's balance is unchanged: the money still left HDFC, now into SBI instead of being spent.
    expect(await checkStatementBalance(db, hdfcOnly, hdfc)).toEqual(hdfcBefore);
  });

  it('imports a MobiKwik statement into a new wallet without counting bank-side transfers twice', async () => {
    db = await setup();
    const hdfcOnly = await createAccount(db, { name: 'HDFC Bank', type: 'bank', openingBalanceMinor: 0 });
    // The only card is taken to fund top-ups, with MobiKwik's ~3% fee estimated.
    const card = await createAccount(db, { name: 'Credit cards', type: 'card', openingBalanceMinor: 0 });
    const other = (await listCategories(db)).find(c => c.name === 'Other income')!.id;
    const bankSide = (amountMinor: number, day: number, counterparty: string) =>
      createTransaction(
        db,
        {
          type: 'income',
          amountMinor,
          occurredAt: new Date(2026, 7, day, 12).toISOString(),
          accountId: hdfcOnly,
          toAccountId: null,
          categoryId: other,
          counterparty,
          note: null,
        },
        { source: 'statement', externalReference: null },
      );
    const fromSelf = await bankSide(500_000, 1, 'Nagoju Cherit Sai');
    const fromWallet = await bankSide(30_000, 5, 'Mobikwik');
    const wallet = parseStatement(mobikwikPages());

    const plan = await planStatementImport(db, wallet, NEW_ACCOUNT);
    expect(plan.accountName).toBe('MobiKwik');
    const byText = (text: string) => plan.rows.filter(r => r.row.narration.startsWith(text));
    expect(byText('Paid to Nagoju')[0].existing).toEqual({ id: fromSelf, accountId: hdfcOnly, becomesTransfer: true });
    expect(byText('Bank transfer')[0].existing).toEqual({ id: fromWallet, accountId: hdfcOnly, becomesTransfer: true });
    expect([...byText('Paid to Ravi'), ...byText('Refund from Ravi')].map(r => [r.reversed, r.existing])).toEqual([
      [true, null],
      [true, null],
    ]);
    expect(byText('Add money').map(r => r.label)).toEqual([
      'From Credit cards + ₹149.85 fee (estimated)',
      'From Credit cards + ₹14.99 fee (estimated)',
      'From Credit cards + ₹29.97 fee (estimated)',
    ]);
    expect(byText('Pocket UPI')[0].label).toBe('Cashback');
    expect(byText('Paid to Swiggy')[0].input).toMatchObject({ type: 'expense', counterparty: 'Swiggy' });

    const skipped = new Set(plan.rows.filter(r => r.reversed).map(r => r.index));
    const result = await applyStatementImport(db, plan, skipped);
    expect(result).toMatchObject({ added: 6, moved: 2 });
    expect(await getAccount(db, result.accountId)).toMatchObject({ name: 'MobiKwik', type: 'wallet', openingBalanceMinor: 0 });
    expect(await checkStatementBalance(db, result.accountId, wallet)).toEqual({ appMinor: 8_050, statementMinor: 8_050 });

    const all = await listTransactions(db);
    expect(all.filter(tx => tx.type === 'transfer').map(tx => [tx.amountMinor, tx.accountId, tx.toAccountId])).toEqual(
      expect.arrayContaining([
        [500_000, result.accountId, hdfcOnly],
        [30_000, result.accountId, hdfcOnly],
      ]),
    );
    expect(all.filter(tx => tx.accountId === hdfcOnly && tx.type === 'income')).toEqual([]);
    // Card owes the three top-ups plus their fees.
    const fees = all.filter(tx => tx.accountId === card && tx.type === 'expense');
    expect(fees.map(f => [f.amountMinor, f.counterparty, f.categoryName])).toEqual(
      expect.arrayContaining([[14_985, 'MobiKwik top-up fee (estimated)', 'Loan interest and fees']]),
    );
    const cardFlows = (await getAccountFlows(db)).get(card)!;
    expect(accountBalance({ openingBalanceMinor: 0 }, cardFlows)).toBe(-(650_000 + 14_985 + 1_499 + 2_997));

    const again = await planStatementImport(db, wallet, result.accountId);
    expect(again.rows.filter(r => !r.existing && !r.reversed)).toEqual([]);
    expect(again.rows.filter(r => r.fee)).toEqual([]);
  });

  it('turns a card charge for a top-up into the transfer plus its real fee', async () => {
    db = await setup();
    await createAccount(db, { name: 'HDFC Bank', type: 'bank', openingBalanceMinor: 0 });
    const cardA = await createAccount(db, { name: 'Axis 0171', type: 'card', openingBalanceMinor: 0 });
    await createAccount(db, { name: 'ICICI 4005', type: 'card', openingBalanceMinor: 0 });
    const charge = await createTransaction(
      db,
      {
        type: 'expense',
        amountMinor: 51_500,
        occurredAt: new Date(2026, 7, 2, 21).toISOString(),
        accountId: cardA,
        toAccountId: null,
        categoryId: null,
        counterparty: null,
        note: null,
      },
      { source: 'bank_sms', externalReference: null },
    );
    const wallet = parseStatement(mobikwikPages());
    const plan = await planStatementImport(db, wallet, NEW_ACCOUNT);
    const topUps = plan.rows.filter(r => r.row.narration === 'Add money');
    expect(topUps[1]).toMatchObject({
      label: 'From Axis 0171 + ₹15.00 fee',
      existing: { id: charge, accountId: cardA, becomesTransfer: true },
      fee: { amountMinor: 1_500, accountId: cardA, estimated: false },
    });
    // Two cards and no charge to go by: the other top-ups stay unknown.
    expect(topUps[0]).toMatchObject({ label: 'Top-up from an account not in the app', fee: null });

    const result = await applyStatementImport(db, plan, new Set(plan.rows.filter(r => r.reversed).map(r => r.index)));
    const all = await listTransactions(db);
    expect(all.find(tx => tx.id === charge)).toMatchObject({
      type: 'transfer',
      amountMinor: 50_000,
      accountId: cardA,
      toAccountId: result.accountId,
    });
    expect(all.filter(tx => tx.accountId === cardA && tx.type === 'expense').map(tx => tx.amountMinor)).toEqual([1_500]);
    expect(await checkStatementBalance(db, result.accountId, wallet)).toEqual({ appMinor: 8_050, statementMinor: 8_050 });

    const again = await planStatementImport(db, wallet, result.accountId);
    expect(again.rows.filter(r => r.fee)).toEqual([]);
  });

  it('moves payments detected into Cash (before any bank account existed) to the imported account', async () => {
    const swiggyDay = new Date(2026, 6, 1, 20, 15).toISOString();
    const food = (await listCategories(db)).find(c => c.name === 'Food and dining')!.id;
    const cashId = (await ids(db)).byName('Cash');
    const detected = await createTransaction(
      db,
      { type: 'expense', amountMinor: 25_000, occurredAt: swiggyDay, accountId: cashId, toAccountId: null, categoryId: food, counterparty: 'SWIGGY', note: null },
      { source: 'bank_sms', externalReference: null },
    );
    const plan = await planStatementImport(db, hdfc, hdfcId);
    expect(plan.rows[0].existing).toEqual({ id: detected, accountId: cashId, becomesTransfer: false });
    expect(await applyStatementImport(db, plan)).toMatchObject({ added: 4, moved: 1 });
    const swiggy = (await listTransactions(db)).filter(tx => tx.amountMinor === 25_000);
    expect(swiggy).toHaveLength(1);
    expect(swiggy[0].accountId).toBe(hdfcId);
  });

  it('matches payments already in the app and moves detected ones from another account', async () => {
    const swiggyDay = new Date(2026, 6, 1, 20, 15).toISOString();
    const food = (await listCategories(db)).find(c => c.name === 'Food and dining')!.id;
    const detected = await createTransaction(
      db,
      { type: 'expense', amountMinor: 25_000, occurredAt: swiggyDay, accountId: sbiId, toAccountId: null, categoryId: food, counterparty: 'Swiggy', note: null },
      { source: 'upi_notification', externalReference: '123456789012' },
    );
    const manualCash = await createTransaction(db, {
      type: 'expense',
      amountMinor: 200_000,
      occurredAt: new Date(2026, 6, 3, 9).toISOString(),
      accountId: (await ids(db)).byName('Cash'),
      toAccountId: null,
      categoryId: food,
      counterparty: null,
      note: null,
    });
    const plan = await planStatementImport(db, hdfc, hdfcId);
    expect(plan.rows[0].existing).toEqual({ id: detected, accountId: sbiId, becomesTransfer: false });
    expect(plan.rows[2].existing).toBeNull();
    expect(await applyStatementImport(db, plan)).toMatchObject({ added: 4, moved: 1 });
    const moved = (await listTransactions(db)).find(tx => tx.id === detected);
    expect(moved?.accountId).toBe(hdfcId);
    expect((await listTransactions(db)).find(tx => tx.id === manualCash)?.accountId).not.toBe(hdfcId);
  });

  it('does not let an existing transfer stand in for an ATM withdrawal of the same amount', async () => {
    await createTransaction(db, {
      type: 'transfer',
      amountMinor: 200_000,
      occurredAt: new Date(2026, 6, 4, 12).toISOString(),
      accountId: hdfcId,
      toAccountId: sbiId,
      categoryId: null,
      counterparty: 'Ravi Kumar',
      note: null,
    });
    const plan = await planStatementImport(db, hdfc, hdfcId);
    expect(plan.rows[2]).toMatchObject({ label: 'To Cash', existing: null });
    expect(plan.notOnStatement).toBe(1);
  });

  it('skips rows the user leaves out and can start a new account at the opening balance', async () => {
    const plan = await planStatementImport(db, hdfc, NEW_ACCOUNT);
    expect(plan.accountName).toBe('HDFC Bank');
    const result = await applyStatementImport(db, plan, new Set([4]));
    expect(result.added).toBe(4);
    const account = await getAccount(db, result.accountId);
    expect(account).toMatchObject({ name: 'HDFC Bank', type: 'bank', openingBalanceMinor: 1_000_000 });
    const check = await checkStatementBalance(db, result.accountId, hdfc);
    expect(check).toEqual({ appMinor: 5_276_200 - 1_200, statementMinor: 5_276_200 });
    const own = (await listTransactions(db)).find(tx => tx.type === 'transfer' && tx.amountMinor === 500_000);
    expect(own).toMatchObject({ accountId: result.accountId, toAccountId: sbiId });
  });
});
