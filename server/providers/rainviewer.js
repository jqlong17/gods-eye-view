import { readResponseJsonCapped, coalesceProxyRequest } from './common/http.js';
import { makeRateLimiter, clientKey } from './common/rate-limit.js';

const MAPS = 'https://api.rainviewer.com/public/weather-maps.json';
const CACHE_MS = 2 * 60_000;
const MAX_BYTES = 256 * 1024;

export function rainViewerProxy({
  fetchImpl = (...args) => globalThis.fetch(...args),
  now = () => Date.now(),
} = {}) {
  let mem = null;
  const inFlight = new Map();
  const allow = makeRateLimiter({ windowMs: 60_000, max: 30, globalMax: 600 });

  async function load() {
    const signal = AbortSignal.timeout(15_000);
    const response = await fetchImpl(MAPS, {
      signal,
      redirect: 'error',
      headers: {
        Accept: 'application/json',
        'User-Agent': 'gods-eye-view-rainviewer/1.0',
      },
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(`HTTP ${response.status}`);
    }
    const payload = await readResponseJsonCapped(response, MAX_BYTES, signal);
    const past = payload?.radar?.past;
    const frame =
      Array.isArray(past) && past.length ? past[past.length - 1] : null;
    if (!payload?.host || !frame?.path) throw new Error('invalid_snapshot');
    mem = {
      fetchedAt: now(),
      host: String(payload.host).replace(/\/$/, ''),
      path: String(frame.path),
      time: frame.time ?? null,
    };
    return mem;
  }

  return {
    name: 'rainviewer-proxy',
    configureServer(server) {
      server.middlewares.use('/api/rainviewer', async (req, res) => {
        if (req.method !== 'GET') {
          res.statusCode = 405;
          res.end('method not allowed');
          return;
        }
        if (!allow(clientKey(req))) {
          res.statusCode = 429;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'rate_limited' }));
          return;
        }
        try {
          if (mem && now() - mem.fetchedAt < CACHE_MS) {
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('X-Feed-Source', 'RainViewer');
            res.end(JSON.stringify(mem));
            return;
          }
          const { promise } = coalesceProxyRequest(inFlight, 'rv', load);
          const body = await promise;
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('X-Feed-Source', 'RainViewer');
          res.end(JSON.stringify(body));
        } catch (error) {
          console.warn('[rainviewer]', error?.message || error);
          res.statusCode = 503;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'upstream_unavailable' }));
        }
      });
    },
  };
}
