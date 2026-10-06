/**
 * Node 26 can expose localStorage/sessionStorage as undefined when Vitest
 * runs with happy-dom. The app uses these stores for the auth session, so
 * provide a small in-memory implementation for tests only.
 */
function memoryStorage(): Storage {
  const store = new Map<string, string>();

  return {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (key: string) => store.get(key) ?? null,
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    removeItem: (key: string) => {
      store.delete(key);
    },
    setItem: (key: string, value: string) => {
      store.set(key, String(value));
    },
  };
}

for (const name of ["localStorage", "sessionStorage"] as const) {
  if (!(globalThis as Record<string, unknown>)[name]) {
    Object.defineProperty(globalThis, name, {
      value: memoryStorage(),
      configurable: true,
      writable: true,
    });
  }
}
