import { createWmsOverlayLayer } from '../wmsOverlay/createWmsOverlayLayer.js';
export { createEffisSource } from './source.js';

/** European Forest Fire Information System fire-weather index WMS. */
export function createEffisLayer(options) {
  return createWmsOverlayLayer({
    id: 'effis',
    name: 'EFFIS fire weather',
    icon: '♨',
    source: 'EFFIS',
    sourceId: 'effis',
    wmsUrl: 'https://maps.effis.emergency.copernicus.eu/effis',
    layers: 'mf010.fwi',
    alpha: 0.55,
    ...options,
  });
}
