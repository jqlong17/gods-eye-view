import { readResponseJsonCapped, coalesceProxyRequest } from './common/http.js';
import { makeRateLimiter, clientKey } from './common/rate-limit.js';
import { normalizeArgoSnapshot } from '../../src/layers/argo/records.js';

const URL =
  'https://erddap.ifremer.fr/erddap/tabledap/ArgoFloats.json?' +
  'platform_number%2Clatitude%2Clongitude%2Ctime&time%3E=now-7days&distinct()';
const CACHE_MS = 30 * 60_000;
const MAX_BYTES = 16 * 1024 * 1024;

export function argoProxy({
  fetchImpl = (...args) => globalThis.fetch(...args),
  now = () => Date.now(),
} = {}) {
  let mem = null;
  const inFlight = new Map();
  const allow = makeRateLimiter({ windowMs: 60_000, max: 10, globalMax: 200 });

  async function load() {
    const signal = AbortSignal.timeout(60_000);
    const response = await fetchImpl(URL, {
      signal,
      redirect: 'error',
      headers: {
        Accept: 'application/json',
        'User-Agent': 'gods-eye-view-argo/1.0',
      },
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(`HTTP ${response.status}`);
    }
    const payload = await readResponseJsonCapped(response, MAX_BYTES, signal);
    const rows = normalizeArgoSnapshot(payload);
    if (!rows) throw new Error('invalid_snapshot');
    // Cap markers for globe readability.
    mem = { fetchedAt: now(), rows: rows.slice(0, 4000), total: rows.length };
    return mem;
  }

  return {
    name: 'argo-proxy',
    configureServer(server) {
      server.middlewares.use('/api/argo', async (req, res) => {
        if (req.method !== 'GET') {
          res.statusCode = 405;
          res.end('method not allowed');
          return;
        }
        res.setHeader('Content-Type', 'application/json');
        if (!allow(clientKey(req))) {
          res.statusCode = 429;
          res.end(JSON.stringify({ error: 'rate_limited' }));
          return;
        }
        try {
          if (mem && now() - mem.fetchedAt < CACHE_MS) {
            res.statusCode = 200;
            res.setHeader('X-Feed-Source', 'Argo');
            res.end(JSON.stringify(mem));
            return;
          }
          const { promise } = coalesceProxyRequest(inFlight, 'argo', load);
          const body = await promise;
          res.statusCode = 200;
          res.setHeader('X-Feed-Source', 'Argo');
          res.end(JSON.stringify(body));
        } catch (error) {
          console.warn('[argo]', error?.message || error);
          if (mem?.rows) {
            res.statusCode = 200;
            res.setHeader('X-Feed-Source', 'Argo');
            res.setHeader('X-Feed-Stale', '1');
            res.end(JSON.stringify({ ...mem, stale: true }));
            return;
          }
          res.statusCode = 503;
          res.end(JSON.stringify({ error: 'upstream_unavailable' }));
        }
      });
    },
  };
}
