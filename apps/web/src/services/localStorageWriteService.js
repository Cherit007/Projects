import { webStorage } from '../platform/storage';

const DEFAULT_FLUSH_DELAY_MS = import.meta.env.MODE === 'test' ? 0 : 220;
const pendingWrites = new Map();
let flushTimer = null;
let listenersAttached = false;

const flushWrites = () => {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (pendingWrites.size === 0) return;

  const entries = Array.from(pendingWrites.entries());
  pendingWrites.clear();

  entries.forEach(([key, value]) => {
    if (value == null) {
      webStorage.removeItem(key);
    } else {
      webStorage.setItem(key, value);
    }
  });
};

const attachFlushListeners = () => {
  if (typeof window === 'undefined' || listenersAttached) return;
  listenersAttached = true;

  window.addEventListener('beforeunload', flushWrites);
  window.addEventListener('pagehide', flushWrites);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      flushWrites();
    }
  });
};

const scheduleFlush = (delayMs = DEFAULT_FLUSH_DELAY_MS) => {
  if (typeof window === 'undefined') return;
  attachFlushListeners();
  const delay = Math.max(0, Number(delayMs) || 0);
  if (delay === 0) {
    flushWrites();
    return;
  }
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flushWrites();
  }, delay);
};

export const queueLocalStorageValue = (key, value, options = {}) => {
  const normalizedKey = String(key || '').trim();
  if (!normalizedKey) return;

  if (value == null) {
    pendingWrites.set(normalizedKey, null);
  } else {
    pendingWrites.set(normalizedKey, String(value));
  }
  scheduleFlush(options.delayMs);
};

export const queueLocalStorageJson = (key, value, options = {}) => {
  try {
    queueLocalStorageValue(key, JSON.stringify(value), options);
  } catch {
    // Ignore serialization errors.
  }
};

export const flushQueuedLocalStorageWrites = () => {
  flushWrites();
};

export const resetLocalStorageWriteQueue = () => {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  pendingWrites.clear();
};
