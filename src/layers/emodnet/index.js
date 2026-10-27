import { createWmsOverlayLayer } from '../wmsOverlay/createWmsOverlayLayer.js';
export { createEmodnetSource } from './source.js';

/** EMODnet mean bathymetry atlas (Europe-focused, global extent service). */
export function createEmodnetLayer(options) {
  return createWmsOverlayLayer({
    id: 'emodnet-bathymetry',
    name: 'EMODnet bathymetry',
    icon: '≋',
    source: 'EMODnet',
    sourceId: 'emodnet',
    wmsUrl: 'https://ows.emodnet-bathymetry.eu/wms',
    layers: 'mean_atlas_land',
    alpha: 0.65,
    ...options,
  });
}
