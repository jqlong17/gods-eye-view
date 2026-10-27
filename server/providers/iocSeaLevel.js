import path from 'node:path';
import { promises as fsp } from 'node:fs';
import { readResponseJsonCapped, coalesceProxyRequest } from './common/http.js';
import { makeRateLimiter, clientKey } from './common/rate-limit.js';
import { normalizeIocSnapshot } from '../../src/layers/iocSeaLevel/records.js';

const URL =
  'https://www.ioc-sealevelmonitoring.org/service.php?query=stationlist&showall=all';
const CACHE_MS = 15 * 60_000;
const MAX_BYTES = 8 * 1024 * 1024;
const CACHE_DIR = path.join(process.cwd(), '.gev-cache');
const CACHE_PATH = path.join(CACHE_DIR, 'ioc-sea-level.json');

export function iocSeaLevelProxy({
  fetchImpl = (...args) => globalThis.fetch(...args),
  now = () => Date.now(),
} = {}) {
  let mem = null;
  let diskChecked = false;
  const inFlight = new Map();
  const allow = makeRateLimiter({ windowMs: 60_000, max: 20, globalMax: 400 });

  async function readDiskOnce() {
    if (diskChecked) return;
    diskChecked = true;
    try {
      const parsed = JSON.parse(await fsp.readFile(CACHE_PATH, 'utf8'));
      if (Number.isFinite(parsed?.fetchedAt) && Array.isArray(parsed?.rows))
        mem = parsed;
    } catch {}
  }

  async function writeDisk(entry) {
    try {
      await fsp.mkdir(CACHE_DIR, { recursive: true });
      await fsp.writeFile(CACHE_PATH, JSON.stringify(entry), 'utf8');
    } catch (err) {
      console.warn('[ioc]', err?.message || err);
    }
  }

  async function load() {
    const signal = AbortSignal.timeout(30_000);
    const response = await fetchImpl(URL, {
      signal,
      redirect: 'error',
      headers: {
        Accept: 'application/json',
        'User-Agent': 'gods-eye-view-ioc/1.0',
      },
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(`HTTP ${response.status}`);
    }
    const payload = await readResponseJsonCapped(response, MAX_BYTES, signal);
    const rows = normalizeIocSnapshot(payload);
    if (!rows) throw new Error('invalid_snapshot');
    mem = { fetchedAt: now(), rows };
    await writeDisk(mem);
    return mem;
  }

  return {
    name: 'ioc-sea-level-proxy',
    configureServer(server) {
      server.middlewares.use('/api/ioc-sea-level', async (req, res) => {
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
          await readDiskOnce();
          if (mem && now() - mem.fetchedAt < CACHE_MS) {
            res.statusCode = 200;
            res.setHeader('X-Feed-Source', 'IOC Sea Level');
            res.end(JSON.stringify(mem));
            return;
          }
          try {
            const { promise } = coalesceProxyRequest(inFlight, 'ioc', load);
            const body = await promise;
            res.statusCode = 200;
            res.setHeader('X-Feed-Source', 'IOC Sea Level');
            res.end(JSON.stringify(body));
          } catch (error) {
            if (mem?.rows) {
              res.statusCode = 200;
              res.setHeader('X-Feed-Source', 'IOC Sea Level');
              res.setHeader('X-Feed-Stale', '1');
              res.end(JSON.stringify({ ...mem, stale: true }));
              return;
            }
            throw error;
          }
        } catch (error) {
          console.warn('[ioc]', error?.message || error);
          res.statusCode = 503;
          res.end(JSON.stringify({ error: 'upstream_unavailable' }));
        }
      });
    },
  };
}
