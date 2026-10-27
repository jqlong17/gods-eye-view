import { readResponseJsonCapped } from '../../sources/httpBody.js';

const msg = (text) => text;
const MAX_BYTES = 4 * 1024 * 1024;

/**
 * Global Fishing Watch — Bearer token required (GFW_API_TOKEN).
 * Mirrors the AISStream missing-key pattern.
 */
export function createFishingWatchSource({
  fetchImpl = (...args) => globalThis.fetch(...args),
} = {}) {
  return {
    async getSnapshot({ view, signal } = {}) {
      signal?.throwIfAborted();
      const params = new URLSearchParams();
      if (view) {
        for (const key of ['west', 'south', 'east', 'north']) {
          if (Number.isFinite(view[key])) params.set(key, String(view[key]));
        }
      }
      const qs = params.toString();
      const response = await fetchImpl(
        `/api/fishing-watch${qs ? `?${qs}` : ''}`,
        { signal, cache: 'no-store' },
      );
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
        throw new Error(`Global Fishing Watch HTTP ${response.status}`);
      }
      return {
        rows: Array.isArray(payload?.rows) ? payload.rows : [],
        emptyMessage:
          payload?.emptyMessage || msg('No fishing activity in this view'),
      };
    },
  };
}
