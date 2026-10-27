import { readResponseJsonCapped } from '../../sources/httpBody.js';

const MAX_BYTES = 1 * 1024 * 1024;

/**
 * ADS-B Exchange has no documented keyless public endpoint that works for
 * this app (live queries return {"NO_AUTH"}). The proxy answers
 * 503 {error:'no_key'} until ADSBX_API_KEY is set.
 */
export function createAdsbExchangeSource({
  fetchImpl = (...args) => globalThis.fetch(...args),
} = {}) {
  return {
    async getSnapshot({ signal } = {}) {
      signal?.throwIfAborted();
      const response = await fetchImpl('/api/adsb-exchange', {
        signal,
        cache: 'no-store',
      });
      let payload;
      try {
        payload = await readResponseJsonCapped(response, MAX_BYTES, signal);
      } catch {
        /* status below remains authoritative */
      }
      signal?.throwIfAborted();
      if (!response.ok) {
        if (response.status === 503 && payload?.error === 'no_key')
          return { keyRequired: true };
        throw new Error(`ADS-B Exchange HTTP ${response.status}`);
      }
      return {
        rows: Array.isArray(payload?.rows) ? payload.rows : [],
        emptyMessage: payload?.emptyMessage || null,
      };
    },
  };
}
