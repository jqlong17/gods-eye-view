import * as Cesium from 'cesium';
import {
  disposeProvider,
  raceProviderConstruction,
} from './providerConstruction.js';

// Attribution and service rights are documented in DATA_SOURCES.md.
export const ESRI_ATTRIBUTION_HTML =
  '<a href="https://www.esri.com" target="_blank" rel="noopener">Powered by Esri</a>';

/**
 * ArcGIS World Imagery metadata (`MapServer/?f=json`) has no Cesium-side
 * timeout. Through some egress paths the request hangs forever, which would
 * leave the boot splash on "Initializing systems..." because construction
 * fallback only runs after the factory rejects. Bound the wait so the
 * existing Esri → OSM constructionFallback can settle the globe.
 */
export const ESRI_IMAGERY_TIMEOUT_MS = 8_000;

/** How long to wait on one World Imagery XYZ probe after metadata fails. */
export const ESRI_TILE_PROBE_TIMEOUT_MS = 3_000;

export const ESRI_WORLD_IMAGERY_URL =
  'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer';

/** Stable XYZ template (z/y/x) when MapServer metadata never arrives. */
export const ESRI_WORLD_IMAGERY_TILE_URL = `${ESRI_WORLD_IMAGERY_URL}/tile/{z}/{y}/{x}`;

export const ESRI_WORLD_IMAGERY_CREDIT =
  'Powered by Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community';

/**
 * Official tile.openstreetmap.org is unreachable or blocked on some networks
 * (notably parts of CN). FOSSGIS's tile.openstreetmap.de mirror serves the
 * same slippy scheme with real map content and CORS, keyless.
 *
 * CARTO Voyager (`basemaps.cartocdn.com`) often answers HTTP 200 from CN but
 * can return near-blank cream tiles from some egress paths — do not prefer it
 * as the painted basemap without a content probe.
 */
export const KEYLESS_STREET_TILE_BASE = 'https://tile.openstreetmap.de/';

export const KEYLESS_STREET_TILE_URL = `${KEYLESS_STREET_TILE_BASE}{z}/{x}/{y}.png`;

export const KEYLESS_STREET_CREDIT =
  '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors';

/** Documented alternate CDN (verify tile content — HTTP 200 alone is not enough). */
export const KEYLESS_STREET_FALLBACK_TILE_URL =
  'https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png';

export function createOsmImagery() {
  return new Cesium.OpenStreetMapImageryProvider({
    url: KEYLESS_STREET_TILE_BASE,
    credit: KEYLESS_STREET_CREDIT,
  });
}

/**
 * World Imagery without waiting on MapServer/?f=json. Tile order is z/y/x.
 */
export function createEsriTileTemplateImagery() {
  return new Cesium.UrlTemplateImageryProvider({
    url: ESRI_WORLD_IMAGERY_TILE_URL,
    credit: ESRI_WORLD_IMAGERY_CREDIT,
    maximumLevel: 23,
    enablePickFeatures: false,
  });
}

function isAbortError(error) {
  return error?.name === 'AbortError';
}

/**
 * Confirm one World Imagery XYZ tile answers before committing to the
 * template provider. A hung or failed probe leaves constructionFallback free
 * to take OSM (tile.openstreetmap.de).
 * @param {{ signal?: AbortSignal, timeoutMs?: number }} [options]
 */
export async function probeEsriWorldImageryTile({
  signal,
  timeoutMs = ESRI_TILE_PROBE_TIMEOUT_MS,
} = {}) {
  signal?.throwIfAborted();
  const probe = AbortSignal.any([
    AbortSignal.timeout(Math.max(0, Number(timeoutMs) || 0)),
    ...(signal ? [signal] : []),
  ]);
  try {
    const response = await fetch(`${ESRI_WORLD_IMAGERY_URL}/tile/0/0/0`, {
      method: 'GET',
      mode: 'cors',
      signal: probe,
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Build Esri World Imagery, or reject when metadata/tiles never arrive.
 * @param {{
 *   signal?: AbortSignal,
 *   timeoutMs?: number,
 *   tileProbeTimeoutMs?: number,
 *   probeTile?: typeof probeEsriWorldImageryTile,
 * }} [options]
 */
export async function createEsriImagery({
  signal,
  timeoutMs = ESRI_IMAGERY_TIMEOUT_MS,
  tileProbeTimeoutMs = ESRI_TILE_PROBE_TIMEOUT_MS,
  probeTile = probeEsriWorldImageryTile,
} = {}) {
  signal?.throwIfAborted();
  const pending = Cesium.ArcGisMapServerImageryProvider.fromUrl(
    ESRI_WORLD_IMAGERY_URL,
    {
      credit: ESRI_WORLD_IMAGERY_CREDIT,
      enablePickFeatures: false,
    },
  );
  try {
    return await raceProviderConstruction(pending, {
      signal,
      timeoutMs,
      label: 'Esri World Imagery metadata',
    });
  } catch (error) {
    // A late fromUrl success must not leak a live provider after fallback.
    void Promise.resolve(pending).then(disposeProvider, () => {});
    if (isAbortError(error) || signal?.aborted) throw error;
    // Metadata hang/fail is common on some egress paths while XYZ tiles still
    // answer. Probe one tile; if it works, keep satellite. Otherwise reject so
    // the existing Esri → OSM constructionFallback (osm.de) can settle.
    // `probeTile` is injectable so unit tests never hit the live ArcGIS CDN.
    const tilesOk = await probeTile({
      signal,
      timeoutMs: tileProbeTimeoutMs,
    });
    if (signal?.aborted) {
      throw signal.reason ?? new DOMException('Aborted', 'AbortError');
    }
    if (tilesOk) return createEsriTileTemplateImagery();
    throw error;
  }
}

export function createIonImagery(style, accessToken) {
  accessToken = String(accessToken || '').trim();
  if (!accessToken) throw new Error('Ion imagery requires an explicit token');
  if (
    style === Cesium.IonWorldImageryStyle.AERIAL ||
    style === Cesium.IonWorldImageryStyle.AERIAL_WITH_LABELS
  ) {
    return createBingIonImagery(style, accessToken);
  }
  return Cesium.IonImageryProvider.fromAssetId(style, { accessToken });
}

async function createBingIonImagery(style, accessToken) {
  const endpoint = await new Cesium.Resource({
    url: `https://api.cesium.com/v1/assets/${style}/endpoint`,
    queryParameters: { access_token: accessToken },
  }).fetchJson();
  if (
    endpoint?.type !== 'IMAGERY' ||
    endpoint.externalType !== 'BING' ||
    typeof endpoint.options?.url !== 'string'
  ) {
    throw new Error('Ion world imagery did not return a Bing imagery endpoint');
  }
  // Bing otherwise follows the page's HTTP scheme on localhost. Resolve its
  // ion-issued credentials through public APIs so tiles use HTTPS without
  // weakening CSP, changing SDK defaults or touching provider internals.
  const { url, ...options } = endpoint.options;
  const provider = await Cesium.BingMapsImageryProvider.fromUrl(url, {
    ...options,
    tileProtocol: 'https',
  });
  const ionCredits = (endpoint.attributions ?? []).map(
    ({ html, collapsible }) => new Cesium.Credit(html, collapsible === false),
  );
  const getTileCredits = provider.getTileCredits.bind(provider);
  provider.getTileCredits = (x, y, level) => [
    ...ionCredits,
    ...(getTileCredits(x, y, level) ?? []),
  ];
  return provider;
}
