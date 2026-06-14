import { createOfflineOutboxService } from '@fixture-maker/storage/offlineOutbox';
import { nativeStorage, STORAGE_KEYS } from '@fixture-maker/storage/native';

export { isLikelyOfflineError } from '@fixture-maker/storage/offlineOutbox';

type OutboxListener = (count: number) => void;

const listeners = new Set<OutboxListener>();

export const subscribeOutboxCount = (listener: OutboxListener) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const offlineOutboxService = createOfflineOutboxService(
  nativeStorage as {
    getJson: (key: string, fallback?: unknown) => Promise<unknown>;
    setJson: (key: string, value: unknown) => Promise<void>;
  },
  {
  storageKey: STORAGE_KEYS.OFFLINE_OUTBOX,
  onChange: (count) => {
    listeners.forEach((listener) => listener(count));
  },
});
