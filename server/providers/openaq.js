import { readResponseJsonCapped, coalesceProxyRequest } from './common/http.js';
import { makeRateLimiter, clientKey } from './common/rate-limit.js';
import { normalizeOpenAqSnapshot } from '../../src/layers/openaq/records.js';

const ROOT = 'https://api.openaq.org/v3/locations';
const CACHE_MS = 10 * 60_000;
const CACHE_MAX = 64;
const MAX_RESPONSE_BYTES = 4 * 1024 * 1024;
const TIMEOUT_MS = 20_000;
const LIMIT = 100;

function apiKey() {
  return String(process.env.OPENAQ_API_KEY || '').trim();
}

function bboxParam(view) {
  let { west, south, east, north } = view;
  if (east < west) {
    // Prefer the non-wrapping span for a first-cut bbox query.
    east = Math.min(180, west + 40);
  }
  west = Math.max(-180, Math.min(180, west));
  east = Math.max(-180, Math.min(180, east));
  south = Math.max(-90, Math.min(90, south));
  north = Math.max(-90, Math.min(90, north));
  if (!(north > south) || !(east > west)) return null;
  // Cap huge zooms so a whole-world view does not ask OpenAQ for everything.
  if (east - west > 80) {
    const mid = (west + east) / 2;
    west = mid - 40;
    east = mid + 40;
  }
  if (north - south > 60) {
    const mid = (south + north) / 2;
    south = mid - 30;
    north = mid + 30;
  }
  return [west, south, east, north].map((n) => n.toFixed(4)).join(',');
}

/** OpenAQ v3 locations proxy; keyless → 503 {error:'no_key'}. */
export function openaqProxy({
  fetchImpl = (...args) => globalThis.fetch(...args),
  now = () => Date.now(),
} = {}) {
  const cache = new Map();
  const inFlight = new Map();
  const allow = makeRateLimiter({ windowMs: 60_000, max: 30, globalMax: 600 });

  async function load(bbox) {
    const url = `${ROOT}?${new URLSearchParams({
      bbox,
      limit: String(LIMIT),
      monitor: 'true',
      'sensors[0][parameter]': 'pm25',
    })}`;
    const signal = AbortSignal.timeout(TIMEOUT_MS);
    const response = await fetchImpl(url, {
      signal,
      redirect: 'error',
      headers: {
        Accept: 'application/json',
        'X-API-Key': apiKey(),
        'User-Agent': 'gods-eye-view-openaq/1.0',
      },
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw Object.assign(new Error('upstream_unavailable'), {
        status: response.status,
      });
    }
    const payload = await readResponseJsonCapped(
      response,
      MAX_RESPONSE_BYTES,
      signal,
    );
    const rows = normalizeOpenAqSnapshot(payload);
    if (!rows) throw new Error('invalid_snapshot');
    return { fetchedAt: now(), rows };
  }

  return {
    name: 'openaq-proxy',
    configureServer(server) {
      server.middlewares.use('/api/openaq', async (req, res) => {
        if (req.method !== 'GET') {
          res.statusCode = 405;
          res.end('method not allowed');
          return;
        }
        res.setHeader('Content-Type', 'application/json');
        if (!apiKey()) {
          res.statusCode = 503;
          res.end(JSON.stringify({ error: 'no_key' }));
          return;
        }
        const key = clientKey(req);
        if (!allow(key)) {
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
          const bbox = bboxParam(view);
          if (!bbox) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'invalid_view' }));
            return;
          }
          const hit = cache.get(bbox);
          if (hit && now() - hit.fetchedAt < CACHE_MS) {
            res.statusCode = 200;
            res.setHeader('X-Feed-Source', 'OpenAQ');
            res.end(JSON.stringify(hit));
            return;
          }
          const { promise } = coalesceProxyRequest(inFlight, bbox, () =>
            load(bbox),
          );
          const body = await promise;
          cache.set(bbox, body);
          while (cache.size > CACHE_MAX) {
            const oldest = cache.keys().next().value;
            cache.delete(oldest);
          }
          res.statusCode = 200;
          res.setHeader('X-Feed-Source', 'OpenAQ');
          res.end(JSON.stringify(body));
        } catch (error) {
          console.warn('[openaq]', error?.message || error);
          res.statusCode = error?.status === 401 ? 502 : 503;
          res.end(JSON.stringify({ error: 'upstream_unavailable' }));
        }
      });
    },
  };
}
