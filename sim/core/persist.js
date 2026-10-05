// JSON state in a Storage (localStorage); every access guarded, may be unavailable.
export function makeStore(storage, key) {
  return {
    load() {
      if (!storage) return null;
      try { const raw = storage.getItem(key); return raw ? JSON.parse(raw) : null; } catch { return null; }
    },
    save(obj) {
      if (!storage) return;
      try { storage.setItem(key, JSON.stringify(obj)); } catch { /* ignore */ }
    },
  };
}
