import test from 'node:test';
import assert from 'node:assert/strict';
import {
  disposeProvider,
  raceProviderConstruction,
} from './providerConstruction.js';

test('raceProviderConstruction resolves when the provider wins', async () => {
  const provider = { id: 'ok' };
  assert.equal(
    await raceProviderConstruction(Promise.resolve(provider), {
      timeoutMs: 1_000,
      label: 'fixture',
    }),
    provider,
  );
});

test('raceProviderConstruction rejects when the deadline wins', async () => {
  const started = Date.now();
  await assert.rejects(
    raceProviderConstruction(new Promise(() => {}), {
      timeoutMs: 25,
      label: 'Hung fixture',
    }),
    /Hung fixture timed out after 25 ms/,
  );
  assert.ok(Date.now() - started < 1_000);
});

test('raceProviderConstruction rejects on abort without waiting for the deadline', async () => {
  const abort = new AbortController();
  const pending = raceProviderConstruction(new Promise(() => {}), {
    signal: abort.signal,
    timeoutMs: 5_000,
    label: 'Aborted fixture',
  });
  abort.abort();
  await assert.rejects(pending, { name: 'AbortError' });
});

test('disposeProvider destroys once and ignores missing destroy hooks', () => {
  let destroyed = 0;
  const provider = {
    isDestroyed: () => destroyed > 0,
    destroy() {
      destroyed += 1;
    },
  };
  disposeProvider(provider);
  disposeProvider(provider);
  disposeProvider(null);
  disposeProvider({});
  assert.equal(destroyed, 1);
});
