import { readResponseJsonCapped } from '../../sources/httpBody.js';
const msg = (text) => text;
const MAX_BYTES = 2 * 1024 * 1024;

export function createSwpcAuroraSource({
  fetchImpl = (...args) => globalThis.fetch(...args),
} = {}) {
  return {
    async getSnapshot({ signal } = {}) {
      signal?.throwIfAborted();
      const response = await fetchImpl('/api/swpc-aurora', {
        signal,
        cache: 'no-store',
      });
      if (!response.ok) throw new Error(`SWPC HTTP ${response.status}`);
      const payload = await readResponseJsonCapped(response, MAX_BYTES, signal);
      signal?.throwIfAborted();
      if (!Array.isArray(payload?.rows))
        throw new Error(msg('Malformed SWPC aurora snapshot'));
      return {
        rows: payload.rows,
        emptyMessage: msg('No elevated aurora forecast cells'),
      };
    },
  };
}
