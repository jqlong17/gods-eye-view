import { readResponseJsonCapped, coalesceProxyRequest } from './common/http.js';
import { makeRateLimiter, clientKey } from './common/rate-limit.js';
import { normalizeAuroraSnapshot } from '../../src/layers/swpcAurora/records.js';

const URL =
  'https://services.swpc.noaa.gov/json/ovation_aurora_latest.json';
const CACHE_MS = 10 * 60_000;
const MAX_BYTES = 2 * 1024 * 1024;

export function swpcAuroraProxy({
  fetchImpl = (...args) => globalThis.fetch(...args),
  now = () => Date.now(),
} = {}) {
  let mem = null;
  const inFlight = new Map();
  const allow = makeRateLimiter({ windowMs: 60_000, max: 20, globalMax: 400 });

  async function load() {
    const signal = AbortSignal.timeout(30_000);
    const response = await fetchImpl(URL, {
      signal,
      redirect: 'error',
      headers: {
        Accept: 'application/json',
        'User-Agent': 'gods-eye-view-swpc/1.0',
      },
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(`HTTP ${response.status}`);
    }
    const payload = await readResponseJsonCapped(response, MAX_BYTES, signal);
    const rows = normalizeAuroraSnapshot(payload);
    if (!rows) throw new Error('invalid_snapshot');
    mem = {
      fetchedAt: now(),
      rows,
      observationTime: payload?.['Observation Time'] || null,
      forecastTime: payload?.['Forecast Time'] || null,
    };
    return mem;
  }

  return {
    name: 'swpc-aurora-proxy',
    configureServer(server) {
      server.middlewares.use('/api/swpc-aurora', async (req, res) => {
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
            res.setHeader('X-Feed-Source', 'NOAA SWPC');
            res.end(JSON.stringify(mem));
            return;
          }
          const { promise } = coalesceProxyRequest(inFlight, 'aurora', load);
          const body = await promise;
          res.statusCode = 200;
          res.setHeader('X-Feed-Source', 'NOAA SWPC');
          res.end(JSON.stringify(body));
        } catch (error) {
          console.warn('[swpc-aurora]', error?.message || error);
          res.statusCode = 503;
          res.end(JSON.stringify({ error: 'upstream_unavailable' }));
        }
      });
    },
  };
}
