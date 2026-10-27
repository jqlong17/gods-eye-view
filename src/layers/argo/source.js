import { readResponseJsonCapped } from '../../sources/httpBody.js';
const msg = (text) => text;
const MAX_BYTES = 8 * 1024 * 1024;

export function createArgoSource({
  fetchImpl = (...args) => globalThis.fetch(...args),
} = {}) {
  return {
    async getSnapshot({ signal } = {}) {
      signal?.throwIfAborted();
      const response = await fetchImpl('/api/argo', {
        signal,
        cache: 'no-store',
      });
      if (!response.ok) throw new Error(`Argo HTTP ${response.status}`);
      const payload = await readResponseJsonCapped(response, MAX_BYTES, signal);
      signal?.throwIfAborted();
      if (!Array.isArray(payload?.rows))
        throw new Error(msg('Malformed Argo snapshot'));
      return {
        rows: payload.rows,
        emptyMessage: msg('No recent Argo floats'),
      };
    },
  };
}
