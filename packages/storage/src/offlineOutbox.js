const OUTBOX_MAX_ITEMS = 200;

const normalizeQueue = (value) => {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => item && typeof item === 'object' && typeof item.action === 'string');
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

/**
 * @param {{ getJson: (key: string, fallback?: unknown) => Promise<unknown>, setJson: (key: string, value: unknown) => Promise<void> }} storage
 * @param {{ storageKey: string, onChange?: (count: number) => void }} options
 */
export const createOfflineOutboxService = (storage, { storageKey, onChange = () => {} } = {}) => {
  if (!storageKey) {
    throw new Error('createOfflineOutboxService requires storageKey');
  }

  const readQueue = async () => {
    const raw = await storage.getJson(storageKey, []);
    return normalizeQueue(raw);
  };

  const writeQueue = async (queue) => {
    const normalized = normalizeQueue(queue);
    await storage.setJson(storageKey, normalized);
    onChange(normalized.length);
  };

  return {
    async getCount() {
      return (await readQueue()).length;
    },

    async list() {
      return readQueue();
    },

    async clear() {
      await writeQueue([]);
    },

    async enqueue({ action, payload, dedupeKey = '' }) {
      const normalizedAction = String(action || '').trim();
      if (!normalizedAction) return null;

      const normalizedDedupe = String(dedupeKey || '').trim();
      const now = new Date().toISOString();
      const queue = await readQueue();

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
          await writeQueue(queue);
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
      await writeQueue(trimmedQueue);
      return next;
    },

    async flush(executor) {
      if (typeof executor !== 'function') {
        const remainingCount = await this.getCount();
        return {
          initialCount: 0,
          flushedCount: 0,
          failedCount: 0,
          remainingCount,
        };
      }

      const initialQueue = await readQueue();
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

      await writeQueue(queue);
      return {
        initialCount: initialQueue.length,
        flushedCount,
        failedCount,
        remainingCount: queue.length,
      };
    },
  };
};
