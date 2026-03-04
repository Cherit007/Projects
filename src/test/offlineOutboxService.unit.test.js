import { beforeEach, describe, expect, it, vi } from 'vitest';
import { offlineOutboxService } from '../services/offlineOutboxService';

describe('offlineOutboxService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('deduplicates queued actions by dedupeKey and keeps only latest payload', () => {
    const first = offlineOutboxService.enqueue({
      action: 'tournament.patchMatches',
      payload: { matchId: 'm1', score1: 21 },
      dedupeKey: 'match:m1',
    });

    const second = offlineOutboxService.enqueue({
      action: 'tournament.patchMatches',
      payload: { matchId: 'm1', score1: 22 },
      dedupeKey: 'match:m1',
    });

    const items = offlineOutboxService.list();
    expect(first).toBeTruthy();
    expect(second).toBeTruthy();
    expect(items).toHaveLength(1);
    expect(items[0].payload).toEqual({ matchId: 'm1', score1: 22 });
    expect(items[0].attempts).toBe(0);
  });

  it('flush stops on likely offline error and preserves remaining queue', async () => {
    offlineOutboxService.enqueue({
      action: 'tournament.save',
      payload: { id: 't1' },
    });
    offlineOutboxService.enqueue({
      action: 'ratings.save',
      payload: { id: 'r1' },
    });

    const executor = vi.fn(async () => {
      throw new Error('Network offline while syncing');
    });

    const summary = await offlineOutboxService.flush(executor);

    expect(executor).toHaveBeenCalledTimes(1);
    expect(summary).toEqual({
      initialCount: 2,
      flushedCount: 0,
      failedCount: 1,
      remainingCount: 2,
    });
    expect(offlineOutboxService.getCount()).toBe(2);
  });

  it('flush removes successful entries and reports accurate counters', async () => {
    offlineOutboxService.enqueue({
      action: 'meta.members',
      payload: { members: [] },
    });
    offlineOutboxService.enqueue({
      action: 'casual.create',
      payload: { id: 'c1' },
    });

    const executor = vi.fn(async () => {});
    const summary = await offlineOutboxService.flush(executor);

    expect(executor).toHaveBeenCalledTimes(2);
    expect(summary).toEqual({
      initialCount: 2,
      flushedCount: 2,
      failedCount: 0,
      remainingCount: 0,
    });
    expect(offlineOutboxService.getCount()).toBe(0);
  });
});
