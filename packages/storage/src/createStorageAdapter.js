const canUseStorage = (storage) => (
  storage != null
  && typeof storage.getItem === 'function'
);

export const createStorageAdapter = ({
  storage,
  legacyKeyMap = {},
}) => {
  const migrateLegacyValue = (canonicalKey) => {
    const legacyKey = legacyKeyMap[canonicalKey];
    if (!legacyKey || !canUseStorage(storage)) return null;

    try {
      const legacyValue = storage.getItem(legacyKey);
      if (legacyValue === null) return null;
      storage.setItem(canonicalKey, legacyValue);
      storage.removeItem(legacyKey);
      return legacyValue;
    } catch {
      return null;
    }
  };

  const getItem = (key) => {
    const canonicalKey = String(key || '').trim();
    if (!canonicalKey || !canUseStorage(storage)) return null;

    try {
      const value = storage.getItem(canonicalKey);
      if (value !== null) return value;
      return migrateLegacyValue(canonicalKey);
    } catch {
      return null;
    }
  };

  const setItem = (key, value) => {
    const canonicalKey = String(key || '').trim();
    if (!canonicalKey || !canUseStorage(storage)) return;

    try {
      storage.setItem(canonicalKey, String(value));
      const legacyKey = legacyKeyMap[canonicalKey];
      if (legacyKey) {
        storage.removeItem(legacyKey);
      }
    } catch {
      // Ignore quota/private mode errors.
    }
  };

  const removeItem = (key) => {
    const canonicalKey = String(key || '').trim();
    if (!canonicalKey || !canUseStorage(storage)) return;

    try {
      storage.removeItem(canonicalKey);
      const legacyKey = legacyKeyMap[canonicalKey];
      if (legacyKey) {
        storage.removeItem(legacyKey);
      }
    } catch {
      // Ignore storage errors.
    }
  };

  const getJson = (key, fallback = null) => {
    const raw = getItem(key);
    if (raw == null) return fallback;
    try {
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  };

  const setJson = (key, value) => {
    try {
      setItem(key, JSON.stringify(value));
    } catch {
      // Ignore serialization errors.
    }
  };

  return {
    getItem,
    setItem,
    removeItem,
    getJson,
    setJson,
  };
};
