import { readResponseJsonCapped } from '../../sources/httpBody.js';
const msg = (text) => text;
const MAX_BYTES = 8 * 1024 * 1024;

export function createIocSeaLevelSource({
  fetchImpl = (...args) => globalThis.fetch(...args),
} = {}) {
  return {
    async getSnapshot({ signal } = {}) {
      signal?.throwIfAborted();
      const response = await fetchImpl('/api/ioc-sea-level', {
        signal,
        cache: 'no-store',
      });
      if (!response.ok) throw new Error(`IOC HTTP ${response.status}`);
      const payload = await readResponseJsonCapped(response, MAX_BYTES, signal);
      signal?.throwIfAborted();
      if (!Array.isArray(payload?.rows))
        throw new Error(msg('Malformed IOC snapshot'));
      return {
        rows: payload.rows,
        emptyMessage: msg('No tide gauges available'),
      };
    },
  };
}
