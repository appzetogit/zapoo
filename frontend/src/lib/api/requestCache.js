const cacheStore = new Map();

function isFresh(entry) {
  return entry && entry.expiresAt > Date.now();
}

function stableSerialize(value) {
  if (Array.isArray(value)) {
    return value.map(stableSerialize);
  }

  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce((acc, currentKey) => {
        acc[currentKey] = stableSerialize(value[currentKey]);
        return acc;
      }, {});
  }

  return value;
}

function normalizeKey(key) {
  if (Array.isArray(key)) {
    return JSON.stringify(stableSerialize(key));
  }

  if (key && typeof key === "object") {
    return JSON.stringify(stableSerialize(key));
  }

  return String(key);
}

export async function getCachedResource(key, fetcher, options = {}) {
  const {
    ttl = 30000,
    force = false,
  } = options;

  const normalizedKey = normalizeKey(key);
  const existing = cacheStore.get(normalizedKey);

  if (!force && existing) {
    if (existing.promise) {
      return existing.promise;
    }

    if (isFresh(existing)) {
      return existing.value;
    }
  }

  const promise = Promise.resolve()
    .then(fetcher)
    .then((value) => {
      cacheStore.set(normalizedKey, {
        value,
        expiresAt: Date.now() + ttl,
      });
      return value;
    })
    .catch((error) => {
      const current = cacheStore.get(normalizedKey);
      if (current?.promise) {
        cacheStore.delete(normalizedKey);
      }
      throw error;
    });

  cacheStore.set(normalizedKey, {
    promise,
    expiresAt: Date.now() + ttl,
  });

  return promise;
}

export function invalidateCachedResource(key) {
  cacheStore.delete(normalizeKey(key));
}

export function invalidateCachedResourcePrefix(prefix) {
  const normalizedPrefix = normalizeKey(prefix);

  for (const key of cacheStore.keys()) {
    if (key === normalizedPrefix || key.startsWith(`${normalizedPrefix}:`) || key.startsWith(`${normalizedPrefix}|`) || key.startsWith(`["${normalizedPrefix}"`)) {
      cacheStore.delete(key);
    }
  }
}
