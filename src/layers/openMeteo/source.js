import { readResponseJsonCapped } from '../../sources/httpBody.js';

const msg = (text) => text;
const MAX_BYTES = 2 * 1024 * 1024;

/** Request Open-Meteo samples for the current camera view via the local proxy. */
export function createOpenMeteoSource({
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
          emptyMessage: msg('Move the camera to sample weather'),
        };
      }
      const params = new URLSearchParams({
        west: String(view.west),
        south: String(view.south),
        east: String(view.east),
        north: String(view.north),
      });
      const response = await fetchImpl(`/api/open-meteo?${params}`, {
        signal,
        cache: 'no-store',
      });
      if (!response.ok) throw new Error(`Open-Meteo HTTP ${response.status}`);
      const payload = await readResponseJsonCapped(response, MAX_BYTES, signal);
      signal?.throwIfAborted();
      if (!Array.isArray(payload?.rows))
        throw new Error(msg('Malformed Open-Meteo snapshot'));
      return {
        rows: payload.rows,
        emptyMessage: msg('No weather samples for this view'),
      };
    },
  };
}
