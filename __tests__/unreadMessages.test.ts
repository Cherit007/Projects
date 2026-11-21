import { createTestDb } from '../test-utils/testDb';
import { migrateDbIfNeeded } from '../src/data/local/migrations';
import {
  countUnreadMessages,
  deleteUnreadMessage,
  listUnreadMessages,
  purgeUnreadMessages,
  saveUnreadMessage,
} from '../src/data/repositories/unreadMessages';
import { BACKUP_TABLES } from '../src/domain/backup';
import { SYNCED_TABLES } from '../src/data/local/migrations';

jest.mock('expo-crypto', () => ({ randomUUID: () => jest.requireActual('node:crypto').randomUUID() }));

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-11-14T16:00:00.000Z');

describe('unread bank messages', () => {
  it('keeps them with their amount, newest first, and lets the user drop one', async () => {
    const db = createTestDb();
    await migrateDbIfNeeded(db);
    await saveUnreadMessage(db, 'Txn of INR 1,250.50 on your a/c XX0501 at ZEPTO', NOW.getTime() - 2 * DAY);
    await saveUnreadMessage(db, 'Your a/c was charged Rs 75 for UPI LITE', NOW.getTime() - DAY);
    const list = await listUnreadMessages(db);
    expect(list.map(m => m.amountMinor)).toEqual([7_500, 125_050]);
    expect(await countUnreadMessages(db)).toBe(2);
    await deleteUnreadMessage(db, list[0].id);
    expect(await countUnreadMessages(db)).toBe(1);
  });

  it('deletes them after seven days', async () => {
    const db = createTestDb();
    await migrateDbIfNeeded(db);
    await saveUnreadMessage(db, 'old Rs 10 debited', NOW.getTime() - 8 * DAY);
    await saveUnreadMessage(db, 'recent Rs 20 debited', NOW.getTime() - 6 * DAY);
    await purgeUnreadMessages(db, NOW);
    expect((await listUnreadMessages(db)).map(m => m.text)).toEqual(['recent Rs 20 debited']);
  });

  it('are never backed up or synced', () => {
    expect(BACKUP_TABLES as readonly string[]).not.toContain('unread_messages');
    expect(SYNCED_TABLES as readonly string[]).not.toContain('unread_messages');
  });
});
