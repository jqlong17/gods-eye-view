import { msg } from '../../i18n/marker.js';

export function createEtopoSource({
  fetchImpl = (...args) => globalThis.fetch(...args),
} = {}) {
  return {
    async getSnapshot({ signal } = {}) {
      signal?.throwIfAborted();
      const response = await fetchImpl('/api/etopo/status', {
        signal,
        cache: 'no-store',
      });
      if (!response.ok) throw new Error(`ETOPO HTTP ${response.status}`);
      const payload = await response.json();
      signal?.throwIfAborted();
      if (!payload?.imageUrl)
        throw new Error(msg('Malformed ETOPO status'));
      return payload;
    },
  };
}
