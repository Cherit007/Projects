import type { SQLiteDatabase } from 'expo-sqlite';

import {
  availableCreditMinor,
  cardBill,
  statementCutoffIso,
  type CardBill,
  type CardFlows,
} from '../../domain/cards/billing';
import type { Account } from '../../domain/types';
import { listAccounts } from '../repositories/accounts';
import { listCardDetails, type CardDetails } from '../repositories/cards';

export interface CardSummary {
  account: Account;
  details: CardDetails | null;
  /** Everything owed on the card now. */
  owedMinor: number;
  availableMinor: number | null;
  /** Null until the statement and due days are set. */
  bill: CardBill | null;
}

export interface CardsOverview {
  cards: CardSummary[];
  totalOwedMinor: number;
  /** Still to pay across cards for statements already generated. */
  totalBilledDueMinor: number;
  totalLimitMinor: number;
}

/** The card's balance changes before `cutoffIso`, and credits and debits from then on. */
async function cardFlows(
  db: SQLiteDatabase,
  account: Account,
  cutoffIso: string,
): Promise<CardFlows> {
  const row = await db.getFirstAsync<{ before: number | null; credits: number | null; debits: number | null }>(
    `SELECT
       SUM(CASE WHEN occurred_at < ? THEN delta ELSE 0 END) AS before,
       SUM(CASE WHEN occurred_at >= ? AND delta > 0 THEN delta ELSE 0 END) AS credits,
       SUM(CASE WHEN occurred_at >= ? AND delta < 0 THEN -delta ELSE 0 END) AS debits
     FROM (
       SELECT occurred_at, CASE type WHEN 'income' THEN amount_minor ELSE -amount_minor END AS delta
       FROM transactions WHERE account_id = ?
       UNION ALL
       SELECT occurred_at, amount_minor FROM transactions WHERE type = 'transfer' AND to_account_id = ?
     )`,
    cutoffIso,
    cutoffIso,
    cutoffIso,
    account.id,
    account.id,
  );
  return {
    openingBalanceMinor: account.openingBalanceMinor,
    beforeStatementMinor: row?.before ?? 0,
    creditsSinceMinor: row?.credits ?? 0,
    debitsSinceMinor: row?.debits ?? 0,
  };
}

const STATUS_ORDER = { overdue: 0, due: 1, paid: 2, nothing: 3 } as const;

/** Every active credit card with what is owed and, where set up, its current bill. Most urgent first. */
export async function loadCardsOverview(db: SQLiteDatabase, now = new Date()): Promise<CardsOverview> {
  const [accounts, allDetails] = await Promise.all([listAccounts(db), listCardDetails(db)]);
  const cards = await Promise.all(
    accounts
      .filter(account => account.type === 'card')
      .map(async (account): Promise<CardSummary> => {
        const details = allDetails.get(account.id) ?? null;
        let bill: CardBill | null = null;
        let owedMinor: number;
        if (details) {
          const flows = await cardFlows(db, account, statementCutoffIso(details.statementDay, now));
          bill = cardBill(details, flows, now);
          owedMinor = bill.owedMinor;
        } else {
          const flows = await cardFlows(db, account, '9999-12-31T00:00:00.000Z');
          owedMinor = Math.max(0, -(flows.openingBalanceMinor + flows.beforeStatementMinor));
        }
        const limit = details?.creditLimitMinor ?? null;
        return {
          account,
          details,
          owedMinor,
          availableMinor: limit === null ? null : availableCreditMinor(limit, owedMinor),
          bill,
        };
      }),
  );

  cards.sort((a, b) => {
    const rank = (c: CardSummary) => (c.bill ? STATUS_ORDER[c.bill.status] : 4);
    return rank(a) - rank(b) || (a.bill?.daysToDue ?? 0) - (b.bill?.daysToDue ?? 0);
  });

  return {
    cards,
    totalOwedMinor: cards.reduce((sum, c) => sum + c.owedMinor, 0),
    totalBilledDueMinor: cards.reduce((sum, c) => sum + (c.bill?.remainingMinor ?? 0), 0),
    totalLimitMinor: cards.reduce((sum, c) => sum + (c.details?.creditLimitMinor ?? 0), 0),
  };
}
