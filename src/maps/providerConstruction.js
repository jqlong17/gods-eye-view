/**
 * Cesium imagery/terrain factories ignore AbortSignal on their own fetches
 * and have no built-in deadline. Race a construction promise so a hung
 * metadata request can reject and trigger an existing fallback path.
 *
 * @param {Promise<unknown>} pending
 * @param {{ signal?: AbortSignal, timeoutMs?: number, label?: string }} options
 * @returns {Promise<unknown>}
 */
export function raceProviderConstruction(
  pending,
  { signal, timeoutMs, label = 'Map provider' } = {},
) {
  const ms = Math.max(0, Number(timeoutMs) || 0);
  let timer;
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${ms} ms`));
    }, ms);
  });
  const races = [Promise.resolve(pending), deadline];
  if (signal) {
    races.push(
      new Promise((_, reject) => {
        if (signal.aborted) {
          reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
          return;
        }
        signal.addEventListener(
          'abort',
          () => {
            reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
          },
          { once: true },
        );
      }),
    );
  }
  return Promise.race(races).finally(() => {
    clearTimeout(timer);
  });
}

/** Best-effort destroy of a Cesium provider that lost a construction race. */
export function disposeProvider(provider) {
  if (!provider || typeof provider.destroy !== 'function') return;
  if (provider.isDestroyed?.()) return;
  try {
    provider.destroy();
  } catch {
    // Best-effort release of a superseded construction.
  }
}
