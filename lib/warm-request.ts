// A short-lived, owner-scoped GET cache. Instantiate inside a keyed component,
// never at module scope: private responses must not cross accounts.
export function createWarmRequest<T>(fetcher: () => Promise<T>, ttl = 30_000, now = Date.now) {
  let cached: Promise<T> | null = null;
  let expiresAt = 0;
  let pending = false;
  let value: T | undefined;
  return {
    read() {
      if (cached && (pending || now() < expiresAt)) return cached;
      const request = fetcher();
      cached = request;
      pending = true;
      expiresAt = now() + ttl;
      void request.then(result => { if (cached === request) { value = result; pending = false; expiresAt = now() + ttl; } }, () => undefined);
      void request.catch(() => {
        if (cached === request) { cached = null; pending = false; expiresAt = 0; }
      });
      return request;
    },
    peek() { return value; },
    set(next: T) { pending = false; value = next; cached = Promise.resolve(next); expiresAt = now() + ttl; return cached; },
    clear() { pending = false; cached = null; value = undefined; expiresAt = 0; },
  };
}
