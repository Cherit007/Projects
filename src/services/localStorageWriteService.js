const isBrowser = () => (
  typeof window !== 'undefined'
  && typeof window.localStorage !== 'undefined'
);

const DEFAULT_FLUSH_DELAY_MS = 220;
const pendingWrites = new Map();
let flushTimer = null;
let listenersAttached = false;

const flushWrites = () => {
  if (!isBrowser()) return;
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (pendingWrites.size === 0) return;

  const entries = Array.from(pendingWrites.entries());
  pendingWrites.clear();

  entries.forEach(([key, value]) => {
    try {
      if (value == null) {
        window.localStorage.removeItem(key);
      } else {
        window.localStorage.setItem(key, value);
      }
    } catch {
      // Ignore quota/private mode errors to avoid blocking UI updates.
    }
  });
};

const attachFlushListeners = () => {
  if (!isBrowser() || listenersAttached) return;
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
  if (!isBrowser()) return;
  attachFlushListeners();
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flushWrites();
  }, Math.max(0, Number(delayMs) || 0));
};

export const queueLocalStorageValue = (key, value, options = {}) => {
  if (!isBrowser()) return;
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
