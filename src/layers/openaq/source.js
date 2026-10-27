import { readResponseJsonCapped } from '../../sources/httpBody.js';

const msg = (text) => text;
const MAX_BYTES = 4 * 1024 * 1024;

/** Request recent OpenAQ locations for the current view via the local proxy. */
export function createOpenAqSource({
  fetchImpl = (...args) => globalThis.fetch(...args),
} = {}) {
  return {
    async getSnapshot({ view, signal } = {}) {
      signal?.throwIfAborted();
      if (
        !view ||
        ![view.west, view.south, view.east, view.north].every(Number.isFinite)
      ) {
        return {
          rows: [],
          emptyMessage: msg('Move the camera to load air-quality stations'),
        };
      }
      const params = new URLSearchParams({
        west: String(view.west),
        south: String(view.south),
        east: String(view.east),
        north: String(view.north),
      });
      const response = await fetchImpl(`/api/openaq?${params}`, {
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
        throw new Error(`OpenAQ HTTP ${response.status}`);
      }
      if (!Array.isArray(payload?.rows))
        throw new Error(msg('Malformed OpenAQ snapshot'));
      return {
        rows: payload.rows,
        emptyMessage: msg('No OpenAQ stations in this view'),
      };
    },
  };
}
