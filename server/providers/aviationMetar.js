import { readResponseJsonCapped, coalesceProxyRequest } from './common/http.js';
import { makeRateLimiter, clientKey } from './common/rate-limit.js';
import { normalizeMetarSnapshot } from '../../src/layers/aviationMetar/records.js';

const ROOT = 'https://aviationweather.gov/api/data/metar';
const CACHE_MS = 3 * 60_000;
const CACHE_MAX = 64;
const MAX_BYTES = 4 * 1024 * 1024;

function bbox(view) {
  let { west, south, east, north } = view;
  if (east < west) east = Math.min(180, west + 30);
  west = Math.max(-180, Math.min(180, west));
  east = Math.max(-180, Math.min(180, east));
  south = Math.max(-90, Math.min(90, south));
  north = Math.max(-90, Math.min(90, north));
  if (!(north > south) || !(east > west)) return null;
  if (east - west > 40) {
    const mid = (west + east) / 2;
    west = mid - 20;
    east = mid + 20;
  }
  if (north - south > 30) {
    const mid = (south + north) / 2;
    south = mid - 15;
    north = mid + 15;
  }
  return [south, west, north, east].map((n) => n.toFixed(3)).join(',');
}

export function aviationMetarProxy({
  fetchImpl = (...args) => globalThis.fetch(...args),
  now = () => Date.now(),
} = {}) {
  const cache = new Map();
  const inFlight = new Map();
  const allow = makeRateLimiter({ windowMs: 60_000, max: 30, globalMax: 600 });

  async function load(box) {
    const url = `${ROOT}?${new URLSearchParams({
      bbox: box,
      format: 'json',
    })}`;
    const signal = AbortSignal.timeout(20_000);
    const response = await fetchImpl(url, {
      signal,
      redirect: 'error',
      headers: {
        Accept: 'application/json',
        'User-Agent': 'gods-eye-view-metar/1.0',
      },
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(`HTTP ${response.status}`);
    }
    const payload = await readResponseJsonCapped(response, MAX_BYTES, signal);
    const rows = normalizeMetarSnapshot(payload);
    if (!rows) throw new Error('invalid_snapshot');
    return { fetchedAt: now(), rows };
  }

  return {
    name: 'aviation-metar-proxy',
    configureServer(server) {
      server.middlewares.use('/api/aviation-metar', async (req, res) => {
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
          const url = new URL(req.url || '', 'http://localhost');
          const view = {
            west: Number(url.searchParams.get('west')),
            south: Number(url.searchParams.get('south')),
            east: Number(url.searchParams.get('east')),
            north: Number(url.searchParams.get('north')),
          };
          const box = bbox(view);
          if (!box) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'invalid_view' }));
            return;
          }
          const hit = cache.get(box);
          if (hit && now() - hit.fetchedAt < CACHE_MS) {
            res.statusCode = 200;
            res.setHeader('X-Feed-Source', 'Aviation Weather Center');
            res.end(JSON.stringify(hit));
            return;
          }
          const { promise } = coalesceProxyRequest(inFlight, box, () =>
            load(box),
          );
          const body = await promise;
          cache.set(box, body);
          while (cache.size > CACHE_MAX)
            cache.delete(cache.keys().next().value);
          res.statusCode = 200;
          res.setHeader('X-Feed-Source', 'Aviation Weather Center');
          res.end(JSON.stringify(body));
        } catch (error) {
          console.warn('[aviation-metar]', error?.message || error);
          res.statusCode = 503;
          res.end(JSON.stringify({ error: 'upstream_unavailable' }));
        }
      });
    },
  };
}
