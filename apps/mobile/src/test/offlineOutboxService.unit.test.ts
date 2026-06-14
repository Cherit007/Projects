import { describe, expect, it, vi } from 'vitest';
import { createOfflineOutboxService, isLikelyOfflineError } from '@fixture-maker/storage/offlineOutbox';

describe('offlineOutbox (native adapter)', () => {
  it('detects likely offline errors', () => {
    expect(isLikelyOfflineError(new Error('Network request failed'))).toBe(true);
    expect(isLikelyOfflineError(new Error('Validation failed'))).toBe(false);
  });

  it('dedupes and flushes queued actions', async () => {
    const store = new Map<string, string>();
    const storage = {
      async getJson(key: string, fallback: unknown) {
        const raw = store.get(key);
        return raw ? JSON.parse(raw) : fallback;
      },
      async setJson(key: string, value: unknown) {
        store.set(key, JSON.stringify(value));
      },
    };

    const outbox = createOfflineOutboxService(storage, { storageKey: 'test-outbox' });
    await outbox.enqueue({
      action: 'tournament.sync',
      payload: { tournamentId: 't1' },
      dedupeKey: 'sync:t1',
    });
    await outbox.enqueue({
      action: 'tournament.sync',
      payload: { tournamentId: 't1', fixtures: [] },
      dedupeKey: 'sync:t1',
    });

    expect(await outbox.getCount()).toBe(1);

    const executor = vi.fn(async () => {});
    const summary = await outbox.flush(executor);
    expect(summary.flushedCount).toBe(1);
    expect(executor).toHaveBeenCalledTimes(1);
    expect(await outbox.getCount()).toBe(0);
  });
});
