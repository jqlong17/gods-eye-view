import { readResponseJsonCapped, coalesceProxyRequest } from './common/http.js';
import { makeRateLimiter, clientKey } from './common/rate-limit.js';

const EVENTS =
  'https://gateway.api.globalfishingwatch.org/v3/events';
const CACHE_MS = 10 * 60_000;
const CACHE_MAX = 32;
const MAX_RESPONSE_BYTES = 4 * 1024 * 1024;
const TIMEOUT_MS = 25_000;

function apiToken() {
  return String(
    process.env.GFW_API_TOKEN || process.env.GLOBAL_FISHING_WATCH_API_TOKEN || '',
  ).trim();
}

function normalizeEvents(payload) {
  const entries = Array.isArray(payload?.entries)
    ? payload.entries
    : Array.isArray(payload?.data)
      ? payload.data
      : Array.isArray(payload)
        ? payload
        : [];
  const rows = [];
  for (const item of entries) {
    const id = item?.id != null ? String(item.id) : null;
    const pos = item?.position || item?.regions?.start || item?.startPosition;
    const lat = Number(pos?.lat ?? pos?.latitude ?? item?.lat);
    const lon = Number(pos?.lon ?? pos?.longitude ?? item?.lon);
    if (
      !id ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lon) ||
      Math.abs(lat) > 90 ||
      Math.abs(lon) > 180
    )
      continue;
    const vessel =
      item?.vessel?.name || item?.vessel?.ssvid || item?.vessel?.id || null;
    rows.push({
      id: `gfw:${id}`,
      lat,
      lon,
      name: vessel ? String(vessel) : `Event ${id}`,
      label: vessel ? String(vessel) : `GFW ${id}`,
      type: typeof item?.type === 'string' ? item.type : null,
    });
  }
  return rows;
}

/** Global Fishing Watch events proxy; missing token → 503 {error:'no_key'}. */
export function fishingWatchProxy({
  fetchImpl = (...args) => globalThis.fetch(...args),
  now = () => Date.now(),
} = {}) {
  const cache = new Map();
  const inFlight = new Map();
  const allow = makeRateLimiter({ windowMs: 60_000, max: 20, globalMax: 400 });

  async function load(view) {
    const token = apiToken();
    // Bounded bbox around the view (or a mid-Atlantic default for a world view).
    let west = Number(view?.west);
    let south = Number(view?.south);
    let east = Number(view?.east);
    let north = Number(view?.north);
    if (![west, south, east, north].every(Number.isFinite) || east <= west) {
      west = -40;
      east = -20;
      south = 20;
      north = 40;
    }
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
    const params = new URLSearchParams({
      limit: '50',
      offset: '0',
      'datasets[0]': 'public-global-fishing-events:latest',
    });
    // GFW accepts a GeoJSON polygon; a simple rectangle is enough for a first cut.
    const body = {
      datasets: ['public-global-fishing-events:latest'],
      startDate: new Date(now() - 7 * 24 * 60 * 60_000).toISOString(),
      endDate: new Date(now()).toISOString(),
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [west, south],
            [east, south],
            [east, north],
            [west, north],
            [west, south],
          ],
        ],
      },
    };
    const signal = AbortSignal.timeout(TIMEOUT_MS);
    const response = await fetchImpl(`${EVENTS}?${params}`, {
      method: 'POST',
      signal,
      redirect: 'error',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'User-Agent': 'gods-eye-view-gfw/1.0',
      },
      body: JSON.stringify(body),
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
    return { fetchedAt: now(), rows: normalizeEvents(payload) };
  }

  return {
    name: 'fishing-watch-proxy',
    configureServer(server) {
      server.middlewares.use('/api/fishing-watch', async (req, res) => {
        if (req.method !== 'GET') {
          res.statusCode = 405;
          res.end('method not allowed');
          return;
        }
        res.setHeader('Content-Type', 'application/json');
        if (!apiToken()) {
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
          const id = [
            view.west,
            view.south,
            view.east,
            view.north,
          ]
            .map((n) => (Number.isFinite(n) ? n.toFixed(1) : 'x'))
            .join(',');
          const hit = cache.get(id);
          if (hit && now() - hit.fetchedAt < CACHE_MS) {
            res.statusCode = 200;
            res.setHeader('X-Feed-Source', 'Global Fishing Watch');
            res.end(JSON.stringify(hit));
            return;
          }
          const { promise } = coalesceProxyRequest(inFlight, id, () =>
            load(view),
          );
          const body = await promise;
          cache.set(id, body);
          while (cache.size > CACHE_MAX) {
            const oldest = cache.keys().next().value;
            cache.delete(oldest);
          }
          res.statusCode = 200;
          res.setHeader('X-Feed-Source', 'Global Fishing Watch');
          res.end(JSON.stringify(body));
        } catch (error) {
          console.warn('[fishing-watch]', error?.message || error);
          res.statusCode = error?.status === 401 ? 502 : 503;
          res.end(JSON.stringify({ error: 'upstream_unavailable' }));
        }
      });
    },
  };
}
