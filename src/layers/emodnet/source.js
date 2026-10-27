import { createWmsCapabilitySource } from '../wmsOverlay/createWmsOverlayLayer.js';

export function createEmodnetSource(options = {}) {
  return createWmsCapabilitySource({
    capabilitiesUrl:
      'https://ows.emodnet-bathymetry.eu/wms?service=WMS&request=GetCapabilities',
    label: 'EMODnet', // i18n-ignore: product name
    ...options,
  });
}
