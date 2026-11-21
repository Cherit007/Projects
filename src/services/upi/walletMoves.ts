import type { SQLiteDatabase } from 'expo-sqlite';

import { nowIso } from '../../data/local/ids';
import { accountIsAtBank } from '../../domain/statements/banks';
import type { Account } from '../../domain/types';

/** MobiKwik charges about 3% (2.997%) to add money from a credit card. */
export const WALLET_TOP_UP_FEE = 0.02997;
/** Messages about the two sides of one move between the user's accounts arrive within this time. */
const PAIR_WINDOW_MS = 45 * 60 * 1000;

export function isWalletName(name: string | null | undefined): boolean {
  return !!name && accountIsAtBank(name, 'MOBK');
}

/**
 * Splits a card charge for a wallet top-up into what reached the wallet and
 * the fee: ₹5,149.86 is ₹5,000 plus ₹149.86. Charges that do not fit the fee
 * are taken whole.
 */
export function splitTopUpCharge(chargeMinor: number): { topUpMinor: number; feeMinor: number } {
  const topUpMinor = Math.round(chargeMinor / (1 + WALLET_TOP_UP_FEE) / 100) * 100;
  const expected = Math.round(topUpMinor * (1 + WALLET_TOP_UP_FEE));
  // Card charges come within a few paise of the fee: ₹5,149.86 for ₹5,000, ₹10,299.72 for ₹10,000.
  if (topUpMinor > 0 && topUpMinor < chargeMinor && Math.abs(expected - chargeMinor) <= 5) {
    return { topUpMinor, feeMinor: chargeMinor - topUpMinor };
  }
  return { topUpMinor: chargeMinor, feeMinor: 0 };
}

/** A wallet's "money added" message saved before the card's message about the same top-up. */
export async function findWalletCredit(
  db: SQLiteDatabase,
  walletId: string,
  amountMinor: number,
  at: string,
): Promise<string | null> {
  const time = Date.parse(at);
  const row = await db.getFirstAsync<{ id: string }>(
    `SELECT id FROM transactions
     WHERE type = 'income' AND source = 'bank_sms' AND account_id = ? AND amount_minor = ? AND occurred_at BETWEEN ? AND ?`,
    walletId,
    amountMinor,
    new Date(time - PAIR_WINDOW_MS).toISOString(),
    new Date(time + PAIR_WINDOW_MS).toISOString(),
  );
  return row?.id ?? null;
}

interface Row {
  id: string;
  account_id: string;
  counterparty: string | null;
}

/**
 * Money sent from a wallet to the user's bank account shows up as two
 * messages: the wallet's debit and the bank's credit, in either order. When
 * one of them is already saved, this finds it so the second message completes
 * a transfer instead of adding spending or income:
 * - a credit into a bank account looks for a wallet debit of the same amount
 *   (or a transfer from the wallet already into this account);
 * - a debit from a wallet looks for a bank credit of the same amount
 *   (or a transfer out of this wallet already).
 * Returns the transaction to link, after turning it into the transfer.
 */
export async function pairWalletMove(
  db: SQLiteDatabase,
  account: Account,
  direction: 'debit' | 'credit',
  amountMinor: number,
  at: string,
  accounts: readonly Account[],
  /** Whether a payee on the other message could be the user (blank, their own name, or the wallet). */
  isSelf: (payee: string | null) => boolean,
): Promise<string | null> {
  const time = Date.parse(at);
  const from = new Date(time - PAIR_WINDOW_MS).toISOString();
  const to = new Date(time + PAIR_WINDOW_MS).toISOString();
  const wallets = accounts.filter(a => a.type === 'wallet' && isWalletName(a.name)).map(a => a.id);
  const banks = accounts.filter(a => a.type === 'bank').map(a => a.id);
  if (wallets.length === 0 || banks.length === 0) {
    return null;
  }
  const marks = (ids: string[]) => ids.map(() => '?').join(', ');

  if (direction === 'credit' && account.type === 'bank') {
    const done = await db.getFirstAsync<Row>(
      `SELECT id, account_id, counterparty FROM transactions
       WHERE type = 'transfer' AND to_account_id = ? AND amount_minor = ? AND occurred_at BETWEEN ? AND ?
         AND account_id IN (${marks(wallets)})`,
      account.id,
      amountMinor,
      from,
      to,
      ...wallets,
    );
    if (done) {
      return done.id;
    }
    const spent = (
      await db.getAllAsync<Row>(
        `SELECT id, account_id, counterparty FROM transactions
         WHERE type = 'expense' AND source = 'bank_sms' AND amount_minor = ? AND occurred_at BETWEEN ? AND ?
           AND account_id IN (${marks(wallets)})
         ORDER BY occurred_at DESC`,
        amountMinor,
        from,
        to,
        ...wallets,
      )
    ).find(row => isSelf(row.counterparty));
    if (spent) {
      await db.runAsync(
        `UPDATE transactions SET type = 'transfer', to_account_id = ?, category_id = NULL, updated_at = ? WHERE id = ?`,
        account.id,
        nowIso(),
        spent.id,
      );
      return spent.id;
    }
    return null;
  }

  // The wallet's own "money added" message for a top-up already saved from the card's message.
  if (direction === 'credit' && wallets.includes(account.id)) {
    const done = await db.getFirstAsync<Row>(
      `SELECT id, account_id, counterparty FROM transactions
       WHERE type = 'transfer' AND to_account_id = ? AND amount_minor = ? AND occurred_at BETWEEN ? AND ?`,
      account.id,
      amountMinor,
      from,
      to,
    );
    return done?.id ?? null;
  }

  if (direction === 'debit' && wallets.includes(account.id)) {
    const done = await db.getFirstAsync<Row>(
      `SELECT id, account_id, counterparty FROM transactions
       WHERE type = 'transfer' AND account_id = ? AND amount_minor = ? AND occurred_at BETWEEN ? AND ?
         AND to_account_id IN (${marks(banks)})`,
      account.id,
      amountMinor,
      from,
      to,
      ...banks,
    );
    if (done) {
      return done.id;
    }
    const received = (
      await db.getAllAsync<Row>(
        `SELECT id, account_id, counterparty FROM transactions
         WHERE type = 'income' AND source = 'bank_sms' AND amount_minor = ? AND occurred_at BETWEEN ? AND ?
           AND account_id IN (${marks(banks)})
         ORDER BY occurred_at DESC`,
        amountMinor,
        from,
        to,
        ...banks,
      )
    ).find(row => isSelf(row.counterparty));
    if (received) {
      await db.runAsync(
        `UPDATE transactions SET type = 'transfer', account_id = ?, to_account_id = ?, category_id = NULL, updated_at = ?
         WHERE id = ?`,
        account.id,
        received.account_id,
        nowIso(),
        received.id,
      );
      return received.id;
    }
  }
  return null;
}
