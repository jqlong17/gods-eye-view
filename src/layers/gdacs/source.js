import { readResponseJsonCapped } from '../../sources/httpBody.js';

const msg = (text) => text;
const MAX_BYTES = 8 * 1024 * 1024;

/** Request active GDACS disaster events via the local proxy. */
export function createGdacsSource({
  fetchImpl = (...args) => globalThis.fetch(...args),
} = {}) {
  return {
    async getSnapshot({ signal } = {}) {
      signal?.throwIfAborted();
      const response = await fetchImpl('/api/gdacs', {
        signal,
        cache: 'no-store',
      });
      if (!response.ok) throw new Error(`GDACS HTTP ${response.status}`);
      const payload = await readResponseJsonCapped(response, MAX_BYTES, signal);
      signal?.throwIfAborted();
      if (!Array.isArray(payload?.rows))
        throw new Error(msg('Malformed GDACS snapshot'));
      return {
        rows: payload.rows,
        emptyMessage: msg('No active GDACS alerts'),
      };
    },
  };
}
