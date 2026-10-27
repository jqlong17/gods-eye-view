import path from 'node:path';
import { promises as fsp } from 'node:fs';
import { readResponseJsonCapped, coalesceProxyRequest } from './common/http.js';
import { makeRateLimiter, clientKey } from './common/rate-limit.js';
import { normalizeGdacsSnapshot } from '../../src/layers/gdacs/records.js';

const CACHE_MS = 5 * 60_000;
const MAX_RESPONSE_BYTES = 8 * 1024 * 1024;
const TIMEOUT_MS = 30_000;
const CACHE_DIR = path.join(process.cwd(), '.gev-cache');
const CACHE_PATH = path.join(CACHE_DIR, 'gdacs.json');

function searchUrl(nowMs = Date.now()) {
  const to = new Date(nowMs);
  const from = new Date(nowMs - 30 * 24 * 60 * 60_000);
  const iso = (d) => d.toISOString().slice(0, 10);
  return (
    'https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH?' +
    new URLSearchParams({
      fromDate: iso(from),
      toDate: iso(to),
      alertlevel: 'Orange;Red',
      eventlist: 'EQ;TC;FL;VO;DR;WF',
    }).toString()
  );
}

/** GDACS active-alert proxy with memory + disk cache (keyless). */
export function gdacsProxy({
  fetchImpl = (...args) => globalThis.fetch(...args),
  now = () => Date.now(),
} = {}) {
  /** @type {?{fetchedAt: number, rows: Array<object>}} */
  let mem = null;
  let diskChecked = false;
  const inFlight = new Map();
  const allow = makeRateLimiter({ windowMs: 60_000, max: 30, globalMax: 600 });

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
      console.warn('[gdacs] cache write failed:', err?.message || err);
    }
  }

  async function load() {
    const signal = AbortSignal.timeout(TIMEOUT_MS);
    const response = await fetchImpl(searchUrl(now()), {
      signal,
      redirect: 'error',
      headers: {
        Accept: 'application/json',
        'User-Agent': 'gods-eye-view-gdacs/1.0',
      },
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(`HTTP ${response.status}`);
    }
    const payload = await readResponseJsonCapped(
      response,
      MAX_RESPONSE_BYTES,
      signal,
    );
    const rows = normalizeGdacsSnapshot(payload);
    if (!rows) throw new Error('invalid_snapshot');
    const entry = { fetchedAt: now(), rows };
    mem = entry;
    await writeDisk(entry);
    return entry;
  }

  return {
    name: 'gdacs-proxy',
    configureServer(server) {
      server.middlewares.use('/api/gdacs', async (req, res) => {
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
            res.setHeader('X-Feed-Source', 'GDACS');
            res.end(JSON.stringify(mem));
            return;
          }
          try {
            const { promise } = coalesceProxyRequest(inFlight, 'gdacs', load);
            const body = await promise;
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('X-Feed-Source', 'GDACS');
            res.end(JSON.stringify(body));
          } catch (error) {
            if (mem?.rows) {
              console.warn(
                '[gdacs] refresh failed — serving cache:',
                error?.message || error,
              );
              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.setHeader('X-Feed-Source', 'GDACS');
              res.setHeader('X-Feed-Stale', '1');
              res.end(JSON.stringify({ ...mem, stale: true }));
              return;
            }
            throw error;
          }
        } catch (error) {
          console.warn('[gdacs]', error?.message || error);
          res.statusCode = 503;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'upstream_unavailable' }));
        }
      });
    },
  };
}
