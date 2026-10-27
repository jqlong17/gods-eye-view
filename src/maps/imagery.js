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

export const ESRI_WORLD_IMAGERY_URL =
  'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer';

export function createOsmImagery() {
  return new Cesium.OpenStreetMapImageryProvider({
    url: 'https://tile.openstreetmap.org/',
    credit: '© OpenStreetMap contributors',
  });
}

/**
 * Build Esri World Imagery, or reject when metadata/tiles never arrive.
 * @param {{ signal?: AbortSignal, timeoutMs?: number }} [options]
 */
export async function createEsriImagery({
  signal,
  timeoutMs = ESRI_IMAGERY_TIMEOUT_MS,
} = {}) {
  signal?.throwIfAborted();
  const pending = Cesium.ArcGisMapServerImageryProvider.fromUrl(
    ESRI_WORLD_IMAGERY_URL,
    {
      credit:
        'Powered by Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community',
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
