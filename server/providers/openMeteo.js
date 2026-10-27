import { readResponseJsonCapped, coalesceProxyRequest } from './common/http.js';
import { makeRateLimiter, clientKey } from './common/rate-limit.js';
import { normalizeOpenMeteoSnapshot } from '../../src/layers/openMeteo/records.js';

const FORECAST = 'https://api.open-meteo.com/v1/forecast';
const CACHE_MS = 5 * 60_000;
const CACHE_MAX = 64;
const MAX_POINTS = 16;
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const TIMEOUT_MS = 15_000;

/** Quantize a view to ~1° cells so nearby cameras share one upstream sample. */
export function openMeteoSamplePoints(view) {
  if (
    !view ||
    ![view.west, view.south, view.east, view.north].every(Number.isFinite)
  )
    return null;
  let { west, south, east, north } = view;
  // Antimeridian: sample a narrow band around the dateline instead of wrapping.
  if (east < west) east = west + Math.min(40, 360 - (west - east));
  west = Math.max(-180, Math.min(180, west));
  east = Math.max(-180, Math.min(180, east));
  south = Math.max(-90, Math.min(90, south));
  north = Math.max(-90, Math.min(90, north));
  if (north <= south) return null;
  const spanLon = Math.max(0.5, east - west);
  const spanLat = Math.max(0.5, north - south);
  const cols = Math.min(4, Math.max(2, Math.round(Math.sqrt(MAX_POINTS))));
  const rows = Math.min(4, Math.max(2, Math.floor(MAX_POINTS / cols)));
  const points = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const lon = west + ((c + 0.5) / cols) * spanLon;
      const lat = south + ((r + 0.5) / rows) * spanLat;
      points.push({
        lon: Math.round(lon * 10) / 10,
        lat: Math.round(lat * 10) / 10,
      });
    }
  }
  return points;
}

function cacheKey(points) {
  return points.map((p) => `${p.lat},${p.lon}`).join('|');
}

/** Same-origin Open-Meteo current-condition samples for the weather layer. */
export function openMeteoProxy({
  fetchImpl = (...args) => globalThis.fetch(...args),
  now = () => Date.now(),
} = {}) {
  const cache = new Map();
  const inFlight = new Map();
  const allow = makeRateLimiter({ windowMs: 60_000, max: 30, globalMax: 600 });

  async function load(points) {
    const latitudes = points.map((p) => p.lat).join(',');
    const longitudes = points.map((p) => p.lon).join(',');
    const url = `${FORECAST}?${new URLSearchParams({
      latitude: latitudes,
      longitude: longitudes,
      current: 'temperature_2m,weather_code,wind_speed_10m,wind_direction_10m',
      timezone: 'UTC',
    })}`;
    const signal = AbortSignal.timeout(TIMEOUT_MS);
    const response = await fetchImpl(url, {
      signal,
      redirect: 'error',
      headers: {
        Accept: 'application/json',
        'User-Agent': 'gods-eye-view-open-meteo/1.0',
      },
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error('upstream_unavailable');
    }
    const payload = await readResponseJsonCapped(
      response,
      MAX_RESPONSE_BYTES,
      signal,
    );
    const rows = normalizeOpenMeteoSnapshot(payload, points);
    if (!rows) throw new Error('invalid_snapshot');
    return { fetchedAt: now(), rows };
  }

  return {
    name: 'open-meteo-proxy',
    configureServer(server) {
      server.middlewares.use('/api/open-meteo', async (req, res) => {
        if (req.method !== 'GET') {
          res.statusCode = 405;
          res.end('method not allowed');
          return;
        }
        const key = clientKey(req);
        if (!allow(key)) {
          res.statusCode = 429;
          res.setHeader('Content-Type', 'application/json');
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
          const points = openMeteoSamplePoints(view);
          if (!points) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'invalid_view' }));
            return;
          }
          const id = cacheKey(points);
          const hit = cache.get(id);
          if (hit && now() - hit.fetchedAt < CACHE_MS) {
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('X-Feed-Source', 'Open-Meteo');
            res.end(JSON.stringify(hit));
            return;
          }
          const { promise } = coalesceProxyRequest(inFlight, id, () =>
            load(points),
          );
          const body = await promise;
          cache.set(id, body);
          while (cache.size > CACHE_MAX) {
            const oldest = cache.keys().next().value;
            cache.delete(oldest);
          }
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('X-Feed-Source', 'Open-Meteo');
          res.end(JSON.stringify(body));
        } catch (error) {
          console.warn('[open-meteo]', error?.message || error);
          res.statusCode = 503;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'upstream_unavailable' }));
        }
      });
    },
  };
}
