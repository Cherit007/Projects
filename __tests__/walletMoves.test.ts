import type { SQLiteDatabase } from 'expo-sqlite';

import { createTestDb } from '../test-utils/testDb';
import { migrateDbIfNeeded } from '../src/data/local/migrations';
import { createAccount, getAccountFlows, listAccounts } from '../src/data/repositories/accounts';
import { setOwnerName } from '../src/data/repositories/settings';
import { listTransactions } from '../src/data/repositories/transactions';
import { getCandidate, insertCandidate } from '../src/data/repositories/upiCandidates';
import { accountBalance } from '../src/domain/accounting/accounting';
import { parseBankSms } from '../src/domain/upi/bankSms';
import { autoAddCandidates } from '../src/services/upi/autoAdd';
import { splitTopUpCharge } from '../src/services/upi/walletMoves';

jest.mock('expo-crypto', () => ({ randomUUID: () => jest.requireActual('node:crypto').randomUUID() }));

const T0 = Date.parse('2026-11-14T15:54:27.000Z');

/** The messages of one card → MobiKwik → HDFC savings round trip, as the user receives them. */
const CARD_CHARGE =
  'Spent Rs.5149.86 On HDFC Bank Card 4885 At MOBIKWIK On 2026-11-14:21:24:20 Not You? To Block+Reissue Call 18002586161/SMS BLOCK CC 4885 to 7308080808';
const WALLET_ADDED = 'Rs.5000.00 added to your MobiKwik wallet. Updated balance Rs.5000.50';
const WALLET_SENT = 'Rs.5000.00 debited from your MobiKwik wallet. Updated balance Rs.0.50';
const BANK_CREDIT = 'Rs.5000.00 credited to HDFC Bank A/c XX1234 on 14-11-26 by VPA 8328518201@mbkns (UPI Ref No 631812345678)';

async function setup(): Promise<SQLiteDatabase> {
  const db = createTestDb();
  await migrateDbIfNeeded(db);
  await createAccount(db, { name: 'HDFC Bank', type: 'bank', openingBalanceMinor: 0 });
  await createAccount(db, { name: 'SBI', type: 'bank', openingBalanceMinor: 0 });
  await createAccount(db, { name: 'MobiKwik', type: 'wallet', openingBalanceMinor: 0 });
  await createAccount(db, { name: 'Credit cards', type: 'card', openingBalanceMinor: 0 });
  await setOwnerName(db, 'Nagoju Cherit Sai');
  return db;
}

async function receive(db: SQLiteDatabase, text: string, secondsLater: number) {
  const parsed = parseBankSms(text, T0 + secondsLater * 1000);
  if (!parsed) {
    throw new Error(`not parsed: ${text}`);
  }
  const id = await insertCandidate(db, parsed);
  await autoAddCandidates(db, [id!]);
  return id!;
}

async function balances(db: SQLiteDatabase) {
  const [accounts, flows] = await Promise.all([listAccounts(db), getAccountFlows(db)]);
  return Object.fromEntries(accounts.map(a => [a.name, accountBalance(a, flows.get(a.id))]));
}

async function expenses(db: SQLiteDatabase) {
  return (await listTransactions(db, { type: 'expense', limit: 50 })).map(t => [t.accountName, t.amountMinor]);
}

describe('splitTopUpCharge', () => {
  it('separates the fee from what reached the wallet', () => {
    expect(splitTopUpCharge(514_986)).toEqual({ topUpMinor: 500_000, feeMinor: 14_986 });
    expect(splitTopUpCharge(205_994)).toEqual({ topUpMinor: 200_000, feeMinor: 5_994 });
    expect(splitTopUpCharge(1_029_972)).toEqual({ topUpMinor: 1_000_000, feeMinor: 29_972 });
    // Not a fee-shaped amount: taken whole.
    expect(splitTopUpCharge(123_45)).toEqual({ topUpMinor: 123_45, feeMinor: 0 });
  });
});

describe('card → MobiKwik → bank round trip from SMS', () => {
  it('reads the HDFC card message as a card charge at MobiKwik', () => {
    expect(parseBankSms(CARD_CHARGE, T0)).toMatchObject({
      card: true,
      accountLast4: '4885',
      counterparty: 'MOBIKWIK',
      sourceApp: 'HDFC Bank SMS',
      direction: 'debit',
      amountMinor: 514_986,
    });
  });

  it.each([
    ['card, wallet debit, bank credit', [CARD_CHARGE, WALLET_SENT, BANK_CREDIT]],
    ['bank credit first', [BANK_CREDIT, CARD_CHARGE, WALLET_SENT]],
    ['wallet messages too, in any order', [WALLET_ADDED, CARD_CHARGE, BANK_CREDIT, WALLET_SENT]],
  ])('leaves only the fee as spending (%s)', async (_, messages) => {
    const db = await setup();
    const ids: string[] = [];
    for (const [i, text] of messages.entries()) {
      ids.push(await receive(db, text, i * 8));
    }
    expect(await expenses(db)).toEqual([['Credit cards', 14_986]]);
    expect(await balances(db)).toMatchObject({
      'Credit cards': -514_986,
      MobiKwik: 0,
      'HDFC Bank': 500_000,
      SBI: 0,
    });
    for (const id of ids) {
      expect((await getCandidate(db, id))?.reviewState).toBe('confirmed');
    }
    expect((await listTransactions(db, { type: 'income', limit: 10 })).length).toBe(0);
  });

  it('keeps a real wallet payment to a shop as spending', async () => {
    const db = await setup();
    await receive(db, 'Rs.250.00 paid from your MobiKwik wallet to Swiggy', 0);
    expect(await expenses(db)).toEqual([['MobiKwik', 25_000]]);
  });
});
