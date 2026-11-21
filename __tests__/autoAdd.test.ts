import type { SQLiteDatabase } from 'expo-sqlite';

import { createTestDb } from '../test-utils/testDb';
import { migrateDbIfNeeded } from '../src/data/local/migrations';
import { createAccount, listAccounts } from '../src/data/repositories/accounts';
import { listCategories, setCategoryArchived } from '../src/data/repositories/categories';
import { listPeople, movePerson } from '../src/data/repositories/people';
import { setAutoAddPayments, setOwnerName } from '../src/data/repositories/settings';
import { createTransaction, listTransactions, updateTransaction } from '../src/data/repositories/transactions';
import { getCandidate, insertCandidate, listWaitingCandidateIds } from '../src/data/repositories/upiCandidates';
import { parseBankSms } from '../src/domain/upi/bankSms';
import { autoAddCandidates } from '../src/services/upi/autoAdd';

jest.mock('expo-crypto', () => ({ randomUUID: () => jest.requireActual('node:crypto').randomUUID() }));

const NOW = Date.parse('2026-10-15T10:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;
let ref = 529100000000;

/** A bank SMS like HDFC sends; each gets a new reference so it is not deduplicated. */
function sms(to: string, amount: string, { credit = false, at = NOW, extra = '' } = {}): string {
  ref += 1;
  return credit
    ? `Rs.${amount} credited to HDFC Bank A/c XX1234 from VPA ${to} on 15-10-26 UPI ${ref}${extra}`
    : `Sent Rs.${amount} From HDFC Bank A/C *1234 To ${to} On 15/10/26 Ref ${ref}${extra} Not You? Call 18002586161`;
}

async function setup(accounts: ('bank' | 'cash' | 'wallet')[] = ['bank'], names: string[] = []): Promise<SQLiteDatabase> {
  const db = createTestDb();
  await migrateDbIfNeeded(db);
  for (const [i, type] of accounts.entries()) {
    await createAccount(db, { name: names[i] ?? `${type} ${i}`, type, openingBalanceMinor: 0 });
  }
  return db;
}

/** Parses, stores and auto-adds one message; returns its candidate id. */
async function receive(db: SQLiteDatabase, text: string, at = NOW): Promise<string> {
  const parsed = parseBankSms(text, at);
  if (!parsed) {
    throw new Error(`not parsed: ${text}`);
  }
  const id = await insertCandidate(db, parsed);
  if (!id) {
    throw new Error(`duplicate: ${text}`);
  }
  await autoAddCandidates(db, [id]);
  return id;
}

async function added(db: SQLiteDatabase, candidateId: string) {
  const candidate = await getCandidate(db, candidateId);
  if (!candidate?.transactionId) {
    return null;
  }
  const [transaction] = (await listTransactions(db, { limit: 500 })).filter(t => t.id === candidate.transactionId);
  return transaction;
}

async function categoryOf(db: SQLiteDatabase, candidateId: string): Promise<string | null> {
  return (await added(db, candidateId))?.categoryName ?? null;
}

async function categoryId(db: SQLiteDatabase, name: string, type: 'expense' | 'income'): Promise<string> {
  const category = (await listCategories(db)).find(c => c.name === name && c.type === type);
  if (!category) {
    throw new Error(`no category ${name}`);
  }
  return category.id;
}

describe('migrations', () => {
  it('create every default category once, including the newer ones', async () => {
    const db = await setup();
    await migrateDbIfNeeded(db);
    const names = (await listCategories(db)).map(c => `${c.type}:${c.name}`);
    expect(new Set(names).size).toBe(names.length);
    for (const name of ['expense:Friends', 'income:Friends', 'income:Family', 'expense:Investments', 'expense:Donations']) {
      expect(names).toContain(name);
    }
  });
});

describe('autoAddCandidates', () => {
  it('adds shops, people and unclear payees with a category', async () => {
    const db = await setup();
    expect(await categoryOf(db, await receive(db, sms('BALAJI MEDICAL HALL', '120.00')))).toBe('Healthcare');
    expect(await categoryOf(db, await receive(db, sms('RAHUL SHARMA', '2000.00')))).toBe('Friends');
    expect(await categoryOf(db, await receive(db, sms('SRI LAKSHMI ENTERPRISES', '999.00')))).toBe('Other');
    expect(await categoryOf(db, await receive(db, sms('ZERODHA BROKING', '5000.00')))).toBe('Investments');
  });

  it('files money received from people under Friends and from others under Other income', async () => {
    const db = await setup();
    expect(await categoryOf(db, await receive(db, sms('rahul.sharma@okaxis', '500.00', { credit: true })))).toBe('Friends');
    expect(await categoryOf(db, await receive(db, sms('razorpay@icici', '501.00', { credit: true })))).toBe('Other income');
  });

  it('uses the account the payment came from, never cash', async () => {
    const db = await setup(['cash', 'bank']);
    const transaction = await added(db, await receive(db, sms('SWIGGY', '250.00')));
    expect(transaction?.accountName).toBe('bank 1');
  });

  it('leaves failed payments, requests and messages without an amount for review', async () => {
    const db = await setup();
    for (const text of [
      `Rs.250.00 debit from A/c XX1234 to SWIGGY failed. Ref ${(ref += 1)}`,
      `RAHUL SHARMA has requested money Rs.500 from you on Google Pay. Ref ${(ref += 1)}`,
    ]) {
      const parsed = parseBankSms(text, NOW);
      if (!parsed) {
        continue;
      }
      const id = await insertCandidate(db, parsed);
      if (id) {
        await autoAddCandidates(db, [id]);
        expect(await added(db, id)).toBeNull();
      }
    }
    expect(await listTransactions(db, { limit: 10 })).toEqual([]);
  });

  it('does not add a payment already entered by hand (possible duplicate)', async () => {
    const db = await setup();
    const account = (await listAccounts(db)).find(a => a.type !== 'cash')!;
    await createTransaction(db, {
      type: 'expense',
      amountMinor: 25000,
      occurredAt: new Date(NOW - 10 * 60 * 1000).toISOString(),
      accountId: account.id,
      toAccountId: null,
      categoryId: await categoryId(db, 'Food and dining', 'expense'),
      counterparty: 'Lunch',
      note: null,
    });
    const id = await receive(db, sms('SWIGGY', '250.00'));
    expect(await added(db, id)).toBeNull();
    expect(await listWaitingCandidateIds(db)).toEqual([id]);
  });

  it('ignores the same message twice and never adds a candidate twice', async () => {
    const db = await setup();
    const text = sms('SWIGGY', '250.00');
    const id = await receive(db, text);
    expect(await insertCandidate(db, parseBankSms(text, NOW)!)).toBeNull();
    await autoAddCandidates(db, [id, id]);
    expect(await listTransactions(db, { limit: 10 })).toHaveLength(1);
  });

  it('does nothing when turned off', async () => {
    const db = await setup();
    await setAutoAddPayments(db, false);
    expect(await added(db, await receive(db, sms('SWIGGY', '250.00')))).toBeNull();
  });

  it('falls back to the Cash account when there is no bank account', async () => {
    const db = await setup([]);
    expect((await added(db, await receive(db, sms('SWIGGY', '251.00'))))?.accountName).toBe('Cash');
  });

  it('leaves the payment for review when its category is archived', async () => {
    const db = await setup();
    await setCategoryArchived(db, await categoryId(db, 'Other', 'expense'), true);
    expect(await added(db, await receive(db, sms('SRI LAKSHMI ENTERPRISES', '999.00')))).toBeNull();
  });

  it('adds waiting payments on a later sync', async () => {
    const db = await setup();
    await setAutoAddPayments(db, false);
    const id = await receive(db, sms('SWIGGY', '250.00'));
    expect(await added(db, id)).toBeNull();
    await setAutoAddPayments(db, true);
    await autoAddCandidates(db, await listWaitingCandidateIds(db));
    expect(await categoryOf(db, id)).toBe('Food and dining');
  });
});

describe('message hints', () => {
  it('P2M keeps a person-like shop name out of Friends; P2A puts a shop-like name in Friends', async () => {
    const db = await setup();
    const p2m = await receive(db, `Rs.150.00 debited from A/c XX1234 on 15-10-26 UPI/P2M/${(ref += 1)}/NANDINI. Not you? Call 1800`);
    expect(await categoryOf(db, p2m)).not.toBe('Friends');
    const p2a = await receive(db, `Rs.170.00 debited from A/c XX1234 on 15-10-26 UPI/P2A/${(ref += 1)}/KUMAR PETROLEUM. Not you? Call 1800`);
    expect(await categoryOf(db, p2a)).toBe('Friends');
  });
});

describe('payee history', () => {
  it('reuses the category the payee had last, ignoring case and spaces', async () => {
    const db = await setup();
    const first = await receive(db, sms('SRI LAKSHMI ENTERPRISES', '999.00'));
    const transaction = (await added(db, first))!;
    await updateTransaction(db, transaction.id, {
      type: 'expense',
      amountMinor: transaction.amountMinor,
      occurredAt: transaction.occurredAt,
      accountId: transaction.accountId,
      toAccountId: null,
      categoryId: await categoryId(db, 'Shopping', 'expense'),
      counterparty: transaction.counterparty,
      note: null,
    });
    expect(await categoryOf(db, await receive(db, sms('Sri Lakshmi Enterprises', '450.00')))).toBe('Shopping');
  });

  it('learns from two payees ending in the same word', async () => {
    const db = await setup();
    const shopping = await categoryId(db, 'Shopping', 'expense');
    for (const [name, amount] of [
      ['SHARMA ENTERPRISES', '311.00'],
      ['GUPTA ENTERPRISES', '312.00'],
    ]) {
      const transaction = (await added(db, await receive(db, sms(name, amount))))!;
      await updateTransaction(db, transaction.id, { ...transaction, toAccountId: null, categoryId: shopping, note: null });
    }
    expect(await categoryOf(db, await receive(db, sms('AGARWAL ENTERPRISES', '313.00')))).toBe('Shopping');
    expect(await categoryOf(db, await receive(db, sms('AGARWAL ENTERPRISES', '314.00', { credit: true })))).toBe('Other income');
  });
});

describe('own transfers', () => {
  it('records payments to and from the user as transfers to their other account', async () => {
    const db = await setup(['bank', 'bank', 'cash'], ['HDFC Bank', 'SBI']);
    await setOwnerName(db, '  Cherit Reddy ');
    const out = (await added(db, await receive(db, sms('MR CHERIT REDDY', '5000.00'))))!;
    expect(out).toMatchObject({ type: 'transfer', accountName: 'HDFC Bank', toAccountName: 'SBI', categoryId: null });
    const back = (await added(db, await receive(db, sms('cherit.reddy@okaxis', '1500.00', { credit: true }))))!;
    expect(back).toMatchObject({ type: 'transfer', accountName: 'SBI', toAccountName: 'HDFC Bank' });
  });

  it('waits for review when the other account is unclear, and ignores other people with the same surname', async () => {
    const one = await setup(['bank']);
    await setOwnerName(one, 'Cherit Reddy');
    expect(await added(one, await receive(one, sms('CHERIT REDDY', '5000.00')))).toBeNull();
    expect(await categoryOf(one, await receive(one, sms('RAMANA REDDY', '700.00')))).toBe('Friends');

    const three = await setup(['bank', 'bank', 'wallet']);
    await setOwnerName(three, 'Cherit Reddy');
    expect(await added(three, await receive(three, sms('CHERIT REDDY', '5001.00')))).toBeNull();
  });

  it('does nothing special without a name set', async () => {
    const db = await setup(['bank', 'bank'], ['HDFC Bank']);
    expect(await categoryOf(db, await receive(db, sms('CHERIT REDDY', '5000.00')))).toBe('Friends');
  });
});

describe('monthly rent', () => {
  async function priorPayment(db: SQLiteDatabase, payee: string, amountMinor: number, daysAgo: number) {
    const account = (await listAccounts(db)).find(a => a.type !== 'cash')!;
    return createTransaction(db, {
      type: 'expense',
      amountMinor,
      occurredAt: new Date(NOW - daysAgo * DAY).toISOString(),
      accountId: account.id,
      toAccountId: null,
      categoryId: await categoryId(db, 'Friends', 'expense'),
      counterparty: payee,
      note: null,
    });
  }

  it('files a repeat of last month\'s amount to a person as rent', async () => {
    const db = await setup();
    await priorPayment(db, 'RAMESH KUMAR', 1_500_000, 30);
    expect(await categoryOf(db, await receive(db, sms('Ramesh Kumar', '15200.00')))).toBe('Rent and housing');
  });

  it.each([
    ['too recent', 1_500_000, 10, '15000.00'],
    ['too long ago', 1_500_000, 50, '15000.00'],
    ['different amount', 1_500_000, 30, '17000.00'],
    ['small amount', 200_000, 30, '2000.00'],
  ])('keeps Friends when the earlier payment is %s', async (_, prior, daysAgo, amount) => {
    const db = await setup();
    await priorPayment(db, 'RAMESH KUMAR', prior, daysAgo);
    expect(await categoryOf(db, await receive(db, sms('RAMESH KUMAR', amount)))).toBe('Friends');
  });

  it('respects the user keeping Friends after editing', async () => {
    const db = await setup();
    const id = await priorPayment(db, 'RAMESH KUMAR', 1_500_000, 30);
    await new Promise(resolve => setTimeout(resolve, 5));
    const [prior] = (await listTransactions(db, { limit: 10 })).filter(t => t.id === id);
    await updateTransaction(db, id, { ...prior, toAccountId: null, note: 'friend, not rent' });
    expect(await categoryOf(db, await receive(db, sms('RAMESH KUMAR', '15000.00')))).toBe('Friends');
  });
});

describe('people', () => {
  it('lists people with totals, groups name variants and moves them to Family and back', async () => {
    const db = await setup(['bank', 'bank'], ['HDFC Bank']);
    await receive(db, sms('RAHUL SHARMA', '2000.00'));
    await receive(db, sms('Rahul Sharma ', '300.00', { credit: true }));
    await receive(db, sms('SWIGGY', '250.00'));

    let [rahul, ...others] = await listPeople(db);
    expect(others).toEqual([]);
    expect(rahul).toMatchObject({ sentMinor: 200_000, receivedMinor: 30_000, count: 2, family: false });

    await movePerson(db, 'rahul sharma', 'family');
    [rahul] = await listPeople(db);
    expect(rahul.family).toBe(true);
    const categories = (await listTransactions(db, { counterparty: ' RAHUL SHARMA ', limit: 10 })).map(t => t.categoryName);
    expect(categories.sort()).toEqual(['Family', 'Family']);

    expect(await categoryOf(db, await receive(db, sms('RAHUL SHARMA', '700.00')))).toBe('Family');

    await movePerson(db, 'RAHUL SHARMA', 'friends');
    [rahul] = await listPeople(db);
    expect(rahul.family).toBe(false);
  });

  it('leaves income in Friends when there is no Family income category', async () => {
    const db = await setup();
    await setCategoryArchived(db, await categoryId(db, 'Family', 'income'), true);
    await receive(db, sms('RAHUL SHARMA', '300.00', { credit: true }));
    await movePerson(db, 'RAHUL SHARMA', 'family');
    const [transaction] = await listTransactions(db, { counterparty: 'RAHUL SHARMA', limit: 10 });
    expect(transaction.categoryName).toBe('Friends');
  });
});
