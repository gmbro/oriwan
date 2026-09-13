// A short-lived, owner-scoped GET cache. Instantiate inside a keyed component,
// never at module scope: private responses must not cross accounts.
export function createWarmRequest<T>(fetcher: () => Promise<T>, ttl = 30_000, now = Date.now) {
  let cached: Promise<T> | null = null;
  let expiresAt = 0;
  let value: T | undefined;
  return {
    read() {
      if (cached && now() < expiresAt) return cached;
      const request = fetcher();
      cached = request;
      expiresAt = now() + ttl;
      void request.then(result => { if (cached === request) value = result; }, () => undefined);
      void request.catch(() => {
        if (cached === request) { cached = null; expiresAt = 0; }
      });
      return request;
    },
    peek() { return value; },
    set(next: T) { value = next; cached = Promise.resolve(next); expiresAt = now() + ttl; return cached; },
    clear() { cached = null; value = undefined; expiresAt = 0; },
  };
}
