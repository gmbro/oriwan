import assert from 'node:assert/strict';
import test from 'node:test';
import { createWarmRequest } from '../lib/warm-request.ts';

test('slow popup GET remains deduplicated after TTL and starts TTL at completion', async () => {
  let now = 0, calls = 0, resolve;
  const cache = createWarmRequest(() => { calls++; return new Promise(r => { resolve = r; }); }, 30, () => now);
  const first = cache.read();
  now = 100;
  assert.equal(cache.read(), first);
  assert.equal(calls, 1);
  resolve('ready'); await first;
  now = 129; assert.equal(cache.read(), first);
  now = 131; assert.notEqual(cache.read(), first); assert.equal(calls, 2);
  cache.clear(); resolve('old'); await Promise.resolve();
  assert.equal(cache.peek(), undefined);
});
