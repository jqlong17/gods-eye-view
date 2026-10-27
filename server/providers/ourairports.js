import path from 'node:path';
import { promises as fsp } from 'node:fs';
import { readResponseTextCapped, coalesceProxyRequest } from './common/http.js';
import { makeRateLimiter, clientKey } from './common/rate-limit.js';
import {
  normalizeOurAirportsSnapshot,
  parseOurAirportsCsv,
} from '../../src/layers/ourairports/records.js';

const CSV_URL =
  'https://davidmegginson.github.io/ourairports-data/airports.csv';
const CACHE_MS = 24 * 60 * 60_000;
const MAX_RESPONSE_BYTES = 64 * 1024 * 1024;
const TIMEOUT_MS = 120_000;
const CACHE_DIR = path.join(process.cwd(), '.gev-cache');
const CACHE_PATH = path.join(CACHE_DIR, 'ourairports.json');

/** OurAirports CSV → filtered airport points (keyless, long TTL). */
export function ourAirportsProxy({
  fetchImpl = (...args) => globalThis.fetch(...args),
  now = () => Date.now(),
} = {}) {
  /** @type {?{fetchedAt: number, rows: Array<object>}} */
  let mem = null;
  let diskChecked = false;
  const inFlight = new Map();
  const allow = makeRateLimiter({ windowMs: 60_000, max: 60, globalMax: 1200 });

  async function readDiskOnce() {
    if (diskChecked) return;
    diskChecked = true;
    try {
      const parsed = JSON.parse(await fsp.readFile(CACHE_PATH, 'utf8'));
      if (Number.isFinite(parsed?.fetchedAt) && Array.isArray(parsed?.rows))
        mem = parsed;
    } catch {
      /* no disk cache yet */
    }
  }

  async function writeDisk(entry) {
    try {
      await fsp.mkdir(CACHE_DIR, { recursive: true });
      await fsp.writeFile(CACHE_PATH, JSON.stringify(entry), 'utf8');
    } catch (err) {
      console.warn('[ourairports] cache write failed:', err?.message || err);
    }
  }

  async function load() {
    const signal = AbortSignal.timeout(TIMEOUT_MS);
    const response = await fetchImpl(CSV_URL, {
      signal,
      redirect: 'error',
      headers: {
        Accept: 'text/csv',
        'User-Agent': 'gods-eye-view-ourairports/1.0',
      },
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(`HTTP ${response.status}`);
    }
    const text = await readResponseTextCapped(
      response,
      MAX_RESPONSE_BYTES,
      signal,
    );
    const parsed = parseOurAirportsCsv(text);
    if (!parsed) throw new Error('invalid_csv');
    const rows = normalizeOurAirportsSnapshot({ rows: parsed });
    if (!rows) throw new Error('invalid_snapshot');
    const entry = { fetchedAt: now(), rows, count: rows.length };
    mem = entry;
    await writeDisk(entry);
    return entry;
  }

  return {
    name: 'ourairports-proxy',
    configureServer(server) {
      server.middlewares.use('/api/ourairports', async (req, res) => {
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
          await readDiskOnce();
          if (mem && now() - mem.fetchedAt < CACHE_MS) {
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('X-Feed-Source', 'OurAirports');
            res.end(JSON.stringify(mem));
            return;
          }
          try {
            const { promise } = coalesceProxyRequest(
              inFlight,
              'ourairports',
              load,
            );
            const body = await promise;
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('X-Feed-Source', 'OurAirports');
            res.end(JSON.stringify(body));
          } catch (error) {
            if (mem?.rows) {
              console.warn(
                '[ourairports] refresh failed — serving cache:',
                error?.message || error,
              );
              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.setHeader('X-Feed-Source', 'OurAirports');
              res.setHeader('X-Feed-Stale', '1');
              res.end(JSON.stringify({ ...mem, stale: true }));
              return;
            }
            throw error;
          }
        } catch (error) {
          console.warn('[ourairports]', error?.message || error);
          res.statusCode = 503;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'upstream_unavailable' }));
        }
      });
    },
  };
}
