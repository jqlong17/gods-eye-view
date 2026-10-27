#!/usr/bin/env node
/**
 * Prove keyless/embed boot leaves the init splash when ArcGIS World Imagery
 * metadata never settles. Intercepts services.arcgisonline.com and hangs those
 * requests (including the XYZ tile probe); expects OSM/CARTO constructionFallback
 * within ~20s without CESIUM_ION_TOKEN.
 *
 *   node scripts/qa-esri-boot-timeout.mjs
 *   QA_BASE_URL=http://127.0.0.1:4173 node scripts/qa-esri-boot-timeout.mjs
 *
 * Needs a running preview/dev server (npm run preview or ./scripts/dev-fresh.sh).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const shotsDir =
  process.env.QA_SHOTS_DIR || path.join(repoRoot, 'qa-shots', 'esri-boot-timeout');
const appUrl = process.env.QA_BASE_URL || 'http://127.0.0.1:4173';
const executablePath =
  process.env.PUPPETEER_EXECUTABLE_PATH ||
  (await puppeteer.executablePath().catch(() => null));

if (!executablePath || !fs.existsSync(executablePath)) {
  throw new Error('Puppeteer Chrome for Testing is unavailable');
}
fs.mkdirSync(shotsDir, { recursive: true });

const browser = await puppeteer.launch({
  headless: 'new',
  executablePath,
  protocolTimeout: 120_000,
  args: [
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--use-gl=angle',
    '--use-angle=swiftshader',
  ],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 720 });
const consoleLines = [];
page.on('console', (message) => {
  consoleLines.push(`[${message.type()}] ${message.text()}`);
});

await page.setRequestInterception(true);
let arcgisRequests = 0;
let streetTiles = 0;
page.on('request', (request) => {
  const url = request.url();
  if (url.includes('services.arcgisonline.com')) {
    arcgisRequests += 1;
    // Never continue: hung MapServer/?f=json (and any XYZ probe) is the
    // failure mode that must fall through to the keyless street basemap.
    return;
  }
  if (
    url.includes('basemaps.cartocdn.com') ||
    url.includes('tile.openstreetmap.de') ||
    url.includes('tile.openstreetmap.org')
  ) {
    streetTiles += 1;
  }
  request.continue().catch(() => {});
});

const started = Date.now();
const target = `${appUrl.replace(/\/$/, '')}/?embed=1&welcome=0`;
await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 60_000 });

let leftInit = false;
let settled = null;
for (let i = 0; i < 25; i++) {
  await new Promise((resolve) => setTimeout(resolve, 1_000));
  const snap = await page.evaluate(() => {
    const screen = document.getElementById('loading-screen');
    const ctrl =
      window.__godsEyeView?.mapStackController ||
      window.__godsEyeView?.styleManager?.mapStackController ||
      null;
    return {
      status: screen?.querySelector('.loader-status')?.textContent || null,
      hidden: Boolean(screen?.classList.contains('hidden')),
      active: ctrl?.getActiveId?.() ?? null,
      lastError: ctrl?.getState?.()?.lastError ?? null,
    };
  });
  if (snap.status && !/Initializing systems/i.test(snap.status)) leftInit = true;
  if (leftInit && snap.hidden && snap.active === 'osm' && streetTiles > 0) {
    settled = snap;
    break;
  }
}

const shot = path.join(shotsDir, 'embed-arcgis-hung.png');
await page.screenshot({ path: shot, fullPage: false });
const elapsed = Date.now() - started;
const fallbackLog = consoleLines.some((line) =>
  /Esri Satellite is unavailable; using OSM/i.test(line),
);

const checks = [
  ['left Initializing systems splash', leftInit],
  ['loading-screen hidden', Boolean(settled?.hidden)],
  ['active stack is osm', settled?.active === 'osm'],
  ['keyless street tiles requested (CARTO/OSM)', streetTiles > 0],
  ['ArcGIS was contacted then hung', arcgisRequests >= 1],
  ['MapStack reported Esri→OSM fallback', fallbackLog],
  ['settled within 20s', elapsed <= 20_000],
];

let failed = 0;
for (const [name, passed] of checks) {
  console.log(`  [${passed ? 'PASS' : 'FAIL'}] ${name}`);
  if (!passed) failed += 1;
}
console.log(
  JSON.stringify(
    {
      elapsed,
      arcgisRequests,
      streetTiles,
      settled,
      shot,
      lastError: settled?.lastError ?? null,
    },
    null,
    2,
  ),
);

await browser.close();
if (failed) process.exit(1);
