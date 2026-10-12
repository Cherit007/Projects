import type { SQLiteDatabase } from 'expo-sqlite';

import {
  dedupeKey,
  initialReviewState,
  type ParsedUpiNotification,
  type ReviewState,
  type UpiDirection,
  type UpiStatus,
} from '../../domain/upi/parser';
import type { TransactionInput } from '../../domain/types';
import { newId, nowIso } from '../local/ids';
import { createTransaction } from './transactions';

export interface UpiCandidate {
  id: string;
  packageName: string;
  sourceApp: string;
  status: UpiStatus;
  direction: UpiDirection | null;
  amountMinor: number | null;
  counterparty: string | null;
  reference: string | null;
  detectedAt: string;
  reviewState: ReviewState;
  transactionId: string | null;
}

interface CandidateRow {
  id: string;
  package_name: string;
  source_app: string;
  status: UpiStatus;
  direction: UpiDirection | null;
  amount_minor: number | null;
  counterparty: string | null;
  reference: string | null;
  detected_at: string;
  review_state: ReviewState;
  transaction_id: string | null;
}

function toCandidate(row: CandidateRow): UpiCandidate {
  return {
    id: row.id,
    packageName: row.package_name,
    sourceApp: row.source_app,
    status: row.status,
    direction: row.direction,
    amountMinor: row.amount_minor,
    counterparty: row.counterparty,
    reference: row.reference,
    detectedAt: row.detected_at,
    reviewState: row.review_state,
    transactionId: row.transaction_id,
  };
}

/** Returns false when the notification duplicates an existing candidate. */
export async function insertCandidate(
  db: SQLiteDatabase,
  parsed: ParsedUpiNotification,
): Promise<boolean> {
  const now = nowIso();
  const result = await db.runAsync(
    `INSERT OR IGNORE INTO upi_candidates
       (id, package_name, source_app, status, direction, amount_minor,
        counterparty, reference, detected_at, dedupe_key, review_state,
        created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    newId(),
    parsed.packageName,
    parsed.sourceApp,
    parsed.status,
    parsed.direction,
    parsed.amountMinor,
    parsed.counterparty,
    parsed.reference,
    new Date(parsed.postedAt).toISOString(),
    dedupeKey(parsed),
    initialReviewState(parsed),
    now,
    now,
  );
  return result.changes > 0;
}

export async function listCandidates(
  db: SQLiteDatabase,
  states: readonly ReviewState[],
): Promise<UpiCandidate[]> {
  const rows = await db.getAllAsync<CandidateRow>(
    `SELECT * FROM upi_candidates
     WHERE review_state IN (${states.map(() => '?').join(', ')})
     ORDER BY detected_at DESC
     LIMIT 200`,
    [...states],
  );
  return rows.map(toCandidate);
}

export async function countPendingCandidates(db: SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) AS count FROM upi_candidates WHERE review_state = 'needs_review'",
  );
  return row?.count ?? 0;
}

export async function getCandidate(
  db: SQLiteDatabase,
  id: string,
): Promise<UpiCandidate | null> {
  const row = await db.getFirstAsync<CandidateRow>(
    'SELECT * FROM upi_candidates WHERE id = ?',
    id,
  );
  return row ? toCandidate(row) : null;
}

export async function setCandidateState(
  db: SQLiteDatabase,
  id: string,
  state: Exclude<ReviewState, 'confirmed'>,
): Promise<void> {
  await db.runAsync(
    'UPDATE upi_candidates SET review_state = ?, updated_at = ? WHERE id = ?',
    state,
    nowIso(),
    id,
  );
}

/**
 * Creates the transaction and marks the candidate confirmed atomically, so a
 * candidate can never produce two transactions.
 */
export async function confirmCandidate(
  db: SQLiteDatabase,
  candidate: UpiCandidate,
  input: TransactionInput,
): Promise<string> {
  let transactionId = '';
  await db.withTransactionAsync(async () => {
    const current = await getCandidate(db, candidate.id);
    if (current?.reviewState === 'confirmed') {
      throw new Error('This payment has already been added.');
    }
    transactionId = await createTransaction(db, input, {
      source: 'upi_notification',
      externalReference: candidate.reference,
    });
    await db.runAsync(
      `UPDATE upi_candidates
       SET review_state = 'confirmed', transaction_id = ?, updated_at = ?
       WHERE id = ?`,
      transactionId,
      nowIso(),
      candidate.id,
    );
  });
  return transactionId;
}

/**
 * Looks for an existing transaction that may already record this payment,
 * e.g. one entered manually: same amount and direction within 30 minutes.
 */
export async function findPossibleDuplicate(
  db: SQLiteDatabase,
  candidate: UpiCandidate,
): Promise<{ id: string; counterparty: string | null; occurredAt: string } | null> {
  if (candidate.amountMinor === null || candidate.direction === null) {
    return null;
  }
  const detected = Date.parse(candidate.detectedAt);
  const window = 30 * 60 * 1000;
  return db.getFirstAsync<{ id: string; counterparty: string | null; occurredAt: string }>(
    `SELECT id, counterparty, occurred_at AS occurredAt FROM transactions
     WHERE amount_minor = ? AND type = ?
       AND occurred_at BETWEEN ? AND ?
       AND (external_reference IS NULL OR ? IS NULL OR external_reference = ?)
     LIMIT 1`,
    candidate.amountMinor,
    candidate.direction === 'credit' ? 'income' : 'expense',
    new Date(detected - window).toISOString(),
    new Date(detected + window).toISOString(),
    candidate.reference,
    candidate.reference,
  );
}
