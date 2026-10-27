import { readResponseJsonCapped } from '../../sources/httpBody.js';

const msg = (text) => text;
const MAX_BYTES = 256 * 1024;

/** Latest RainViewer radar frame metadata via the local proxy. */
export function createRainViewerSource({
  fetchImpl = (...args) => globalThis.fetch(...args),
} = {}) {
  return {
    async getSnapshot({ signal } = {}) {
      signal?.throwIfAborted();
      const response = await fetchImpl('/api/rainviewer', {
        signal,
        cache: 'no-store',
      });
      if (!response.ok) throw new Error(`RainViewer HTTP ${response.status}`);
      const payload = await readResponseJsonCapped(response, MAX_BYTES, signal);
      signal?.throwIfAborted();
      if (!payload?.host || !payload?.path)
        throw new Error(msg('Malformed RainViewer snapshot'));
      return payload;
    },
  };
}
