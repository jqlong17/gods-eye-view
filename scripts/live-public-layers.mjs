#!/usr/bin/env node
/**
 * Live fetch checks for keyless public DATA LAYERS (batch 1 + batch 2).
 *
 * Hits real upstream endpoints from this machine. Fails the process if a
 * keyless source returns an unexpected error / empty failure. Registration-
 * required stubs are asserted UNAVAILABLE (503 no_key) without claiming data.
 *
 * Usage: node scripts/live-public-layers.mjs
 */
import assert from 'node:assert/strict';
import { openMeteoSamplePoints } from '../server/providers/openMeteo.js';
import { normalizeOpenMeteoSnapshot } from '../src/layers/openMeteo/records.js';
import { normalizeGdacsSnapshot } from '../src/layers/gdacs/records.js';
import {
  normalizeOurAirportsSnapshot,
  parseOurAirportsCsv,
} from '../src/layers/ourairports/records.js';
import { normalizeMetarSnapshot } from '../src/layers/aviationMetar/records.js';
import { normalizeIocSnapshot } from '../src/layers/iocSeaLevel/records.js';
import { normalizeArgoSnapshot } from '../src/layers/argo/records.js';
import { normalizeAuroraSnapshot } from '../src/layers/swpcAurora/records.js';

const results = [];

function record(name, ok, detail) {
  results.push({ name, ok, detail });
  const mark = ok ? 'PASS' : 'FAIL';
  console.log(`${mark}  ${name}: ${detail}`);
}

async function fetchJson(url, { headers = {}, timeoutMs = 45_000 } = {}) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(timeoutMs),
    redirect: 'error',
    headers: {
      Accept: 'application/json',
      'User-Agent': 'gods-eye-view-live-public-layers/1.0',
      ...headers,
    },
  });
  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* leave null */
  }
  return { response, text, json };
}

async function fetchBytes(url, { timeoutMs = 45_000, headers = {} } = {}) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(timeoutMs),
    redirect: 'error',
    headers: {
      'User-Agent': 'gods-eye-view-live-public-layers/1.0',
      ...headers,
    },
  });
  const buffer = Buffer.from(await response.arrayBuffer());
  return { response, buffer };
}

async function checkOpenMeteo() {
  const points = openMeteoSamplePoints({
    west: -74.5,
    south: 40.4,
    east: -73.5,
    north: 41.0,
  });
  assert.ok(points?.length);
  const latitudes = points.map((p) => p.lat).join(',');
  const longitudes = points.map((p) => p.lon).join(',');
  const url =
    'https://api.open-meteo.com/v1/forecast?' +
    new URLSearchParams({
      latitude: latitudes,
      longitude: longitudes,
      current: 'temperature_2m,weather_code,wind_speed_10m',
      timezone: 'UTC',
    });
  const { response, json } = await fetchJson(url);
  assert.equal(response.status, 200);
  const rows = normalizeOpenMeteoSnapshot(json, points);
  assert.ok(rows?.length);
  record(
    'Open-Meteo',
    true,
    `${rows.length} samples; e.g. ${rows[0].label} @ ${rows[0].lat},${rows[0].lon}`,
  );
}

async function checkGdacs() {
  const to = new Date();
  const from = new Date(Date.now() - 30 * 24 * 60 * 60_000);
  const iso = (d) => d.toISOString().slice(0, 10);
  const url =
    'https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH?' +
    new URLSearchParams({
      fromDate: iso(from),
      toDate: iso(to),
      alertlevel: 'Orange;Red',
      eventlist: 'EQ;TC;FL;VO;DR;WF',
    });
  const { response, json } = await fetchJson(url, { timeoutMs: 60_000 });
  assert.equal(response.status, 200);
  const rows = normalizeGdacsSnapshot(json);
  assert.ok(rows?.length);
  record(
    'GDACS',
    true,
    `${rows.length} events; e.g. ${rows[0].label}`,
  );
}

async function checkOurAirports() {
  const { response, buffer } = await fetchBytes(
    'https://davidmegginson.github.io/ourairports-data/airports.csv',
    { timeoutMs: 90_000 },
  );
  assert.equal(response.status, 200);
  const parsed = parseOurAirportsCsv(buffer.toString('utf8'));
  assert.ok(parsed?.length);
  const rows = normalizeOurAirportsSnapshot({ rows: parsed });
  assert.ok(rows?.length);
  record(
    'OurAirports',
    true,
    `${rows.length} large/scheduled airports; e.g. ${rows[0].label}`,
  );
}

async function checkGebco() {
  const { response, buffer } = await fetchBytes(
    'https://wms.gebco.net/mapserv?service=WMS&version=1.3.0&request=GetMap&layers=GEBCO_LATEST&styles=&format=image/png&transparent=true&crs=EPSG:4326&bbox=-90,-180,90,180&width=512&height=256',
    { timeoutMs: 60_000 },
  );
  assert.equal(response.status, 200);
  assert.ok(buffer.length > 1000);
  assert.equal(buffer.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  record('GEBCO', true, `GetMap PNG ${buffer.length} bytes (GEBCO_LATEST)`);
}

async function checkRainViewer() {
  const { response, json } = await fetchJson(
    'https://api.rainviewer.com/public/weather-maps.json',
  );
  assert.equal(response.status, 200);
  const past = json?.radar?.past;
  assert.ok(Array.isArray(past) && past.length);
  const frame = past[past.length - 1];
  const tileUrl = `${String(json.host).replace(/\/$/, '')}${frame.path}/256/3/4/2/2/1_1.png`;
  const tile = await fetchBytes(tileUrl);
  assert.equal(tile.response.status, 200);
  assert.ok(tile.buffer.length > 100);
  record(
    'RainViewer',
    true,
    `maps ok; latest path ${frame.path}; tile ${tile.buffer.length} bytes`,
  );
}

async function checkEffis() {
  const { response, buffer } = await fetchBytes(
    'https://maps.effis.emergency.copernicus.eu/effis?service=WMS&version=1.3.0&request=GetMap&layers=mf010.fwi&styles=&format=image/png&transparent=true&crs=EPSG:4326&bbox=35,-10,70,40&width=512&height=512',
    { timeoutMs: 60_000 },
  );
  assert.equal(response.status, 200);
  assert.equal(buffer.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  record('EFFIS', true, `FWI GetMap PNG ${buffer.length} bytes`);
}

async function checkAviationMetar() {
  const { response, json } = await fetchJson(
    'https://aviationweather.gov/api/data/metar?bbox=40,-75,42,-73&format=json',
  );
  assert.equal(response.status, 200);
  const rows = normalizeMetarSnapshot(json);
  assert.ok(rows?.length);
  record(
    'Aviation METAR',
    true,
    `${rows.length} METARs; e.g. ${rows[0].label}`,
  );
}

async function checkArgo() {
  const { response, json } = await fetchJson(
    'https://erddap.ifremer.fr/erddap/tabledap/ArgoFloats.json?platform_number%2Clatitude%2Clongitude%2Ctime&time%3E=now-7days&distinct()',
    { timeoutMs: 90_000 },
  );
  assert.equal(response.status, 200);
  const rows = normalizeArgoSnapshot(json);
  assert.ok(rows?.length);
  record('Argo', true, `${rows.length} floats (7d); e.g. ${rows[0].label}`);
}

async function checkIoc() {
  const { response, json } = await fetchJson(
    'https://www.ioc-sealevelmonitoring.org/service.php?query=stationlist&showall=all',
    { timeoutMs: 60_000 },
  );
  assert.equal(response.status, 200);
  const rows = normalizeIocSnapshot(json);
  assert.ok(rows?.length);
  record(
    'IOC sea level',
    true,
    `${rows.length} gauges; e.g. ${rows[0].label}`,
  );
}

async function checkSwpc() {
  const { response, json } = await fetchJson(
    'https://services.swpc.noaa.gov/json/ovation_aurora_latest.json',
    { timeoutMs: 60_000 },
  );
  assert.equal(response.status, 200);
  const rows = normalizeAuroraSnapshot(json);
  assert.ok(rows?.length);
  record(
    'SWPC aurora',
    true,
    `${rows.length} elevated cells; forecast ${json?.['Forecast Time'] || '?'}`,
  );
}

async function checkEmodnet() {
  const { response, buffer } = await fetchBytes(
    'https://ows.emodnet-bathymetry.eu/wms?service=WMS&version=1.3.0&request=GetMap&layers=mean_atlas_land&styles=&format=image/png&transparent=true&crs=EPSG:4326&bbox=30,-20,70,20&width=512&height=512',
    { timeoutMs: 60_000 },
  );
  assert.equal(response.status, 200);
  assert.equal(buffer.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  record('EMODnet', true, `mean_atlas_land PNG ${buffer.length} bytes`);
}

async function checkEtopo() {
  const { response, buffer } = await fetchBytes(
    'https://gis.ngdc.noaa.gov/arcgis/rest/services/DEM_mosaics/DEM_global_mosaic_hillshade/ImageServer/exportImage?bbox=-40,20,-20,40&bboxSR=4326&imageSR=4326&size=512,512&format=png32&f=image',
    { timeoutMs: 60_000 },
  );
  assert.equal(response.status, 200);
  assert.equal(buffer.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  record('ETOPO', true, `hillshade exportImage PNG ${buffer.length} bytes`);
}

async function checkOpenAqStub() {
  const { response, json } = await fetchJson(
    'https://api.openaq.org/v3/locations?limit=1',
  );
  assert.equal(response.status, 401);
  assert.match(String(json?.message || ''), /API key|Unauthorized/i);
  record(
    'OpenAQ (stub)',
    true,
    `upstream requires key (HTTP ${response.status}) — layer stays UNAVAILABLE without OPENAQ_API_KEY`,
  );
}

async function checkAdsbxStub() {
  const { response, text } = await fetchJson(
    'https://adsbexchange.com/api/aircraft/json/',
  );
  assert.equal(response.status, 200);
  assert.match(text, /NO_AUTH/);
  record(
    'ADS-B Exchange (stub)',
    true,
    'public endpoint returns NO_AUTH — layer UNAVAILABLE without ADSBX_API_KEY',
  );
}

async function checkGfwStub() {
  const { response } = await fetchJson(
    'https://gateway.api.globalfishingwatch.org/v3/events',
    { timeoutMs: 30_000 },
  );
  assert.ok(response.status === 401 || response.status === 403);
  record(
    'Global Fishing Watch (stub)',
    true,
    `HTTP ${response.status} without bearer — layer UNAVAILABLE without GFW_API_TOKEN`,
  );
}

async function checkWorldCoverStub() {
  // Terrascope WMS has been unreachable from this environment; assert the
  // documented failure mode rather than claiming a working keyless feed.
  let status = 0;
  try {
    const { response } = await fetchBytes(
      'https://services.terrascope.be/wms/v2?service=WMS&request=GetCapabilities',
      { timeoutMs: 20_000 },
    );
    status = response.status;
  } catch (error) {
    status = 0;
    record(
      'ESA WorldCover (stub)',
      true,
      `Terrascope WMS unreachable (${error?.cause?.code || error?.message || 'error'}) — layer UNAVAILABLE`,
    );
    return;
  }
  if (status >= 200 && status < 300) {
    record(
      'ESA WorldCover (stub)',
      false,
      `Terrascope unexpectedly reachable (HTTP ${status}); promote to a real layer`,
    );
    return;
  }
  record(
    'ESA WorldCover (stub)',
    true,
    `Terrascope WMS HTTP ${status} — layer UNAVAILABLE`,
  );
}

async function checkGpsjamStub() {
  const { response } = await fetchBytes('https://gpsjam.org/data.json', {
    timeoutMs: 20_000,
  });
  assert.ok(response.status === 404 || response.status >= 400);
  record(
    'GPSJAM (stub)',
    true,
    `no public JSON (HTTP ${response.status}) — layer UNAVAILABLE; use GNSS Integrity`,
  );
}

const checks = [
  checkOpenMeteo,
  checkGdacs,
  checkOurAirports,
  checkGebco,
  checkRainViewer,
  checkEffis,
  checkAviationMetar,
  checkArgo,
  checkIoc,
  checkSwpc,
  checkEmodnet,
  checkEtopo,
  checkOpenAqStub,
  checkAdsbxStub,
  checkGfwStub,
  checkWorldCoverStub,
  checkGpsjamStub,
];

let failed = 0;
for (const check of checks) {
  try {
    await check();
  } catch (error) {
    failed += 1;
    record(check.name.replace(/^check/, ''), false, error?.stack || String(error));
  }
}

console.log('\n--- summary ---');
for (const row of results) {
  console.log(`${row.ok ? 'PASS' : 'FAIL'}\t${row.name}\t${row.detail}`);
}
if (failed || results.some((row) => !row.ok)) {
  process.exitCode = 1;
}
