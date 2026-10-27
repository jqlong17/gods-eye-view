import { createWmsOverlayLayer } from '../wmsOverlay/createWmsOverlayLayer.js';
export { createGebcoSource } from './source.js';

/** GEBCO latest shaded-relief bathymetry (keyless WMS). */
export function createGebcoLayer(options) {
  return createWmsOverlayLayer({
    id: 'gebco-bathymetry',
    name: 'GEBCO bathymetry',
    icon: '≋',
    source: 'GEBCO WMS',
    sourceId: 'gebco',
    wmsUrl: 'https://wms.gebco.net/mapserv',
    layers: 'GEBCO_LATEST',
    alpha: 0.7,
    ...options,
  });
}
