import { readResponseJsonCapped } from '../../sources/httpBody.js';
import { normalizeOurAirportsSnapshot } from './records.js';

const msg = (text) => text;
const MAX_BYTES = 16 * 1024 * 1024;

/** Request the cached OurAirports subset via the local proxy. */
export function createOurAirportsSource({
  fetchImpl = (...args) => globalThis.fetch(...args),
} = {}) {
  return {
    async getSnapshot({ signal } = {}) {
      signal?.throwIfAborted();
      const response = await fetchImpl('/api/ourairports', {
        signal,
        cache: 'no-store',
      });
      if (!response.ok) throw new Error(`OurAirports HTTP ${response.status}`);
      const payload = await readResponseJsonCapped(response, MAX_BYTES, signal);
      signal?.throwIfAborted();
      const rows = normalizeOurAirportsSnapshot(payload);
      if (!rows) throw new Error(msg('Malformed OurAirports snapshot'));
      return {
        rows,
        emptyMessage: msg('No airports in catalog'),
      };
    },
  };
}
