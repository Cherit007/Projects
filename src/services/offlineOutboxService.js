const OUTBOX_STORAGE_KEY = 'bfm:offline-outbox:v1';
const OUTBOX_EVENT_NAME = 'bfm:outbox-changed';
const OUTBOX_MAX_ITEMS = 200;
export const OUTBOX_SYNC_TAG = 'bfm-outbox-sync';

const isBrowser = () => typeof window !== 'undefined';

const safeParse = (value, fallback) => {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const normalizeQueue = (value) => {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => item && typeof item === 'object' && typeof item.action === 'string');
};

const emitOutboxChanged = (count) => {
  if (!isBrowser()) return;
  window.dispatchEvent(new CustomEvent(OUTBOX_EVENT_NAME, {
    detail: { count: Number(count) || 0 },
  }));
};

const readQueue = () => {
  if (!isBrowser()) return [];
  const raw = window.localStorage.getItem(OUTBOX_STORAGE_KEY);
  return normalizeQueue(safeParse(raw, []));
};

const writeQueue = (queue) => {
  if (!isBrowser()) return;
  window.localStorage.setItem(OUTBOX_STORAGE_KEY, JSON.stringify(normalizeQueue(queue)));
  emitOutboxChanged(normalizeQueue(queue).length);
};

const makeId = () => `outbox-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

export const isLikelyOfflineError = (error) => {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  const code = Number(error?.code ?? NaN);
  if (Number.isFinite(code) && code === 0) return true;
  const name = String(error?.name || '').toLowerCase();
  const message = String(error?.message || error || '').toLowerCase();
  return (
    name.includes('network')
    || message.includes('network')
    || message.includes('offline')
    || message.includes('failed to fetch')
    || message.includes('load failed')
    || message.includes('internet')
    || message.includes('connection')
    || message.includes('timeout')
  );
};

export const registerOutboxBackgroundSync = async () => {
  if (!isBrowser() || !('serviceWorker' in navigator)) return false;
  try {
    const registration = await navigator.serviceWorker.getRegistration(import.meta.env.BASE_URL);
    if (!registration || !('sync' in registration) || !registration.sync?.register) {
      return false;
    }
    await registration.sync.register(OUTBOX_SYNC_TAG);
    return true;
  } catch {
    return false;
  }
};

export const offlineOutboxService = {
  getCount() {
    return readQueue().length;
  },

  list() {
    return readQueue();
  },

  clear() {
    writeQueue([]);
  },

  enqueue({ action, payload, dedupeKey = '' }) {
    const normalizedAction = String(action || '').trim();
    if (!normalizedAction) return null;

    const normalizedDedupe = String(dedupeKey || '').trim();
    const now = new Date().toISOString();
    const queue = readQueue();

    if (normalizedDedupe) {
      const existingIndex = queue.findIndex((item) => String(item?.dedupeKey || '').trim() === normalizedDedupe);
      if (existingIndex >= 0) {
        const existing = queue[existingIndex];
        queue[existingIndex] = {
          ...existing,
          payload,
          updatedAt: now,
          attempts: 0,
          lastError: '',
        };
        writeQueue(queue);
        void registerOutboxBackgroundSync();
        return queue[existingIndex];
      }
    }

    const next = {
      id: makeId(),
      action: normalizedAction,
      payload,
      dedupeKey: normalizedDedupe,
      attempts: 0,
      lastError: '',
      createdAt: now,
      updatedAt: now,
    };

    const nextQueue = [...queue, next];
    const trimmedQueue = nextQueue.slice(Math.max(0, nextQueue.length - OUTBOX_MAX_ITEMS));
    writeQueue(trimmedQueue);
    void registerOutboxBackgroundSync();
    return next;
  },

  async flush(executor) {
    if (typeof executor !== 'function') {
      return {
        initialCount: 0,
        flushedCount: 0,
        failedCount: 0,
        remainingCount: this.getCount(),
      };
    }

    const initialQueue = readQueue();
    if (initialQueue.length === 0) {
      return {
        initialCount: 0,
        flushedCount: 0,
        failedCount: 0,
        remainingCount: 0,
      };
    }

    const queue = [...initialQueue];
    let flushedCount = 0;
    let failedCount = 0;

    for (let index = 0; index < queue.length;) {
      const entry = queue[index];
      try {
        await executor(entry);
        queue.splice(index, 1);
        flushedCount += 1;
      } catch (error) {
        failedCount += 1;
        queue[index] = {
          ...entry,
          attempts: Number(entry?.attempts || 0) + 1,
          lastError: String(error?.message || error || 'Unknown outbox error'),
          updatedAt: new Date().toISOString(),
        };
        if (isLikelyOfflineError(error)) {
          break;
        }
        index += 1;
      }
    }

    writeQueue(queue);
    return {
      initialCount: initialQueue.length,
      flushedCount,
      failedCount,
      remainingCount: queue.length,
    };
  },
};
